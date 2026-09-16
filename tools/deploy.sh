#!/usr/bin/env bash
# tools/deploy.sh - Automated Zero-Downtime Blue-Green Swap Deployment Engine

set -euo pipefail

# GitHub pushes can arrive close together. Only one process may choose and
# replace a blue/green slot at a time, otherwise both runs can target the same
# inactive container and interrupt a healthy release.
exec 9>/tmp/mitch-pro-deploy.lock
echo "[deploy] Waiting for the deployment lock..."
flock -w 900 9 || { echo '[deploy] Timed out waiting for another deployment to finish.'; exit 1; }

CADDYFILE_PATH="/home/mitch/server/bun/caddy/Caddyfile"
PROJECT_DIR="/home/mitch/server/bun"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
else
    cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."
fi

# 1. Fetch only NTFY_TOPIC for the deploy script's notifications
NTFY_TOPIC=""
DOPPLER_AVAILABLE=false
export DOPPLER_ENABLE_DNS_RESOLVER=true
if command -v doppler &> /dev/null && doppler secrets download --format json &> /dev/null; then
    DOPPLER_AVAILABLE=true
    NTFY_TOPIC=$(doppler secrets get NTFY_TOPIC --plain 2>/dev/null || echo "")
else
    ENV_PATH="$PROJECT_DIR/.env"
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

