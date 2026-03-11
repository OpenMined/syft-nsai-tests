#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Install dependencies
bun install

# Install Playwright browsers
npx playwright install chromium

# Copy env file (skip if already exists)
if [ ! -f .env ]; then
  cp .env.example .env
fi

# Create symlinks to sibling repos (skip if already exist)
[ -L ./syfthub ] || ln -sf ../syfthub ./syfthub
[ -L ./syft-space ] || ln -sf ../syft-space ./syft-space

# Build syfthub SDK (required for hub frontend)
cd ./syfthub/sdk/typescript
npm ci
./node_modules/.bin/tsup
cd "$SCRIPT_DIR"

# Build syft-space frontend (required for space Docker image)
cd ./syft-space/frontend
bun install
bun run build
cd "$SCRIPT_DIR"

echo "Setup complete. Run 'docker compose up -d --build' to start services."
