#!/usr/bin/env bash
BASE_DIR="/home/mitch/server/bun"
cd "$BASE_DIR" || exit 1

#adb connect mitch-desk:5555 &
/home/mitch/server/bun/tools/drive_backup.sh >/home/mitch/server/bun/logs/backup.log 2>&1 &
TZ=America/Los_Angeles python3 /home/mitch/server/bun/tools/ipserver.py 2>&1 | TZ=America/Los_Angeles ts '[%Y-%m-%d %H:%M:%S]' >>/home/mitch/server/bun/logs/ipserver.log &
echo "pls don't exit"
setsid -f /home/mitch/.bun/bin/bun /home/mitch/server/bun/server.js >> /home/mitch/server/bun/logs/bun-direct.log 2>&1
cd /home/mitch/server/bun/proxy || exit 1
/home/mitch/server/bun/proxy/run_proxy.sh 2>&1 | TZ=America/Los_Angeles ts '[%Y-%m-%d %H:%M:%S]' | tee -a /home/mitch/server/bun/logs/proxy.log
wait
