import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';

test.describe('Smoke', () => {
  test('hub loads and shows landing page', async ({ page }) => {
    await page.goto(config.hub.url);
    await expect(
      page.getByRole('button', { name: /sign up/i }),
    ).toBeVisible({ timeout: config.timeouts.navigation });
  });

  test('space loads and shows onboarding', async ({ page }) => {
    await page.goto(`${config.space.url}${config.space.frontendPath}`);
    await expect(
      page.getByRole('heading', { name: /welcome to syft space/i }),
    ).toBeVisible({ timeout: config.timeouts.navigation });
  });
});
