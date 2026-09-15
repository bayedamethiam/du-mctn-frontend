import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { refApi, settingsApi } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { SETTINGS_FALLBACK } from '../theme.js';

const RefContext = createContext(null);

// Marqueurs de repli tant que les référentiels ne sont pas chargés (valeurs réelles : ref_lists.meta)
const FLAG_FALLBACK = {
  priority:            { critical: ['critique'], high: ['haute'] },
  program_status:      { nominal: ['on_track'], alert: ['attention', 'risque'], critical: ['risque'] },
  indicator_status:    { nominal: ['on_track'], alert: ['attention', 'risque'], critical: ['risque'] },
  revue_status:        { held: ['tenue'], closed: ['tenue', 'annulee'], open: ['planifiee', 'reportee'] },
  evaluation_status:   { closed: ['terminee'] },
  diligence_status:    { closed: ['fait', 'annule'], done: ['fait'] },
  audience_status:     { held: ['tenue'], closed: ['tenue', 'annulee'], open: ['planifiee', 'reportee'] },
  action_status:       { closed: ['fait'], done: ['fait'] },
  contribution_status: { closed: ['soumis'], done: ['soumis'] },
  partnership_status:  { active: ['actif'] },
};

const parseJson = (v, fallback) => {
  if (v == null || v === '') return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

export function RefProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems]       = useState([]);
  const [settings, setSettings] = useState({});
  const [ready, setReady]       = useState(false);

  const reload = useCallback(async () => {
    try {
      if (user) {
        const [r, s] = await Promise.all([refApi.list(), settingsApi.all()]);
        setItems(r); setSettings(s);
      } else {
        setSettings(await settingsApi.public());
      }
    } catch { /* valeurs de repli */ }
    finally { setReady(true); }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const value = useMemo(() => {
    const byDomain = {};
    for (const it of items) (byDomain[it.domain] ||= []).push(it);

    /* Éléments actifs d'un référentiel (ou tous avec includeInactive) */
    const list = (domain, { includeInactive = false } = {}) =>
      (byDomain[domain] || []).filter(i => includeInactive || i.is_active);
    const item  = (domain, code) => (byDomain[domain] || []).find(i => String(i.code) === String(code));
    const label = (domain, code) => item(domain, code)?.label ?? code ?? '';
    const color = (domain, code, fallback = '#94a3b8') => item(domain, code)?.color || fallback;

    /* Codes portant un marqueur logique (meta) : closed, done, held, open, critical, high, nominal, alert, active */
    const codes = (domain, flag) => {
      const found = (byDomain[domain] || []).filter(i => i.meta?.[flag]).map(i => String(i.code));
      return found.length || byDomain[domain] ? found : (FLAG_FALLBACK[domain]?.[flag] || []);
    };
    const has = (domain, code, flag) => code != null && codes(domain, flag).includes(String(code));

    const setting = key => settings[key] ?? SETTINGS_FALLBACK[key] ?? '';
    /* JSON d'un paramètre ; renvoie fallback si invalide ou d'un type différent (tableau / objet) */
    const json    = (key, fallback) => {
      const v = parseJson(settings[key], parseJson(SETTINGS_FALLBACK[key], fallback));
      if (fallback !== undefined && (Array.isArray(fallback) !== Array.isArray(v) || v === null)) return fallback;
      return v;
    };

    const th = json('score_thresholds', [75, 50, 30]);
    const [t1, t2, t3] = th.length === 3 ? th : [75, 50, 30];
    const scoreColor = s => s >= t1 ? '#10b981' : s >= t2 ? '#06b6d4' : s >= t3 ? '#f59e0b' : '#ef4444';
    const planPeriod = `${setting('plan_start')}–${setting('plan_end')}`;

    return { ready, items, settings, list, item, label, color, codes, has, setting, json, scoreColor, planPeriod, reload };
  }, [items, settings, ready, reload]);

  return <RefContext.Provider value={value}>{children}</RefContext.Provider>;
}

export const useRefData = () => useContext(RefContext);
