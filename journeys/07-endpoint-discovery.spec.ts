import { test, expect } from '@playwright/test';
import { config } from '../helpers/config';
import {
  ensureSpaceOnboarded,
  createDataset,
  startIngestion,
  waitForIngestion,
  createModel,
  createEndpoint,
  publishEndpoint,
  getPublicEndpoints,
} from '../helpers/api';

const ts = Date.now();
const hubUrl = config.hub.url;
const spaceUrl = config.space.url;

const datasetName = `e2e-disc-dataset-${ts}`;
const modelName = `e2e-disc-model-${ts}`;
const dataEndpointSlug = `e2e-disc-data-${ts}`;
const modelEndpointSlug = `e2e-disc-model-ep-${ts}`;
const dataEndpointSummary = 'Discoverable data endpoint for E2E testing';
const modelEndpointSummary = 'Discoverable model endpoint for E2E testing';

let spaceOwner: string;

test.describe('Endpoint Discovery & Query', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await ensureSpaceOnboarded();

    // Create dataset and ingest
    const dataset = await createDataset(datasetName, [{ path: '/root/test-docs', description: 'Test documents' }]);
    await startIngestion(dataset.id);
    await waitForIngestion(dataset.id);

    // Create model
    const model = await createModel(modelName, {
      apiKey: config.mockOpenai.apiKey,
      model: config.mockOpenai.model,
      baseUrl: config.mockOpenai.dockerBaseUrl,
    });

    // Create and publish raw data endpoint
    await createEndpoint(dataEndpointSlug, {
      datasetId: dataset.id,
      responseType: 'raw',
      summary: dataEndpointSummary,
      tags: 'e2e,discovery,data',
    });
    await publishEndpoint(dataEndpointSlug);

    // Create and publish model endpoint separately for chat model selection
    await createEndpoint(modelEndpointSlug, {
      modelId: model.id,
      responseType: 'summary',
      summary: modelEndpointSummary,
      tags: 'e2e,discovery,model',
    });
    await publishEndpoint(modelEndpointSlug);

    // Discover the Space's hub username from the published endpoint
    const endpoints = (await getPublicEndpoints()) as Array<Record<string, unknown>>;
    const published = endpoints.find((ep) => ep.slug === dataEndpointSlug) as Record<string, any>;
    spaceOwner =
      published?.owner?.username ?? published?.namespace ?? published?.owner_username;
    if (!spaceOwner) {
      throw new Error(
        `Cannot determine owner of published endpoint. Response keys: ${Object.keys(published ?? {}).join(', ')}`,
      );
    }
  });

  test.describe('browse page', () => {
    test('shows published endpoint in listing', async ({ page }) => {
      // API sanity check
      const publicEndpoints = await getPublicEndpoints();
      expect(publicEndpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: dataEndpointSlug }),
          expect.objectContaining({ slug: modelEndpointSlug }),
        ]),
      );

      // UI check
      await page.goto(`${hubUrl}/browse`);
      await expect(page.getByText('Browse Library')).toBeVisible({
        timeout: config.timeouts.navigation,
      });
      await page.locator('#endpoint-search').fill(dataEndpointSlug);
      await expect(page.getByText(dataEndpointSlug)).toBeVisible({
        timeout: config.timeouts.action,
      });
    });

    test('search filters to matching endpoint', async ({ page }) => {
      await page.goto(`${hubUrl}/browse`);
      await expect(page.getByText('Browse Library')).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      await page.locator('#endpoint-search').fill(dataEndpointSlug);
      // Wait for debounce
      await page.waitForTimeout(300);

      const endpointCard = page.getByRole('link', { name: new RegExp(dataEndpointSlug) });
      await expect(endpointCard).toBeVisible({
        timeout: config.timeouts.action,
      });
      await expect(endpointCard.getByText(`by @${spaceOwner}`)).toBeVisible({
        timeout: config.timeouts.assertion,
      });
    });

    test('no results state for nonexistent query', async ({ page }) => {
      await page.goto(`${hubUrl}/browse`);
      await expect(page.getByText('Browse Library')).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      await page.locator('#endpoint-search').fill('nonexistent-xyz-99999');
      await expect(page.getByText('No Results Found')).toBeVisible({
        timeout: config.timeouts.action,
      });
    });
  });

  test.describe('endpoint detail page', () => {
    test('shows metadata, type, owner, and policies section', async ({ page }) => {
      await page.goto(`${hubUrl}/${spaceOwner}/${dataEndpointSlug}`);

      await expect(page.locator('h1', { hasText: dataEndpointSlug })).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      // Summary
      await expect(page.getByText(dataEndpointSummary)).toBeVisible({
        timeout: config.timeouts.assertion,
      });

      // Owner
      await expect(page.getByText(`@${spaceOwner}`)).toBeVisible();

      // Policies section
      await expect(page.getByRole('heading', { name: 'Access Policies' })).toBeVisible();
      await expect(page.getByText('No access policies configured')).toBeVisible();
    });
  });

  test.describe('query flow', () => {
    // Hub chat UI test
    test('query via Hub chat UI', async ({ page }) => {
      await page.goto(`${hubUrl}/browse`);
      await expect(page.getByText('Browse Library')).toBeVisible({
        timeout: config.timeouts.navigation,
      });
      await page.locator('#endpoint-search').fill(dataEndpointSlug);
      await page
        .getByRole('button', { name: new RegExp(`Add ${dataEndpointSlug} to context`) })
        .click();
      await expect(page.getByRole('button', { name: /start chat/i })).toBeVisible({
        timeout: config.timeouts.navigation,
      });
      await page.getByRole('button', { name: /start chat/i }).click();

      const welcomeTour = page.getByRole('region', { name: 'Welcome' });
      const skipTour = page.getByRole('button', { name: 'Skip' });
      await skipTour.click({ timeout: 5_000 }).catch(() => {});
      await expect(welcomeTour).toBeHidden({
        timeout: 5_000,
      }).catch(() => {});

      const selectedModelButton = page.getByRole('button', {
        name: new RegExp(modelEndpointSlug),
      });
      const modelTrigger = page.getByRole('button', { name: /select model/i });
      await expect(selectedModelButton.or(modelTrigger)).toBeVisible({
        timeout: config.timeouts.navigation,
      });
      if (await modelTrigger.isVisible()) {
        await expect(modelTrigger).toBeVisible({
          timeout: config.timeouts.navigation,
        });
        await expect(modelTrigger).toBeEnabled({
          timeout: config.timeouts.navigation,
        });
        await modelTrigger.click();
        await expect(page.getByPlaceholder(/search models/i)).toBeVisible({
          timeout: config.timeouts.navigation,
        });
        await page.getByPlaceholder(/search models/i).fill(modelEndpointSlug);
        await page.getByRole('option', { name: new RegExp(modelEndpointSlug) }).click();
        await expect(selectedModelButton).toBeVisible({
          timeout: config.timeouts.navigation,
        });
      }

      const queryInput = page.getByLabel(/chat message/i);
      await expect(queryInput).toBeVisible({ timeout: config.timeouts.navigation });
      await queryInput.fill('What is in the test documents?');
      await queryInput.press('Enter');

      // Assert response appears
      await expect(
        page.getByText(/E2E echo:.*USER QUESTION:\s*What is in the test documents\?/s),
      ).toBeVisible({
        timeout: 120_000,
      });
    });
  });
});
