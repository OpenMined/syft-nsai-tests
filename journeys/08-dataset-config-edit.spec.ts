import { test, expect, type Locator, type Page } from '@playwright/test';
import { config } from '../helpers/config';
import {
  createEndpoint,
  deleteDataset,
  deleteEndpoint,
  ensureSpaceOnboarded,
  getDataset,
  publishEndpoint,
} from '../helpers/api';

/**
 * Editing a dataset's configuration after creation (syft-space #269).
 *
 * The edit dialog renders whatever the type's schema marks editable, so the
 * journey needs types that have such fields. The local-file dataset of
 * journey 04 has none. Two types are used:
 *
 * - WordPress, against the mock-wordpress fixture: text, secret and number
 *   fields, a live "Test connection", a refused edit, and the republish
 *   banner for an endpoint that publishes the dataset.
 * - Remote Weaviate, created from the experimental page: nothing in create
 *   or edit talks to the cluster (the store's checks are shape-only), so a
 *   URL nobody serves is enough to exercise the edit path. Test connection
 *   is expected to report "failed" rather than refuse the edit.
 */

const ts = Date.now();
const frontendBase = `${config.space.url}${config.space.frontendPath}`;
const datasetsUrl = `${frontendBase}#/datasets`;
const endpointsUrl = `${frontendBase}#/endpoints`;
const experimentalWeaviateUrl = `${frontendBase}#/experimental-rwdt`;
const datasetDetailUrl = (name: string) => `${frontendBase}#/datasets/${name}`;

const WP = config.mockWordpress;
const wpDatasetName = `e2e-wordpress-${ts}`;
const wvDatasetName = `e2e-weaviate-${ts}`;
const endpointSlug = `e2e-wp-endpoint-${ts}`;
const endpointName = `E2E WordPress endpoint ${ts}`;

async function goToDatasetsPage(page: Page) {
  await page.goto(datasetsUrl);
  await expect(page.getByText(/your data sources/i)).toBeVisible({
    timeout: config.timeouts.navigation,
  });
}

async function goToDatasetDetail(page: Page, name: string) {
  await page.goto(datasetDetailUrl(name));
  await expect(page.getByRole('heading', { name })).toBeVisible({
    timeout: config.timeouts.navigation,
  });
}

/** Open the edit dialog from the dataset card and wait for its configuration section. */
async function openEditDialog(page: Page, name: string): Promise<Locator> {
  await goToDatasetsPage(page);
  const card = page.locator('.bg-card', { has: page.getByRole('heading', { name }) });
  await card.getByRole('button', { name: /edit/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /edit data source/i })).toBeVisible();
  // The section renders once the type's schema has loaded.
  await expect(dialog.getByRole('heading', { name: 'Configuration' })).toBeVisible({
    timeout: config.timeouts.action,
  });
  return dialog;
}

async function testConnection(dialog: Locator) {
  await dialog.getByRole('button', { name: /test connection/i }).click();
}

async function saveAndClose(page: Page, dialog: Locator) {
  await dialog.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('heading', { name: /edit data source/i })).toBeHidden({
    timeout: config.timeouts.navigation,
  });
}

