import { useState, useEffect } from 'react';
import { authApi, usersApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRefData } from '../context/RefContext.jsx';
import { Modal, ModalFooter, Input, Select, ErrorBanner } from './UI.jsx';
import { T } from '../theme.js';

const lbl = { fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 };

/* Profil + changement de mot de passe. forced = mot de passe provisoire à changer obligatoirement */
export default function AccountModal({ open, onClose, forced = false }) {
  const { user, refreshUser } = useAuth();
  const ref = useRefData();
  const [profile, setProfile] = useState({ name: '', department: '', phone: '' });
  const [pwd, setPwd]         = useState({ current: '', next: '', confirm: '' });
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (open && user) setProfile({ name: user.name || '', department: user.department || '', phone: user.phone || '' });
    setPwd({ current: '', next: '', confirm: '' }); setError(''); setInfo('');
  }, [open, user?.id]);

  const save = async () => {
    setError(''); setInfo('');
    const wantsPwd = forced || pwd.current || pwd.next;
    if (wantsPwd) {
      if (pwd.next.length < 8) return setError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      if (pwd.next !== pwd.confirm) return setError('La confirmation ne correspond pas');
    }
    setSaving(true);
    try {
      if (!forced) await usersApi.update(user.id, profile);
      if (wantsPwd) await authApi.changePassword(pwd.current, pwd.next);
      await refreshUser();
      if (forced) onClose(); else setInfo('Modifications enregistrées');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={forced ? () => {} : onClose} title={forced ? 'Choisissez votre mot de passe' : 'Mon compte'}>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      {info && <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.success, marginBottom: 12 }}>✓ {info}</div>}
      {forced && <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted, marginBottom: 16 }}>Votre mot de passe est provisoire. Définissez un mot de passe personnel pour continuer.</p>}
      {!forced && (
        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <div><label style={lbl}>Nom complet</label><Input value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Pôle / département</label>
              <Select value={profile.department} onChange={v => setProfile(p => ({ ...p, department: v }))}>
                <option value="">—</option>
                {ref.list('team_pole').map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </Select>
            </div>
            <div><label style={lbl}>Téléphone</label><Input value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder={ref.setting('phone_prefix')} /></div>
          </div>
          <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>{user?.email} · {ref.label('user_role', user?.role)}</div>
        </div>
      )}
      <div style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textDim, marginBottom: 10 }}>
        {forced ? 'Mot de passe' : 'Changer le mot de passe (optionnel)'}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><label style={lbl}>Mot de passe actuel{forced ? ' (provisoire)' : ''}</label><Input type="password" value={pwd.current} onChange={v => setPwd(p => ({ ...p, current: v }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>Nouveau (8 caractères min.)</label><Input type="password" value={pwd.next} onChange={v => setPwd(p => ({ ...p, next: v }))} /></div>
          <div><label style={lbl}>Confirmation</label><Input type="password" value={pwd.confirm} onChange={v => setPwd(p => ({ ...p, confirm: v }))} /></div>
        </div>
      </div>
      <ModalFooter onCancel={forced ? undefined : onClose} onConfirm={save} loading={saving} />
    </Modal>
  );
}
