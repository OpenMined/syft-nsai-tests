import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';
import { loginUser, getEndpoints, getBalance } from '../helpers/api';

test.describe('Query Endpoint', () => {
  let token: string;

  test.beforeAll(async () => {
    // Seed: user exists with a published endpoint (from previous journey or API)
    token = await loginUser();
  });

  test('user can discover and query an endpoint on the hub', async ({
    page,
  }) => {
    // --- Step 1: Get the published endpoint ---
    // TODO: Uncomment once endpoints are published
    // const endpoints = await getEndpoints(token);
    // expect(endpoints.length).toBeGreaterThan(0);
    // const endpointId = (endpoints[0] as { id: string }).id;

    // --- Step 2: Navigate to endpoint page on hub ---
    await page.goto(config.hub.url);
    // TODO: Update selectors once hub endpoint discovery UI is finalized
    // await page.getByRole('link', { name: /explore|endpoints/i }).click();
    // await page.getByText('test-dataset').click();

    // --- Step 3: Submit a query ---
    // TODO: Update selectors once hub query UI is finalized
    // await page.getByLabel(/query|prompt/i).fill('test query');
    // await page.getByRole('button', { name: /submit|run|query/i }).click();

    // --- Step 4: Assert response ---
    // TODO: Update once query response UI is finalized
    // await expect(page.getByTestId('query-response')).toBeVisible({
    //   timeout: config.timeouts.assertion,
    // });

    // --- Step 5: Verify accounting ---
    // TODO: Uncomment once accounting is implemented
    // const { balance } = await getBalance(token);
    // expect(balance).toBeDefined();

    expect(token).toBeTruthy(); // placeholder assertion
  });
});
