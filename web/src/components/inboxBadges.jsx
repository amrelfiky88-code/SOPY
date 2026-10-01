import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';

// Unread counts for the Inbox tab and the bell. Fetched on every page
// change and once a minute while the app is open, and refreshed straight
// away by a page that has just read something (a thread, the notifications).
const BadgeContext = createContext({ unreadMessages: 0, unreadNotifications: 0, refresh: () => {} });

export function InboxBadgeProvider({ children }) {
  const [counts, setCounts] = useState({ unreadMessages: 0, unreadNotifications: 0 });
  const { pathname } = useLocation();

  const refresh = useCallback(() => {
    api.get('/inbox/summary').then(setCounts).catch(() => {}); // badges are optional
  }, []);

  useEffect(() => { refresh(); }, [pathname, refresh]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return <BadgeContext.Provider value={{ ...counts, refresh }}>{children}</BadgeContext.Provider>;
}

export function useInboxBadges() {
  return useContext(BadgeContext);
}
