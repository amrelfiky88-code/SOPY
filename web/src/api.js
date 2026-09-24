import { PAGE_LABELS } from './i18n/pageLabels.js';

const TOKEN_KEY = 'sopy_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// A phone on shaky signal can leave a request hanging with no error at
// all; give up after this long so the page can say so and offer a retry.
const TIMEOUT_MS = 20_000;

// The UI language (set by i18n/index.jsx). Sent with every request so the
// server's error messages come back in it, and used for this file's own.
function uiLanguage() {
  try { return localStorage.getItem('sopy_lang') || 'en'; } catch { return 'en'; }
}
const say = (key, vars = {}) => {
  let out = (PAGE_LABELS[uiLanguage()] || PAGE_LABELS.en)[key] || PAGE_LABELS.en[key];
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
};

async function attempt(method, path, body, isForm) {
  const headers = { 'Accept-Language': uiLanguage() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  let text;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    text = await res.text();
  } catch {
    // Network failure, dropped connection or timeout.
    throw Object.assign(new Error(say('api.offline')), { transient: true });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Our API only ever sends JSON. A non-JSON reply that claims success,
      // or a gateway/server error page, means the request didn't really get
      // through — treat as a connection problem. Anything else (a 404 page,
      // say) is a real answer, not an outage.
      if (res.ok || res.status >= 500) {
        throw Object.assign(new Error(say('api.offline')), { transient: true });
      }
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data && data.error) || say('api.failed', { status: res.status });
    // A signed-in request rejected as unauthenticated means the session is
    // over (expired, or the account was disabled): tell the app to sign
    // out, rather than every page showing "Invalid session".
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('sopy:signed-out'));
    }
    throw Object.assign(new Error(message), { status: res.status, transient: res.status >= 502 && res.status <= 504 });
  }
  return data;
}

async function request(method, path, body, { isForm = false } = {}) {
  try {
    return await attempt(method, path, body, isForm);
  } catch (err) {
    // Reads are safe to repeat, so retry one transient failure silently.
    // Writes aren't — the first one may have gone through.
    if (method !== 'GET' || !err.transient) throw err;
    await new Promise((r) => setTimeout(r, 600));
    return attempt(method, path, body, isForm);
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, opts) => request('POST', path, body, opts),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};
