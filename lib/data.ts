import {
  and,
  asc,
  eq,
  inArray,
  ne,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  blueprint,
  requestDates,
  requests,
  rooms,
  type RequestStatus,
} from "@/db/schema";
import {
  computeAvailability,
  type AvailabilityMap,
  type RoomInfo,
} from "@/lib/availability";
import { dateRange, sortUniqueDates } from "@/lib/dates";
import { randomToken, randomUUID } from "@/lib/tokens";

export type RequestWithDetails = {
  id: number;
  name: string;
  email: string | null;
  roomId: number;
  roomName: string;
  status: RequestStatus;
  note: string | null;
  groupId: string;
  cancelToken: string;
  createdAt: Date;
  updatedAt: Date;
  dates: string[];
};

export async function getRooms(): Promise<RoomInfo[]> {
  const db = getDb();
  const rows = await db.select().from(rooms).orderBy(asc(rooms.displayOrder), asc(rooms.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    beds: r.beds,
    displayOrder: r.displayOrder,
    hotspotX: r.hotspotX,
    hotspotY: r.hotspotY,
    hotspotW: r.hotspotW,
    hotspotH: r.hotspotH,
  }));
}

export async function getRoomById(id: number): Promise<RoomInfo | null> {
  const all = await getRooms();
  return all.find((r) => r.id === id) ?? null;
}

// Returns bookings (pending/confirmed) that touch any of the given dates.
async function getBookingsForDates(dates: string[]) {
  const db = getDb();
  if (dates.length === 0) return [];
  const rows = await db
    .select({
      requestId: requests.id,
      roomId: requests.roomId,
      status: requests.status,
      date: requestDates.date,
    })
    .from(requestDates)
    .innerJoin(requests, eq(requests.id, requestDates.requestId))
    .where(
      and(
        inArray(requestDates.date, dates),
        inArray(requests.status, ["pending", "confirmed"]),
      ),
    );

  const grouped = new Map<number, { roomId: number; status: RequestStatus; dates: string[] }>();
  for (const row of rows) {
    let b = grouped.get(row.requestId);
    if (!b) {
      b = { roomId: row.roomId, status: row.status, dates: [] };
      grouped.set(row.requestId, b);
    }
    b.dates.push(row.date);
  }
  return [...grouped.values()];
}

export function availabilityFromBookings(
  roomList: RoomInfo[],
  bookings: { roomId: number; status: RequestStatus; dates: string[] }[],
  dates: string[],
): AvailabilityMap {
  return computeAvailability(
    roomList,
    bookings.map((b) => ({
      roomId: b.roomId,
      status: b.status === "confirmed" ? ("confirmed" as const) : ("pending" as const),
      dates: b.dates,
    })),
    dates,
  );
}

export async function getAvailabilityRange(
  start: string,
  end: string,
): Promise<AvailabilityMap> {
  const roomList = await getRooms();
  const dates = dateRange(start, end);
  if (dates.length === 0) return {};
  const bookings = await getBookingsForDates(dates);
  return availabilityFromBookings(roomList, bookings, dates);
}

export async function getAvailabilityForDates(
  dates: string[],
): Promise<AvailabilityMap> {
  const roomList = await getRooms();
  const bookings = await getBookingsForDates(dates);
  return availabilityFromBookings(roomList, bookings, dates);
}

async function attachDates(
  rows: {
    id: number;
    name: string;
    email: string | null;
    roomId: number;
    roomName: string;
    status: RequestStatus;
    note: string | null;
    groupId: string;
    cancelToken: string;
    createdAt: Date;
    updatedAt: Date;
  }[],
): Promise<RequestWithDetails[]> {
  const db = getDb();
  if (rows.length === 0) return [];
  const dateRows = await db
    .select({ requestId: requestDates.requestId, date: requestDates.date })
    .from(requestDates)
    .where(inArray(requestDates.requestId, rows.map((r) => r.id)));
  const byRequest = new Map<number, string[]>();
  for (const d of dateRows) {
    const list = byRequest.get(d.requestId) ?? [];
    list.push(d.date);
    byRequest.set(d.requestId, list);
  }
  return rows.map((r) => ({ ...r, dates: sortUniqueDates(byRequest.get(r.id) ?? []) }));
}

export async function getRequestsAll(): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: requests.id,
      name: requests.name,
      email: requests.email,
      roomId: requests.roomId,
      roomName: rooms.name,
      status: requests.status,
      note: requests.note,
      groupId: requests.groupId,
      cancelToken: requests.cancelToken,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .innerJoin(rooms, eq(rooms.id, requests.roomId))
    .orderBy(sql`${requests.createdAt} DESC, ${requests.id} DESC`);
  return attachDates(rows);
}

