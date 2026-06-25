import { useState } from 'react';
import { BarChart3, FolderKanban, FileText, Handshake, MessageSquare, BarChart2, Users, AlertCircle, LogOut, ChevronDown, CalendarDays } from 'lucide-react';
import { T } from '../theme.js';
import { useAuth } from '../context/AuthContext.jsx';
import LogoDU from './LogoDU.jsx';

const NAV = [
  { id: 'dashboard',    icon: BarChart3,     label: 'Dashboard' },
  { id: 'portefeuille', icon: FolderKanban,  label: 'Portefeuille NDT' },
  { id: 'diligences',   icon: FileText,      label: 'Diligences' },
  { id: 'partenariats', icon: Handshake,     label: 'Partenariats' },
  { id: 'audiences',    icon: MessageSquare, label: 'Audiences' },
  { id: 'se',           icon: BarChart2,     label: 'Suivi-Évaluation' },
  { id: 'equipe',       icon: Users,         label: 'Équipe & DU' },
  { id: 'calendrier',  icon: CalendarDays,  label: 'Calendrier' },
];

export default function Layout({ view, setView, alerts, children }) {
  const { user, logout } = useAuth();
  const [menu, setMenu]  = useState(false);
  const urgDil = alerts?.critical_diligences?.length || 0;
  const pendAud = alerts?.pending_audience_followups?.length || 0;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ background: `linear-gradient(90deg,${T.navyMid} 0%,#0a1e3d 100%)`, borderBottom: `1px solid rgba(255,255,255,0.1)`, position: 'sticky', top: 0, zIndex: 50 }}>
        {/* Brand bar */}
        <div style={{ padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <LogoDU size="sm" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {urgDil > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.15)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertCircle size={12} color="#ef4444" />
                <span style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, color: '#ef4444' }}>{urgDil} critique{urgDil > 1 ? 's' : ''}</span>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <div onClick={() => setMenu(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: menu ? T.surface2 : 'transparent' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${T.teal}22`, border: `1.5px solid ${T.teal}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 12, color: T.teal }}>{(user?.name || 'U').slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.text }}>{user?.name}</div>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim }}>{user?.role} · DU</div>
                </div>
                <ChevronDown size={14} color={T.textDim} />
              </div>
              {menu && (
                <div className="slide-in" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#0d1f3c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 6, minWidth: 180, zIndex: 100 }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>Connecté en tant que</div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.text }}>{user?.email}</div>
                  </div>
                  <button onClick={() => { logout(); setMenu(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: 13, fontFamily: 'DM Sans', cursor: 'pointer', borderRadius: 7, textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <LogOut size={14} /> Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Navigation */}
        <div style={{ padding: '0 28px', display: 'flex', gap: 2, overflowX: 'auto' }}>
          {NAV.map(n => {
            const active = view === n.id;
            const hasAlert = (n.id === 'diligences' && urgDil > 0) || (n.id === 'audiences' && pendAud > 0);
            return (
              <button key={n.id} onClick={() => setView(n.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'DM Sans', fontSize: 12, fontWeight: active ? 600 : 400, padding: '13px 15px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? T.teal : 'transparent'}`, color: active ? T.teal : T.textMuted, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', position: 'relative' }}>
                <n.icon size={13} />{n.label}
                {hasAlert && <span style={{ position: 'absolute', top: 10, right: 8, width: 6, height: 6, background: '#ef4444', borderRadius: '50%' }} />}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>{children}</div>
    </div>
  );
}
