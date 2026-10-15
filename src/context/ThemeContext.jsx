import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { applyTheme, resolveMode } from '../theme.js';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'du_theme';

/* Préférence d'apparence : 'light', 'dark' ou 'system'.
 * Choix mémorisé par navigateur ; à défaut, valeur par défaut de l'organisation (paramètre
 * default_theme) transmise par RefContext via setDefault(). */
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'system'; } catch { return 'system'; }
  });
  const [resolved, setResolved] = useState(() => applyTheme(mode));

  useEffect(() => { setResolved(applyTheme(mode)); }, [mode]);

  // En mode système, suivre les changements de réglage du système d'exploitation
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const choose = useCallback(next => {
    setMode(next);
    // 'system' est mémorisé comme les autres : sans cela, la valeur par défaut de
    // l'organisation reprendrait la main au rechargement suivant
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* stockage indisponible */ }
  }, []);

  /* Valeur par défaut de l'organisation, appliquée tant que l'utilisateur n'a rien choisi */
  const setDefault = useCallback(value => {
    if (!['light', 'dark'].includes(value)) return;
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (!stored) { setMode(value); setResolved(applyTheme(value)); }
  }, []);

  const value = useMemo(() => ({ mode, resolved, choose, setDefault, isDark: resolved === 'dark' }),
    [mode, resolved, choose, setDefault]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext) || { mode: 'dark', resolved: 'dark', isDark: true, choose: () => {}, setDefault: () => {} };
export { resolveMode };
