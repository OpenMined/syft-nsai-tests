# syft-nsai-tests

End-to-end tests for **SyftHub + Syft Space** integration using Playwright.

## Prerequisites

- Node.js 20+ (or Bun)
- Docker & Docker Compose v2.20+
- Sibling repos cloned:
  ```
  ~/Projects/OpenMined/
  ├── syfthub/
  ├── syft-space/
  └── syft-nsai-tests/  ← this repo
  ```

## Setup

```bash
# Install dependencies
bun install

# Install Playwright browsers
npx playwright install chromium

# Copy env file
cp .env.example .env

# Build syfthub SDK (required for hub frontend)
cd ../syfthub/sdk/typescript && npm ci && ./node_modules/.bin/tsup

# Build syft-space frontend (required for space Docker image)
cd ../syft-space/frontend && bun install && bun run build
```

## Running tests

```bash
# 1. Start all services
docker compose up -d --build

# 2. Wait for services to be healthy
docker compose ps

# 3. Run tests
npx playwright test

# 4. Run with UI (for debugging)
npx playwright test --ui

# 5. Tear down
docker compose down
```

## Project structure

```
journeys/           # Test specs — one per user journey
  01-smoke.spec.ts
helpers/            # Shared utilities
  api.ts            # API helpers for seeding/assertions
  config.ts         # URLs, ports, timeouts
docker-compose.yml  # Includes syfthub compose + defines space service
docker-compose.override.yml  # Exposes backend port for test API access
versions.json       # Pinned service versions
```

## Architecture

`docker-compose.yml` uses the compose `include:` directive to pull in syfthub's dev compose (`../syfthub/deploy/docker-compose.dev.yml`) as the single source of truth. Only the space service is defined locally. A `docker-compose.override.yml` exposes the backend port to the host for direct API access from tests.

| Service | Port | Source |
|---------|------|--------|
| Hub proxy | :8080 | syfthub compose |
| Hub backend | :8000 | syfthub compose (override exposes port) |
| Space | :8081 | local compose |

## Version pinning

`versions.json` documents which versions of each service are being tested. In CI, checkout the specified refs before running `docker compose up`.

## Troubleshooting

- **Services won't start**: Check `docker compose logs <service>`
- **Hub frontend errors**: Ensure `@syfthub/sdk` is built (`../syfthub/sdk/typescript`)
- **Space blank page**: Ensure frontend is built (`../syft-space/frontend`) without `TAURI_ENV_PLATFORM` set
- **Tests timeout**: Increase `config.timeouts` in `helpers/config.ts`
- **Port conflicts**: Update ports in `.env` and `docker-compose.yml`
