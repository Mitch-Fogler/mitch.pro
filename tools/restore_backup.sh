#!/usr/bin/env bash
# restore_backup.sh - Restore the latest packed SQLite/config backup from Google Drive

set -euo pipefail

REMOTE_NAME="gdrive"
REMOTE_FOLDER="mitch_server_backups"
ROOT="/home/mitch/server/bun"
RESTORE_DIR="$ROOT/.backups/restore"

mkdir -p "$RESTORE_DIR"
cd "$ROOT"

LATEST="$(rclone lsf "$REMOTE_NAME:$REMOTE_FOLDER" --files-only | grep '^mitchpro_full_.*\.tar\.gz$' | sort | tail -n 1)"
if [ -z "$LATEST" ]; then
  echo "No packed backup found in $REMOTE_NAME:$REMOTE_FOLDER" >&2
  exit 1
fi

rclone copy "$REMOTE_NAME:$REMOTE_FOLDER/$LATEST" "$RESTORE_DIR"
bun tools/unpack_all_from_db.js "$RESTORE_DIR/$LATEST"
