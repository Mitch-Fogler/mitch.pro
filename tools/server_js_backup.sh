#!/usr/bin/env bash
# server_js_backup.sh - Automated backup for server.js

BACKUP_NAME="server_js_$(date +%Y%m%d_%H%M%S).tar.gz"
BACKUP_PATH="/home/mitch/server/bun/.backups/$BACKUP_NAME"
REMOTE_NAME="gdrive"
REMOTE_FOLDER="mitch_server_js_backups"

# Ensure backup directory exists
mkdir -p /home/mitch/server/bun/.backups

# Compress the server.js file
tar -I pigz -cf "$BACKUP_PATH" -C /home/mitch/server/bun server.js

# Upload to Google Drive
if [ -f "$BACKUP_PATH" ]; then
  rclone copy "$BACKUP_PATH" "$REMOTE_NAME:$REMOTE_FOLDER"
  # Clean up local backup
  rm "$BACKUP_PATH"
fi
