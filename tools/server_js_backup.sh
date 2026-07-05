#!/usr/bin/env bash
# server_js_backup.sh - Automated full data/config backup

set -euo pipefail

BACKUP_NAME="mitchpro_full_$(date +%Y%m%d_%H%M%S).tar.gz"
BACKUP_PATH="/home/mitch/server/bun/.backups/$BACKUP_NAME"
REMOTE_NAME="gdrive"
REMOTE_FOLDER="mitch_pro_backups"
ROOT="/home/mitch/server/bun"

# Ensure backup directory exists
mkdir -p "$ROOT/.backups"

# Pack SQLite database and preserved flat config/static files
cd "$ROOT"
bun tools/pack_all_to_db.js "$BACKUP_PATH"

# Upload to Google Drive
if [ -f "$BACKUP_PATH" ]; then
  rclone copy "$BACKUP_PATH" "$REMOTE_NAME:$REMOTE_FOLDER"
  # Clean up local backup
  rm "$BACKUP_PATH"
fi
