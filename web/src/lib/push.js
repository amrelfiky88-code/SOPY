import { api } from '../api.js';

// Phone notifications for this browser (server/src/push.js sends them,
// public/sw.js shows them). Needs the service worker, so it works on the
// production build only; on an iPhone, only once SOPY is added to the
// Home Screen (iOS 16.4 and later).

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Safari on iPhone offers push only to the Home Screen app.
export function needsHomeScreen() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

const toKey = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

async function registration() {
  // Resolves once the worker main.jsx registered is running.
  return navigator.serviceWorker.ready;
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// This browser's push address, if it has one (kept on a password change).
export async function currentPushEndpoint() {
  try { return (await currentSubscription())?.endpoint || undefined; } catch { return undefined; }
}

// 'unsupported' | 'home-screen' | 'off-server' | 'blocked' | 'on' | 'off'
export async function pushState() {
  if (!pushSupported()) return needsHomeScreen() ? 'home-screen' : 'unsupported';
  const { publicKey } = await api.get('/push/config');
  if (!publicKey) return 'off-server';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await currentSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  const { publicKey } = await api.get('/push/config');
  if (!publicKey) return 'off-server';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
  await api.post('/push/subscribe', sub.toJSON());
  return 'on';
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return 'off';
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  return 'off';
}

// On sign-out: phones are shared between shifts, so this browser stops
// getting the last person's alerts. Best effort, never blocks signing out.
// `token` is the session being signed out, taken before it's cleared.
export async function forgetPushOnSignOut(token) {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    if (token) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
    }
    await sub.unsubscribe();
  } catch {
    // not fatal
  }
}
