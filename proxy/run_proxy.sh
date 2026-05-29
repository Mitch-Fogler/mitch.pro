#!/usr/bin/env bash
set -euo pipefail
LOCK_FILE=/tmp/mitch-proxy-stack.lock
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[proxy] another proxy stack is already running"
  exit 0
fi

export DISPLAY=:10
pkill -9 -f '^Xvfb :10 ' || true
pkill -9 -f '/home/mitch/server/bun/proxy/stream_server.cjs' || true
rm -f /tmp/.X10-lock

# Start Xvfb
Xvfb :10 -screen 0 1280x720x24 -ac +extension GLX +render -noreset 9>&- &
sleep 2

# Start mitch.proxy (Ultra) on port 8081
cd /home/mitch/server/bun/proxy
while true; do
  /usr/bin/node /home/mitch/server/bun/proxy/stream_server.cjs 9>&-
  status=$?
  echo "[stream] stream_server exited with status ${status}; restarting in 3s"
  sleep 3
done
