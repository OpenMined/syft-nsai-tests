import { test, expect, type Page } from '@playwright/test';
import { config } from '../helpers/config';
import { ensureSpaceOnboarded } from '../helpers/api';

const ts = Date.now();
const spaceUrl = config.space.url;
const frontendBase = `${spaceUrl}${config.space.frontendPath}`;

// Hash-routed URLs for the Space SPA
const datasetsUrl = `${frontendBase}#/datasets`;
const datasetDetailUrl = (name: string) => `${frontendBase}#/datasets/${name}`;

// Path inside the Space container where test-docs are mounted
const TEST_DOCS_PATH = '/root/test-docs';

// The 3 fixture files mounted into the container
const TEST_FILE_NAMES = [
  'ai-safety-report.txt',
  'product-overview.txt',
  'meeting-notes.md',
];

/**
 * Navigate to the datasets list page and wait for it to load.
 */
async function goToDatasetsPage(page: Page) {
  await page.goto(datasetsUrl);
  await expect(page.getByText(/your datasets/i)).toBeVisible({
    timeout: config.timeouts.navigation,
  });
}

/**
 * Navigate to the dataset detail page and wait for it to load.
 */
async function goToDatasetDetail(page: Page, datasetName: string) {
  await page.goto(datasetDetailUrl(datasetName));
  await expect(
    page.getByRole('heading', { name: datasetName }),
  ).toBeVisible({ timeout: config.timeouts.navigation });
}

