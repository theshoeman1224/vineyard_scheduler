# Code Audit — open items

Date: 2026-10-21
Scope: data layer, API routes, client components, and their alignment with
`AGENTS.md` / `README.md`.

This file tracks **open** findings only. When an item is fixed, its entry is
removed in the same commit as the fix; `git log -- AUDIT.md` is the history.

---

## Misalignments with AGENTS.md / README

- **Bed reduction bypasses capacity.** Lowering a room's beds below its
  confirmed bookings is not checked; `free = max(0, …)` hides the overbooking.
- **`db/index.ts` pool comment is inaccurate.** It assumes the previous
  request has finished when its pool is retired; one isolate serves
  overlapping requests.

## Database

- **No migrations.** Schema changes go to production via `db:push`;
  `drizzle/` is not committed.
- **Unbounded `/api/availability` range.** Huge ranges exceed Postgres's
  65,535 bind-parameter limit (500) and are a cheap DoS. Cap the range and
  query with `BETWEEN` instead of `IN (…)`.
- **Per-request pool churn on Workers.** Overlapping requests retire each
  other's pools, so most requests open a fresh connection. Consider
  Hyperdrive or Neon's serverless driver.
- **Lock-order deadlock risk.** `decideGroup` locks rooms in request-id
  order, not room-id order.
- **Missing constraints.** No CHECKs for `beds >= 0`, hotspot ranges, or the
  `blueprint.id = 1` singleton; `request_dates` has no primary key.
- **Unhandled constraint errors.** Duplicate room names and the
  `deleteRoom` check-then-delete race surface as raw 500s; public 500s echo
  the database error message.
- **Blueprint served `no-store`.** Up to ~4MB of base64 is read and decoded
  on every view; use a versioned URL with long-lived caching.

## Frontend

- **Availability window shrinks after refresh.** Initial load covers 400
  days; `refresh()` uses the API default of 120. Dates outside the loaded
  window show "full" in the list and "free" on the blueprint. The calendar
  has no end bound.
- **Shared-IP rate limit.** A household behind one router shares 5
  submissions / 15 min, and failed validations count against it.
- **Blueprint not refreshed after upload.** Same image URL, so the admin
  editor keeps showing the old image.
- **Polish.** Geist font loaded but overridden by `body { font-family: Arial }`;
  toggles lack `aria-pressed`; calendar state is color-only; `StatusPill`
  has no dark variants; no `error.tsx`.
