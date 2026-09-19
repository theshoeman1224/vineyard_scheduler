import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { requestDates, requests, rooms, type RequestStatus } from "@/db/schema";
import { randomToken, randomUUID } from "@/lib/tokens";
import {
  baseRequestQuery,
  attachDates,
  type RequestWithDetails,
  type Tx,
} from "./shared";
import { capacityConflicts, firstFullDate } from "./capacity";

export type DecideResult =
  | { ok: true }
  | { ok: false; error: string };

export type GroupDecisionRoomResult = {
  roomId: number;
  roomName: string;
  requestId: number;
  ok: boolean;
  error?: string;
};

export async function getRequestsAll(): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await baseRequestQuery(db).orderBy(
    sql`${requests.createdAt} DESC, ${requests.id} DESC`,
  );
  return attachDates(rows);
}

export async function getRequestById(id: number): Promise<RequestWithDetails | null> {
  const all = await getRequestsAll();
  return all.find((r) => r.id === id) ?? null;
}

export async function getGroupRequests(groupId: string): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await baseRequestQuery(db)
    .where(eq(requests.groupId, groupId))
    .orderBy(asc(requests.id));
  return attachDates(rows);
}

export async function getRequestByCancelToken(
  token: string,
): Promise<RequestWithDetails | null> {
  const db = getDb();
  const rows = await baseRequestQuery(db).where(eq(requests.cancelToken, token));
  const withDates = await attachDates(rows);
  return withDates[0] ?? null;
}

// All rows of the group that a cancel token belongs to (the submission may
// cover several rooms).
export async function getGroupByCancelToken(
  token: string,
): Promise<RequestWithDetails[]> {
  const anchor = await getRequestByCancelToken(token);
  if (!anchor) return [];
  const db = getDb();
  const rows = await baseRequestQuery(db)
    .where(eq(requests.groupId, anchor.groupId))
    .orderBy(asc(requests.id));
  return attachDates(rows);
}

// Creates one request row per room, all sharing a group id and cancel
// token so they can be decided or withdrawn together.
export async function createRequest(
  input: {
    name: string;
    email: string | null;
    roomIds: number[];
    dates: string[];
    note: string | null;
  },
): Promise<{ groupId: string; ids: number[]; cancelToken: string }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const groupId = randomUUID();
    const cancelToken = randomToken();
    const ids: number[] = [];
    const dateRows: { requestId: number; date: string }[] = [];
    for (let i = 0; i < input.roomIds.length; i++) {
      const inserted = await tx
        .insert(requests)
        .values({
          name: input.name,
          email: input.email,
          roomId: input.roomIds[i],
          note: input.note,
          cancelToken,
          groupId,
          status: "pending",
        })
        .returning({ id: requests.id });
      const id = inserted[0].id;
      ids.push(id);
      for (const d of input.dates) {
        dateRows.push({ requestId: id, date: d });
      }
    }
    await tx.insert(requestDates).values(dateRows);
    return { groupId, ids, cancelToken };
  });
}

