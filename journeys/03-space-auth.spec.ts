import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';
import { loginUser, registerUser } from '../helpers/api';

const ts = Date.now();
const spaceUrl = `${config.space.url}${config.space.frontendPath}`;

test.describe('Space Authentication & Onboarding', () => {
  // Tests assume a fresh Space (no prior onboarding).
  // Global setup recreates the Space container with fresh volumes before all tests.
  // Error tests run first (none complete onboarding), then happy path last.
  test.describe.configure({ mode: 'serial' });

  test.describe('Error cases', () => {
    test('username already taken shows indicator', async ({ page }) => {
      const username = `taken${ts}`;
      await registerUser(
        `taken-${ts}@test.openmined.org`,
        'TestPass123!',
        username,
        'Taken User',
      );

      await page.goto(spaceUrl);
      await expect(
        page.getByRole('heading', { name: /welcome to syft space/i }),
      ).toBeVisible({ timeout: config.timeouts.navigation });

      await page.locator('#username').fill(username);

      await expect(page.getByText(/username is already taken/i)).toBeVisible({
        timeout: config.timeouts.action,
      });
    });

    test('password mismatch shows error', async ({ page }) => {
      await page.goto(spaceUrl);
      await expect(
        page.getByRole('heading', { name: /welcome to syft space/i }),
      ).toBeVisible({ timeout: config.timeouts.navigation });

      await page.locator('#password').fill('TestPass123!');
      await page.locator('#confirm-password').fill('DifferentPass1!');

      await expect(page.getByText(/passwords do not match/i)).toBeVisible({
        timeout: config.timeouts.assertion,
      });
    });

    test('password too short shows helper text', async ({ page }) => {
      await page.goto(spaceUrl);
      await expect(
        page.getByRole('heading', { name: /welcome to syft space/i }),
      ).toBeVisible({ timeout: config.timeouts.navigation });

      await page.locator('#password').fill('Short1');
      await page.locator('#confirm-password').click();

      await expect(page.getByText(/at least 8 characters/i)).toBeVisible({
        timeout: config.timeouts.assertion,
      });
    });

    test('invalid public URL keeps submit disabled', async ({ page }) => {
      await page.goto(spaceUrl);
      await expect(
        page.getByRole('heading', { name: /welcome to syft space/i }),
      ).toBeVisible({ timeout: config.timeouts.navigation });

      // Fill valid auth fields so only the URL blocks submission
      const username = `urltest${ts}`;
      await page.locator('#username').fill(username);
      await page.locator('#email').fill(`urltest-${ts}@test.openmined.org`);
      await page.locator('#name').fill('URL Test User');
      await page.locator('#password').fill('TestPass123!');
      await page.locator('#confirm-password').fill('TestPass123!');

      // Wait for username availability check
      await expect(page.getByText(/username is available/i)).toBeVisible({
        timeout: config.timeouts.action,
      });

      // Select custom domain with invalid URL (missing http://)
      await page.locator('#custom').check();
      await page.locator('#custom-domain').fill('space:8081');

      await expect(
        page.getByRole('button', { name: /complete setup/i }),
      ).toBeDisabled();
    });

    test('wrong credentials sign-in shows error', async ({ page }) => {
      await page.goto(spaceUrl);
      await expect(
        page.getByRole('heading', { name: /welcome to syft space/i }),
      ).toBeVisible({ timeout: config.timeouts.navigation });

      await page.getByRole('button', { name: /i have an account/i }).click();

      await page.locator('#signin-username').fill('nonexistentuser');
      await page.locator('#signin-password').fill('WrongPass123!');

      // Need valid network setup to enable submit
      await page.locator('#custom').check();
      await page.locator('#custom-domain').fill('http://space:8081');

      await page.getByRole('button', { name: /complete setup/i }).click();

      await expect(
        page.getByText(/invalid.*password|failed.*sign|invalid.*credentials/i),
      ).toBeVisible({ timeout: config.timeouts.assertion });
    });
  });

  test.describe('Happy path', () => {
    test('register new user via Space onboarding', async ({ page }) => {
      const username = `e2espace${ts}`;
      const email = `e2e-space-${ts}@test.openmined.org`;
      const password = 'TestPass123!';

      await page.goto(spaceUrl);
      await expect(
        page.getByRole('heading', { name: /welcome to syft space/i }),
      ).toBeVisible({ timeout: config.timeouts.navigation });

      // Fill registration form ("I'm new here" is the default mode)
      await page.locator('#username').fill(username);
      await expect(page.getByText(/username is available/i)).toBeVisible({
        timeout: config.timeouts.action,
      });

      await page.locator('#email').fill(email);
      await page.locator('#name').fill('E2E Space User');
      await page.locator('#password').fill(password);
      await page.locator('#confirm-password').fill(password);

      // Network setup: custom domain
      await page.locator('#custom').check();
      await page.locator('#custom-domain').fill('http://space:8081');

      // Submit
      await page.getByRole('button', { name: /complete setup/i }).click();

      // UI: should redirect to Space home page
      await expect(
        page.getByRole('heading', { name: /welcome to your syft space/i }),
      ).toBeVisible({ timeout: 60_000 });

      // Verify user was also created on the hub
      const token = await loginUser(email, password);
      expect(token).toBeTruthy();
    });
  });
});
