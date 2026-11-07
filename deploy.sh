#!/usr/bin/env bash
# Build locally and upload to the server (served by Caddy from /srv/syakai).
# Needs the "hiroba" host in ~/.ssh/config.
set -euo pipefail
cd "$(dirname "$0")"
bun run build
rsync -az --delete --chmod=D755,F644 dist/ hiroba:/srv/syakai/
echo "deployed $(git log --oneline -1)"
