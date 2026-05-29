#!/usr/bin/env bash

# Script: collect_primes.sh
# Usage: ./collect_primes.sh <bits> <output.json>
# Example: ./collect_primes.sh 3072 primes3072.json

set -o errexit
set -o nounset
set -o pipefail

BITS=${1:-4096}
OUTFILE=${2:-primes.json}
TMPFILE="${OUTFILE}.tmp"

# Flag to signal loop exit
stop_now=false

# Cleanup function to properly close JSON array
cleanup() {
  echo "" >>"${TMPFILE}"
  echo "]" >>"${TMPFILE}"
  mv "${TMPFILE}" "${OUTFILE}"
  echo -e "\nStopped. Output saved to ${OUTFILE}"
  exit 0
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT

# Start fresh JSON array
echo "[" >"${TMPFILE}"

FIRST=true
COUNT=0

# Loop indefinitely until Ctrl+C
while true; do
  # Fetch prime
  if resp=$(curl -s "https://2ton.com.au/getprimes/random/${BITS}"); then
    # Append comma if not first
    if [ "${FIRST}" = true ]; then
      FIRST=false
    else
      echo "," >>"${TMPFILE}"
    fi
    echo "  ${resp}" >>"${TMPFILE}"
    COUNT=$((COUNT + 1))
    # Optional: print count or dot
    echo -n "."
  else
    echo -e "\nFetch failed — retrying..."
    # no sleep to allow immediate interrupt
    continue
  fi
done
