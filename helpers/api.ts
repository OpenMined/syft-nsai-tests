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
): Promise<UserResponse> {
  return request<UserResponse>(config.hub.backendUrl, '/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Log in to the hub and return an access token.
 */
export async function loginUser(
  email: string = config.testUser.email,
  password: string = config.testUser.password,
): Promise<string> {
  const data = await request<AuthResponse>(
    config.hub.backendUrl,
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
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
