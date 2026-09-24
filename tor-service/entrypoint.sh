#!/bin/bash
set -e

TOR_IFACE="${TOR_INTERFACE:-eth1}"
echo "[tor-service] Starting Tor service container..."
echo "[tor-service] Configured outbound interface: ${TOR_IFACE}"

# Check if the configured interface exists
if ip link show "${TOR_IFACE}" >/dev/null 2>&1; then
    echo "[tor-service] Found interface ${TOR_IFACE}!"
    IFACE_IP=$(ip -4 addr show "${TOR_IFACE}" 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -n1)
    if [ -n "$IFACE_IP" ]; then
        echo "[tor-service] Interface ${TOR_IFACE} IPv4: ${IFACE_IP}"
        export TOR_OUTBOUND_BIND_IP="${IFACE_IP}"
    fi

    # Check for default route on this interface
    GATEWAY=$(ip route show dev "${TOR_IFACE}" 2>/dev/null | awk '/default via/{print $3; exit}')
    if [ -n "$GATEWAY" ]; then
        echo "[tor-service] Gateway on ${TOR_IFACE}: ${GATEWAY}"
        ip route replace default via "${GATEWAY}" dev "${TOR_IFACE}" 2>/dev/null || true
    fi
else
    echo "[tor-service] Notice: Interface '${TOR_IFACE}' not present on host. Using default system route."
fi

exec python3 /app/tor_manager.py
