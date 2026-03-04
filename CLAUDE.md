# CLAUDE.md

## What this repo is
Cross-service E2E tests for SyftHub + Syft Space. Tests run against both services simultaneously using Playwright. The sibling repos (`../syfthub`, `../syft-space`) are built via docker-compose.

## Commands
```bash
bun install                        # Install deps
npx tsc --noEmit                   # Typecheck
npx playwright test                # Run tests
npx playwright test --ui           # Debug with UI
docker compose up -d --build       # Start all services
docker compose down                # Stop services
```

## Key conventions
- **Journey tests** in `journeys/` are numbered and run sequentially (one worker, not parallel)
- **Seed data via API helpers** (`helpers/api.ts`), not through the UI — keeps tests fast and focused
- **TODO comments** mark selectors that need updating once the real UIs are finalized
- Use `bun` for package management, not npm
- Config is centralized in `helpers/config.ts` — don't hardcode URLs/ports in tests

## Architecture notes
- `docker-compose.yml` builds syfthub and syft-space from sibling directories
- `nginx.conf` proxies hub traffic: `/api/` → backend, everything else → frontend
- `versions.json` documents which branch/ref of each service is being tested
- Playwright config uses chromium only, 60s timeout, video retained on failure
