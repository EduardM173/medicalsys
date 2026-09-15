import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMe, loginRequest, logoutRequest, setStoredToken } from '../services/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshUser = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        setStoredToken(urlToken);
        params.delete('token');
        const cleanSearch = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState({}, document.title, `${window.location.pathname}${cleanSearch}`);
      }
    } catch (_e) {}

    try { const response = await getMe(); setUser(response.user); }
    catch (error) { if (error.status === 401 || error.status === 403) setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refreshUser();
    const timer = setInterval(refreshUser, 30000);
    window.addEventListener('focus', refreshUser);
    window.addEventListener('permissions-changed', refreshUser);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshUser);
      window.removeEventListener('permissions-changed', refreshUser);
    };
  }, [refreshUser]);
  async function login(email, password) {
    const response = await loginRequest({ email, password });
    setUser(response.user);
    return { ...response.user, token: response.token };
  }
  async function logout() { try { await logoutRequest(); } finally { setUser(null); } }
  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
