/**
 * Playwright global setup — runs once before all test files.
 *
 * Resets both Space and Hub to a clean slate:
 *  - Space: recreate container with fresh volumes (guarantees no leftover state)
 *  - Hub:   reset PostgreSQL database via built-in management command
 *
 * Onboarding is NOT performed here — test 03 (space-auth) tests the
 * onboarding flow itself and completes it. Tests that run after 03
 * inherit the onboarded state. Tests that run in isolation should
 * call ensureSpaceOnboarded() in their own beforeAll.
 */

import { execSync } from 'node:child_process';
import { waitForService } from './helpers/api';
import { config } from './helpers/config';

export default async function globalSetup() {
  const opts = { cwd: process.cwd(), stdio: 'pipe' as const };

  console.log('[global-setup] Resetting Hub database…');
  execSync(
    'docker compose exec -T backend /app/.venv/bin/python -m syfthub.database.init reset',
    opts,
  );

  console.log('[global-setup] Recreating Space container with fresh volumes…');
  execSync('docker compose up -d --force-recreate -V space', opts);

  console.log('[global-setup] Waiting for Space to become healthy…');
  await waitForService(config.space.url, 90_000);

  console.log('[global-setup] Space is ready.');
}
