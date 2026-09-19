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
