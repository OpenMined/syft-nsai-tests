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
const endpointSlug = `e2e-disc-ep-${ts}`;
const endpointSummary = 'Discoverable endpoint for E2E testing';

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

    // Create and publish endpoint
    await createEndpoint(endpointSlug, {
      datasetId: dataset.id,
      modelId: model.id,
      responseType: 'both',
      summary: endpointSummary,
      tags: 'e2e,discovery',
    });
    await publishEndpoint(endpointSlug);

    // Discover the Space's hub username from the published endpoint
    const endpoints = (await getPublicEndpoints()) as Array<Record<string, unknown>>;
    const published = endpoints.find((ep) => ep.slug === endpointSlug) as Record<string, any>;
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
        expect.arrayContaining([expect.objectContaining({ slug: endpointSlug })]),
      );

      // UI check
      await page.goto(`${hubUrl}/browse`);
      await expect(page.getByText('Browse Library')).toBeVisible({
        timeout: config.timeouts.navigation,
      });
      await page.locator('#endpoint-search').fill(endpointSlug);
      await expect(page.getByText(endpointSlug)).toBeVisible({
        timeout: config.timeouts.action,
      });
    });

    test('search filters to matching endpoint', async ({ page }) => {
      await page.goto(`${hubUrl}/browse`);
      await expect(page.getByText('Browse Library')).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      await page.locator('#endpoint-search').fill(endpointSlug);
      // Wait for debounce
      await page.waitForTimeout(300);

      const endpointCard = page.getByRole('link', { name: new RegExp(endpointSlug) });
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
      await page.goto(`${hubUrl}/${spaceOwner}/${endpointSlug}`);

      await expect(page.locator('h1', { hasText: endpointSlug })).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      // Summary
      await expect(page.getByText(endpointSummary)).toBeVisible({
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
    // Direct Space query requires a satellite token (issued during hub→Space proxy flow),
    // not a regular hub user JWT — upgrade once hub query proxy API is available for tests
    test.fixme('query returns response via Space endpoint API', async () => {
      const response = await fetch(
        `${spaceUrl}/api/v1/endpoints/${encodeURIComponent(endpointSlug)}/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer <satellite-token>',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'What is in the test documents?' }],
          }),
        },
      );

      const body = await response.text();
      expect(response.ok, `POST query → ${response.status}: ${body}`).toBe(true);
      const data = JSON.parse(body);
      expect(data).toBeTruthy();
    });

    // Hub chat UI test — upgrade once aggregator ↔ Space connectivity is confirmed
    test.fixme('query via Hub chat UI', async ({ page }) => {
      await page.goto(`${hubUrl}/chat`);

      // Select the endpoint in chat
      const queryInput = page.getByPlaceholder(/start making queries/i);
      await expect(queryInput).toBeVisible({ timeout: config.timeouts.navigation });
      await queryInput.fill('What is in the test documents?');
      await queryInput.press('Enter');

      // Assert response appears
      await expect(page.locator('.message-content').first()).toBeVisible({
        timeout: 30_000,
      });
    });
  });
});
