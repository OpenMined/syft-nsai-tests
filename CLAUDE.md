# CLAUDE.md

## What this repo is
Cross-service E2E tests for SyftHub + Syft Space. Tests run against both services simultaneously using Playwright. The sibling repos are symlinked into the repo root (`./syfthub`, `./syft-space`) and built via docker-compose.

## Commands
```bash
./setup.sh                         # First-time setup (deps, symlinks, builds)
npx tsc --noEmit                   # Typecheck
npx playwright test                # Run tests (auto-starts/stops containers)
npx playwright test --ui           # Debug with UI
```

## Key conventions
- **Journey tests** in `journeys/` are numbered and run sequentially (one worker, not parallel)
- **Seed data via API helpers** (`helpers/api.ts`), not through the UI — keeps tests fast and focused
- **Smoke tests** should assert visible rendered content (buttons, headings), not just page title — title is in static HTML and doesn't prove JS loaded
- Use `bun` for package management, not npm
- Config is centralized in `helpers/config.ts` — don't hardcode URLs/ports in tests

## Architecture notes
- `docker-compose.yml` uses `include:` to pull syfthub's `deploy/docker-compose.dev.yml` — single source of truth, no duplicated service definitions
- `docker-compose.override.yml` exposes backend port 8000 to host for direct API access from tests
- Space is the only service defined in our compose; all syfthub services come from the included file
- Syfthub proxy on :8080, backend on :8000, space on :8081
- `versions.json` documents which branch/ref of each service is being tested
- Playwright config uses chromium only, 60s timeout, video retained on failure
