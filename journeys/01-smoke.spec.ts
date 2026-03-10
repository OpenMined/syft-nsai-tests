import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';

test.describe('Smoke', () => {
  test('hub loads and shows landing page', async ({ page }) => {
    await page.goto(config.hub.url);
    await expect(
      page.getByRole('button', { name: /sign up/i }),
    ).toBeVisible({ timeout: config.timeouts.navigation });
  });

  test('space loads and renders', async ({ page }) => {
    await page.goto(`${config.space.url}${config.space.frontendPath}`);
    // Space shows onboarding page (fresh) or home page (already onboarded)
    await expect(
      page.getByRole('heading', { name: /welcome to.*syft space/i }),
    ).toBeVisible({ timeout: config.timeouts.navigation });
  });
});
