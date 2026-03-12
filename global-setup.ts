/**
 * Playwright global setup — runs once before all test files.
 *
 * Tears down all containers and volumes, then brings everything up fresh
 * so every test run starts from a completely clean slate (DB, search
 * indices, caches, Space state). The initial `down -v` also serves as a
 * safety net in case a previous teardown didn't complete.
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

  console.log('[global-setup] Tearing down containers and volumes…');
  execSync('docker compose down -v -t 0', opts);

  console.log('[global-setup] Starting fresh containers (with rebuild)…');
  execSync('docker compose up -d --build', opts);

  console.log('[global-setup] Waiting for services to become healthy…');
  await Promise.all([
    waitForService(config.space.url, 90_000),
    waitForService(config.hub.url, 90_000),
  ]);

  console.log('[global-setup] All services ready.');
}
