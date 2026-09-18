import { useState, useEffect } from 'react';
import { authApi } from '../api.js';
import { passwordRules, DEFAULT_POLICY } from '../utils/passwordPolicy.js';
import { T } from '../theme.js';

/* Options d'authentification (politique de mot de passe, réinitialisation) chargées une seule fois par page */
let _optionsPromise = null;
export function loadAuthOptions() {
  _optionsPromise ||= authApi.options().catch(() => { _optionsPromise = null; return null; });
  return _optionsPromise;
}

export function usePasswordPolicy() {
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  useEffect(() => {
    let alive = true;
    loadAuthOptions().then(o => { if (alive && o?.password_policy) setPolicy({ ...DEFAULT_POLICY, ...o.password_policy }); });
    return () => { alive = false; };
  }, []);
  return policy;
}

/* Liste ✓ / ✗ des règles de la politique, mise à jour à la frappe */
export default function PasswordChecklist({ password, policy, email, name, style = {} }) {
  const rules = passwordRules(password || '', policy, { email, name });
  return (
    <div style={{ display: 'grid', gap: 3, marginTop: 8, ...style }}>
      {rules.map(r => (
        <div key={r.label} style={{ fontFamily: 'DM Sans', fontSize: 11, color: !password ? T.textDim : r.ok ? T.success : T.danger, display: 'flex', gap: 6 }}>
          <span style={{ width: 10, fontWeight: 700 }}>{r.ok ? '✓' : '✗'}</span>{r.label}
        </div>
      ))}
    </div>
  );
}
