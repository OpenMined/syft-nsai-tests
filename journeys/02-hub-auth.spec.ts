import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';
import { registerUser } from '../helpers/api';

const ts = Date.now();

test.describe('Hub Authentication', () => {
  test.describe('Happy path', () => {
    test('register via UI', async ({ page }) => {
      const email = `e2e-reg-${ts}@test.openmined.org`;
      const password = 'TestPass1!';

      await page.goto(config.hub.url);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill registration form
      await page.getByRole('textbox', { name: /full name/i }).fill('E2E Test User');
      await page.getByRole('textbox', { name: /email/i }).fill(email);
      await page.getByRole('textbox', { name: /^password/i }).fill(password);
      await page.getByRole('textbox', { name: /confirm password/i }).fill(password);
      await page.locator('#terms-agreement').check();

      // Submit
      await page.getByRole('button', { name: /create account/i }).click();

      // Wait for modal to close, then verify authenticated state
      await expect(page.getByRole('dialog')).toBeHidden({
        timeout: config.timeouts.navigation,
      });
      await expect(
        page.getByRole('button', { name: /logout/i }),
      ).toBeVisible();
    });

    test('login via UI with API-seeded user', async ({ page }) => {
      const email = `e2e-login-${ts}@test.openmined.org`;
      const password = 'TestPass1!';
      await registerUser(email, password, `e2elogin${ts}`, 'E2E Login User');

      await page.goto(config.hub.url);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill login form
      await page.getByRole('textbox', { name: /email/i }).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);

      // Submit — scope to the dialog to avoid matching the header "Sign in" button
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /sign in/i })
        .click();

      // Wait for modal to close, then verify authenticated state
      await expect(page.getByRole('dialog')).toBeHidden({
        timeout: config.timeouts.navigation,
      });
      await expect(
        page.getByRole('button', { name: /logout/i }),
      ).toBeVisible();
    });
  });

  test.describe('Error cases', () => {
    test('duplicate email shows error', async ({ page }) => {
      const email = `e2e-dup-${ts}@test.openmined.org`;
      const password = 'TestPass1!';
      await registerUser(email, password, `e2edup${ts}`, 'Dup User');

      await page.goto(config.hub.url);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByRole('textbox', { name: /full name/i }).fill('Dup User');
      await page.getByRole('textbox', { name: /email/i }).fill(email);
      await page.getByRole('textbox', { name: /^password/i }).fill(password);
      await page.getByRole('textbox', { name: /confirm password/i }).fill(password);
      await page.locator('#terms-agreement').check();
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(
        page.getByText(/already exists|already registered|email.*taken/i),
      ).toBeVisible({ timeout: config.timeouts.assertion });
    });

    test('wrong password shows error', async ({ page }) => {
      const email = `e2e-wrongpw-${ts}@test.openmined.org`;
      await registerUser(email, 'TestPass1!', `e2ewrongpw${ts}`, 'Wrong PW');

      await page.goto(config.hub.url);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByRole('textbox', { name: /email/i }).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill('WrongPassword1!');

      await page
        .getByRole('dialog')
        .getByRole('button', { name: /sign in/i })
        .click();

      await expect(
        page.getByText(/invalid|incorrect|wrong.*password/i),
      ).toBeVisible({ timeout: config.timeouts.assertion });
    });

    test('form validation errors on submit', async ({ page }) => {
      await page.goto(config.hub.url);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Submit empty form — triggers all required field errors
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByText(/name is required/i)).toBeVisible({
        timeout: config.timeouts.assertion,
      });
      await expect(page.getByText(/email is required/i)).toBeVisible();

      // Fill invalid email (has @ to bypass HTML5, but no valid TLD → fails zod)
      await page.getByRole('textbox', { name: /email/i }).fill('test@x');
      // Fill too-short password
      await page.getByRole('textbox', { name: /^password/i }).fill('Ab1');
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(
        page.getByText(/please enter a valid email/i),
      ).toBeVisible({ timeout: config.timeouts.assertion });
      await expect(
        page.getByText(/password must be at least 6 characters/i),
      ).toBeVisible();
    });

    test('password strength indicator', async ({ page }) => {
      await page.goto(config.hub.url);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // All lowercase, no digits → score 1 → "Weak"
      await page.getByRole('textbox', { name: /^password/i }).fill('abcdefgh');
      await expect(page.getByText('Weak')).toBeVisible({
        timeout: config.timeouts.assertion,
      });

      // All digits, < 8 chars → score 1 → "Weak"
      await page.getByRole('textbox', { name: /^password/i }).fill('123456');
      await expect(page.getByText('Weak')).toBeVisible();

      // Mixed case + digit + length ≥ 8 → score 3 → "Medium"
      await page.getByRole('textbox', { name: /^password/i }).fill('Abcdefg1');
      await expect(page.getByText('Medium')).toBeVisible();

      // Mixed case + digit + special + length ≥ 12 → score 5 → "Strong"
      await page.getByRole('textbox', { name: /^password/i }).fill('Abcdefghij1!');
      await expect(page.getByText('Strong')).toBeVisible();
    });
  });
});
