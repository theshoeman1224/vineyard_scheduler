# Code Audit — open items

Date: 2026-10-21
Scope: data layer, API routes, client components, and their alignment with
`AGENTS.md` / `README.md`.

This file tracks **open** findings only. When an item is fixed, its entry is
removed in the same commit as the fix; `git log -- AUDIT.md` is the history.

---

## Bugs affecting users

- **Editing a room wipes its hotspot.** The room edit form omits the
  hotspot fields and `upsertRoom` turns missing fields into `null`.
  (`app/components/admin/RoomsAdmin.tsx`, `lib/data/rooms.ts`)

## Misalignments with AGENTS.md / README

- **Email has no shared length limit.** No `MAX_EMAIL_LENGTH` constant; the
  public schema has no limit, the admin schema hardcodes 120 without a shape
  check, and neither email input sets `maxLength`.
- **Bed reduction bypasses capacity.** Lowering a room's beds below its
  confirmed bookings is not checked; `free = max(0, …)` hides the overbooking.
- **`localeCompare` on dates.** `RequestsTable.tsx` sorts dates with
  `localeCompare`, which `lib/dates.ts` documents as unsafe; use
  `compareDateStr`.
- **`db/index.ts` pool comment is inaccurate.** It assumes the previous
  request has finished when its pool is retired; one isolate serves
  overlapping requests.
- **`.env.example` is stale.** Mentions Vercel and misdescribes `ADMIN_EMAIL`.

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
- **Inefficient reads.** `getRequestById` loads the whole table (twice per
  admin PATCH); withdrawal runs ~7 queries; the home page loads all request
  history.
- **Blueprint served `no-store`.** Up to ~4MB of base64 is read and decoded
  on every view; use a versioned URL with long-lived caching.

## Frontend

- **Availability window shrinks after refresh.** Initial load covers 400
  days; `refresh()` uses the API default of 120. Dates outside the loaded
  window show "full" in the list and "free" on the blueprint. The calendar
  has no end bound.
- **Timezone mismatch.** The client's "today" is local; the server validates
  against UTC (Workers), rejecting "today" for US evening users.
- **Notes are public.** `RequestPublic` includes `note`, though the form
  presents it as admin-facing.
- **Shared-IP rate limit.** A household behind one router shares 5
  submissions / 15 min, and failed validations count against it.
- **Blueprint not refreshed after upload.** Same image URL, so the admin
  editor keeps showing the old image.
- **"Current requests" shows all history**, oldest first.
- **Polish.** Geist font loaded but overridden by `body { font-family: Arial }`;
  toggles lack `aria-pressed`; calendar state is color-only; `StatusPill`
  has no dark variants; no `error.tsx`.
