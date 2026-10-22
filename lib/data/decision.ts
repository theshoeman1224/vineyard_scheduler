import type { RequestStatus } from "@/db/schema";
import type { DecideAction } from "@/lib/tokens";
import { firstFullDate } from "./capacity";

// Pure rules for applying an email-link decision ("Approve all" /
// "Deny all") to one row of a submission group. Kept free of database
// imports so the rules can be unit-tested.
//
// Decision links never expire, so an old link can be clicked after the
// admin already decided a row differently in the panel. Those rows are
// left alone and reported as conflicts, never silently flipped and never
// reported as if the link's action had been applied.

export type RowDecision =
  | { kind: "unchanged" } // already in the state the action asks for
  | { kind: "conflict"; error: string } // already decided the other way
  | { kind: "deny" } // pending → denied
  | { kind: "approve" }; // pending → confirmed, after a capacity check

export function planRowDecision(
  status: RequestStatus,
  action: DecideAction,
): RowDecision {
  const target: RequestStatus = action === "approve" ? "confirmed" : "denied";
  if (status === target) return { kind: "unchanged" };
  if (status !== "pending") {
    return {
      kind: "conflict",
      error: `Already ${status} — change it in the admin panel`,
    };
  }
  return action === "approve" ? { kind: "approve" } : { kind: "deny" };
}

// The requester is emailed only when the click actually changed a row, so
// re-clicking a link (or clicking one for an already-decided group) does
// not send duplicate notices.
export function shouldNotifyRequester(results: { changed: boolean }[]): boolean {
  return results.some((r) => r.changed);
}

// One row of a group decision's outcome.
// `ok`: the row ended in the state the action asked for.
// `changed`: this call updated the row (drives requester notification).
// `status`: the row's status after the call.
export type GroupDecisionRoomResult = {
  roomId: number;
  roomName: string;
  requestId: number;
  ok: boolean;
  changed: boolean;
  status: RequestStatus;
  error?: string;
};

export type GroupRow = {
  id: number;
  roomId: number;
  roomName: string;
  status: RequestStatus;
  beds: number;
  dates: string[];
};

// roomId -> date -> confirmed bookings
export type RoomDateCounts = Map<number, Map<string, number>>;

function countsFor(counts: RoomDateCounts, roomId: number): Map<string, number> {
  let m = counts.get(roomId);
  if (!m) {
    m = new Map();
    counts.set(roomId, m);
  }
  return m;
}

// Plans a whole "Approve all" / "Deny all" click. `otherConfirmed` counts
// confirmed bookings from OTHER groups (the caller holds the room locks,
// so the counts stay valid). Rows are processed in id order, and the
// group's own confirmed rows — already confirmed or approved earlier in
// this same plan — take beds too, exactly as approving one row at a time
// would. A row whose room has no free bed on some night stays pending.
export function planGroupDecision(
  rows: GroupRow[],
  action: DecideAction,
  otherConfirmed: RoomDateCounts,
): GroupDecisionRoomResult[] {
  const counts: RoomDateCounts = new Map(
    [...otherConfirmed].map(([room, m]) => [room, new Map(m)]),
  );
  const take = (row: GroupRow) => {
    const m = countsFor(counts, row.roomId);
    for (const d of row.dates) m.set(d, (m.get(d) ?? 0) + 1);
  };
  for (const row of rows) {
    if (row.status === "confirmed") take(row);
  }

  return rows.map((row) => {
    const base = { roomId: row.roomId, roomName: row.roomName, requestId: row.id };
    const plan = planRowDecision(row.status, action);
    switch (plan.kind) {
      case "unchanged":
        return { ...base, ok: true, changed: false, status: row.status };
      case "conflict":
        return { ...base, ok: false, changed: false, status: row.status, error: plan.error };
      case "deny":
        return { ...base, ok: true, changed: true, status: "denied" };
      case "approve": {
        const full = firstFullDate(row.dates, countsFor(counts, row.roomId), row.beds);
        if (full) {
          return {
            ...base,
            ok: false,
            changed: false,
            status: row.status,
            error: `No beds left in ${row.roomName} on ${full}`,
          };
        }
        take(row);
        return { ...base, ok: true, changed: true, status: "confirmed" };
      }
    }
  });
}
