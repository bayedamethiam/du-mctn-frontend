import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Shield, MonitorSmartphone, Copy, Check, ShieldCheck, ShieldOff, RefreshCw, LogOut } from 'lucide-react';
import { authApi, usersApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRefData } from '../context/RefContext.jsx';
import { Modal, ModalFooter, Input, Select, ErrorBanner, Btn, RoleChip, Spinner } from './UI.jsx';
import PasswordChecklist, { usePasswordPolicy } from './PasswordChecklist.jsx';
import { checkPassword } from '../utils/passwordPolicy.js';
import { fmtDateTime, shortUserAgent } from '../utils/authFormat.js';
import { T } from '../theme.js';

const lbl  = { fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 };
const sect = { fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textDim, marginBottom: 10 };
const txt  = { fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted };
const Info = ({ children }) => children ? <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.success, marginBottom: 12 }}>✓ {children}</div> : null;

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); document.body.removeChild(ta);
    return ok;
  }
}

function CopyBtn({ text, label = 'Copier' }) {
  const [done, setDone] = useState(false);
  return (
    <Btn size="sm" variant="ghost" onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 2000); } }}>
      {done ? <><Check size={12} /> Copié</> : <><Copy size={12} /> {label}</>}
    </Btn>
  );
}

const codeInput = (value, onChange, { placeholder = '000000', numeric = false } = {}) => (
  <input type="text" inputMode={numeric ? "numeric" : "text"} autoComplete="one-time-code" maxLength={9} value={value} placeholder={placeholder}
    onChange={e => onChange(e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, '').slice(0, 9))}
    style={{ width: '100%', background: T.field, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', color: T.text, fontSize: 16, fontFamily: 'monospace', letterSpacing: 4, outline: 'none' }} />
);

/* ── Changement de mot de passe ───────────────────────────────── */
function PasswordSection({ forced, onDone }) {
  const { user, refreshUser } = useAuth();
  const policy = usePasswordPolicy();
  const [pwd, setPwd]       = useState({ current: '', next: '', confirm: '' });
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(''); setInfo('');
    if (!pwd.current) return setError('Saisissez votre mot de passe actuel');
    const unmet = checkPassword(pwd.next, policy, { email: user?.email, name: user?.name });
    if (unmet.length) return setError(`Mot de passe non conforme : ${unmet.join(' · ')}`);
    if (pwd.next !== pwd.confirm) return setError('La confirmation ne correspond pas');
    setSaving(true);
    try {
      await authApi.changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '', confirm: '' });
      if (forced) return onDone?.();
      await refreshUser();
      setInfo('Mot de passe modifié');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <Info>{info}</Info>
      {forced && <p style={{ ...txt, marginBottom: 16 }}>Votre mot de passe est provisoire. Définissez un mot de passe personnel pour continuer.</p>}
      <div style={sect}>{forced ? 'Mot de passe' : 'Changer le mot de passe'}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><label style={lbl}>Mot de passe actuel{forced ? ' (provisoire)' : ''}</label><Input type="password" value={pwd.current} onChange={v => setPwd(p => ({ ...p, current: v }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>Nouveau mot de passe</label><Input type="password" value={pwd.next} onChange={v => setPwd(p => ({ ...p, next: v }))} /></div>
          <div><label style={lbl}>Confirmation</label><Input type="password" value={pwd.confirm} onChange={v => setPwd(p => ({ ...p, confirm: v }))} /></div>
        </div>
        <PasswordChecklist password={pwd.next} policy={policy} email={user?.email} name={user?.name} style={{ marginTop: 0 }} />
      </div>
      {forced
        ? <ModalFooter onConfirm={save} loading={saving} />
        : <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn size="sm" onClick={save} disabled={saving}>{saving ? <Spinner size={12} color="#fff" /> : 'Changer le mot de passe'}</Btn>
          </div>}
    </div>
  );
}

/* ── Codes de secours (affichés une seule fois) ───────────────── */
function RecoveryCodes({ codes, onAck }) {
  return (
    <div>
      <div style={{ background: `${T.warning}15`, border: `1px solid ${T.warning}55`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontFamily: 'DM Sans', fontSize: 12, color: T.warning }}>
        Conservez ces codes de secours en lieu sûr : ils ne seront plus affichés. Chaque code ne peut servir qu'une fois si vous perdez l'accès à votre application d'authentification.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
        {codes.map(c => (
          <div key={c} style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: 1.5, color: T.text, background: T.field, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>{c}</div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <CopyBtn text={codes.join('\n')} label="Copier les codes" />
        <Btn onClick={onAck}><Check size={14} /> J'ai enregistré mes codes</Btn>
      </div>
    </div>
  );
}

/* ── Activation de la 2FA : QR code → code de confirmation → codes de secours ── */
function MfaSetupFlow({ onEnabled, onCancel, autoStart = false }) {
  const [setup, setSetup]     = useState(null);
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    setError(''); setLoading(true);
    try { setSetup(await authApi.mfaSetup()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  // Garde : un seul appel même avec le double montage de React.StrictMode (sinon deux secrets différents)
  const started = useRef(false);
  useEffect(() => { if (autoStart && !started.current) { started.current = true; start(); } }, [autoStart, start]);

  const enable = async () => {
    if (!/^\d{6}$/.test(code)) return setError('Saisissez le code à 6 chiffres affiché par l\'application');
    setError(''); setLoading(true);
    try { const r = await authApi.mfaEnable(code); onEnabled(r.recovery_codes || []); }
    catch (e) { setError(e.message); setLoading(false); }
  };

  if (!setup) return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div>
        : <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={start}><ShieldCheck size={14} /> {autoStart ? 'Réessayer' : 'Activer la double authentification'}</Btn>
            {onCancel && <Btn variant="outline" color={T.textMuted} onClick={onCancel}>Annuler</Btn>}
          </div>}
    </div>
  );

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <ol style={{ ...txt, fontSize: 12, paddingLeft: 18, margin: '0 0 14px', display: 'grid', gap: 4 }}>
        <li>Installez une application d'authentification (Microsoft Authenticator, Google Authenticator, FreeOTP…).</li>
        <li>Scannez le QR code ou saisissez la clé manuellement.</li>
        <li>Entrez le code à 6 chiffres généré pour confirmer.</li>
      </ol>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {setup.qr_data_url && <img src={setup.qr_data_url} alt="QR code 2FA" width={168} height={168} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={lbl}>Clé secrète (saisie manuelle)</label>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: T.text, background: T.field, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 10px', wordBreak: 'break-all', marginBottom: 6 }}>{setup.secret}</div>
          <CopyBtn text={setup.secret} label="Copier la clé" />
        </div>
      </div>
      <label style={lbl}>Code de vérification</label>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>{codeInput(code, v => setCode(v.replace(/\D/g, '').slice(0, 6)), { numeric: true })}</div>
        <Btn onClick={enable} disabled={loading}>{loading ? <Spinner size={14} color="#fff" /> : 'Activer'}</Btn>
      </div>
      {onCancel && <div style={{ marginTop: 10 }}><Btn size="sm" variant="outline" color={T.textMuted} onClick={onCancel}>Annuler</Btn></div>}
    </div>
  );
}

/* ── Bloc 2FA de l'onglet Sécurité ────────────────────────────── */
function MfaSection() {
  const { user, refreshUser } = useAuth();
  const ref = useRefData();
  const [mode, setMode]     = useState('idle');   // idle | setup | codes | regen | disable
  const [codes, setCodes]   = useState([]);
  const [form, setForm]     = useState({ password: '', code: '' });
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');
  const [saving, setSaving] = useState(false);

  const requiredRoles = ref.json('mfa_required_roles', ['admin', 'director']);
  const mandatory     = requiredRoles.includes(user?.role);
  const enabled       = !!Number(user?.mfa_enabled);

  const reset = m => { setMode(m); setForm({ password: '', code: '' }); setError(''); setInfo(''); };

  const regen = async () => {
    setError(''); setSaving(true);
    try { const r = await authApi.regenerateRecoveryCodes(form.code); setCodes(r.recovery_codes || []); setMode('codes'); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const disable = async () => {
    setError(''); setSaving(true);
    try { await authApi.mfaDisable(form.password, form.code); await refreshUser(); reset('idle'); setInfo('Double authentification désactivée'); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ ...sect, display: 'flex', alignItems: 'center', gap: 8 }}>
        Double authentification (2FA)
        {enabled ? <span style={{ color: T.success, letterSpacing: 0.5 }}>● Activée</span> : <span style={{ color: T.textDim, letterSpacing: 0.5 }}>○ Désactivée</span>}
      </div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <Info>{info}</Info>

      {mode === 'codes' && <RecoveryCodes codes={codes} onAck={() => reset('idle')} />}

      {mode === 'setup' && (
        <MfaSetupFlow autoStart onCancel={() => reset('idle')}
          onEnabled={async list => { setCodes(list); setMode('codes'); await refreshUser().catch(() => {}); }} />
      )}

      {mode === 'idle' && !enabled && (
        <div>
          <p style={{ ...txt, fontSize: 12, marginBottom: 12 }}>
            Protégez votre compte avec un code temporaire généré par une application sur votre téléphone, demandé à chaque connexion.
            {mandatory && ' La double authentification est obligatoire pour votre rôle.'}
          </p>
          <Btn onClick={() => reset('setup')}><ShieldCheck size={14} /> Activer la double authentification</Btn>
        </div>
      )}

      {mode === 'idle' && enabled && (
        <div>
          <p style={{ ...txt, fontSize: 12, marginBottom: 12 }}>Un code de votre application d'authentification est demandé à chaque connexion.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn size="sm" variant="ghost" onClick={() => reset('regen')}><RefreshCw size={12} /> Régénérer les codes de secours</Btn>
            {!mandatory && <Btn size="sm" variant="ghost" color={T.danger} onClick={() => reset('disable')}><ShieldOff size={12} /> Désactiver</Btn>}
          </div>
          {mandatory && <p style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: 8 }}>La désactivation n'est pas possible : la double authentification est obligatoire pour le rôle « {ref.roleLabel(user?.role)} ».</p>}
        </div>
      )}

      {mode === 'regen' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ ...txt, fontSize: 12 }}>Les anciens codes de secours seront invalidés. Confirmez avec un code de votre application.</p>
          <div><label style={lbl}>Code de vérification</label>{codeInput(form.code, v => setForm(p => ({ ...p, code: v })), { placeholder: '000000 ou XXXX-XXXX' })}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn size="sm" variant="outline" color={T.textMuted} onClick={() => reset('idle')}>Annuler</Btn>
            <Btn size="sm" onClick={regen} disabled={saving || !form.code}>{saving ? <Spinner size={12} color="#fff" /> : 'Régénérer'}</Btn>
          </div>
        </div>
      )}

      {mode === 'disable' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ ...txt, fontSize: 12 }}>Confirmez avec votre mot de passe et un code de votre application (ou un code de secours).</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Mot de passe</label><Input type="password" value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} /></div>
            <div><label style={lbl}>Code</label>{codeInput(form.code, v => setForm(p => ({ ...p, code: v })), { placeholder: '000000 ou XXXX-XXXX' })}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn size="sm" variant="outline" color={T.textMuted} onClick={() => reset('idle')}>Annuler</Btn>
            <Btn size="sm" color={T.danger} onClick={disable} disabled={saving || !form.password || !form.code}>{saving ? <Spinner size={12} color="#fff" /> : 'Désactiver la 2FA'}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sessions actives ─────────────────────────────────────────── */
function SessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [busy, setBusy]         = useState(null);

  const load = useCallback(() => {
    authApi.sessions().then(setSessions).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, msg) => {
    setError(''); setInfo(''); setBusy(key);
    try { const r = await fn(); setInfo(typeof msg === 'function' ? msg(r) : msg); load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Spinner /></div>;
  const others = sessions.filter(s => !s.current);

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <Info>{info}</Info>
      <div style={{ display: 'grid', gap: 8 }}>
        {sessions.length === 0 && <p style={txt}>Aucune session active.</p>}
        {sessions.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: T.surface2, border: `1px solid ${s.current ? `${T.teal}55` : T.border}`, borderRadius: 8 }}>
            <MonitorSmartphone size={18} color={s.current ? T.teal : T.textDim} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }} title={s.user_agent || ''}>
                {shortUserAgent(s.user_agent)}
                {s.current && <span style={{ background: `${T.teal}26`, color: T.teal, padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>Cette session</span>}
              </div>
              <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>
                {s.ip || 'IP inconnue'} · dernière activité {fmtDateTime(s.last_used_at || s.created_at)} · ouverte le {fmtDateTime(s.created_at)}
              </div>
            </div>
            {!s.current && (
              <Btn size="sm" variant="ghost" color={T.danger} disabled={busy === s.id} onClick={() => act(s.id, () => authApi.revokeSession(s.id), 'Session déconnectée')}>
                {busy === s.id ? <Spinner size={12} color={T.danger} /> : <><LogOut size={12} /> Déconnecter</>}
              </Btn>
            )}
          </div>
        ))}
      </div>
      {others.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn size="sm" variant="outline" color={T.danger} disabled={busy === 'others'}
            onClick={() => window.confirm('Déconnecter toutes les autres sessions ?') && act('others', authApi.revokeOtherSessions, r => `${r?.revoked ?? others.length} session(s) déconnectée(s)`)}>
            <LogOut size={12} /> Déconnecter les autres sessions
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ── Profil ───────────────────────────────────────────────────── */
function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const ref = useRefData();
  const [profile, setProfile] = useState({ name: user?.name || '', department: user?.department || '', phone: user?.phone || '' });
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setError(''); setInfo(''); setSaving(true);
    try { await usersApi.update(user.id, profile); await refreshUser(); setInfo('Modifications enregistrées'); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <Info>{info}</Info>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><label style={lbl}>Nom complet</label><Input value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>Pôle / département</label>
            <Select value={profile.department} onChange={v => setProfile(p => ({ ...p, department: v }))}>
              <option value="">-</option>
              {ref.list('team_pole').map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </Select>
          </div>
          <div><label style={lbl}>Téléphone</label><Input value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder={ref.setting('phone_prefix')} /></div>
        </div>
        <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>
          {user?.email} · <RoleChip code={user?.role} title={ref.role?.(user?.role)?.description || undefined} />
          {user?.last_login_at ? ` · dernière connexion ${fmtDateTime(user.last_login_at)}` : ''}
        </div>
      </div>
      <ModalFooter onConfirm={save} loading={saving} />
    </div>
  );
}

/* Sortie de secours des modales obligatoires */
const ForcedLogout = ({ onLogout }) => (
  <div style={{ textAlign: 'center', marginTop: 16 }}>
    <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, color: T.textDim, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <LogOut size={12} /> Se déconnecter
    </button>
  </div>
);

const TABS = [
  { id: 'profile',  label: 'Profil',   icon: User },
  { id: 'security', label: 'Sécurité', icon: Shield },
  { id: 'sessions', label: 'Sessions', icon: MonitorSmartphone },
];

/* Mon compte : profil, sécurité (mot de passe, 2FA), sessions.
 * forced = 'password' (mot de passe provisoire) | 'mfa' (2FA obligatoire à configurer) : modale non fermable. */
export default function AccountModal({ open, onClose, forced = false }) {
  const mode = forced === true ? 'password' : forced || null;
  const { logout } = useAuth();
  const [tab, setTab]     = useState('profile');
  const [codes, setCodes] = useState(null);

  useEffect(() => { if (open) { setTab('profile'); setCodes(null); } }, [open]);

  if (mode === 'password') return (
    <Modal open={open} onClose={() => {}} title="Choisissez votre mot de passe">
      <PasswordSection forced onDone={onClose} />
      <ForcedLogout onLogout={logout} />
    </Modal>
  );

  if (mode === 'mfa') return (
    <Modal open={open} onClose={() => {}} title="Activez la double authentification" width={560}>
      {codes
        ? <RecoveryCodes codes={codes} onAck={onClose} />
        : <>
            <p style={{ ...txt, marginBottom: 16 }}>La double authentification est obligatoire pour votre rôle. Configurez-la pour accéder à l'application.</p>
            <MfaSetupFlow autoStart onEnabled={setCodes} />
            <ForcedLogout onLogout={logout} />
          </>}
    </Modal>
  );

  return (
    <Modal open={open} onClose={onClose} title="Mon compte" width={600}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${tab === t.id ? T.teal : T.border}`, background: tab === t.id ? `${T.teal}18` : 'transparent', color: tab === t.id ? T.teal : T.textMuted }}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'security' && (
        <div style={{ display: 'grid', gap: 24 }}>
          <PasswordSection />
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}><MfaSection /></div>
        </div>
      )}
      {tab === 'sessions' && <SessionsTab />}
    </Modal>
  );
}
