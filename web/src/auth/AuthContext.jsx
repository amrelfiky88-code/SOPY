import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api.js';
import { useI18n } from '../i18n/index.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const { setLang } = useI18n();

  // The saved profile language is the user's setting across devices, so
  // it wins over whatever this browser last cached once we know who's
  // signed in.
  const adoptUser = useCallback((u) => {
    setUser(u);
    if (u?.language) setLang(u.language);
  }, [setLang]);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setTenant(null);
      setLoading(false);
      return;
    }
    setOffline(false);
    try {
      const data = await api.get('/auth/me');
      adoptUser(data.user);
      setTenant(data.tenant);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setToken(null);
        setUser(null);
        setTenant(null);
      } else {
        // No signal / server hiccup: keep the saved login and offer a
        // retry. Signing out here logged people out every time the app
        // was opened without a connection.
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [adoptUser]);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setTenant(null);
  }, []);

  // Fired by api.js when a signed-in request comes back 401.
  useEffect(() => {
    window.addEventListener('sopy:signed-out', logout);
    return () => window.removeEventListener('sopy:signed-out', logout);
  }, [logout]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    adoptUser(data.user);
    setTenant(data.tenant);
    return data;
  };

  const signup = async (payload) => {
    const data = await api.post('/auth/signup', payload);
    setToken(data.token);
    adoptUser(data.user);
    setTenant(data.tenant);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, tenant, setTenant, loading, offline, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
