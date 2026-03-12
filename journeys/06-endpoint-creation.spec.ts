import { test, expect, type Page } from '@playwright/test';
import { config } from '../helpers/config';
import {
  ensureSpaceOnboarded,
  createDataset,
  startIngestion,
  waitForIngestion,
  createModel,
  createEndpoint,
  getPublicEndpoints,
} from '../helpers/api';

const ts = Date.now();
const spaceUrl = config.space.url;
const frontendBase = `${spaceUrl}${config.space.frontendPath}`;
const hubUrl = config.hub.url;
const createEndpointUrl = `${frontendBase}#/create/data-endpoint`;

const datasetName = `e2e-ep-dataset-${ts}`;
const modelName = `e2e-ep-model-${ts}`;
const takenSlug = `e2e-taken-${ts}`;

let datasetId: string;
let modelId: string;

/**
 * Navigate through the creation wizard to a specific step.
 * Steps: 1=source, 2=response-type, 3=policies, 4=metadata, 5=review
 */
async function navigateToStep(
  page: Page,
  targetStep: number,
  opts: { responseType?: 'raw' | 'both' | 'summary' } = {},
) {
  const responseType = opts.responseType ?? 'raw';

  await page.goto(createEndpointUrl);
  await expect(page.getByRole('heading', { name: 'What do you want to share?', level: 1 })).toBeVisible({
    timeout: config.timeouts.navigation,
  });

  if (targetStep < 2) return;

  // Step 1: Select existing source + dataset
  await page.getByText('Existing Sources').click();
  await expect(page.getByText('Available Data Sources')).toBeVisible({
    timeout: config.timeouts.action,
  });
  await page.locator('.p-4.border.rounded-lg', { hasText: datasetName }).click();
  await page.getByRole('button', { name: /continue/i }).click();

  if (targetStep < 3) return;

  // Step 2: Select response type
  if (responseType === 'raw') {
    await page.getByText('Search & Quote').click();
  } else if (responseType === 'both') {
    await page.getByText('Search + AI').click();
    await expect(page.getByText('Choose AI Model')).toBeVisible({
      timeout: config.timeouts.action,
    });
    await page.locator('.p-4.border.rounded-lg', { hasText: modelName }).click();
  } else {
    await page.getByText('AI Assistant').click();
    await expect(page.getByText('Choose AI Model')).toBeVisible({
      timeout: config.timeouts.action,
    });
    await page.locator('.p-4.border.rounded-lg', { hasText: modelName }).click();
  }
  await page.getByRole('button', { name: /continue/i }).click();

  if (targetStep < 4) return;

  // Step 3: Policies — skip
  await page.getByRole('button', { name: /continue/i }).click();
}