// Approve/deny a whole submission group. Each room is confirmed
// independently with a race-safe capacity re-check (locking its room row);
// a room that no longer has beds stays untouched and is reported.
export async function decideGroup(
  groupId: string,
  action: "approve" | "deny",
): Promise<GroupDecisionRoomResult[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: requests.id,
        roomId: requests.roomId,
        roomName: rooms.name,
        status: requests.status,
        beds: rooms.beds,
      })
      .from(requests)
      .innerJoin(rooms, eq(rooms.id, requests.roomId))
      .where(eq(requests.groupId, groupId))
      .orderBy(asc(requests.id));

    if (rows.length === 0) return [];

    const results: GroupDecisionRoomResult[] = [];

    for (const req of rows) {
      if (req.status === "denied") {
        results.push({ roomId: req.roomId, roomName: req.roomName, requestId: req.id, ok: true });
        continue;
      }

      if (action === "deny") {
        if (req.status === "pending") {
          await tx
            .update(requests)
            .set({ status: "denied", updatedAt: new Date() })
            .where(eq(requests.id, req.id));
        }
        results.push({ roomId: req.roomId, roomName: req.roomName, requestId: req.id, ok: true });
        continue;
      }

      // approve — already-confirmed rooms are a no-op success.
      if (req.status === "confirmed") {
        results.push({ roomId: req.roomId, roomName: req.roomName, requestId: req.id, ok: true });
        continue;
      }

      // Lock the room row to serialize concurrent approvals for this room.
      await tx.execute(sql`SELECT id FROM rooms WHERE id = ${req.roomId} FOR UPDATE`);

      const reqDates = await tx
        .select({ date: requestDates.date })
        .from(requestDates)
        .where(eq(requestDates.requestId, req.id));
      const dateList = reqDates.map((r) => r.date);
      const conflicts = await capacityConflicts(tx, req.roomId, req.id, dateList);
      const full = firstFullDate(dateList, conflicts, req.beds);

      if (full) {
        results.push({
          roomId: req.roomId,
          roomName: req.roomName,
          requestId: req.id,
          ok: false,
          error: `No beds left in ${req.roomName} on ${full}`,
        });
        continue;
      }

      await tx
        .update(requests)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(eq(requests.id, req.id));
      results.push({ roomId: req.roomId, roomName: req.roomName, requestId: req.id, ok: true });
    }

    return results;
  });
}

// Admin edit: change name/email/room/dates/note/status. The whole update is
// atomic; if the capacity check fails, nothing is changed.
export async function updateRequestAsAdmin(
  requestId: number,
  edit: {
    name: string;
    email: string | null;
    roomId: number;
    status: RequestStatus;
    dates: string[];
    note: string | null;
  },
): Promise<DecideResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: requests.id })
      .from(requests)
      .where(eq(requests.id, requestId));
    if (!existing[0]) return { ok: false as const, error: `Request #${requestId} not found` };

    // Lock the room row first to serialize concurrent capacity checks.
    await tx.execute(sql`SELECT id FROM rooms WHERE id = ${edit.roomId} FOR UPDATE`);

    if (edit.status === "confirmed") {
      const roomRows = await tx
        .select({ beds: rooms.beds })
        .from(rooms)
        .where(eq(rooms.id, edit.roomId));
      const beds = roomRows[0]?.beds ?? 0;

      const conflicts = await capacityConflicts(tx, edit.roomId, requestId, edit.dates);
      const full = firstFullDate(edit.dates, conflicts, beds);
      if (full) {
        const used = conflicts.get(full) ?? 0;
        return {
          ok: false as const,
          error: `No beds left in this room on ${full} (${used}/${beds} taken).`,
        };
      }
    }

    await tx
      .update(requests)
      .set({
        name: edit.name,
        email: edit.email,
        roomId: edit.roomId,
        status: edit.status,
        note: edit.note,
        updatedAt: new Date(),
      })
      .where(eq(requests.id, requestId));

    await tx.delete(requestDates).where(eq(requestDates.requestId, requestId));
    if (edit.dates.length > 0) {
      await tx
        .insert(requestDates)
        .values(edit.dates.map((d) => ({ requestId, date: d })));
    }

    return { ok: true as const };
  });
}

export async function deleteRequestAsAdmin(requestId: number): Promise<void> {
  const db = getDb();
  await db.delete(requests).where(eq(requests.id, requestId));
}

// User withdrew their request via their private link — removes the whole
// submission group (all rooms requested together).
export async function cancelByToken(token: string): Promise<boolean> {
  const db = getDb();
  const anchor = await getRequestByCancelToken(token);
  if (!anchor) return false;
  await db.delete(requests).where(eq(requests.groupId, anchor.groupId));
  return true;
}

// Re-exported so single-source-of-truth stays with the domain module.
export type { Tx };
