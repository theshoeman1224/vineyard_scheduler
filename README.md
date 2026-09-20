# House Scheduler

A small scheduling site for a shared house: ~12 people pick dates on a
calendar, choose a room (list view or clickable floorplan/blueprint), and
submit a request. All requests are visible to everyone (pending + confirmed).
The admin receives each request by email and approves/denies it with a link
in that email, or manages everything in a password-protected admin panel.

## Features

- Multi-date calendar selection (dates = nights)
- **Multi-room requests**: select several rooms at once for large parties —
  one submission covers all of them, the admin email has one Approve-all /
  Deny-all pair, and the withdraw link removes the whole submission
- Rooms with configurable bed counts; each confirmed request occupies one bed
  of its room per night
- Calendar markers reflect the selected rooms: pick one room to see just its
  activity, pick several (or none) for the combined view — booked days take
  priority over requested
- Blueprint image with clickable room hotspots colored by availability
- Everyone sees all ongoing requests and their dates
- Requests email the admin with **Approve / Deny** buttons (signed links that
  never expire; the links open a confirmation page first; rooms without free
  beds stay pending with a clear explanation)
- Requesters get an email on decisions/edits if they leave their address
- Every submitter gets a private "withdraw my request" link (removes all
  rooms of the submission)
- Admin panel (`/admin`): approve/deny, edit any request after the fact
  (name, room, dates, status, note), delete, manage rooms, upload the
  blueprint and draw room hotspots
- Overlapping requests are allowed; on approve the admin is told which dates
  (if any) no longer have free beds — admin decides who wins

## Stack

Next.js (App Router) · TypeScript · Tailwind · Postgres (Neon) with
Drizzle ORM · Resend for email · Vitest for unit tests.

## Services

Three hosted services back the app. Each one has a single job:

| Service | What it does here |
| --- | --- |
| **Cloudflare Workers** | Hosts the site (custom domain `beachroad.casa`). The Next.js app is packaged for Workers with `opennextjs-cloudflare`: `npm run deploy` builds and publishes, `npm run preview` runs the worker locally. Production secrets live on the worker, managed with `wrangler secret put` (see *Managing secrets*). |
| **Neon** | Managed Postgres and the app's only data store: rooms, requests, requested dates, and the uploaded blueprint image. The app connects with the pooled connection string from `DATABASE_URL` and queries it through Drizzle ORM (`npm run db:push` applies schema changes). The repo vendors a `pg-cloudflare` shim so the `pg` driver can reach Postgres over WebSockets from inside a Worker. |
| **Resend** | Transactional email. It sends every message the app produces: the admin notification with signed Approve/Deny links, decision and edit notices to requesters, and withdrawal confirmations. Email is optional: with no `RESEND_API_KEY` the site works normally and only email is skipped (`emailQueued: false`). |

Everything else (calendar, availability math, admin panel) runs entirely in
the app itself with no service dependency.

## Local development

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL + SIGNING_SECRET + ADMIN_PASSWORD
npm run db:push        # create tables
npm run seed           # optional starter rooms
npm run dev
```

Tests / checks:

```bash
npm test        # unit tests (pure logic: dates, availability, tokens, validation, emails)
npm run typecheck
npm run lint
npm run build
```

For local testing you can skip email by leaving `RESEND_API_KEY` empty —
requests still work (`emailQueued: false`), and decisions can be made in the
admin panel.

## Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `SIGNING_SECRET` | Long random string; signs email action links + admin cookie |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `ADMIN_EMAIL` | Where request notifications are sent |
| `RESEND_API_KEY` | Resend API key (empty = emails disabled) |
| `EMAIL_FROM` | Verified Resend sender, e.g. `House Scheduler <scheduler@yourdomain.com>` |
| `APP_URL` | Public base URL used in email links |

## Managing secrets

Secrets are never stored in the repo.

- **Local dev** — `.env` (gitignored). Edit it and restart `npm run dev`.
- **Production (Cloudflare Workers)** — stored with wrangler, changed any
  time with:

  ```bash
  echo "<new value>" | npx wrangler secret put ADMIN_PASSWORD --name vineyard-scheduler
  npx wrangler secret list --name vineyard-scheduler   # verify
  ```

  Replace `ADMIN_PASSWORD` with any var above. Values cannot be read back,
  only overwritten. Each `secret put` publishes a new worker version
  immediately — no redeploy needed.

- **Email (Resend)** — for a guided walkthrough (Resend account, domain
  verification, API key, storing on the worker, live verification) run:

  ```bash
  ./scripts/setup-resend.sh
  ```

## Deploying

1. Create a **Postgres** database (e.g. Neon) → copy the pooled connection
   string into `DATABASE_URL`.
2. Create a **Resend** account → verify your sending domain → create an API key.
3. Set the secrets on the worker (see *Managing secrets* above, including
   `DATABASE_URL`; `APP_URL` = `https://beachroad.casa`).
4. Deploy with:

   ```bash
   npm run deploy   # builds and deploys via opennextjs-cloudflare
   ```
5. Push the schema to the production database once (locally, with the prod
   `DATABASE_URL` exported): `npm run db:push`, then `npm run seed` for the
   template rooms.
6. Sign in at `/admin` with `ADMIN_PASSWORD`, upload the blueprint image,
   create rooms, and drag a hotspot rectangle over each room.

## Data model

- `rooms` — name, bed count, display order, hotspot rectangle (x/y/w/h as % of blueprint)
- `requests` — name, optional email, room, status (`pending`/`confirmed`/`denied`), note, `group_id` (rows from one multi-room submission share it), private `cancel_token` (shared per group)
- `request_dates` — one row per requested night per request
- `blueprint` — single row holding the uploaded floorplan image

Approvals re-check capacity inside a transaction that locks the room row, so
two admins approving simultaneously cannot overbook a room.
