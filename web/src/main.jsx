import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { I18nProvider } from './i18n/index.jsx';
import './styles/theme.css';

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-fatal: app still works without offline caching.
      });
    });
  } else {
    // In dev the worker cached Vite's source modules, so a phone testing
    // over the tunnel kept running old code after a fix. Remove any
    // worker a previous dev session installed.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

// Flags when the on-screen keyboard is likely up, so theme.css can hide
// the fixed bottom bars that would otherwise sit on top of it.
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color', 'image']);
const opensKeyboard = (el) =>
  !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(el.type)));
const syncKeyboardFlag = () => document.documentElement.classList.toggle('keyboard-open', opensKeyboard(document.activeElement));
document.addEventListener('focusin', syncKeyboardFlag);
// focusout fires before focus lands on the next field; check once it has.
document.addEventListener('focusout', () => setTimeout(syncKeyboardFlag, 0));

// Remember a referral code from ?ref=… for 30 days, so someone who opens a
// referral link, browses the site and signs up later is still credited.
try {
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) localStorage.setItem('sopy_ref', JSON.stringify({ code: ref.trim().toUpperCase().slice(0, 16), at: Date.now() }));
} catch { /* storage blocked — the link still works if they sign up right away */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