test.describe('Dataset Management', () => {
  test.describe.configure({ mode: 'serial' });

  const datasetName = `e2e-dataset-${ts}`;

  test.beforeAll(async () => {
    // Ensure Space is onboarded so the frontend doesn't redirect to /onboarding.
    // When running the full suite, test 03 completes onboarding via UI.
    // When running this file in isolation, this seeds it via API.
    await ensureSpaceOnboarded();
  });

  test('create dataset via UI with file selection', async ({ page }) => {
    await goToDatasetsPage(page);

    // Click "Add Dataset" button (page may show both header and empty-state buttons)
    await page.getByRole('button', { name: /add dataset/i }).first().click();

    // Dialog should open with "Create Dataset" title
    await expect(
      page.getByRole('heading', { name: /create dataset/i }),
    ).toBeVisible();

    // Fill dataset name
    await page.locator('#dataset-name').fill(datasetName);

    // --- File Explorer: navigate to the mounted test-docs directory ---

    // The file explorer starts at ~ (/home/appuser). We need to find and
    // expand the "test-docs" directory, then select it via its checkbox.
    const testDocsNode = page.locator('.tree-node').filter({
      hasText: 'test-docs',
    });
    await expect(testDocsNode).toBeVisible({ timeout: config.timeouts.action });

    // Click the checkbox on the test-docs directory to select it
    await testDocsNode.locator('[data-slot="checkbox"]').first().click();

    // Verify the directory appears in the selected items (path shows in multiple places)
    await expect(page.getByText(TEST_DOCS_PATH).first()).toBeVisible({
      timeout: config.timeouts.assertion,
    });

    // Fill optional summary
    await page.locator('#summary').fill('E2E test dataset with sample documents');

    // Add a tag (scope assertion to dialog to avoid matching tags on list behind)
    const dialog = page.getByLabel('Create Dataset');
    await dialog.locator('#topics').fill('e2e-test');
    await dialog.locator('#topics').press('Enter');
    await expect(dialog.getByText('e2e-test')).toBeVisible();

    // Submit — "Create Dataset" button should be enabled now
    const createBtn = page.getByRole('button', { name: /create dataset/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Dialog should close and toast should confirm creation
    await expect(
      page.getByRole('heading', { name: /create dataset/i }),
    ).toBeHidden({ timeout: config.timeouts.navigation });

    // The new dataset should appear in the list (use heading to avoid matching toast)
    await expect(
      page.getByRole('heading', { name: datasetName }),
    ).toBeVisible({ timeout: config.timeouts.action });
  });

  test('dataset detail page shows watched paths and config', async ({ page }) => {
    await goToDatasetDetail(page, datasetName);

    // Summary grid should show file counts
    await expect(page.getByText(/files/i)).toBeVisible();

    // "Watched Paths" section should show our test-docs path and "Watching" status
    await expect(page.getByText(TEST_DOCS_PATH).first()).toBeVisible({
      timeout: config.timeouts.action,
    });
    await expect(page.getByText('Watching').first()).toBeVisible();

    // Configuration section should show connection status
    await expect(page.getByText('Connected').first()).toBeVisible({
      timeout: config.timeouts.action,
    });
  });

  test('ingestion completes for all test documents', async ({ page }) => {
    test.setTimeout(180_000); // ingestion polling can take a while
    await goToDatasetDetail(page, datasetName);

    // Poll the overview tab until ingestion finishes.
    // The status labels render as "Indexed (N)" / "Queued (N)" etc.
    // Files are small (<1 KB each) so ingestion should be fast, but we
    // reload periodically in case it hasn't finished on first load.
    await expect(async () => {
      await page.reload();
      // Wait for the detail page to render
      await expect(
        page.getByRole('heading', { name: datasetName }),
      ).toBeVisible();
      // Check that no jobs are still queued or processing
      await expect(page.getByText(/queued \(0\)/i)).toBeVisible();
      await expect(page.getByText(/processing \(0\)/i)).toBeVisible();
    }).toPass({ timeout: 120_000, intervals: [5_000] });

    // Verify the indexed count matches our 3 fixture files
    await expect(page.getByText(/indexed \([3-9]\d*\)/i)).toBeVisible();

    // Verify zero errors
    await expect(page.getByText(/errored \(0\)/i)).toBeVisible();
  });

  test('analytics tab shows individual ingested files', async ({ page }) => {
    await goToDatasetDetail(page, datasetName);

    // Switch to the Analytics tab
    await page.getByRole('tab', { name: /analytics/i }).click();

    // The default filter is "Completed" (Indexed). Our 3 files should be listed.
    for (const fileName of TEST_FILE_NAMES) {
      await expect(page.getByText(fileName)).toBeVisible({
        timeout: config.timeouts.action,
      });
    }

    // Each file entry should have a "completed" status badge
    const completedBadges = page.locator('[data-slot="badge"]', {
      hasText: /completed/i,
    });
    await expect(completedBadges).toHaveCount(TEST_FILE_NAMES.length, {
      timeout: config.timeouts.assertion,
    });

    // Click the "Errored" filter tab — should show no files
    await page.getByText(/errored \(0\)/i).click();
    await expect(
      page.getByText(/no errored files found/i),
    ).toBeVisible({ timeout: config.timeouts.assertion });
  });

  test('edit dataset via UI updates summary and tags', async ({ page }) => {
    await goToDatasetsPage(page);

    // Click Edit on the dataset card
    const datasetCard = page.locator('.bg-card', {
      has: page.getByRole('heading', { name: datasetName }),
    });
    await datasetCard.getByRole('button', { name: /edit/i }).click();

    // Edit dialog should open with pre-filled name
    await expect(
      page.getByRole('heading', { name: /edit dataset/i }),
    ).toBeVisible();
    await expect(page.locator('#dataset-name')).toHaveValue(datasetName);

    // Update summary
    await page.locator('#summary').fill('Updated summary for E2E dataset');

    // Add a tag
    const dialog = page.getByRole('dialog');
    await dialog.locator('#topics').fill('updated-tag');
    await dialog.locator('#topics').press('Enter');
    await expect(dialog.getByText('updated-tag')).toBeVisible();

    // Submit
    await page.getByRole('button', { name: /update dataset/i }).click();

    // Dialog should close
    await expect(
      page.getByRole('heading', { name: /edit dataset/i }),
    ).toBeHidden({ timeout: config.timeouts.navigation });

    // Verify changes on the detail page
    await page.goto(datasetDetailUrl(datasetName));
    await expect(
      page.getByRole('heading', { name: datasetName }),
    ).toBeVisible({ timeout: config.timeouts.navigation });

    await expect(page.getByText('Updated summary for E2E dataset')).toBeVisible();
    await expect(page.getByText('updated-tag')).toBeVisible();
  });

  test('dataset can be deleted via UI', async ({ page }) => {
    await goToDatasetsPage(page);

    // Find the dataset card and click its Delete button
    const datasetCard = page.locator('.bg-card', {
      has: page.getByRole('heading', { name: datasetName }),
    });
    await datasetCard
      .getByRole('button', { name: /delete/i })
      .click();

    // Confirm deletion in the confirmation dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /delete/i }).click();

    // Wait for the confirmation dialog to close
    await expect(dialog).toBeHidden({ timeout: config.timeouts.navigation });

    // Dataset should disappear from the list
    await expect(
      page.getByRole('heading', { name: datasetName }),
    ).toBeHidden({ timeout: config.timeouts.action });
  });
});
