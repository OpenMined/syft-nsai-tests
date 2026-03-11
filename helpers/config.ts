export const config = {
  hub: {
    url: process.env.HUB_URL ?? 'http://localhost:8080',
    backendUrl: process.env.HUB_BACKEND_URL ?? 'http://localhost:8000',
    frontendUrl: process.env.HUB_FRONTEND_URL ?? 'http://localhost:3000',
  },
  space: {
    url: process.env.SPACE_URL ?? 'http://localhost:8081',
    frontendPath: '/frontend/',
  },
  mockOpenai: {
    /** URL reachable from the Space backend (inside docker network) */
    dockerBaseUrl: process.env.MOCK_OPENAI_DOCKER_URL ?? 'http://mock-openai:11434/v1',
    /** URL reachable from the test runner (host machine) */
    hostBaseUrl: process.env.MOCK_OPENAI_HOST_URL ?? 'http://localhost:11434/v1',
    apiKey: 'mock-api-key',
    model: 'mock-gpt-4o',
  },
  testUser: {
    email: process.env.TEST_USER_EMAIL ?? 'e2e@openmined.org',
    password: process.env.TEST_USER_PASSWORD ?? 'TestPass123!',
  },
  timeouts: {
    navigation: 30_000,
    action: 15_000,
    assertion: 10_000,
  },
} as const;
