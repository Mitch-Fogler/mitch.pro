#!/usr/bin/env bash
# tools/deploy.sh - Automated Zero-Downtime Blue-Green Swap Deployment Engine

set -euo pipefail

CADDYFILE_PATH="/home/mitch/server/bun/caddy/Caddyfile"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure we are in the project root directory so git, docker-compose, and Doppler scope resolve correctly
cd "$SCRIPT_DIR/.."

# 1. Fetch only NTFY_TOPIC for the deploy script's notifications
NTFY_TOPIC=""
DOPPLER_AVAILABLE=false
if command -v doppler &> /dev/null && doppler secrets download --format json &> /dev/null; then
    DOPPLER_AVAILABLE=true
    NTFY_TOPIC=$(doppler secrets get NTFY_TOPIC --plain 2>/dev/null || echo "")
else
    ENV_PATH="$SCRIPT_DIR/../.env"
    if [ -f "$ENV_PATH" ]; then
        NTFY_TOPIC=$(grep -E "^NTFY_TOPIC=" "$ENV_PATH" | cut -d= -f2- | tr -d '"' | tr -d "'")
    fi
fi
NTFY_TOPIC="${NTFY_TOPIC:-}"

send_notification() {
    [ -z "${NTFY_TOPIC:-}" ] && return 0
    local msg="$1"
    local title="${2:-Deploy Status}"
    local priority="${3:-default}"
    curl -s -H "Title: $title" -H "Priority: $priority" -d "$msg" "https://ntfy.sh/$NTFY_TOPIC" > /dev/null || true
}

# Helper to run docker compose wrapped in doppler run (if Doppler is available), keeping secrets off disk and avoiding bash evaluation bugs.
run_docker_compose() {
    if [ "$DOPPLER_AVAILABLE" = true ]; then
        doppler run -- docker compose "$@"
    else
        docker compose "$@"
    fi
}

# 0. Pull the latest code
if [ "$(id -u)" -eq 0 ]; then
    # Running as root (via sudo / deployer), pull as mitch to preserve credentials and ownership
    echo "[deploy] Pulling latest code from GitHub as mitch..."
    sudo -u mitch -H git -C /home/mitch/server/bun pull origin master
else
    # Running as mitch directly, pull directly
    echo "[deploy] Pulling latest code from GitHub..."
    git -C /home/mitch/server/bun pull origin master
fi

echo "[deploy] Starting Blue-Green deployment swap..."

# 1. Determine which slot is currently active based on Caddyfile routing
if grep -q "webserver-blue" "$CADDYFILE_PATH"; then
    ACTIVE_SLOT="blue"
    INACTIVE_SLOT="green"
    INACTIVE_PORT=6812
else
    ACTIVE_SLOT="green"
    INACTIVE_SLOT="blue"
    INACTIVE_PORT=6811
fi

echo "[deploy] Active slot is: webserver-$ACTIVE_SLOT"
echo "[deploy] Target inactive slot to boot is: webserver-$INACTIVE_SLOT (Port $INACTIVE_PORT)"

send_notification "Rebuilding and starting webserver-$INACTIVE_SLOT (Port $INACTIVE_PORT)..." "Deploy Started" "default"

# 2. Build and boot the inactive slot container
echo "[deploy] Rebuilding and starting webserver-$INACTIVE_SLOT..."
run_docker_compose --progress=plain up -d --build "webserver-$INACTIVE_SLOT"

# 3. Poll the inactive container's health check until it is fully ready
echo "[deploy] Waiting for webserver-$INACTIVE_SLOT to be fully started and responsive..."
MAX_ATTEMPTS=30
ATTEMPT=0
HEALTHY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$INACTIVE_PORT/enroll/" || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "[deploy] Health check passed (HTTP 200)!"
        HEALTHY=true
        break
    fi
    echo "[deploy] Container is starting... HTTP Status: $HTTP_STATUS (Attempt $((ATTEMPT+1))/$MAX_ATTEMPTS)"
    sleep 2
    ATTEMPT=$((ATTEMPT+1))
done

if [ "$HEALTHY" = false ]; then
    echo "[deploy] Error: The new webserver-$INACTIVE_SLOT failed to become healthy. Aborting swap!"
    send_notification "Error: webserver-$INACTIVE_SLOT failed health check on port $INACTIVE_PORT. Aborting swap!" "Swap Failed" "high"
    exit 1
fi

# 4. Swap routing in the Caddyfile
echo "[deploy] Swapping Caddy proxy configuration to point to webserver-$INACTIVE_SLOT..."
cat << EOF > "$CADDYFILE_PATH"
:6800 {
    # Forward all traffic to the active Bun webserver container
    reverse_proxy webserver-$INACTIVE_SLOT:6800
}
EOF

# 5. Hot-reload Caddy (0ms downtime swap)
echo "[deploy] Reloading Caddy proxy configuration..."
run_docker_compose exec -T reverse-proxy caddy reload --config /etc/caddy/Caddyfile

# 6. Tear down the old container slot
echo "[deploy] Stopping and tearing down the old webserver-$ACTIVE_SLOT..."
run_docker_compose stop "webserver-$ACTIVE_SLOT"

echo "[deploy] Deployment successfully completed! webserver-$INACTIVE_SLOT is now serving production traffic."
send_notification "Successfully swapped traffic from webserver-$ACTIVE_SLOT to webserver-$INACTIVE_SLOT (0ms downtime)!" "Swap Successful" "high"
