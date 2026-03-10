import { config } from './config';

interface AuthResponse {
  access_token: string;
  token_type: string;
}

interface UserResponse {
  id: string;
  email: string;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? 'GET'} ${url} → ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Register a new user on the hub.
 */
export async function registerUser(
  email: string = config.testUser.email,
  password: string = config.testUser.password,
  username?: string,
  fullName?: string,
): Promise<UserResponse> {
  const derivedUsername =
    username ?? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(3, 'x');
  return request<UserResponse>(config.hub.backendUrl, '/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      username: derivedUsername,
      full_name: fullName ?? 'E2E Test User',
    }),
  });
}

/**
 * Log in to the hub and return an access token.
 */
export async function loginUser(
  email: string = config.testUser.email,
  password: string = config.testUser.password,
): Promise<string> {
  const url = `${config.hub.backendUrl}/api/v1/auth/login`;
  const body = new URLSearchParams({ username: email, password });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${url} → ${response.status}: ${text}`);
  }

  const data = (await response.json()) as AuthResponse;
  return data.access_token;
}

/**
 * Get the list of endpoints for the authenticated user.
 */
export async function getEndpoints(token: string): Promise<unknown[]> {
  return request<unknown[]>(config.hub.backendUrl, '/api/v1/endpoints', {
    headers: authHeaders(token),
  });
}

/**
 * Get accounting balance for the authenticated user.
 */
export async function getBalance(
  token: string,
): Promise<{ balance: number }> {
  return request<{ balance: number }>(
    config.hub.backendUrl,
    '/api/v1/users/me/accounting',
    { headers: authHeaders(token) },
  );
}

// ---------------------------------------------------------------------------
// Space API helpers
// ---------------------------------------------------------------------------

interface DatasetResponse {
  id: string;
  name: string;
  dtype: string;
  configuration: Record<string, unknown>;
  summary: string;
  tags: string;
  provisioner_state?: { status: string };
  connected_endpoints: Array<{ id: string; name: string; slug: string }>;
  created_at: string;
  updated_at: string;
}

interface IngestionStatusResponse {
  dataset_id: string;
  dataset_name: string;
  is_watching: boolean;
  total_jobs: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
}

/**
 * Create a dataset on the Space.
 */
export async function createDataset(
  name: string,
  filePaths: Array<{ path: string; description?: string }>,
  options?: { summary?: string; tags?: string },
): Promise<DatasetResponse> {
  return request<DatasetResponse>(config.space.url, '/api/v1/datasets', {
    method: 'POST',
    body: JSON.stringify({
      dtype: 'local_file',
      name,
      summary: options?.summary ?? '',
      tags: options?.tags ?? '',
      configuration: { filePaths },
    }),
  });
}

/**
 * List all datasets on the Space.
 */
export async function listDatasets(): Promise<DatasetResponse[]> {
  return request<DatasetResponse[]>(config.space.url, '/api/v1/datasets');
}

/**
 * Get a single dataset by name.
 */
export async function getDataset(name: string): Promise<DatasetResponse> {
  return request<DatasetResponse>(config.space.url, `/api/v1/datasets/${encodeURIComponent(name)}`);
}

/**
 * Start ingestion for a dataset.
 */
export async function startIngestion(datasetId: string): Promise<void> {
  await request<unknown>(config.space.url, `/api/v1/ingestion/datasets/${datasetId}/start`, {
    method: 'POST',
  });
}

/**
 * Get ingestion status for a dataset.
 */
export async function getIngestionStatus(datasetId: string): Promise<IngestionStatusResponse> {
  return request<IngestionStatusResponse>(
    config.space.url,
    `/api/v1/ingestion/datasets/${datasetId}/status`,
  );
}

/**
 * Poll until ingestion completes (all jobs finished — completed or failed, none pending/in_progress).
 */
export async function waitForIngestion(
  datasetId: string,
  timeoutMs: number = 120_000,
): Promise<IngestionStatusResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getIngestionStatus(datasetId);
    if (status.total_jobs > 0 && status.pending === 0 && status.in_progress === 0) {
      return status;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`Ingestion for dataset ${datasetId} did not complete within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Space marketplace / onboarding helpers
// ---------------------------------------------------------------------------

interface MarketplaceResponse {
  id: string;
  name: string;
  url: string;
  email: string;
  is_default: boolean;
  is_active: boolean;
}

/**
 * Register a new marketplace on the Space (also creates a hub user).
 * Omitting `url` lets the Space use its configured SYFT_DEFAULT_MARKETPLACE_URL
 * (the internal docker URL http://proxy:80), which is required because the
 * Space backend calls the hub from inside the docker network.
 */
export async function registerMarketplace(
  username: string,
  email: string,
  password: string,
  opts?: { name?: string },
): Promise<MarketplaceResponse> {
  return request<MarketplaceResponse>(config.space.url, '/api/v1/marketplaces/register', {
    method: 'POST',
    body: JSON.stringify({
      name: opts?.name ?? 'E2E Marketplace',
      username,
      email,
      password,
    }),
  });
}

/**
 * List registered marketplaces on the Space.
 */
export async function listMarketplaces(): Promise<MarketplaceResponse[]> {
  return request<MarketplaceResponse[]>(config.space.url, '/api/v1/marketplaces');
}

/**
 * Ensure the Space is onboarded (has at least one marketplace).
 * If not, register one using a timestamped test user.
 */
export async function ensureSpaceOnboarded(): Promise<void> {
  try {
    const existing = await listMarketplaces();
    if (existing.length > 0) return;
  } catch {
    // API may 500 if DB not ready yet — fall through to register
  }
  const ts = Date.now();
  await registerMarketplace(
    `e2eauto${ts}`,
    `e2e-auto-${ts}@test.openmined.org`,
    'TestPass123!',
  );
}

/**
 * Wait until a service responds with a 200 status.
 */
export async function waitForService(
  url: string,
  timeoutMs: number = 60_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // service not up yet
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Service at ${url} did not become healthy within ${timeoutMs}ms`);
}
