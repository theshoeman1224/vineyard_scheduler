---
name: run-local
description: Launch the House Scheduler locally against a throwaway Postgres database with email disabled, then smoke-test the database-backed flows (request submit, approve/deny email links, bed capacity, withdraw link, room hotspots) over HTTP and in a headless browser. Use when asked to run, test, or verify the app or a change locally.
---

# Run and test the app locally

Everything runs against **`house_test`**, a scratch database in the
`house-sched-pg` Docker container. The developer's own `house` database is
never touched. Email is always disabled (`RESEND_API_KEY=` overrides `.env`),
so no real mail is sent even though `.env` holds a live key.

Scripts live next to this file. Run them from anywhere in the repo.

## 1. Start the server (background)

```bash
.claude/skills/run-local/serve.sh            # http://localhost:3100
```

Run it with `run_in_background`; it ends in `exec next dev`. Flags:
`--fresh` recreates `house_test`, `--no-admin-email` runs with
`ADMIN_EMAIL` empty, `--port N` changes the port. It starts (or creates)
the container, applies the committed migrations with `drizzle-kit migrate`, seeds rooms,
and frees the port first.

Wait for it by polling, not sleeping:

```bash
timeout 90 bash -c 'until curl -sf "http://localhost:3100/api/availability?start=2030-01-01&end=2030-01-01" >/dev/null; do sleep 1; done'
```

Confirm the listener really has your overrides (a stale server on the port
is the classic false result):

```bash
P=$(ss -ltnpH 'sport = :3100' | sed -n 's/.*pid=\([0-9]*\).*/\1/p'); tr '\0' '\n' < /proc/$P/environ | grep -E '^(RESEND_API_KEY|ADMIN_EMAIL)='
```

`RESEND_API_KEY=` must be present and empty. With `--no-admin-email`,
`ADMIN_EMAIL=` must be present and empty too.

## 2. HTTP smoke test

```bash
.claude/skills/run-local/smoke.sh
```

This prints PASS/FAIL for each check: submit, deny-all, re-clicked link (no
email), old approve link on a denied group, 2-bed capacity, withdraw link,
and room edits keeping or clearing hotspots. It exits non-zero on any
failure and cleans up its own rows. Decision links are signed locally by
`sign.ts`, because email (which normally carries them) is off.

To check the "email is optional" path, restart with
`serve.sh --no-admin-email` and submit a request. It must return HTTP 200
with `"emailQueued":false`.

## 3. Browser check (UI-only behavior)

The withdraw-link banner only exists in the browser. `playwright-core` is
not a repo dependency, so install it once into a scratch directory outside
the repo (never into the repo's `node_modules`):

```bash
PW_DIR=<scratchpad>/pw; mkdir -p $PW_DIR && (cd $PW_DIR && npm init -y >/dev/null && npm i --ignore-scripts playwright-core@1.56.1)
PW_DIR=$PW_DIR node .claude/skills/run-local/banner.mjs <scratchpad>/banner.png
```

It uses the Chromium headless shell cached in `~/.cache/ms-playwright`.
**Open the screenshot and look at it** before reporting success.

## 4. Stop and clean up

```bash
P=$(ss -ltnpH 'sport = :3100' | sed -n 's/.*pid=\([0-9]*\).*/\1/p'); kill $P $(ps -o ppid= -p $P)
docker exec house-sched-pg psql -U postgres -c 'DROP DATABASE IF EXISTS house_test WITH (FORCE)'   # optional
```

## Gotchas

- **Never use `npx` here.** It downloads and runs any package that isn't
  installed locally (SonarCloud rule `shell:S6505`). The scripts call
  `node_modules/.bin/*` and stop with a message if a tool is missing.
- **Kill the whole `next dev` chain.** `next → next-server`, plus an
  `npm exec` wrapper when started through npm:
  killing only the listener can leave the old server on the port, and the
  next launch dies with `EADDRINUSE` while your tests silently hit the old
  one. `serve.sh` handles this. When stopping by hand, verify with `ss`.
- **Process env beats `.env`**, even when the value is empty. That is how
  email gets disabled; it also means a variable exported in your shell
  overrides `.env` without warning.
- **Rate limits are per IP** (5 submits / 15 min, 10 logins / 5 min).
  Hand-rolled `curl` loops need a varying `x-forwarded-for` header, as
  `smoke.sh` sends.
- **Dates must be in the future by the server's clock.** Use dates at least
  a few days out.
- **Dev CSP allows `eval()`** (React dev needs it). Any console error or
  "Issue" overlay in dev is a real problem; `banner.mjs` fails on any.
