import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, setUnauthCallback, getToken } from '../api.js';
import { DEMO_USER } from '../demo/data.js';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(IS_DEMO ? DEMO_USER : null);
  const [loading, setLoading] = useState(!IS_DEMO);

  const logout = useCallback(async () => {
    if (IS_DEMO) return;
    try { await authApi.logout(localStorage.getItem('du_refresh')); } catch {}
    setToken('');
    localStorage.removeItem('du_refresh');
    setUser(null);
  }, []);

  useEffect(() => {
    if (IS_DEMO) return;
    setUnauthCallback(() => setUser(null));
  }, []);

  useEffect(() => {
    if (IS_DEMO) return;
    const init = async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        setUser(await authApi.me());
      } catch {
        try {
          const rt = localStorage.getItem('du_refresh');
          if (rt) {
            const { accessToken } = await authApi.refresh(rt);
            setToken(accessToken);
            setUser(await authApi.me());
          }
        } catch { setToken(''); }
      } finally { setLoading(false); }
    };
    init();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.accessToken);
    localStorage.setItem('du_refresh', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
