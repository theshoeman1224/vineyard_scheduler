# Code Audit — open items

Date: 2026-10-21
Scope: data layer, API routes, client components, and their alignment with
`AGENTS.md` / `README.md`.

This file tracks **open** findings only. When an item is fixed, its entry is
removed in the same commit as the fix; `git log -- AUDIT.md` is the history.

---

All audit findings are fixed. What remains below needs a decision from
you, or was deliberately left as is.

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

- **Hyperdrive (or Neon's serverless driver) for database connections?**
  Pools are now kept per request and retired only when idle, so
  overlapping requests no longer close each other's connections. But every
  request still opens a new TCP+TLS connection to Neon, because Workers
  cannot keep sockets between requests. Cloudflare Hyperdrive keeps warm
  connections at the edge and would remove that setup cost (typically
  the largest part of a page's database time). It needs a Hyperdrive
  config in your Cloudflare account and a `wrangler.jsonc` binding, so I
  did not set it up.

## SonarCloud issues left open on purpose

- **`typescript:S9379` — `autoFocus` on the admin password field
  (`app/admin/login/page.tsx`).** The rule targets forms where focus jumps
  past content a screen-reader user hasn't heard yet. The admin login page
  has a heading, one sentence, and a single password field, so focusing
  it is the expected behavior (as on most sign-in pages), and removing it
  only adds a click for you. Mark it "Accepted" in SonarCloud if you
  agree, or tell me to remove it.

## Decisions made while you were away

- **Submit rate limit raised to 20 per 15 min per IP** (was 5), counted
  only after validation, so a household sharing one router does not lock
  itself out.
- **Public request list shows current requests only** (pending/confirmed
  with a night from yesterday on) and never includes notes. Admins still
  see everything.
- **Lowering a room's beds below its confirmed bookings is refused** (409
  naming the first overbooked night) rather than allowed with a warning.
- **Kept the Arial look and removed the Geist web font.** Geist was
  downloaded on every visit but never shown (body text overrode it).
  Switching to Geist would change how the whole site looks, so I kept what
  you see today.
- **Availability is one 400-day window** shared by the page, the refresh,
  the API default, the calendar's last selectable day, and request
  validation.
