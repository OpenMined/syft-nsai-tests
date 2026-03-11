# syft-nsai-tests

End-to-end tests for **SyftHub + Syft Space** integration using Playwright.

## Prerequisites

- Node.js 20+ (or Bun)
- Docker & Docker Compose v2.20+
- `syfthub` and `syft-space` repos cloned locally

## Setup

```bash
./setup.sh
```

This installs dependencies, Playwright browsers, creates symlinks to sibling repos, and builds the syfthub SDK and syft-space frontend. See `setup.sh` for details.

## Running tests

Playwright's global setup/teardown automatically starts containers (with a fresh DB) before tests and tears them down after.

```bash
npx playwright test          # Run all tests
npx playwright test --ui     # Debug with UI
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

`docker-compose.yml` uses the compose `include:` directive to pull in syfthub's dev compose (`./syfthub/deploy/docker-compose.dev.yml`) via symlink as the single source of truth. Only the space service is defined locally. A `docker-compose.override.yml` exposes the backend port to the host for direct API access from tests and adds Space to the hub network.

| Service | Port | Source |
|---------|------|--------|
| Hub proxy | :8080 | syfthub compose |
| Hub backend | :8000 | syfthub compose (override exposes port) |
| Space | :8081 | local compose |

## Version pinning

`versions.json` documents which versions of each service are being tested. In CI, checkout the specified refs before running `docker compose up`.

## Troubleshooting

- **Services won't start**: Check `docker compose logs <service>`
- **Hub frontend errors**: Ensure `@syfthub/sdk` is built (`./syfthub/sdk/typescript`)
- **Space blank page**: Ensure frontend is built (`./syft-space/frontend`) without `TAURI_ENV_PLATFORM` set
- **Tests timeout**: Increase `config.timeouts` in `helpers/config.ts`
- **Port conflicts**: Update ports in `.env` and `docker-compose.yml`
