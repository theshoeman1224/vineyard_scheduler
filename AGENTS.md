<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Architecture seams

- The data layer is `lib/data/`, split by domain (rooms, availability,
  requests, blueprint) behind the barrel `lib/data/index.ts`. All app code
  imports through `@/lib/data` so the barrel keeps working as the seam.
  `shared.ts` owns the request column list, `baseRequestQuery()`,
  `attachDates()`, and the `Tx` type. `capacity.ts` owns bed-capacity
  checking; it is race-safe only because callers lock the room row
  (`FOR UPDATE`) before counting confirmed bookings. Preserve that order.
- Client components never call `fetch()` directly. They use
  `app/lib/apiClient.ts` (`apiGet`, `apiSend`, `apiSendForm`), which
  resolves every call to an `ApiResult` with a consistent error string.
- The client-facing request row is typed once as `RequestPublic`
  (`app/lib/requestTypes.ts`), mapped from full rows with
  `toPublicRequest()`, and never carries `cancelToken`/`groupId`.
- Shared UI primitives already exist: `Notice` (banners), `Field` +
  `inputClass` (form fields), `StatusPill`, `app/lib/roomText` (room and
  bed labels), `app/lib/tokenPage` (the HTML pages behind email links).
  Reuse them rather than creating new copies.
- Input limits (`MAX_NAME_LENGTH`, `MAX_NOTE_LENGTH`,
  `MAX_ROOM_NAME_LENGTH`, `MAX_BEDS`) live in `lib/validation.ts` beside
  the zod schemas. HTML `maxLength`/`max` attributes must use those
  constants so browser and server limits cannot drift.

# Policies

- Email is fire-and-forget: notification sites call `trySendEmail`
  (`lib/mailer.ts`). A mailer failure must never fail a response after
  the database change has committed.
- Tests are pure-logic only (vitest, no database). Extract pure helpers
  out of DB-touching modules so they can be tested, and give new pure
  helpers tests.
- Before every commit, run `npm run test`, `typecheck`, `lint`, and
  `build` and get all four green. Commits go straight to `main`, one
  commit per coherent unit of work.
- Comments explain why: put one at the top of large functions and
  modules, covering the non-obvious constraints (locks, error policy,
  why a value is derived rather than hardcoded).
