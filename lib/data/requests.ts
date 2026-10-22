import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { requestDates, requests, rooms, type RequestStatus } from "@/db/schema";
import { randomToken, randomUUID, type DecideAction } from "@/lib/tokens";
import { sortUniqueDates } from "@/lib/dates";
import { planGroupDecision, type GroupDecisionRoomResult } from "./decision";
import {
  baseRequestQuery,
  attachDates,
  type RequestWithDetails,
} from "./shared";
import { capacityConflicts, confirmedCountsOutsideGroup, firstFullDate } from "./capacity";

export type DecideResult =
  | { ok: true }
  | { ok: false; error: string };

export type { GroupDecisionRoomResult } from "./decision";

export async function getRequestsAll(): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await baseRequestQuery(db).orderBy(
    sql`${requests.createdAt} DESC, ${requests.id} DESC`,
  );
  return attachDates(rows);
}

// The public "current requests" list: pending or confirmed requests with at
// least one night on or after `fromDate`. Denied and fully past requests
// stay out of the public payload (and the home page's load) as history
// grows; the admin panel still reads everything via getRequestsAll.
export async function getRequestsCurrent(
  fromDate: string,
): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await baseRequestQuery(db)
    .where(
      and(
        inArray(requests.status, ["pending", "confirmed"]),
        sql`exists (select 1 from ${requestDates} rd
                    where rd.request_id = ${requests.id} and rd.date >= ${fromDate})`,
      ),
    )
    .orderBy(sql`${requests.createdAt} DESC, ${requests.id} DESC`);
  return attachDates(rows);
}

export async function getRequestById(id: number): Promise<RequestWithDetails | null> {
  const db = getDb();
  const rows = await baseRequestQuery(db).where(eq(requests.id, id));
  const withDates = await attachDates(rows);
  return withDates[0] ?? null;
}

export async function getGroupRequests(groupId: string): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await baseRequestQuery(db)
    .where(eq(requests.groupId, groupId))
    .orderBy(asc(requests.id));
  return attachDates(rows);
}

// The group (all rooms of one submission) a cancel token belongs to.
// Every row of a group shares the token, so this is a subquery rather
// than an anchor lookup followed by a second query.
function groupIdForToken(token: string) {
  return getDb()
    .select({ groupId: requests.groupId })
    .from(requests)
    .where(eq(requests.cancelToken, token));
}

// All rows of the group that a cancel token belongs to (the submission may
// cover several rooms), with dates: two queries in total.
export async function getGroupByCancelToken(
  token: string,
): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await baseRequestQuery(db)
    .where(inArray(requests.groupId, groupIdForToken(token)))
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
    for (const roomId of input.roomIds) {
      const inserted = await tx
        .insert(requests)
        .values({
          name: input.name,
          email: input.email,
          roomId,
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

// Approve/deny a whole submission group in one transaction.
//
// Lock order is rooms (ascending id) then request rows — the same order
// as updateRequestAsAdmin (room, then its request), so concurrent
// decisions and edits serialize instead of deadlocking. Room locks are
// only needed for approvals (capacity); a deny touches request rows only.
// With the locks held, dates and other groups' confirmed counts are read
// in two queries, planGroupDecision decides every row, and the changes
// are written as at most two batch updates.
export async function decideGroup(
  groupId: string,
  action: DecideAction,
): Promise<GroupDecisionRoomResult[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    if (action === "approve") {
      await tx.execute(sql`
        SELECT id FROM ${rooms}
        WHERE id IN (SELECT room_id FROM ${requests} WHERE group_id = ${groupId})
        ORDER BY id
        FOR UPDATE`);
    }

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
      .orderBy(asc(requests.id))
      .for("update", { of: requests });
    if (rows.length === 0) return [];

    const dateRows = await tx
      .select({ requestId: requestDates.requestId, date: requestDates.date })
      .from(requestDates)
      .where(inArray(requestDates.requestId, rows.map((r) => r.id)));
    const datesById = new Map<number, string[]>();
    for (const d of dateRows) {
      datesById.set(d.requestId, [...(datesById.get(d.requestId) ?? []), d.date]);
    }

    const otherConfirmed =
      action === "approve" ? await confirmedCountsOutsideGroup(tx, groupId) : new Map();
    const results = planGroupDecision(
      rows.map((r) => ({ ...r, dates: sortUniqueDates(datesById.get(r.id) ?? []) })),
      action,
      otherConfirmed,
    );

    const changedIds = results.filter((r) => r.changed).map((r) => r.requestId);
    if (changedIds.length > 0) {
      await tx
        .update(requests)
        .set({ status: action === "approve" ? "confirmed" : "denied", updatedAt: new Date() })
        .where(inArray(requests.id, changedIds));
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
// submission group (all rooms requested together) in one statement.
// Returns false when nothing matched (already withdrawn or removed).
export async function cancelByToken(token: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(requests)
    .where(inArray(requests.groupId, groupIdForToken(token)))
    .returning({ id: requests.id });
  return deleted.length > 0;
}
