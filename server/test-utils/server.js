import http from 'node:http';
import { createApp } from '../src/app.js';

// Boots the real Express app on an ephemeral port so integration tests hit
// actual HTTP + real route/middleware wiring, not a mocked request object.
export async function startTestServer() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// Thin JSON fetch helper so test bodies read like the actual API contract
// (method, path, body, bearer token) instead of raw fetch boilerplate.
export function makeClient(baseUrl) {
  return async function request(method, path, { body, token } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    if (text) {
      try { json = JSON.parse(text); } catch { json = text; }
    }
    return { status: res.status, body: json };
  };
}
