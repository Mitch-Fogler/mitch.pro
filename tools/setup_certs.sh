#!/usr/bin/env bash
# tools/setup_certs.sh - Automated Mock SSL Certificate Generator

set -euo pipefail

CERT_DIR="/home/mitch/server"
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"

echo "[certs] Checking for local development SSL certificates..."

# 1. Clean up accidental directories created by Docker volumes
if [ -d "$CERT_FILE" ]; then
    echo "[certs] Cleaning up directory '$CERT_FILE' accidentally created by Docker..."
    rm -rf "$CERT_FILE"
fi

if [ -d "$KEY_FILE" ]; then
    echo "[certs] Cleaning up directory '$KEY_FILE' accidentally created by Docker..."
    rm -rf "$KEY_FILE"
fi

# 2. Ensure target directory exists
mkdir -p "$CERT_DIR"

# 3. Generate self-signed certificates if missing
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "[certs] Certificates missing. Generating self-signed mock certificates..."
    openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -days 365 \
        -subj "/C=US/ST=California/L=Sacramento/O=Mitch Development/CN=localhost"
    
    chmod 644 "$CERT_FILE"
    chmod 600 "$KEY_FILE"
    echo "[certs] Mock certificates successfully generated at '$CERT_DIR'!"
else
    echo "[certs] Valid SSL certificates already exist at '$CERT_DIR'."
fi
