import { eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { requestDates, requests, rooms, type RequestStatus } from "@/db/schema";
import { sortUniqueDates } from "@/lib/dates";

// The transaction handle handed to db.transaction callbacks.
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// A request joined with its room name, plus its dates attached.
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

// Column list shared by every request query so all readers return the
// same shape. `roomName` comes from the joined rooms table.
export const REQUEST_COLUMNS = {
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
} as const;

// One row as returned by baseRequestQuery (before dates are attached).
export type RequestRow = Awaited<ReturnType<typeof baseRequestQuery>>[number];

// Every request joined with its room; callers add where/orderBy clauses.
export function baseRequestQuery(db: Db) {
  return db
    .select(REQUEST_COLUMNS)
    .from(requests)
    .innerJoin(rooms, eq(rooms.id, requests.roomId));
}

// Attaches each request's sorted date list, fetched in one query for the
// whole batch.
export async function attachDates(
  rows: RequestRow[],
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
  return rows.map((r) => ({
    ...r,
    dates: sortUniqueDates(byRequest.get(r.id) ?? []),
  }));
}
