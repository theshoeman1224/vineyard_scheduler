#!/usr/bin/env bash
# Starts the app locally against a throwaway database (house_test) in the
# house-sched-pg Postgres container, with all outbound email disabled.
# Runs `next dev` in the foreground — launch it in the background.
#
# Usage: serve.sh [--fresh] [--no-admin-email] [--port N]
#   --fresh           drop and recreate house_test before starting
#   --no-admin-email  run with ADMIN_EMAIL empty (tests the "email optional" path)
#   --port N          port to serve on (default 3100, leaves 3000 for `npm run dev`)
#
# Why the overrides work: Next.js never lets .env overwrite a variable that
# is already set in the process environment — even to an empty string. So
# RESEND_API_KEY= reliably disables email while .env supplies the secrets.
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"

PORT=3100
FRESH=0
NO_ADMIN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fresh) FRESH=1 ;;
    --no-admin-email) NO_ADMIN=1 ;;
    --port) PORT="$2"; shift ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

[[ -f .env ]] || { echo ".env missing — copy .env.example and fill it in" >&2; exit 1; }

# Tools run from the project's own install, never via npx: npx silently
# downloads and runs any package missing locally, lifecycle scripts
# included (Sonar shell:S6505). A missing binary should fail loudly.
BIN="$ROOT/node_modules/.bin"
for tool in drizzle-kit next tsx; do
  [[ -x "$BIN/$tool" ]] || { echo "$BIN/$tool missing — run: npm ci --ignore-scripts" >&2; exit 1; }
done

CONTAINER=house-sched-pg
TEST_DB=house_test
BASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
TEST_URL="${BASE_URL%/*}/$TEST_DB" # same server as .env, scratch database

# Create the container on a fresh machine, using the password and host port
# from .env's DATABASE_URL so the app's connection string just works.
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  PGPASS=$(echo "$BASE_URL" | sed -E 's#^[a-z]+://[^:]+:([^@]*)@.*#\1#')
  PGPORT=$(echo "$BASE_URL" | sed -E 's#.*@[^:/]+:([0-9]+)/.*#\1#')
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PGPASS" \
    -p "$PGPORT:5432" postgres:16-alpine >/dev/null
fi
docker start "$CONTAINER" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres -q && break
  sleep 1
done

sql() {
  local query="$1"
  docker exec "$CONTAINER" psql -U postgres -tAc "$query"
  return $?
}
if [[ "$FRESH" = 1 ]]; then
  sql "DROP DATABASE IF EXISTS $TEST_DB WITH (FORCE)" >/dev/null
fi
if [[ -z "$(sql "SELECT 1 FROM pg_database WHERE datname='$TEST_DB'")" ]]; then
  sql "CREATE DATABASE $TEST_DB" >/dev/null
fi
# Same schema path as production: committed migrations, never push. A
# database left over from the old push workflow is baselined first. All
# three steps are idempotent (seed skips rooms that already exist).
legacy=$(docker exec "$CONTAINER" psql -U postgres -d "$TEST_DB" -tAc \
  "SELECT to_regclass('public.rooms') IS NOT NULL AND to_regclass('drizzle.__drizzle_migrations') IS NULL")
if [[ "$legacy" = t ]]; then
  DATABASE_URL="$TEST_URL" npm run --silent db:baseline
fi
DATABASE_URL="$TEST_URL" "$BIN/drizzle-kit" migrate >/dev/null
DATABASE_URL="$TEST_URL" npm run --silent seed

# Free the port. `next dev` is a chain (next -> next-server, plus an
# `npm exec` wrapper when started via npm/npx);
# killing only the listener can leave the parent holding the port, so kill
# the listener plus its `next` ancestors, then confirm with ss.
pid=$(ss -ltnpH "sport = :$PORT" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
if [[ -n "$pid" ]]; then
  chain="$pid"
  p="$pid"
  for _ in 1 2 3; do
    p=$(ps -o ppid= -p "$p" | tr -d ' ')
    if [[ -n "$p" ]] && ps -o args= -p "$p" | grep -q next; then chain="$chain $p"; else break; fi
  done
  kill $chain 2>/dev/null || true
  for _ in $(seq 1 20); do
    ss -ltnH "sport = :$PORT" | grep -q . || break
    sleep 0.5
  done
  if ss -ltnH "sport = :$PORT" | grep -q .; then
    echo "port $PORT is still busy" >&2
    exit 1
  fi
fi

extra=()
note=""
if [[ "$NO_ADMIN" = 1 ]]; then
  extra+=(ADMIN_EMAIL=)
  note=", ADMIN_EMAIL empty"
fi
echo "Serving http://localhost:$PORT (database: $TEST_DB, email disabled$note)"
exec env DATABASE_URL="$TEST_URL" RESEND_API_KEY= APP_URL="http://localhost:$PORT" \
  "${extra[@]}" "$BIN/next" dev -p "$PORT"
