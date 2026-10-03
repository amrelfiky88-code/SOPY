// Bump on any change to this file's caching rules.
const CACHE_NAME = 'sopy-cache-v4'; // v4: phone notifications
const APP_SHELL = ['/', '/manifest.json', '/icons/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const offline = () => new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the API or evidence photos — checklist data and dashboards must be fresh.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Pages: network first, so a deploy reaches phones on the next open
  // instead of one visit later. The cached shell is only the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Copy before handing it back: once the page starts reading the
          // body, a later clone() throws and the offline copy never updates.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || offline()))
    );
    return;
  }

  // Build assets are content-hashed, so a cached copy is never stale.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => offline());
    })
  );
});

// Phone notifications (server/src/push.js). The server sends the wording
// already in the person's language; tapping opens the page it points to,
// reusing an open SOPY window when there is one.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'SOPY', body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SOPY', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      renotify: !!data.tag,
      lang: data.lang,
      dir: data.dir || 'auto',
      data: { url: data.url || '/app/notifications' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/app/notifications', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      // navigate() only works on a window this worker controls (not one
      // opened before it took over), so fall back to a new window.
      if (open) return open.focus().then(() => open.navigate(target)).catch(() => self.clients.openWindow(target));
      return self.clients.openWindow(target);
    })
  );
});
