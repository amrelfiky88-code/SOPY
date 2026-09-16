import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setTenant(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setTenant(data.tenant);
    } catch {
      setToken(null);
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    setTenant(data.tenant);
    return data;
  };

  const signup = async (payload) => {
    const data = await api.post('/auth/signup', payload);
    setToken(data.token);
    setUser(data.user);
    setTenant(data.tenant);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, setTenant, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
