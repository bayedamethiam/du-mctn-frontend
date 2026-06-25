import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import LogoDU from '../components/LogoDU.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { T } from '../theme.js';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const inp = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 600, height: 600, background: `radial-gradient(circle,${T.teal}0a 0%,transparent 70%)`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '20%', width: 400, height: 400, background: 'radial-gradient(circle,#8b5cf60a 0%,transparent 70%)', borderRadius: '50%' }} />
      </div>
      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <LogoDU size="md" />
          <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted, marginTop: 0 }}>New Deal Technologique 2025–2034</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontFamily: 'DM Sans', fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 4 }}>Connexion</h2>
          <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted, marginBottom: 24 }}>Accès réservé aux agents habilités</p>
          {error && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontFamily: 'DM Sans', fontSize: 13, color: '#ef4444' }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 6 }}>Adresse email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textDim }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom.nom@mctn.sn" required style={{ ...inp, width: '100%', padding: '11px 14px 11px 36px' }} />
              </div>
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 6 }}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textDim }} />
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ ...inp, width: '100%', padding: '11px 40px 11px 36px' }} />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.textDim }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              style={{ marginTop: 8, padding: 12, borderRadius: 9, border: 'none', background: `linear-gradient(135deg,${T.teal},${T.tealDark})`, color: '#fff', fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading && <div style={{ width: 16, height: 16, border: '2px solid #fff5', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: 20 }}>
          © 2025 Ministère de la Communication, des Télécommunications et du Numérique · Sénégal
        </p>
      </div>
    </div>
  );
}
