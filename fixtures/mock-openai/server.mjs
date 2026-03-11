/**
 * Minimal OpenAI-compatible mock API server.
 *
 * Endpoints:
 *   GET  /v1/models              – list available models
 *   POST /v1/chat/completions    – return a canned chat completion
 *
 * Any valid Bearer token is accepted (no real auth).
 */

import { createServer } from 'node:http';

const PORT = process.env.PORT ?? 11434;

const MODELS = [
  { id: 'mock-gpt-4o', object: 'model', owned_by: 'mock-provider', created: 1700000000 },
  { id: 'mock-gpt-3.5-turbo', object: 'model', owned_by: 'mock-provider', created: 1700000000 },
];

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Health probe
  if (path === '/health' || path === '/') {
    return json(res, 200, { status: 'ok' });
  }

  // GET /v1/models
  if (req.method === 'GET' && path === '/v1/models') {
    return json(res, 200, { object: 'list', data: MODELS });
  }

  // POST /v1/chat/completions
  if (req.method === 'POST' && path === '/v1/chat/completions') {
    const body = JSON.parse(await readBody(req));
    const model = body.model ?? 'mock-gpt-4o';
    const reply = {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'This is a mock response from the E2E test server.' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
    };
    return json(res, 200, reply);
  }

  // Catch-all
  json(res, 404, { error: { message: 'Not found', type: 'invalid_request_error' } });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock OpenAI API listening on :${PORT}`);
});
