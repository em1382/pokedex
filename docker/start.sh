#!/bin/sh
# Runs the Rails API (internal only) and the Next.js server in one container.
# If either process exits, the container stops.
set -eu

# The API keeps no sessions or cookies, so a per-boot key is fine unless one is given.
: "${SECRET_KEY_BASE:=$(head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
export SECRET_KEY_BASE

cd /app/backend
bin/rails server -b 127.0.0.1 -p 3001 &
api=$!

# Only start serving pages once the API answers (Rails boots slower than Next).
node -e '
  const deadline = Date.now() + 60_000;
  (async function poll() {
    try { if ((await fetch("http://127.0.0.1:3001/up")).ok) process.exit(0); } catch {}
    if (Date.now() > deadline) { console.error("Rails API did not start"); process.exit(1); }
    setTimeout(poll, 250);
  })();
' || { kill -TERM "$api" 2>/dev/null; exit 1; }

cd /app/web/frontend
HOSTNAME=0.0.0.0 PORT=3000 node server.js &
web=$!

trap 'kill -TERM "$api" "$web" 2>/dev/null' INT TERM

# Wait for the first process to exit, then stop the other.
while kill -0 "$api" 2>/dev/null && kill -0 "$web" 2>/dev/null; do sleep 1; done
kill -TERM "$api" "$web" 2>/dev/null || true
wait