export async function getRequestById(id: number): Promise<RequestWithDetails | null> {
  const all = await getRequestsAll();
  return all.find((r) => r.id === id) ?? null;
}

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

      // approve
      if (req.status === "confirmed") {
        results.push({ roomId: req.roomId, roomName: req.roomName, requestId: req.id, ok: true });
        continue;
      }

      // Lock the room row to serialize concurrent approvals for this room.
      await tx.execute(sql`SELECT id FROM rooms WHERE id = ${req.roomId} FOR UPDATE`);

      const conflictRows = await tx.execute(sql`
        SELECT rd.date, COUNT(*)::int AS cnt
        FROM ${requestDates} rd
        JOIN ${requests} r ON r.id = rd.request_id
        WHERE r.status = 'confirmed'
          AND r.room_id = ${req.roomId}
          AND r.id <> ${req.id}
          AND rd.date IN (SELECT date FROM ${requestDates} WHERE request_id = ${req.id})
        GROUP BY rd.date
      `);
      const conflicts = new Map<string, number>();
      for (const row of conflictRows.rows as { date: string; cnt: number }[]) {
        conflicts.set(row.date, Number(row.cnt));
      }

      const reqDates = await tx
        .select({ date: requestDates.date })
        .from(requestDates)
        .where(eq(requestDates.requestId, req.id));

      let full: string | null = null;
      for (const d of reqDates) {
        const used = conflicts.get(d.date) ?? 0;
        if (used >= req.beds) {
          full = d.date;
          break;
        }
      }

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

      const conflictRows = await tx.execute(sql`
        SELECT rd.date, COUNT(*)::int AS cnt
        FROM ${requestDates} rd
        JOIN ${requests} r ON r.id = rd.request_id
        WHERE r.status = 'confirmed'
          AND r.room_id = ${edit.roomId}
          AND r.id <> ${requestId}
          AND rd.date IN (${sql.join(
            edit.dates.map((d) => sql`${d}`),
            sql`, `,
          )})
        GROUP BY rd.date
      `);
      const conflicts = new Map<string, number>();
      for (const row of conflictRows.rows as { date: string; cnt: number }[]) {
        conflicts.set(row.date, Number(row.cnt));
      }
      for (const d of edit.dates) {
        const used = conflicts.get(d) ?? 0;
        if (used >= beds) {
          return {
            ok: false as const,
            error: `No beds left in this room on ${d} (${used}/${beds} taken).`,
          };
        }
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

export async function getGroupRequests(groupId: string): Promise<RequestWithDetails[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: requests.id,
      name: requests.name,
      email: requests.email,
      roomId: requests.roomId,
      roomName: rooms.name,
      status: requests.status,
      note: requests.note,
      groupId: requests.groupId,
      cancelToken: requests.cancelToken,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .innerJoin(rooms, eq(rooms.id, requests.roomId))
    .where(eq(requests.groupId, groupId))
    .orderBy(asc(requests.id));
  return attachDates(rows);
}

export async function getRequestByCancelToken(
  token: string,
): Promise<RequestWithDetails | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: requests.id,
      name: requests.name,
      email: requests.email,
      roomId: requests.roomId,
      roomName: rooms.name,
      status: requests.status,
      note: requests.note,
      groupId: requests.groupId,
      cancelToken: requests.cancelToken,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .innerJoin(rooms, eq(rooms.id, requests.roomId))
    .where(eq(requests.cancelToken, token));
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
  const rows = await db
    .select({
      id: requests.id,
      name: requests.name,
      email: requests.email,
      roomId: requests.roomId,
      roomName: rooms.name,
      status: requests.status,
      note: requests.note,
      groupId: requests.groupId,
      cancelToken: requests.cancelToken,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .innerJoin(rooms, eq(rooms.id, requests.roomId))
    .where(eq(requests.groupId, anchor.groupId))
    .orderBy(asc(requests.id));
  return attachDates(rows);
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

// --- Rooms & blueprint ----------------------------------------------------

export async function upsertRoom(input: {
  id?: number;
  name: string;
  beds: number;
  displayOrder: number;
  hotspotX?: number | null;
  hotspotY?: number | null;
  hotspotW?: number | null;
  hotspotH?: number | null;
}): Promise<void> {
  const db = getDb();
  const values = {
    name: input.name,
    beds: input.beds,
    displayOrder: input.displayOrder,
    hotspotX: input.hotspotX ?? null,
    hotspotY: input.hotspotY ?? null,
    hotspotW: input.hotspotW ?? null,
    hotspotH: input.hotspotH ?? null,
  };
  if (input.id) {
    await db.update(rooms).set(values).where(eq(rooms.id, input.id));
  } else {
    await db.insert(rooms).values(values);
  }
}

export async function deleteRoom(roomId: number): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const used = await db
    .select({ id: requests.id })
    .from(requests)
    .where(eq(requests.roomId, roomId))
    .limit(1);
  if (used[0]) {
    return { ok: false, error: "Room has requests — remove or reassign them first." };
  }
  await db.delete(rooms).where(eq(rooms.id, roomId));
  return { ok: true };
}

export async function getBlueprintRow() {
  const db = getDb();
  const rows = await db.select().from(blueprint).where(eq(blueprint.id, 1));
  return rows[0] ?? null;
}

export async function saveBlueprint(mimeType: string, dataBase64: string) {
  const db = getDb();
  await db
    .insert(blueprint)
    .values({ id: 1, mimeType, dataBase64 })
    .onConflictDoUpdate({
      target: blueprint.id,
      set: { mimeType, dataBase64, updatedAt: new Date() },
    });
}

export async function countRequestsInDateStatuses(
  roomId: number,
  status: RequestStatus,
  excludeRequestId: number,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: requests.id })
    .from(requests)
    .where(
      and(
        eq(requests.roomId, roomId),
        eq(requests.status, status),
        ne(requests.id, excludeRequestId),
      ),
    );
  return rows.length;
}

