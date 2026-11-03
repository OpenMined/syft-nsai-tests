/**
 * Minimal WordPress REST API mock, enough for the Space's WordPress source.
 *
 * Endpoints (all under /wp-json/wp/v2, Basic auth required):
 *   GET /types        – post types; the Space uses this as its credential check
 *   GET /posts        – one page of posts (X-WP-Total / X-WP-TotalPages headers)
 *   GET /posts/:id    – one post with rendered content and embedded terms
 *   GET /pages        – empty
 *
 * Exactly one username / Application Password pair is accepted, so a
 * replaced password is a real edit: the wrong one gets WordPress's 401.
 */

import { createServer } from 'node:http';

const PORT = process.env.PORT ?? 8089;
const SITE = process.env.SITE_URL ?? `http://mock-wordpress:${PORT}`;
const USERNAME = process.env.WP_USERNAME ?? 'e2e-editor';
const APP_PASSWORD = process.env.WP_APP_PASSWORD ?? 'e2e-app-password';

const TYPES = {
  post: { slug: 'post', name: 'Posts', rest_base: 'posts', viewable: true },
  page: { slug: 'page', name: 'Pages', rest_base: 'pages', viewable: true },
  attachment: { slug: 'attachment', name: 'Media', rest_base: 'media', viewable: true },
  wp_block: { slug: 'wp_block', name: 'Patterns', rest_base: 'blocks', viewable: false },
};

const post = (id, slug, title, body, modified) => ({
  id,
  slug,
  link: `${SITE}/${slug}/`,
  status: 'publish',
  author: 1,
  date_gmt: '2026-01-10T09:00:00',
  modified_gmt: modified,
  title: { rendered: title },
  excerpt: { rendered: `<p>${body.slice(0, 40)}…</p>` },
  content: { rendered: `<p>${body}</p>` },
  categories: [1],
  tags: [],
  _links: { self: [{ href: `${SITE}/wp-json/wp/v2/posts/${id}` }] },
  _embedded: {
    author: [{ id: 1, name: 'E2E Author' }],
    'wp:term': [[{ id: 1, name: 'News', taxonomy: 'category' }]],
  },
});

const POSTS = [
  post(1, 'welcome', 'Welcome to the mock site', 'A first article for the end-to-end suite.', '2026-01-12T10:00:00'),
  post(2, 'second-article', 'A second article', 'More words that the Space can ingest.', '2026-01-11T10:00:00'),
  post(3, 'third-article', 'A third article', 'The last of the seeded articles.', '2026-01-10T10:00:00'),
];

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function authorised(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Basic ')) return false;
  const [user, ...rest] = Buffer.from(header.slice(6), 'base64').toString().split(':');
  // WordPress ignores the spaces it prints in an Application Password.
  return user === USERNAME && rest.join(':').replace(/\s+/g, '') === APP_PASSWORD.replace(/\s+/g, '');
}

const server = createServer((req, res) => {
  const url = new URL(req.url, SITE);
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/health' || path === '') return json(res, 200, { status: 'ok' });
  if (path === '/wp-json') return json(res, 200, { name: 'E2E WordPress', url: SITE, namespaces: ['wp/v2'] });

  if (!path.startsWith('/wp-json/wp/v2/')) {
    return json(res, 404, { code: 'rest_no_route', message: 'No route was found matching the URL and request method.', data: { status: 404 } });
  }
  if (req.method !== 'GET') return json(res, 405, { code: 'rest_no_route', message: 'Method not allowed.', data: { status: 405 } });
  if (!authorised(req)) {
    return json(res, 401, { code: 'rest_not_logged_in', message: 'You are not currently logged in.', data: { status: 401 } });
  }

  const route = path.slice('/wp-json/wp/v2/'.length);
  if (route === 'types') return json(res, 200, TYPES);
  if (route === 'posts') {
    return json(res, 200, POSTS, { 'X-WP-Total': String(POSTS.length), 'X-WP-TotalPages': '1' });
  }
  const one = route.match(/^posts\/(\d+)$/);
  if (one) {
    const found = POSTS.find((p) => p.id === Number(one[1]));
    return found
      ? json(res, 200, found)
      : json(res, 404, { code: 'rest_post_invalid_id', message: 'Invalid post ID.', data: { status: 404 } });
  }
  if (route === 'pages' || route === 'media') {
    return json(res, 200, [], { 'X-WP-Total': '0', 'X-WP-TotalPages': '0' });
  }
  json(res, 404, { code: 'rest_no_route', message: 'No route was found matching the URL and request method.', data: { status: 404 } });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock WordPress REST API listening on :${PORT} as ${SITE}`);
});
