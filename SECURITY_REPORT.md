# Security Review — vineyard_scheduler

Date: 2026-09-19
Scope: full repo (app/, lib/, db/, scripts/, tests/, config), git history, and build artifacts.

**Status: all code findings below have been fixed** (2026-09-19, see §3).
Remaining actions are operational (secret rotation, Cloudflare WAF rate
limits at the edge).

---

## Executive summary

No hardcoded secrets are committed to the repository or its git history. The
`.env` file contains live-looking secrets but is properly gitignored and has
never been committed. The core crypto (HMAC-signed tokens, timing-safe
comparisons) is done well.

The main issues are **stored XSS in the token-driven HTML pages** (requester
names are interpolated into HTML without escaping), **unauthenticated exposure
of requester emails** via `GET /api/requests`, and **missing rate limiting /
security headers**.

---

## 1. Secrets audit

### ✅ Clean

| Check | Result |
|---|---|
| `.env` tracked in git? | No — gitignored, `git log --all` shows it was never committed |
| Secrets in git history (all 20 commits)? | None found (`git grep` across all revs) |
| Secrets in tracked source? | None — all secret access goes through `process.env` via `lib/env.ts` |
| `NEXT_PUBLIC_*` leaks? | None used |
| Real API keys (`re_…`, `sk-…`, AWS, etc.) anywhere in tree? | None found |
| `wrangler.jsonc` / `.dev.vars` | No secrets; `.dev.vars*` gitignored |

### ⚠️ Notes

- **`.env` on disk contains live-looking secrets** (`SIGNING_SECRET`,
  `ADMIN_PASSWORD`, local DB password). This is fine for a
  local dev file, but:
  - Confirm production secrets for the Cloudflare deployment are set via
    `wrangler secret put` / dashboard, never copied into tracked files.
  - The `.env` `ADMIN_PASSWORD` and `SIGNING_SECRET` should not be reused in
    production. If they were ever used in prod, rotate them.
- `.env.example` correctly uses placeholders. Good.

---

## 2. Vulnerabilities & attack vectors

### 🔴 HIGH — Stored XSS via requester-controlled fields in token pages

`app/lib/tokenPage.ts` and the routes that use it build HTML by string
interpolation **without HTML-escaping**. `lib/emails.ts` has an `esc()`
helper, but `tokenPage.ts`, `app/api/decide/[token]/route.ts`, and
`app/api/cancel/[token]/route.ts` do not use it.

Affected sinks (values come from the public request form — `name` is
attacker-controlled up to 80 chars; `roomName` is admin-set):

- `app/api/decide/[token]/route.ts:108` — `<p><strong>${name}</strong>` on the
  GET confirm page. **The victim here is the admin**, who opens the email link
  and sees the requester-supplied name before approving.
- `app/api/decide/[token]/route.ts:62-72` — `roomName` interpolated into the
  POST result page.
- `app/api/cancel/[token]/route.ts:18,58` — `group[0].name` interpolated.
- `app/lib/tokenPage.ts:51` (`roomSummaryList`) — `roomName` and `status` (from
  DB) interpolated; `title` is interpolated into `<title>` and `<h1>` too.

Impact: an attacker submits a request with `<img src=x onerror=…>` as their
name; when the admin opens the approve/deny link, the payload executes on the
site's origin in the admin's browser. The session cookie is `httpOnly` so it
can't be stolen directly, but the script can act *as* the admin (approve/deny,
edit/delete requests, change rooms, read blueprint data) or exfiltrate page
data.

Fix: add an `esc()` to `app/lib/tokenPage.ts` and escape every dynamic
interpolation (`name`, `roomName`, `status`, `token` URL context) in both
routes. Escaping in `roomSummaryList` covers the cancel + decide GET pages.

### 🟠 MEDIUM — Public, unauthenticated dump of requester PII

`GET /api/requests` (app/api/requests/route.ts:10-24) returns **every
request's name, email, note, and dates to anyone** with no auth. Emails are
PII; this endpoint enables scraping/enumeration of all past and pending
guests.

Fix: if the public calendar only needs busy dates, expose availability only
(there is already `/api/availability`); require admin auth for the full list,
or strip `email` (and possibly `name`) from public rows.

### 🟠 MEDIUM — No rate limiting on login or request submission

- `POST /api/admin/login` has no lockout/throttle → online password
  brute-forcing. The constant-time comparison (lib/tokens.ts:132) is good but
  doesn't slow guessing of a 16-char password over time.
