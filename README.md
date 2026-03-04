# syft-nsai-tests

End-to-end tests for **SyftHub + Syft Space** integration using Playwright.

## Prerequisites

- Node.js 20+ (or Bun)
- Docker & Docker Compose
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
  01-register-and-connect.spec.ts
  02-publish-endpoint.spec.ts
  03-query-endpoint.spec.ts
helpers/            # Shared utilities
  api.ts            # API helpers for seeding/assertions
  config.ts         # URLs, ports, timeouts
docker-compose.yml  # Full stack orchestration
versions.json       # Pinned service versions
```

## Journeys

| # | Journey | What it tests |
|---|---------|---------------|
| 01 | Register & Connect | Register on hub, connect space to hub |
| 02 | Publish Endpoint | Create dataset + model + endpoint, publish to hub |
| 03 | Query Endpoint | Discover endpoint on hub, submit query, verify accounting |

## Version pinning

`versions.json` documents which versions of each service are being tested. In CI, checkout the specified refs before running `docker compose up`.

## Troubleshooting

- **Services won't start**: Check `docker compose logs <service>`
- **Tests timeout**: Increase `config.timeouts` in `helpers/config.ts`
- **Port conflicts**: Update ports in `.env` and `docker-compose.yml`
