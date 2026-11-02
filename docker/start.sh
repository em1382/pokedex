#!/bin/sh
# Runs the Rails API (internal only) and the Next.js server in one container.
#
# - docker stop (SIGTERM/SIGINT) stops both, at any point, and exits 0.
# - If either server exits on its own, the other is stopped and the container
#   exits non-zero, so restart policies and orchestrators notice.
set -u

api="" waiter="" web=""

stop_children() {
  for pid in $api $waiter $web; do kill -TERM "$pid" 2>/dev/null || true; done
  wait
}

# Installed before anything starts, so even a stop during Rails' boot is prompt.
trap 'stop_children; exit 0' INT TERM

# The API keeps no sessions or cookies, so a per-boot key is fine unless one is given.
: "${SECRET_KEY_BASE:=$(head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
export SECRET_KEY_BASE

cd /app/backend
bin/rails server -b 127.0.0.1 -p 3001 &
api=$!

# Only start serving pages once the API answers (Rails boots slower than Next).
# Runs in the background so a stop signal can interrupt the wait.
node -e '
  const deadline = Date.now() + 60_000;
  (async function poll() {
    try { if ((await fetch("http://127.0.0.1:3001/up")).ok) process.exit(0); } catch {}
    if (Date.now() > deadline) { console.error("Rails API did not start within 60s"); process.exit(1); }
    setTimeout(poll, 250);
  })();
' &
waiter=$!
if ! wait "$waiter"; then
  waiter=""
  echo "start.sh: giving up, the API is not answering" >&2
  stop_children
  exit 1
fi
waiter=""

cd /app/web/frontend
HOSTNAME=0.0.0.0 PORT=3000 node server.js &
web=$!

# Wait for the first server to exit, then stop the other and report it.
while :; do
  if ! kill -0 "$api" 2>/dev/null; then name=rails pid=$api; break; fi
  if ! kill -0 "$web" 2>/dev/null; then name=next pid=$web; break; fi
  sleep 1
done
wait "$pid"
status=$?
[ "$status" -eq 0 ] && status=1 # a server exiting on its own is a failure
echo "start.sh: $name exited (status $status); stopping" >&2
stop_children
exit "$status"
