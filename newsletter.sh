#!/usr/bin/env bash
# newsletter.sh - Wrapper script that pipes Doppler secrets into newsletter.py

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export DOPPLER_ENABLE_DNS_RESOLVER=true

if command -v doppler &>/dev/null && doppler secrets &>/dev/null; then
    exec doppler run -- ./newsletter.py "$@"
elif command -v sudo &>/dev/null; then
    exec sudo doppler run -- ./newsletter.py "$@"
else
    exec ./newsletter.py "$@"
fi
