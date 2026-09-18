import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, setUnauthCallback, getToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    const rt = localStorage.getItem('du_refresh');
    try { if (rt) await authApi.logout(rt); } catch {}
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
            const { accessToken, refreshToken } = await authApi.refresh(rt);
            setToken(accessToken);
            if (refreshToken) localStorage.setItem('du_refresh', refreshToken);
            setUser(await authApi.me());
          }
        } catch { setToken(''); }
      } finally { setLoading(false); }
    };
    init();
  }, []);

  /* Enregistre les jetons d'une connexion réussie et charge le profil complet */
  const completeLogin = useCallback(async data => {
    setToken(data.accessToken);
    if (data.refreshToken) localStorage.setItem('du_refresh', data.refreshToken);
    const full = await authApi.me().catch(() => data.user);
    setUser(full);
    return full;
  }, []);

  /* Renvoie { mfa_required, mfaToken } sans connecter l'utilisateur si un code 2FA est requis */
  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    if (data.mfa_required) return { mfa_required: true, mfaToken: data.mfaToken };
    const full = await completeLogin(data);
    return { mfa_required: false, user: full };
  };

  const verifyMfa = async (mfaToken, code) => completeLogin(await authApi.verifyMfa(mfaToken, code));

  const refreshUser = useCallback(async () => { setUser(await authApi.me()); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeLogin, verifyMfa, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
