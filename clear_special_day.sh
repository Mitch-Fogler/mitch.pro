#!/usr/bin/env bash
# clear_special_day.sh — Reset the bell schedule override for Woodcreek High School

BASE_DIR=$(dirname "$0")
OVERRIDE_PATH="$BASE_DIR/data/bell_overrides.json"

if [ -f "$OVERRIDE_PATH" ]; then
  rm "$OVERRIDE_PATH"
  echo "✓ Successfully cleared special bell schedule override. Resetting back to standard WHS block schedule."
else
  echo "No active bell schedule overrides found."
fi
