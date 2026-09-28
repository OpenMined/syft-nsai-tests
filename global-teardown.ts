/**
 * Playwright global teardown — runs once after all test files.
 *
 * Captures container logs first, then tears down all containers and
 * removes named volumes so nothing is left running after a test suite
 * completes.
 *
 * The logs must be captured here: Playwright runs this teardown even when
 * global setup throws, and once `down -v` has run there is nothing left
 * for a later CI step to collect. CI uploads the resulting file as the
 * `docker-logs` artifact.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOCKER_LOGS_PATH = join('test-results', 'docker-logs.txt');

export function captureDockerLogs(cwd: string): void {
  try {
    const logs = execSync('docker compose logs --no-color --timestamps 2>&1', {
      cwd,
      stdio: 'pipe',
      maxBuffer: 64 * 1024 * 1024,
    });
    mkdirSync(join(cwd, 'test-results'), { recursive: true });
    writeFileSync(join(cwd, DOCKER_LOGS_PATH), logs);
    console.log(`[global-teardown] Container logs written to ${DOCKER_LOGS_PATH}`);
  } catch (err) {
    console.warn(`[global-teardown] Could not capture container logs: ${String(err)}`);
  }
}

export default async function globalTeardown() {
  const cwd = process.cwd();

  captureDockerLogs(cwd);

  console.log('[global-teardown] Tearing down containers and volumes…');
  execSync('docker compose down -v -t 0', { cwd, stdio: 'pipe' });
  console.log('[global-teardown] Done.');
}
