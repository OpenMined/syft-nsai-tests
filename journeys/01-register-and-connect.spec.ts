import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';
import { loginUser } from '../helpers/api';

test.describe('Register and Connect', () => {
  test('user can register on hub and connect their space', async ({ page }) => {
    const { email, password } = config.testUser;

    // --- Step 1: Register on the hub ---
    await page.goto(config.hub.url);
    // TODO: Update selectors once hub registration UI is finalized
    await page.getByRole('link', { name: /sign up|register/i }).click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(password);
    // Some forms have a confirm password field
    const confirmPassword = page.getByLabel(/confirm password/i);
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill(password);
    }
    await page.getByRole('button', { name: /register|sign up/i }).click();

    // Assert: registration succeeded (redirected to dashboard or shown success)
    await expect(page).toHaveURL(/dashboard|home|verify/i, {
      timeout: config.timeouts.navigation,
    });

    // --- Step 2: Navigate to space and connect ---
    await page.goto(`${config.space.url}${config.space.frontendPath}`);
    await expect(page).toHaveTitle(/syft space/i, {
      timeout: config.timeouts.navigation,
    });

    // TODO: Update selectors once space connection UI is finalized
    await page.getByRole('button', { name: /connect|settings/i }).click();
    await page.getByLabel(/hub url/i).fill(config.hub.url);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /connect|save/i }).click();

    // Assert: space shows connected status
    await expect(page.getByText(/connected/i)).toBeVisible({
      timeout: config.timeouts.assertion,
    });

    // --- Step 3: Verify on hub side ---
    const token = await loginUser(email, password);
    expect(token).toBeTruthy();

    // TODO: Assert hub API shows user has a registered domain
    // const domains = await getDomains(token);
    // expect(domains.length).toBeGreaterThan(0);
  });
});
