#!/usr/bin/env bash
# The only sanctioned path to the `public` mirror (github.com/Mitch-Fogler/bun-server-public).
#
# Safety rules:
#   1. Refuses if HEAD is the `rust` branch (or any rust* worktree).
#   2. Refuses if the outgoing commits (public/master..master) touch anything
#      under rust/ or the .githooks guardrails — those stay private.
#   3. Pushes ONLY master:master.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" = "rust" ] || [ "${branch#rust}" != "$branch" ]; then
    echo "REFUSED: you are on '$branch'. The rust branch is private; publish from master only." >&2
    exit 1
fi

git fetch public master --quiet 2>/dev/null || true

if git rev-parse --verify public/master >/dev/null 2>&1; then
    private_paths="$(git diff --name-only public/master..master -- rust .githooks tools/publish_public.sh || true)"
    if [ -n "$private_paths" ]; then
        echo "REFUSED: outgoing master commits touch private rewrite paths:" >&2
        echo "$private_paths" >&2
        echo "Remove those changes (or merge them on the rust branch) before publishing." >&2
        exit 1
    fi
fi

echo "Pushing master:master to public..."
git push public master:master
echo "Done."