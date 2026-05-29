#!/bin/bash
echo "[maintenance] Stopping bun.service..."
systemctl --user stop bun
sleep 2
echo "[maintenance] Starting standalone maintenance server on port 6800..."
cd /home/mitch/server/bun
mkdir -p logs
bun maintenance_server.js >> /home/mitch/server/bun/logs/maintenance.log 2>&1
