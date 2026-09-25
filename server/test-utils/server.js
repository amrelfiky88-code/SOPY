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

// Takes a fresh signup through the real funnel — checkout, (mock) payment,
// setup finished — the way a paying customer gets into the app. The
// shortcut of calling /onboarding/complete straight after signup is now
// refused, since it let accounts skip paying.
export async function completeSetup(api, token) {
  const checkout = await api('POST', '/api/billing/checkout', { token, body: {} });
  if (checkout.status !== 200) throw new Error(`checkout failed: ${JSON.stringify(checkout.body)}`);
  if (!checkout.body.alreadyActive) {
    const paid = await api('POST', '/api/billing/mock-complete', { token, body: {} });
    if (paid.status !== 200) throw new Error(`mock-complete failed: ${JSON.stringify(paid.body)}`);
  }
  const done = await api('POST', '/api/onboarding/complete', { token, body: {} });
  if (done.status !== 200) throw new Error(`onboarding/complete failed: ${JSON.stringify(done.body)}`);
  return done.body.tenant;
}

// Thin JSON fetch helper so test bodies read like the actual API contract
// (method, path, body, bearer token) instead of raw fetch boilerplate.
export function makeClient(baseUrl) {
  return async function request(method, path, { body, token, headers: extra } = {}) {
    const headers = { ...extra };
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