# Helper: return 0 if all changed files are static webroot assets or doc files
is_only_static() {
    local files="$1"
    [ -z "$files" ] && return 1
    while IFS= read -r file; do
        [ -z "$file" ] && continue
        case "$file" in
            webserver/*|docs/*|*.md|.gitignore|LICENSE|*.txt)
                ;;
            *)
                return 1
                ;;
        esac
    done <<< "$files"
    return 0
}

# 1. Determine which slot is currently active BEFORE touching git or files.
# Check running Docker containers first (the runtime source of truth).
if docker ps --filter "name=mitch-webserver-green" --filter "status=running" --format '{{.Names}}' 2>/dev/null | grep -q "mitch-webserver-green"; then
    ACTIVE_SLOT="green"
    INACTIVE_SLOT="blue"
    INACTIVE_PORT=6811
elif docker ps --filter "name=mitch-webserver-blue" --filter "status=running" --format '{{.Names}}' 2>/dev/null | grep -q "mitch-webserver-blue"; then
    ACTIVE_SLOT="blue"
    INACTIVE_SLOT="green"
    INACTIVE_PORT=6812
elif grep -q "webserver-green" "$CADDYFILE_PATH" 2>/dev/null; then
    ACTIVE_SLOT="green"
    INACTIVE_SLOT="blue"
    INACTIVE_PORT=6811
else
    ACTIVE_SLOT="blue"
    INACTIVE_SLOT="green"
    INACTIVE_PORT=6812
fi

echo "[deploy] Active slot detected: webserver-$ACTIVE_SLOT"
echo "[deploy] Target inactive slot to boot: webserver-$INACTIVE_SLOT (Port $INACTIVE_PORT)"

# 2. Pull the latest code
# Discard local runtime modifications to tracked files (like caddy/Caddyfile) so git pull never fails
echo "[deploy] Ensuring working directory is clean of runtime changes..."
OLD_COMMIT=$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "")
if [ "$(id -u)" -eq 0 ]; then
    sudo -u mitch -H git -C "$PROJECT_DIR" checkout -- caddy/Caddyfile 2>/dev/null || true
    echo "[deploy] Pulling latest code from GitHub as mitch..."
    sudo -u mitch -H git -C "$PROJECT_DIR" pull origin master
else
    git -C "$PROJECT_DIR" checkout -- caddy/Caddyfile 2>/dev/null || true
    echo "[deploy] Pulling latest code from GitHub..."
    git -C "$PROJECT_DIR" pull origin master
fi
NEW_COMMIT=$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "")

# Keep /usr/local/bin/deploy.sh synchronized with repo if running as root
if [ -f "$PROJECT_DIR/tools/deploy.sh" ] && [ "$(id -u)" -eq 0 ]; then
    cp "$PROJECT_DIR/tools/deploy.sh" /usr/local/bin/deploy.sh.tmp && mv -f /usr/local/bin/deploy.sh.tmp /usr/local/bin/deploy.sh 2>/dev/null || true
    chmod +x /usr/local/bin/deploy.sh 2>/dev/null || true
fi

# 2b. Fast path: check if this update only modifies static webroot files or docs
CHANGED_FILES=""
if [ -n "$OLD_COMMIT" ] && [ "$OLD_COMMIT" != "$NEW_COMMIT" ]; then
    CHANGED_FILES=$(git -C "$PROJECT_DIR" diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" 2>/dev/null || echo "")
fi

if [ -n "$CHANGED_FILES" ] && is_only_static "$CHANGED_FILES" && [ "${FORCE_FULL_DEPLOY:-0}" != "1" ]; then
    echo "[deploy] Only static files changed in this update:"
    echo "$CHANGED_FILES" | sed 's/^/  - /'
    echo "[deploy] Fast-path: triggering static cache refresh API on running containers..."

    SECRET_KEY=""
    if [ "$DOPPLER_AVAILABLE" = true ]; then
        SECRET_KEY=$(doppler secrets get SECRET_KEY --plain 2>/dev/null || echo "")
    elif [ -f "$PROJECT_DIR/.env" ]; then
        SECRET_KEY=$(grep -E "^SECRET_KEY=" "$PROJECT_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
    fi

    REFRESHED=false
    for URL in "http://localhost:6800/api/cache/refresh" "http://localhost:6811/api/cache/refresh" "http://localhost:6812/api/cache/refresh"; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $SECRET_KEY" \
            -H "X-Internal-Refresh: 1" \
            -H "Host: mitch.pro" \
            -d '{"files":[]}' "$URL" || echo "000")
        if [ "$STATUS" = "200" ]; then
            REFRESHED=true
            echo "[deploy] Static cache refreshed successfully via $URL (HTTP 200)"
        fi
    done

    if [ "$REFRESHED" = true ]; then
        COUNT=$(echo "$CHANGED_FILES" | wc -l)
        echo "[deploy] Static deploy complete in seconds! ($COUNT files updated). Skipping full Docker rebuild and container swap."
        send_notification "Static deploy complete: refreshed $COUNT files in 2 seconds." "Static Deploy Successful" "low"
        exit 0
    else
        echo "[deploy] Warning: Static cache refresh API was not reachable; proceeding with full blue-green swap."
    fi
fi

echo "[deploy] Starting Blue-Green deployment swap..."

send_notification "Rebuilding and starting webserver-$INACTIVE_SLOT (Port $INACTIVE_PORT)..." "Deploy Started" "default"

# 3. Build and boot the inactive slot container, SSH gateway, conduit, and LiveKit SFU
echo "[deploy] Rebuilding and starting webserver-$INACTIVE_SLOT, ssh-gateway, conduit, and livekit..."
run_docker_compose --progress=plain up -d --build "webserver-$INACTIVE_SLOT" ssh-gateway conduit livekit deploy-sync

# 4. Poll the inactive container's health check until it is fully ready
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

# 5. Swap routing in the Caddyfile (targeted slot replacement, preserving headers/CSP/configs)
echo "[deploy] Swapping Caddy proxy configuration to point to webserver-$INACTIVE_SLOT..."
sed -i -E "s/(webserver-)(blue|green)(:6800)/\1$INACTIVE_SLOT\3/g" "$CADDYFILE_PATH"
if ! grep -q "webserver-$INACTIVE_SLOT:6800" "$CADDYFILE_PATH"; then
    echo "[deploy] Warning: standard sed pattern did not match; applying general replacement..."
    sed -i -E "s/webserver-[^:]+:6800/webserver-$INACTIVE_SLOT:6800/g" "$CADDYFILE_PATH"
fi

# 6. Hot-reload Caddy (0ms downtime swap)
echo "[deploy] Reloading Caddy proxy configuration..."
run_docker_compose exec -T reverse-proxy caddy reload --config /etc/caddy/Caddyfile

# 7. Absorb the first post-reload upstream connection inside the deploy. This also
# verifies the public proxy path before the old slot is removed.
echo "[deploy] Warming the newly routed application through Caddy..."
WARMED=false
for _ in 1 2 3 4 5; do
    WARM_STATUS=$(curl -sSL --max-time 10 -o /dev/null -w "%{http_code}" -H "Host: mitchdog.com" "http://localhost:6800/enroll/" || echo "000")
    if [ "$WARM_STATUS" = "200" ] || [ "$WARM_STATUS" = "308" ] || [ "$WARM_STATUS" = "302" ]; then
        WARMED=true
        break
    fi
    sleep 1
done
if [ "$WARMED" = false ]; then
    echo "[deploy] Error: Caddy did not reach the new slot after reload. Aborting before stopping the old slot."
    exit 1
fi

# 8. Tear down the old container slot
echo "[deploy] Stopping and tearing down the old webserver-$ACTIVE_SLOT..."
run_docker_compose stop "webserver-$ACTIVE_SLOT"

echo "[deploy] Deployment successfully completed! webserver-$INACTIVE_SLOT is now serving production traffic."
send_notification "Successfully swapped traffic from webserver-$ACTIVE_SLOT to webserver-$INACTIVE_SLOT (0ms downtime)!" "Swap Successful" "high"
