# Code Audit — open items

Date: 2026-10-21
Scope: data layer, API routes, client components, and their alignment with
`AGENTS.md` / `README.md`.

This file tracks **open** findings only. When an item is fixed, its entry is
removed in the same commit as the fix; `git log -- AUDIT.md` is the history.

---

## Misalignments with AGENTS.md / README

- **`db/index.ts` pool comment is inaccurate.** It assumes the previous
  request has finished when its pool is retired; one isolate serves
  overlapping requests.

## Database

- **Per-request pool churn on Workers.** Overlapping requests retire each
  other's pools, so most requests open a fresh connection. Consider
  Hyperdrive or Neon's serverless driver.
- **Blueprint served `no-store`.** Up to ~4MB of base64 is read and decoded
  on every view; use a versioned URL with long-lived caching.

## Frontend

- **Blueprint not refreshed after upload.** Same image URL, so the admin
  editor keeps showing the old image.
- **Polish.** Geist font loaded but overridden by `body { font-family: Arial }`;
  toggles lack `aria-pressed`; calendar state is color-only; `StatusPill`
  has no dark variants; no `error.tsx`.

## Open questions for the owner

- **Who applies migrations to production, and should CI do it?** The repo
  now has committed migrations (`drizzle/`), but nothing runs them in
  production. The prod database was created with the old `db:push`, so it
  needs a one-time `npm run db:baseline` then `npm run db:migrate` (with
  the prod `DATABASE_URL` exported) to pick up `0001_constraints`: CHECKs
  on beds, hotspot ranges, and the single blueprint row, plus a primary key
  on `request_dates`. The deployed code does not depend on those
  constraints, so deploying first is safe. Running `db:migrate` in the
  deploy workflow would need `DATABASE_URL` as a GitHub secret. I left
  that for you to decide.

## Decisions made while you were away

- **Submit rate limit raised to 20 per 15 min per IP** (was 5), counted
  only after validation, so a household sharing one router does not lock
  itself out.
- **Public request list shows current requests only** (pending/confirmed
  with a night from yesterday on) and never includes notes. Admins still
  see everything.
- **Lowering a room's beds below its confirmed bookings is refused** (409
  naming the first overbooked night) rather than allowed with a warning.
- **Availability is one 400-day window** shared by the page, the refresh,
  the API default, the calendar's last selectable day, and request
  validation.
