import { test, expect, type Page } from '@playwright/test';
import { config } from '../helpers/config';
import { ensureSpaceOnboarded } from '../helpers/api';

const ts = Date.now();
const spaceUrl = config.space.url;
const frontendBase = `${spaceUrl}${config.space.frontendPath}`;

// Hash-routed URLs for the Space SPA
const modelsUrl = `${frontendBase}#/models`;
const modelDetailUrl = (name: string) => `${frontendBase}#/models/${name}`;

// Mock provider settings — the Space backend reaches mock-openai inside Docker,
// but the form needs the docker-internal URL because the Space backend (not the
// browser) calls the provider to fetch models / run health checks.
const MOCK_BASE_URL = config.mockOpenai.dockerBaseUrl;
const MOCK_API_KEY = config.mockOpenai.apiKey;
const MOCK_MODEL_ID = config.mockOpenai.model;

/**
 * Navigate to the models page and wait for it to load.
 */
async function goToModelsPage(page: Page) {
  await page.goto(modelsUrl);
  await expect(page.getByText(/your models/i)).toBeVisible({
    timeout: config.timeouts.navigation,
  });
}

test.describe('Model Configuration', () => {
  test.describe.configure({ mode: 'serial' });

  const modelName = `e2e-model-${ts}`;

  test.beforeAll(async () => {
    await ensureSpaceOnboarded();
  });

  test('create model via UI with custom provider', async ({ page }) => {
    await goToModelsPage(page);

    // Click "Add Model" button
    await page.getByRole('button', { name: /add model/i }).first().click();

    // Dialog should open
    await expect(
      page.getByRole('heading', { name: /create model/i }),
    ).toBeVisible();

    // Fill model name
    await page.locator('#model-name').fill(modelName);

    // Select "Custom / OpenAI-Compatible" provider
    await page.locator('#provider').click();
    await page.getByRole('option', { name: /custom/i }).click();

    // Fill base URL (docker-internal URL so the Space backend can reach it)
    await page.locator('#base-url').fill(MOCK_BASE_URL);

    // Fill API key — this triggers a debounced fetch of available models
    await page.locator('#api-key').fill(MOCK_API_KEY);

    // Wait for the model list to load from mock server
    await expect(page.getByText(/models available/i)).toBeVisible({
      timeout: config.timeouts.action,
    });

    // Open the model combobox — scoped to the dialog to avoid the provider select.
    // The combobox has no accessible name; locate it via its placeholder text.
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Select a model').click();
    await page.getByRole('option', { name: MOCK_MODEL_ID }).click();

    // Fill optional summary
    await page.locator('#summary').fill('E2E test model using mock OpenAI API');

    // Submit — "Create Model" button should be enabled
    const createBtn = page.getByRole('button', { name: /create model/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Dialog should close
    await expect(
      page.getByRole('heading', { name: /create model/i }),
    ).toBeHidden({ timeout: config.timeouts.navigation });

    // Model should appear in the list
    await expect(
      page.getByRole('heading', { name: modelName }),
    ).toBeVisible({ timeout: config.timeouts.action });
  });

  test('model detail page shows correct configuration', async ({ page }) => {
    await page.goto(modelDetailUrl(modelName));

    // Wait for the detail page to load
    await expect(
      page.getByRole('heading', { name: modelName }),
    ).toBeVisible({ timeout: config.timeouts.navigation });

    // Verify the Type value in the summary grid (exact match avoids badge/URL/summary)
    await expect(
      page.getByRole('paragraph').filter({ hasText: /^openai$/ }),
    ).toBeVisible();

    // Verify configuration section shows the base URL and model
    await expect(page.getByText(MOCK_BASE_URL, { exact: true })).toBeVisible({
      timeout: config.timeouts.assertion,
    });
    await expect(page.getByText(MOCK_MODEL_ID, { exact: true })).toBeVisible();

    // API key should be masked
    await expect(page.getByText('••••••••')).toBeVisible();

    // Summary should be displayed in the header paragraph
    await expect(page.getByText('E2E test model using mock OpenAI API')).toBeVisible();

    // Connected endpoints should show zero
    await expect(
      page.getByRole('heading', { name: /connected endpoints \(0\)/i }),
    ).toBeVisible();
  });

  test('edit model via UI updates summary and tags', async ({ page }) => {
    await goToModelsPage(page);

    // Click Edit on the model card
    const modelCard = page.locator('.bg-card', {
      has: page.getByRole('heading', { name: modelName }),
    });
    await modelCard.getByRole('button', { name: /edit/i }).click();

    // Edit dialog should open with pre-filled name
    await expect(
      page.getByRole('heading', { name: /edit model/i }),
    ).toBeVisible();
    await expect(page.locator('#model-name')).toHaveValue(modelName);

    // Update summary
    await page.locator('#summary').fill('Updated summary for E2E model');

    // Add a tag
    const dialog = page.getByRole('dialog');
    await dialog.locator('#topics').fill('e2e-tag');
    await dialog.locator('#topics').press('Enter');
    await expect(dialog.getByText('e2e-tag')).toBeVisible();

    // Submit
    await page.getByRole('button', { name: /update model/i }).click();

    // Dialog should close
    await expect(
      page.getByRole('heading', { name: /edit model/i }),
    ).toBeHidden({ timeout: config.timeouts.navigation });

    // Verify changes on the detail page
    await page.goto(modelDetailUrl(modelName));
    await expect(
      page.getByRole('heading', { name: modelName }),
    ).toBeVisible({ timeout: config.timeouts.navigation });

    await expect(page.getByText('Updated summary for E2E model')).toBeVisible();
    await expect(page.getByText('e2e-tag')).toBeVisible();
  });

  test('model can be deleted via UI', async ({ page }) => {
    await goToModelsPage(page);

    // Find the model card and click its Delete button
    const modelCard = page.locator('.bg-card', {
      has: page.getByRole('heading', { name: modelName }),
    });
    await modelCard
      .getByRole('button', { name: /delete/i })
      .click();

    // Confirm deletion in the confirmation dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /delete/i }).click();

    // Model should disappear from the list
    await expect(
      page.getByRole('heading', { name: modelName }),
    ).toBeHidden({ timeout: config.timeouts.action });
  });
});
