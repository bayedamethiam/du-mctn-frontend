import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, setUnauthCallback, getToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try { await authApi.logout(localStorage.getItem('du_refresh')); } catch {}
    setToken('');
    localStorage.removeItem('du_refresh');
    setUser(null);
  }, []);

  useEffect(() => { setUnauthCallback(() => setUser(null)); }, []);

  useEffect(() => {
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
