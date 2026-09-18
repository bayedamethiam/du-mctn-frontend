import { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import LogoDU from '../components/LogoDU.jsx';
import PasswordChecklist, { loadAuthOptions } from '../components/PasswordChecklist.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../api.js';
import { T } from '../theme.js';
import { useRefData } from '../context/RefContext.jsx';
import { checkPassword, DEFAULT_POLICY } from '../utils/passwordPolicy.js';
import { parseServerDate } from '../utils/authFormat.js';

const URL_PARAMS = ['reset_token'];

/* Lien de réinitialisation du mot de passe, lu une seule fois */
function readUrlParams() {
  const q = new URLSearchParams(window.location.search);
  return { resetToken: q.get('reset_token') || '' };
}

function cleanUrl() {
  const q = new URLSearchParams(window.location.search);
  if (!URL_PARAMS.some(k => q.has(k))) return;
  URL_PARAMS.forEach(k => q.delete(k));
  const qs = q.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
}

function loginErrorMessage(err) {
  if (err?.status === 423) {
    const until = parseServerDate(err.data?.locked_until);
    return until ? `${err.message} (jusqu'à ${until.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})` : err.message;
  }
  return err?.message || 'Erreur de connexion';
}

export default function Login() {
  const { login, verifyMfa } = useAuth();
  const ref = useRefData();
  const [initial] = useState(readUrlParams);
  const [step, setStep]         = useState(initial.resetToken ? 'reset' : 'password'); // password | mfa | forgot | reset
  const [options, setOptions]   = useState(null);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode]         = useState('');
  const [recovery, setRecovery] = useState(false);
  const [reset, setReset]       = useState({ password: '', confirm: '' });

  useEffect(() => {
    loadAuthOptions().then(o => o && setOptions(o));
    cleanUrl();
  }, []);

  const policy = { ...DEFAULT_POLICY, ...(options?.password_policy || {}) };

  const go = s => { setStep(s); setError(''); setInfo(''); setCode(''); setRecovery(false); };

  const run = async fn => {
    setError(''); setInfo(''); setLoading(true);
    try { await fn(); }
    catch (err) { setError(loginErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const submitPassword = e => {
    e.preventDefault();
    run(async () => {
      const r = await login(email, password);
      if (r?.mfa_required) { setMfaToken(r.mfaToken); setPassword(''); go('mfa'); }
    });
  };

  const submitMfa = e => {
    e.preventDefault();
    run(async () => {
      try { await verifyMfa(mfaToken, code.trim()); }
      catch (err) {
        if (err.status === 401 && /expir/i.test(err.message)) { go('password'); }
        throw err;
      }
    });
  };

  const submitForgot = e => {
    e.preventDefault();
    run(async () => {
      await authApi.forgotPassword(email);
      setInfo('Si un compte existe pour cette adresse, un email contenant un lien de réinitialisation a été envoyé.');
    });
  };

  const submitReset = e => {
    e.preventDefault();
    const unmet = checkPassword(reset.password, policy);
    if (unmet.length) return setError(`Mot de passe non conforme : ${unmet.join(' · ')}`);
    if (reset.password !== reset.confirm) return setError('La confirmation ne correspond pas');
    run(async () => {
      await authApi.resetPassword(initial.resetToken, reset.password);
      setReset({ password: '', confirm: '' });
      go('password');
      setInfo('Mot de passe réinitialisé. Vous pouvez vous connecter.');
    });
  };

  const inp   = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' };
  const label = { fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 6 };
  const icon  = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textDim };
  const link  = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, color: T.teal };

  const Submit = ({ children, busy }) => (
    <button type="submit" disabled={loading}
      style={{ marginTop: 8, padding: 12, borderRadius: 9, border: 'none', background: `linear-gradient(135deg,${T.teal},${T.tealDark})`, color: '#fff', fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {loading && <div style={{ width: 16, height: 16, border: '2px solid #fff5', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
      {loading ? busy : children}
    </button>
  );

  const BackLink = ({ to = 'password', children = 'Retour à la connexion' }) => (
    <button type="button" onClick={() => go(to)} style={{ ...link, color: T.textMuted, display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'center', marginTop: 4 }}>
      <ArrowLeft size={13} /> {children}
    </button>
  );

  const PasswordField = ({ value, onChange, placeholder = '••••••••', autoFocus }) => (
    <div style={{ position: 'relative' }}>
      <Lock size={14} style={icon} />
      <input type={showPwd ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required autoFocus={autoFocus} style={{ ...inp, width: '100%', padding: '11px 40px 11px 36px' }} />
      <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textDim }}>
        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );

  const TITLES = {
    password: ['Connexion', 'Accès réservé aux agents habilités'],
    mfa:      ['Vérification en deux étapes', recovery ? 'Saisissez l\'un de vos codes de secours' : 'Saisissez le code à 6 chiffres de votre application d\'authentification'],
    forgot:   ['Mot de passe oublié', 'Indiquez votre adresse email pour recevoir un lien de réinitialisation'],
    reset:    ['Nouveau mot de passe', 'Choisissez un mot de passe personnel robuste'],
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 600, height: 600, background: `radial-gradient(circle,${T.teal}0a 0%,transparent 70%)`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '20%', width: 400, height: 400, background: 'radial-gradient(circle,#8b5cf60a 0%,transparent 70%)', borderRadius: '50%' }} />
      </div>
      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <LogoDU size="md" />
          <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted, marginTop: 0 }}>{ref.setting('plan_name')} {ref.planPeriod}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontFamily: 'DM Sans', fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>{TITLES[step][0]}</h2>
          <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted, marginBottom: 24 }}>{TITLES[step][1]}</p>
          {error && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontFamily: 'DM Sans', fontSize: 13, color: '#ef4444' }}>{error}</div>}
          {info && <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontFamily: 'DM Sans', fontSize: 13, color: T.success }}>{info}</div>}

          {step === 'password' && (
            <>
              <form onSubmit={submitPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={label}>Adresse email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={icon} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={`prenom.nom@${ref.setting('email_domain')}`} required autoComplete="username" style={{ ...inp, width: '100%', padding: '11px 14px 11px 36px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={label}>Mot de passe</label>
                    {options?.password_reset && <button type="button" onClick={() => go('forgot')} style={link}>Mot de passe oublié ?</button>}
                  </div>
                  {PasswordField({ value: password, onChange: setPassword })}
                </div>
                <Submit busy="Connexion…">Se connecter</Submit>
              </form>
            </>
          )}

          {step === 'mfa' && (
            <form onSubmit={submitMfa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>{recovery ? 'Code de secours' : 'Code de vérification'}</label>
                <div style={{ position: 'relative' }}>
                  {recovery ? <KeyRound size={14} style={icon} /> : <ShieldCheck size={14} style={icon} />}
                  {recovery
                    ? <input key="rec" type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 9))} placeholder="XXXX-XXXX" required autoFocus autoComplete="off"
                        style={{ ...inp, width: '100%', padding: '11px 14px 11px 36px', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }} />
                    : <input key="otp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required autoFocus autoComplete="one-time-code"
                        style={{ ...inp, width: '100%', padding: '11px 14px 11px 36px', fontFamily: 'monospace', fontSize: 18, letterSpacing: 6 }} />}
                </div>
              </div>
              <Submit busy="Vérification…">Vérifier</Submit>
              <button type="button" onClick={() => { setRecovery(v => !v); setCode(''); setError(''); }} style={{ ...link, alignSelf: 'center' }}>
                {recovery ? 'Utiliser le code de l\'application' : 'Utiliser un code de secours'}
              </button>
              <BackLink />
            </form>
          )}

          {step === 'forgot' && (
            <form onSubmit={submitForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Adresse email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={icon} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={`prenom.nom@${ref.setting('email_domain')}`} required autoFocus style={{ ...inp, width: '100%', padding: '11px 14px 11px 36px' }} />
                </div>
              </div>
              {!info && <Submit busy="Envoi…">Envoyer le lien</Submit>}
              <BackLink />
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={submitReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Nouveau mot de passe</label>
                {PasswordField({ value: reset.password, onChange: v => setReset(r => ({ ...r, password: v })), autoFocus: true })}
                <PasswordChecklist password={reset.password} policy={policy} />
              </div>
              <div>
                <label style={label}>Confirmation</label>
                {PasswordField({ value: reset.confirm, onChange: v => setReset(r => ({ ...r, confirm: v })) })}
                {reset.confirm && reset.confirm !== reset.password && <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.danger, marginTop: 6 }}>✗ La confirmation ne correspond pas</div>}
              </div>
              <Submit busy="Enregistrement…">Réinitialiser le mot de passe</Submit>
              <BackLink />
            </form>
          )}
        </div>
        <p style={{ textAlign: 'center', fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: 20 }}>
          © {new Date().getFullYear()} {ref.setting('ministry_name')} · {ref.setting('country')}
        </p>
      </div>
    </div>
  );
}