test.describe('Dataset configuration edit', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await ensureSpaceOnboarded();
  });

  test.afterAll(async () => {
    // Best effort: the endpoint must go before the dataset it uses.
    for (const step of [
      () => deleteEndpoint(endpointSlug),
      () => deleteDataset(wpDatasetName),
      () => deleteDataset(wvDatasetName),
    ]) {
      try {
        await step();
      } catch {
        // already gone, or never created because an earlier test failed
      }
    }
  });

  test.describe('WordPress source', () => {
    test('create a WordPress dataset against the mock site', async ({ page }) => {
      await goToDatasetsPage(page);
      await page.getByRole('button', { name: 'Add', exact: true }).first().click();

      // Source picker: credentials are the browse half of the configuration.
      await expect(page.getByRole('heading', { name: /choose data source/i })).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.locator('#source-type').click();
      await page.getByRole('option', { name: /wordpress/i }).click();
      await page.locator('#cred-siteUrl').fill(WP.dockerBaseUrl);
      await page.locator('#cred-username').fill(WP.username);
      await page.locator('#cred-applicationPassword').fill(WP.applicationPassword);
      await page.getByRole('button', { name: /continue/i }).click();

      const dialog = page.getByLabel('Add Data Source');
      await expect(page.getByRole('heading', { name: /add data source/i })).toBeVisible();
      await page.locator('#dataset-name').fill(wpDatasetName);

      // The browser lists post types; a type expands into its posts.
      const postsNode = page.locator('.source-node').filter({ hasText: 'Posts' }).first();
      await expect(postsNode).toBeVisible({ timeout: config.timeouts.action });
      await postsNode.getByText('Posts', { exact: true }).click();
      const firstPost = postsNode.locator('.source-node').first();
      await expect(firstPost).toBeVisible({ timeout: config.timeouts.action });
      await firstPost.locator('[data-slot="checkbox"]').click();

      await dialog.getByRole('button', { name: /add data source/i }).click();
      await expect(page.getByRole('heading', { name: /add data source/i })).toBeHidden({
        timeout: config.timeouts.navigation,
      });
      await expect(page.getByRole('heading', { name: wpDatasetName })).toBeVisible({
        timeout: config.timeouts.navigation,
      });
    });

    test('edit dialog shows the editable source fields, secret value withheld', async ({
      page,
    }) => {
      const dialog = await openEditDialog(page, wpDatasetName);

      await expect(dialog.locator('#cfg-siteUrl')).toHaveValue(WP.dockerBaseUrl);
      await expect(dialog.locator('#cfg-username')).toHaveValue(WP.username);
      await expect(dialog.locator('#cfg-pollIntervalSeconds')).toBeVisible();

      // The stored password never reaches the client: shown as configured,
      // replaceable, and no input until Replace is clicked.
      await expect(dialog.getByText('Configured')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Replace' })).toBeVisible();
      await expect(dialog.locator('#cfg-applicationPassword')).toHaveCount(0);

      // Locked fields are not offered.
      await expect(dialog.locator('#cfg-collectionName')).toHaveCount(0);

      await dialog.getByRole('button', { name: /cancel/i }).click();
    });

    test('test connection reaches the site, then an edit is validated and saved', async ({
      page,
    }) => {
      const dialog = await openEditDialog(page, wpDatasetName);

      await dialog.locator('#cfg-pollIntervalSeconds').fill('900');
      await testConnection(dialog);
      await expect(dialog.getByText('Connection works')).toBeVisible({
        timeout: config.timeouts.action,
      });

      await saveAndClose(page, dialog);

      await goToDatasetDetail(page, wpDatasetName);
      await expect(page.getByText('Poll Interval Seconds')).toBeVisible();
      await expect(page.getByText('900', { exact: true })).toBeVisible();
    });

    test('a wrong replacement password is reported by the site, keeping it is not', async ({
      page,
    }) => {
      const dialog = await openEditDialog(page, wpDatasetName);

      await dialog.getByRole('button', { name: 'Replace' }).click();
      await dialog.locator('#cfg-applicationPassword').fill('not-the-password');
      await testConnection(dialog);
      const failed = dialog.getByText('Connection failed');
      await expect(failed).toBeVisible({ timeout: config.timeouts.action });
      await expect(dialog.getByText(/401/)).toBeVisible();

      // Keep current: the stored password is used again.
      await dialog.getByRole('button', { name: /keep current/i }).click();
      await testConnection(dialog);
      await expect(dialog.getByText('Connection works')).toBeVisible({
        timeout: config.timeouts.action,
      });

      await dialog.getByRole('button', { name: /cancel/i }).click();
    });

    test('an unreachable site is refused on save and nothing is written', async ({ page }) => {
      const dialog = await openEditDialog(page, wpDatasetName);

      // Port 1 on the mock host: refused at once, no timeout to wait out.
      await dialog.locator('#cfg-siteUrl').fill('http://mock-wordpress:1');
      await dialog.getByRole('button', { name: /save changes/i }).click();

      // The 422 is shown inline and the dialog stays open.
      await expect(dialog.getByText(/invalid configuration/i)).toBeVisible({
        timeout: config.timeouts.action,
      });
      await expect(dialog.getByRole('heading', { name: /edit data source/i })).toBeVisible();
      await dialog.getByRole('button', { name: /cancel/i }).click();

      await goToDatasetDetail(page, wpDatasetName);
      await expect(page.getByText(WP.dockerBaseUrl)).toBeVisible();
      await expect(page.getByText('mock-wordpress:1')).toHaveCount(0);
    });
  });

  test.describe('Republish after a configuration edit', () => {
    test.beforeAll(async () => {
      const dataset = await getDataset(wpDatasetName);
      await createEndpoint(endpointSlug, {
        name: endpointName,
        datasetId: dataset.id,
        responseType: 'raw',
        summary: 'E2E endpoint for the configuration-edit journey',
        tags: 'e2e,config-edit',
      });
      await publishEndpoint(endpointSlug);
    });

    test('the dataset list offers to republish the endpoint that uses the dataset', async ({
      page,
    }) => {
      const dialog = await openEditDialog(page, wpDatasetName);
      await dialog.locator('#cfg-pollIntervalSeconds').fill('600');
      await saveAndClose(page, dialog);

      // Nothing is sent to the Hub on its own; the banner names what changed.
      await expect(page.getByText('Configuration changed')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await expect(page.getByText(`One published API uses "${wpDatasetName}".`)).toBeVisible();

      await page.getByRole('button', { name: 'Republish', exact: true }).click();
      await expect(page.getByText(`"${endpointName}" republished`)).toBeVisible({
        timeout: config.timeouts.navigation,
      });
      await expect(page.getByText('Configuration changed')).toBeHidden();
    });

    test('Later dismisses the banner without a request', async ({ page }) => {
      const dialog = await openEditDialog(page, wpDatasetName);
      await dialog.locator('#cfg-pollIntervalSeconds').fill('700');
      await saveAndClose(page, dialog);

      await expect(page.getByText('Configuration changed')).toBeVisible({
        timeout: config.timeouts.action,
      });
      await page.getByRole('button', { name: 'Later', exact: true }).click();
      await expect(page.getByText('Configuration changed')).toBeHidden();
    });

    test('a metadata-only edit does not ask for a republish', async ({ page }) => {
      const dialog = await openEditDialog(page, wpDatasetName);
      await dialog.locator('#edit-dataset-summary').fill('Summary changed, configuration not');
      await saveAndClose(page, dialog);

      await expect(page.getByText('Summary changed, configuration not')).toBeVisible();
      await expect(page.getByText('Configuration changed')).toHaveCount(0);
    });

    test('a published endpoint can be republished from its card menu', async ({ page }) => {
      await page.goto(endpointsUrl);
      const card = page.locator('.bg-card', {
        has: page.getByRole('heading', { name: endpointName }),
      });
      await expect(card).toBeVisible({ timeout: config.timeouts.navigation });

      await card.locator('[data-slot="dropdown-menu-trigger"]').click();
      await page.getByRole('menuitem', { name: /republish/i }).click();
      await expect(page.getByText(`"${endpointName}" republished`)).toBeVisible({
        timeout: config.timeouts.navigation,
      });
    });
  });

  test.describe('Remote Weaviate dataset', () => {
    test('create one from the experimental page without a live cluster', async ({ page }) => {
      await page.goto(experimentalWeaviateUrl);
      await page.locator('#dataset-name').fill(wvDatasetName);
      await page.locator('#http-url').fill('http://weaviate.e2e.invalid:8080');
      await page.locator('#grpc-url').fill('http://weaviate.e2e.invalid:50051');
      await page.locator('#api-key').fill('e2e-weaviate-key');
      await page.locator('#collection-name').fill('Articles');
      await page.locator('#content-property').fill('content');
      await page.getByRole('button', { name: /create dataset/i }).click();

      await expect(page.getByRole('heading', { name: wvDatasetName })).toBeVisible({
        timeout: config.timeouts.navigation,
      });
    });

    test('its configuration can be edited; the dry run reports the missing cluster', async ({
      page,
    }) => {
      const dialog = await openEditDialog(page, wvDatasetName);

      await expect(dialog.locator('#cfg-http_url')).toHaveValue(/weaviate\.e2e\.invalid:8080/);
      await expect(dialog.locator('#cfg-grpc_url')).toHaveValue(/weaviate\.e2e\.invalid:50051/);
      await expect(dialog.locator('#cfg-content_property')).toHaveValue('content');
      // The API key; the headers map is empty so it contributes no entry.
      await expect(dialog.getByText('Configured').first()).toBeVisible();
      // The collection is editable for a remote cluster (syft-space #272);
      // the query filters are the one locked field and are never offered.
      await expect(dialog.locator('#cfg-collection_name')).toHaveValue('Articles');
      await expect(dialog.locator('#cfg-search_mode')).toBeVisible();
      await expect(dialog.locator('#cfg-filters')).toHaveCount(0);

      await dialog.locator('#cfg-content_property').fill('body');

      // No cluster answers: that is a health result, not a refusal of the edit.
      await testConnection(dialog);
      await expect(dialog.getByText('Connection failed')).toBeVisible({
        timeout: config.timeouts.navigation,
      });

      await saveAndClose(page, dialog);

      await goToDatasetDetail(page, wvDatasetName);
      await expect(page.getByText('body', { exact: true })).toBeVisible();
      await expect(page.getByText('e2e-weaviate-key')).toHaveCount(0);
    });
  });
});
