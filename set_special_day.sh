#!/usr/bin/env bash
# set_special_day.sh — Set a custom bell schedule override for Woodcreek High School

BASE_DIR=$(dirname "$0")
exec bun "$BASE_DIR/tools/set_special_day.js"

