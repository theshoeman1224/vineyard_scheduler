import type { RequestStatus } from "@/db/schema";
import type { DecideAction } from "@/lib/tokens";

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
