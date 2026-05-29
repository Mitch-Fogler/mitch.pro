#!/usr/bin/env bash
# mitch.pro - Home Directory to Google Drive Backup

BACKUP_NAME="mitch_pro_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
BACKUP_PATH="/home/mitch/server/bun/.backups/$BACKUP_NAME"
REMOTE_NAME="gdrive"
REMOTE_FOLDER="mitch_pro_backups"

echo "[backup] Starting compression (using pigz for speed)..."
mkdir -p /home/mitch/server/bun/.backups

# Create a compressed tarball of ~ while excluding large/junk folders
tar -I pigz -cf "$BACKUP_PATH" -C /home/mitch \
  --exclude=".cache" \
  --exclude=".local" \
  --exclude="node_modules" \
  --exclude="*.onnx" \
  --exclude="*.zst" \
  --exclude="minecraft-java" \
  --exclude="backups" \
  --exclude=".npm" \
  --exclude=".bun" \
  --exclude="server/bun/node_modules" \
  --exclude=".gemini" \
  --exclude=".claude" \
  --exclude=".mozilla" \
  --exclude="Downloads" \
  --exclude="server/bun/.backups" \
  --exclude="server/bun/backups" .

if [ ! -f "$BACKUP_PATH" ]; then
  echo "[backup] Error: Backup file was not created."
  exit 1
fi

echo "[backup] Uploading to Google Drive..."
# Note: REMOTE_NAME must match the name you gave in 'rclone config'
rclone copy "$BACKUP_PATH" "$REMOTE_NAME:$REMOTE_FOLDER"

echo "[backup] Cleaning up..."
rm "$BACKUP_PATH"
rm ~/server/bun/.backups/mitch_pro*
echo "[backup] Done! Saved as $BACKUP_NAME"