test.describe('Endpoint Creation & Publishing', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await ensureSpaceOnboarded();

    // Create dataset and ingest
    const dataset = await createDataset(datasetName, [{ path: '/root/test-docs', description: 'Test documents' }]);
    datasetId = dataset.id;
    await startIngestion(datasetId);
    await waitForIngestion(datasetId);

    // Create model
    const model = await createModel(modelName, {
      apiKey: config.mockOpenai.apiKey,
      model: config.mockOpenai.model,
      baseUrl: config.mockOpenai.dockerBaseUrl,
    });
    modelId = model.id;

    // Create a "taken" endpoint for duplicate-slug validation test
    await createEndpoint(takenSlug, {
      datasetId,
      responseType: 'raw',
      summary: 'Reserved for duplicate slug test',
    });
  });

  test.describe('metadata validation', () => {
    test('rejects invalid slug format', async ({ page }) => {
      await navigateToStep(page, 4, { responseType: 'raw' });

      await page.locator('#endpoint-name').fill('INVALID_SLUG!!');
      await expect(
        page.getByText(/lowercase letters.*numbers.*hyphens/i),
      ).toBeVisible({ timeout: config.timeouts.assertion });

      await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    test('rejects duplicate slug', async ({ page }) => {
      await navigateToStep(page, 4, { responseType: 'raw' });

      await page.locator('#endpoint-name').fill(takenSlug);

      // Wait for the debounced availability check
      await expect(
        page.getByText(/this name is already taken/i),
      ).toBeVisible({ timeout: config.timeouts.action });
    });

    test('requires summary to continue', async ({ page }) => {
      await navigateToStep(page, 4, { responseType: 'raw' });

      const uniqueSlug = `e2e-nosummary-${ts}`;
      await page.locator('#endpoint-name').fill(uniqueSlug);
      await expect(page.getByText(/this name is available/i)).toBeVisible({
        timeout: config.timeouts.action,
      });

      // Leave summary empty
      await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    test('requires model when summary/both response type selected', async ({ page }) => {
      await page.goto(createEndpointUrl);
      await expect(page.getByRole('heading', { name: 'What do you want to share?', level: 1 })).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      // Step 1: pick source
      await page.getByText('Existing Sources').click();
      await expect(page.getByText('Available Data Sources')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.locator('.p-4.border.rounded-lg', { hasText: datasetName }).click();
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 2: Select "Search + AI" but do NOT pick a model
      await page.getByText('Search + AI').click();
      await expect(page.getByText('Choose AI Model')).toBeVisible({
        timeout: config.timeouts.action,
      });

      // Continue should be disabled without selecting a model
      await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
  });

  test.describe('data endpoint — both (raw + summary)', () => {
    const bothSlug = `e2e-both-${ts}`;

    test('full creation flow with existing dataset + model, publish to hub', async ({ page }) => {
      // Navigate through the full wizard
      await page.goto(createEndpointUrl);
      await expect(page.getByRole('heading', { name: 'What do you want to share?', level: 1 })).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      // Step 1: Existing Sources → select dataset
      await page.getByText('Existing Sources').click();
      await expect(page.getByText('Available Data Sources')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.locator('.p-4.border.rounded-lg', { hasText: datasetName }).click();
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 2: Search + AI → select model
      await page.getByText('Search + AI').click();
      await expect(page.getByText('Choose AI Model')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.locator('.p-4.border.rounded-lg', { hasText: modelName }).click();
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 3: Policies — skip
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 4: Metadata
      await page.locator('#endpoint-name').fill(bothSlug);
      await expect(page.getByText(/this name is available/i)).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.locator('#summary').fill('E2E both endpoint with raw + summary');
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 5: Review & Publish
      await expect(page.getByText('Ready to Publish!')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await expect(page.getByText(bothSlug)).toBeVisible();
      await page.getByRole('button', { name: /publish to syfthub/i }).click();

      // Wait for redirect to endpoints list
      await expect(page.getByText(/your endpoints/i)).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByRole('heading', { name: bothSlug })).toBeVisible();

      // Verify on Hub (API)
      const publicEndpoints = await getPublicEndpoints();
      expect(publicEndpoints).toEqual(
        expect.arrayContaining([expect.objectContaining({ slug: bothSlug })]),
      );

      // Verify on Hub (UI)
      await page.goto(`${hubUrl}/browse`);
      await page.locator('#endpoint-search').fill(bothSlug);
      await expect(page.getByText(bothSlug)).toBeVisible({
        timeout: config.timeouts.action,
      });
    });
  });

  test.describe('data endpoint — raw only', () => {
    const rawSlug = `e2e-raw-${ts}`;

    test('creation flow without model, publish to hub', async ({ page }) => {
      await page.goto(createEndpointUrl);
      await expect(page.getByRole('heading', { name: 'What do you want to share?', level: 1 })).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      // Step 1: Existing Sources → select dataset
      await page.getByText('Existing Sources').click();
      await expect(page.getByText('Available Data Sources')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.locator('.p-4.border.rounded-lg', { hasText: datasetName }).click();
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 2: Search & Quote (raw — no model needed)
      await page.getByText('Search & Quote').click();
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 3: Policies — skip
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 4: Metadata
      await page.locator('#endpoint-name').fill(rawSlug);
      await expect(page.getByText(/this name is available/i)).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.locator('#summary').fill('E2E raw-only endpoint');
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 5: Review & Publish
      await expect(page.getByText('Ready to Publish!')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await expect(page.getByText(rawSlug)).toBeVisible();
      await page.getByRole('button', { name: /publish to syfthub/i }).click();

      // Wait for redirect to endpoints list
      await expect(page.getByText(/your endpoints/i)).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByRole('heading', { name: rawSlug })).toBeVisible();

      // Verify on Hub (API)
      const publicEndpoints = await getPublicEndpoints();
      expect(publicEndpoints).toEqual(
        expect.arrayContaining([expect.objectContaining({ slug: rawSlug })]),
      );

      // Verify on Hub (UI)
      await page.goto(`${hubUrl}/browse`);
      await page.locator('#endpoint-search').fill(rawSlug);
      await expect(page.getByText(rawSlug)).toBeVisible({
        timeout: config.timeouts.action,
      });
    });
  });
});
