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
