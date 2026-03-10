/**
 * Playwright global teardown — runs once after all test files.
 *
 * Tears down all containers and removes named volumes so nothing is
 * left running after a test suite completes.
 */

import { execSync } from 'node:child_process';

export default async function globalTeardown() {
  console.log('[global-teardown] Tearing down containers and volumes…');
  execSync('docker compose down -v -t 0', {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
  console.log('[global-teardown] Done.');
}
