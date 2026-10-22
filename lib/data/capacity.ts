import { sql } from "drizzle-orm";
import { requestDates, requests } from "@/db/schema";
import type { Tx } from "./shared";

// First date whose confirmed bookings already fill the room's beds, or
// null when every requested date still has space. Pure so the capacity
// boundary can be tested without a database.
export function firstFullDate(
  dates: string[],
  conflicts: Map<string, number>,
  beds: number,
): string | null {
  for (const d of dates) {
    if ((conflicts.get(d) ?? 0) >= beds) return d;
  }
  return null;
}

// First night (earliest) whose confirmed bookings exceed `beds`, or null.
// Used when an admin lowers a room's bed count: the new count must still
// hold every confirmed booking. Pure so the boundary can be tested.
export function firstOverbookedNight(
  counts: Map<string, number>,
  beds: number,
): { date: string; count: number } | null {
  const over = [...counts]
    .filter(([, count]) => count > beds)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return over[0] ? { date: over[0][0], count: over[0][1] } : null;
}

// Confirmed bookings per night for one room, from `fromDate` on (past
// nights cannot be overbooked any more). Callers must lock the room row.
export async function confirmedCountsFrom(
  tx: Tx,
  roomId: number,
  fromDate: string,
): Promise<Map<string, number>> {
  const rows = await tx.execute(sql`
    SELECT rd.date, COUNT(*)::int AS cnt
    FROM ${requestDates} rd
    JOIN ${requests} r ON r.id = rd.request_id
    WHERE r.status = 'confirmed'
      AND r.room_id = ${roomId}
      AND rd.date >= ${fromDate}
    GROUP BY rd.date
  `);
  const counts = new Map<string, number>();
  for (const row of rows.rows as { date: string; cnt: number }[]) {
    counts.set(row.date, Number(row.cnt));
  }
  return counts;
}

// Counts confirmed bookings per date for one room, excluding the request
// being approved or edited (its own rows must not count against it).
// Callers must lock the room row first so concurrent approvals serialize
// and the count stays valid until the transaction commits.
export async function capacityConflicts(
  tx: Tx,
  roomId: number,
  excludeRequestId: number,
  dates: string[],
): Promise<Map<string, number>> {
  if (dates.length === 0) return new Map();
  const rows = await tx.execute(sql`
    SELECT rd.date, COUNT(*)::int AS cnt
    FROM ${requestDates} rd
    JOIN ${requests} r ON r.id = rd.request_id
    WHERE r.status = 'confirmed'
      AND r.room_id = ${roomId}
      AND r.id <> ${excludeRequestId}
      AND rd.date IN (${sql.join(
        dates.map((d) => sql`${d}`),
        sql`, `,
      )})
    GROUP BY rd.date
  `);
  const conflicts = new Map<string, number>();
  for (const row of rows.rows as { date: string; cnt: number }[]) {
    conflicts.set(row.date, Number(row.cnt));
  }
  return conflicts;
}

// Confirmed bookings per room per night from requests OUTSIDE the group,
// limited to the group's rooms and nights: everything planGroupDecision
// needs, in one query. Callers must hold the group's room locks.
export async function confirmedCountsOutsideGroup(
  tx: Tx,
  groupId: string,
): Promise<Map<number, Map<string, number>>> {
  const rows = await tx.execute(sql`
    SELECT r.room_id, rd.date, COUNT(*)::int AS cnt
    FROM ${requestDates} rd
    JOIN ${requests} r ON r.id = rd.request_id
    WHERE r.status = 'confirmed'
      AND r.group_id <> ${groupId}
      AND r.room_id IN (SELECT room_id FROM ${requests} WHERE group_id = ${groupId})
      AND rd.date IN (
        SELECT gd.date FROM ${requestDates} gd
        JOIN ${requests} g ON g.id = gd.request_id
        WHERE g.group_id = ${groupId}
      )
    GROUP BY r.room_id, rd.date
  `);
  const counts = new Map<number, Map<string, number>>();
  for (const row of rows.rows as { room_id: number; date: string; cnt: number }[]) {
    let m = counts.get(Number(row.room_id));
    if (!m) {
      m = new Map();
      counts.set(Number(row.room_id), m);
    }
    m.set(row.date, Number(row.cnt));
  }
  return counts;
}
