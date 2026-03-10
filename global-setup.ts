/**
 * Playwright global setup — runs once before all test files.
 *
 * Recreates ALL containers with fresh volumes so every test run starts
 * from a completely clean slate (DB, search indices, caches, Space state).
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

  console.log('[global-setup] Recreating all containers with fresh volumes…');
  execSync('docker compose up -d --force-recreate -V', opts);

  console.log('[global-setup] Waiting for services to become healthy…');
  await Promise.all([
    waitForService(config.space.url, 90_000),
    waitForService(config.hub.url, 90_000),
  ]);

  console.log('[global-setup] All services ready.');
}
