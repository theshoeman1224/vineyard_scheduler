#!/usr/bin/env bash
# Regression smoke for the database-backed flows, driven over HTTP against
# a server started by serve.sh. Prints PASS/FAIL per check and exits
# non-zero on any failure. Creates its own rooms and requests (suffixed
# with a run id) and deletes them at the end, so runs are repeatable.
#
# Usage: smoke.sh   (PORT=3100 by default)
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$DIR" rev-parse --show-toplevel)"
cd "$ROOT"

PORT="${PORT:-3100}"
B="http://localhost:$PORT"
export SIGNING_SECRET
SIGNING_SECRET=$(grep '^SIGNING_SECRET=' .env | cut -d= -f2- | tr -d '"')
PW=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2- | tr -d '"')
RUN=$(date +%s)
NIGHT=$(date -d '+30 days' +%F)
JAR=$(mktemp)
FAILS=0

q() { docker exec house-sched-pg psql -U postgres -d house_test -tAc "$1"; }
# A fresh fake client IP per call keeps the per-IP rate limits out of the way.
ip() { echo "10.$((RANDOM % 250)).$((RANDOM % 250)).$((RANDOM % 250))"; }
post() {
  curl -s -X POST "$B$1" -H 'content-type: application/json' \
    -H "x-forwarded-for: $(ip)" -b "$JAR" -c "$JAR" -d "$2"
}
# Project-local tsx, not npx (which can fetch and run unvetted packages).
decide() { curl -s -X POST "$B/api/decide/$("$ROOT/node_modules/.bin/tsx" "$DIR/sign.ts" "$1" "$2")"; }
has() { grep -q "$1" && echo yes || echo no; }
check() {
  if [ "$2" = "$3" ]; then
    echo "PASS  $1"
  else
    echo "FAIL  $1 (expected '$3', got '$2')"
    FAILS=$((FAILS + 1))
  fi
}
group() { q "select group_id from requests where name='$1' limit 1"; }
statuses() { q "select string_agg(status::text, ',' order by id) from requests where name like '$1'"; }

curl -sf "$B/api/availability?start=$NIGHT&end=$NIGHT" >/dev/null ||
  { echo "server not reachable at $B — start serve.sh first" >&2; exit 1; }
echo "Smoke run $RUN against $B (night $NIGHT)"

check "admin login" "$(post /api/admin/login "{\"password\":\"$PW\"}" | has '"ok":true')" yes
post /api/admin/rooms "{\"name\":\"Smoke Loft $RUN\",\"beds\":2,\"displayOrder\":900}" >/dev/null
post /api/admin/rooms "{\"name\":\"Smoke Den $RUN\",\"beds\":1,\"displayOrder\":901}" >/dev/null
ROOM=$(q "select id from rooms where name='Smoke Loft $RUN'")
ROOM2=$(q "select id from rooms where name='Smoke Den $RUN'")

# Submission + email-link decisions.
R=$(post /api/requests "{\"name\":\"Deny $RUN\",\"email\":\"smoke@example.com\",\"roomIds\":[$ROOM,$ROOM2],\"dates\":[\"$NIGHT\"]}")
check "submit returns ok" "$(echo "$R" | has '"ok":true')" yes
check "submit saves one row per room" "$(statuses "Deny $RUN")" "pending,pending"
G=$(group "Deny $RUN")
decide "$G" deny >/dev/null
check "deny-all denies every room" "$(statuses "Deny $RUN")" "denied,denied"
check "re-clicked link sends no email" "$(decide "$G" deny | has 'Nothing changed')" yes
P=$(decide "$G" approve)
check "old approve link keeps rows denied" "$(statuses "Deny $RUN")" "denied,denied"
check "old approve link reports the conflict" "$(echo "$P" | has 'Already denied')" yes

# Capacity: a 2-bed room takes two confirmed bookings per night, not three.
for n in A B C; do
  post /api/requests "{\"name\":\"Cap$n $RUN\",\"roomIds\":[$ROOM],\"dates\":[\"$NIGHT\"]}" >/dev/null
  decide "$(group "Cap$n $RUN")" approve >/dev/null
done
check "capacity: third approval stays pending" "$(statuses "Cap_ $RUN")" "confirmed,confirmed,pending"

# Withdraw link.
R=$(post /api/requests "{\"name\":\"Withdraw $RUN\",\"roomIds\":[$ROOM2],\"dates\":[\"$NIGHT\"]}")
CANCEL=$(echo "$R" | sed -n 's/.*"cancelUrl":"\([^"]*\)".*/\1/p')
curl -s -X POST "$CANCEL" >/dev/null
check "withdraw link deletes the request" "$(q "select count(*) from requests where name='Withdraw $RUN'")" "0"

# Room edits: omitted hotspot fields keep the hotspot, explicit nulls clear it.
post /api/admin/rooms "{\"id\":$ROOM,\"name\":\"Smoke Loft $RUN\",\"beds\":2,\"displayOrder\":900,\"hotspotX\":10,\"hotspotY\":20,\"hotspotW\":30,\"hotspotH\":40}" >/dev/null
post /api/admin/rooms "{\"id\":$ROOM,\"name\":\"Smoke Loft $RUN\",\"beds\":3,\"displayOrder\":900}" >/dev/null
check "room edit keeps hotspot" "$(q "select concat_ws(',',beds,hotspot_x,hotspot_y,hotspot_w,hotspot_h) from rooms where id=$ROOM")" "3,10,20,30,40"
post /api/admin/rooms "{\"id\":$ROOM,\"name\":\"Smoke Loft $RUN\",\"beds\":3,\"displayOrder\":900,\"hotspotX\":null,\"hotspotY\":null,\"hotspotW\":null,\"hotspotH\":null}" >/dev/null
check "explicit null clears hotspot" "$(q "select concat_ws(',',beds,hotspot_x) from rooms where id=$ROOM")" "3"

# Clean up this run's rows (requests first: rooms are FK-referenced).
q "delete from requests where name like '% $RUN'" >/dev/null
q "delete from rooms where name like 'Smoke % $RUN'" >/dev/null
rm -f "$JAR"

if [ "$FAILS" -eq 0 ]; then echo "All checks passed."; else echo "$FAILS check(s) failed."; fi
[ "$FAILS" -eq 0 ]
