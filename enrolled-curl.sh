#!/usr/bin/env bash
# enrolled-curl.sh — Run curl requests with an authentic, enrolled studentId cookie

BASE_DIR=$(dirname "$0")
NAMES_FILE="$BASE_DIR/data/names.json"

# Generate the authenticated session ID for admin@mitch.pro
SID=$(bun -e "
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const baseDir = '$BASE_DIR';
const secretPath = path.join(baseDir, 'data/id_secret.key');
const tokensPath = path.join(baseDir, 'data/tokens.json');

if (!fs.existsSync(secretPath)) {
  console.error('Error: data/id_secret.key not found');
  process.exit(1);
}

const ID_SECRET = fs.readFileSync(secretPath);

function makeEmailId(email, gen = 0) {
  const key = gen === 0 ? email : \`\${email}:v\${gen}\`;
  const emailHash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
  const raw = 'e' + emailHash;
  const sig = crypto.createHmac('sha256', ID_SECRET).update(raw).digest('hex').slice(0, 16);
  return raw + '.' + sig;
}

let claimCount = 0;
try {
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  for (const t of Object.values(tokens)) {
    if (t.email === 'admin@mitch.pro' && t.infinite) {
      claimCount = t.claim_count || 0;
      break;
    }
  }
} catch (e) {}

console.log(makeEmailId('admin@mitch.pro', claimCount));
")

if [ -z "$SID" ]; then
  echo "Error: Could not generate a valid session ID for admin@mitch.pro."
  exit 1
fi

# Default local port / host
HOST="http://127.0.0.1:6800"

TARGET="$1"
shift

if [ -z "$TARGET" ]; then
  echo "Usage: ./enrolled-curl.sh [path/URL] [additional curl arguments]"
  echo "Example: ./enrolled-curl.sh /api/me/inventory"
  echo "Example: ./enrolled-curl.sh /api/public-chat/send -X POST -H 'Content-Type: application/json' -d '{\"text\":\"hello\"}'"
  exit 1
fi

# Pre-pend local host if it looks like a path
if [[ "$TARGET" == /* ]]; then
  URL="${HOST}${TARGET}"
else
  URL="$TARGET"
fi

echo "Running authenticated curl with studentId=$SID on: $URL"
curl -b "studentId=$SID" "$URL" "$@"