- `POST /api/requests` is unthrottled → spam flood of requests, and each one
  triggers an admin notification email → **email bombing via Resend** (also
  burns the Resend quota/budget).

Fix: add per-IP rate limiting (Cloudflare WAF rules or a middleware limiter),
and consider a simple honeypot/proof-of-work on the public form.

### 🟡 LOW — Missing security headers

`next.config.ts` sets only `X-Robots-Tag`. Missing:

- `Content-Security-Policy` (would also mitigate finding #1's impact)
- `X-Content-Type-Options: nosniff` — relevant because `/api/blueprint`
  serves stored bytes with the client-declared MIME type
- `X-Frame-Options` / `frame-ancestors` (clickjacking on admin pages)
- `Strict-Transport-Security` (verify Cloudflare adds HSTS; set explicitly)

Fix: add these in `next.config.ts headers()`.

### 🟡 LOW — Blueprint upload trusts client-declared MIME type

`app/api/admin/blueprint/route.ts:21` accepts `file.type`, which is set by the
client, with no content sniffing; the bytes are later served back with that
same `content-type` (`app/api/blueprint/route.ts:11`). An attacker with admin
access (or via the XSS in finding #1) could store HTML/JS served from the
origin. Size (3MB) and the admin-only gate limit the risk.

Fix: sniff magic bytes (PNG `\x89PNG`, JPEG `\xFF\xD8`, WebP `RIFF…WEBP`)
instead of trusting `file.type`, and add `X-Content-Type-Options: nosniff`.

### 🟡 LOW — Decision links never expire

`lib/emails.ts:59` documents that approve/deny links never expire. Anyone who
obtains an old email (forwarded inbox, shared machine) can act on a request
indefinitely. HMAC signature is unforgeable, so exposure requires the email
itself — acceptable for the threat model, but an expiry claim in the signed
payload (`exp`) would be a cheap hardening.

### ℹ️ Informational / done well

- **Crypto**: HMAC-SHA256 with `timingSafeEqual` for token verification and
  password comparison (lib/tokens.ts) — correct.
- **Cookies**: `httpOnly`, `sameSite: lax`, `secure` in production — CSRF on
  admin endpoints is largely mitigated by SameSite=Lax; token flows are
  protected by unguessable secrets.
- **Cancel tokens**: 24 bytes of `crypto.randomBytes` — unguessable.
- **SQL injection**: all queries use Drizzle parameter binding / `sql`
  template interpolation — no string-built SQL found.
- **Input validation**: zod schemas with sane length caps on all public and
  admin inputs; email validation uses a linear-time check (ReDoS-conscious).
- **Tests** use only fake secrets (`tests/admin.test.ts`, `tests/mailer.test.ts`).
- `.next/`, `.open-next/`, `.wrangler/` build dirs are gitignored (scanned
  them anyway — no secrets).

---

## 3. Prioritized action list

1. ~~**Escape HTML in `app/lib/tokenPage.ts` and both token routes** (stored XSS).~~ ✅ Fixed — `esc()` added to `tokenPage.ts`, applied at every dynamic sink (`title`, `roomName`, `status`, `name`, `error`) in `roomSummaryList`, the decide and cancel routes; regression tests added.
2. ~~**Restrict `/api/requests` GET** — don't expose emails publicly.~~ ✅ Fixed — emails are stripped for non-admins (`toPublicRequest(r, includeEmail)`); admins still receive them for the edit form. The public home page RSC payload no longer contains emails either.
3. ~~**Add rate limiting** to `/api/admin/login` and `/api/requests` POST.~~ ✅ Fixed (defense-in-depth) — `lib/rateLimit.ts` fixed-window limiter: login 10/5 min, submissions 5/15 min, per client IP (`CF-Connecting-IP` → `X-Forwarded-For`). In-memory state is per-isolate on Workers; for a hard guarantee add Cloudflare WAF rules at the edge.
4. ~~Add security headers (CSP, nosniff, frame-ancestors, HSTS).~~ ✅ Fixed — `next.config.ts` now sets `Content-Security-Policy` (self + inline for Next hydration/Tailwind), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and HSTS on all routes.
5. ~~Sniff blueprint file magic bytes instead of trusting `file.type`.~~ ✅ Fixed — `lib/images.ts` `sniffImageMime()` decides the stored MIME type from PNG/JPEG/WebP magic bytes; serving adds `nosniff`.
6. Rotate the `.env` credentials if they were ever used beyond local dev.
