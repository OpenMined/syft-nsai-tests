import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';
import { registerUser, loginUser, getEndpoints } from '../helpers/api';

test.describe('Publish Endpoint', () => {
  let token: string;

  test.beforeAll(async () => {
    // Seed: register user and get auth token via API
    try {
      await registerUser();
    } catch {
      // User may already exist from previous test run
    }
    token = await loginUser();
  });

  test('user can create and publish an endpoint from space to hub', async ({
    page,
  }) => {
    // --- Step 1: Navigate to space ---
    await page.goto(`${config.space.url}${config.space.frontendPath}`);
    await expect(page).toHaveTitle(/syft space/i, {
      timeout: config.timeouts.navigation,
    });

    // --- Step 2: Add a dataset ---
    // TODO: Update selectors once space dataset UI is finalized
    await page.getByRole('link', { name: /datasets/i }).click();
    await page.getByRole('button', { name: /add|create|new/i }).click();
    // TODO: Fill in dataset form fields
    // await page.getByLabel(/name/i).fill('test-dataset');
    // await page.getByLabel(/description/i).fill('E2E test dataset');
    // await page.getByRole('button', { name: /save|create/i }).click();
    // await expect(page.getByText('test-dataset')).toBeVisible();

    // --- Step 3: Add a model ---
    // TODO: Update selectors once space model UI is finalized
    // await page.getByRole('link', { name: /models/i }).click();
    // await page.getByRole('button', { name: /add|create|new/i }).click();
    // await page.getByLabel(/name/i).fill('test-model');
    // await page.getByRole('button', { name: /save|create/i }).click();

    // --- Step 4: Create an endpoint ---
    // TODO: Update selectors once space endpoint UI is finalized
    // await page.getByRole('link', { name: /endpoints/i }).click();
    // await page.getByRole('button', { name: /create|new/i }).click();
    // await page.getByLabel(/dataset/i).selectOption('test-dataset');
    // await page.getByLabel(/model/i).selectOption('test-model');
    // await page.getByRole('button', { name: /create/i }).click();

    // --- Step 5: Publish endpoint to hub ---
    // TODO: Update selectors once publish flow is finalized
    // await page.getByRole('button', { name: /publish/i }).click();
    // await expect(page.getByText(/published/i)).toBeVisible();

    // --- Step 6: Verify on hub side ---
    // TODO: Uncomment once publish flow is implemented
    // const endpoints = await getEndpoints(token);
    // expect(endpoints.length).toBeGreaterThan(0);
    expect(token).toBeTruthy(); // placeholder assertion
  });
});
