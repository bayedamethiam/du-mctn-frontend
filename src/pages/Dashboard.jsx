import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, FileText, MessageSquare } from 'lucide-react';
import { dashboardApi, programsApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';

export default function Dashboard() {
  const [kpis, setKpis]       = useState(null);
  const [alerts, setAlerts]   = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    Promise.all([dashboardApi.kpis(), dashboardApi.alerts(), programsApi.list()])
      .then(([k, a, p]) => { setKpis(k); setAlerts(a); setPrograms(p); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={36} /></div>;

  const kpiCards = [
    { icon: CheckCircle,   label: 'Projets on track',    value: kpis?.programs?.on_track || 0,                                         sub: `${kpis?.avg_progress || 0}% avancement moyen`, color: '#10b981' },
    { icon: AlertCircle,   label: 'Projets en alerte',   value: (kpis?.programs?.attention || 0) + (kpis?.programs?.risque || 0),       sub: 'Attention requise',                           color: '#f59e0b' },
    { icon: FileText,      label: 'Diligences critiques', value: kpis?.diligences?.urgentes || 0,                                        sub: 'À traiter en urgence',                        color: '#ef4444' },
    { icon: MessageSquare, label: 'Audiences : suivi',   value: kpis?.audiences_suivi || 0,                                             sub: 'Suites à donner',                             color: '#8b5cf6' },
  ];

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Delivery Unit · MCTN" title="Tableau de bord stratégique"
        subtitle="New Deal Technologique 2025–2034 · Pilotage en temps réel"
        stats={[
          { value: '50+', label: 'Projets actifs' },
          { value: '12',  label: 'Programmes NDT' },
          { value: `${kpis?.avg_progress || 0}%`, label: 'Avancement moyen', color: '#10b981' },
          { value: kpis?.partnerships_actifs || 0, label: 'Partenaires actifs' },
        ]} />
      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
          {kpiCards.map((k, i) => (
            <Card key={i} style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'EB Garamond', fontSize: 38, fontWeight: 500, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.text, marginTop: 6 }}>{k.label}</div>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: 2 }}>{k.sub}</div>
                </div>
                <div style={{ background: `${k.color}20`, borderRadius: 10, padding: 10 }}><k.icon size={18} color={k.color} /></div>
              </div>
            </Card>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'EB Garamond', fontSize: 18, color: T.text }}>Programmes NDT</h3>
              <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>12 programmes</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {programs.slice(0, 8).map(p => (
                <div key={p.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{p.code} · {p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: p.color || T.teal, fontWeight: 600 }}>{p.progress}%</span>
                      <Badge status={p.status} />
                    </div>
                  </div>
                  <ProgressBar value={p.progress} color={p.color || T.teal} />
                </div>
              ))}
            </div>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ padding: '20px 22px', flex: 1 }}>
              <h3 style={{ fontFamily: 'EB Garamond', fontSize: 18, color: T.text, marginBottom: 12 }}>Diligences critiques</h3>
              {(alerts?.critical_diligences || []).length === 0
                ? <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textDim, textAlign: 'center', padding: '12px 0' }}>✅ Aucune diligence critique</div>
                : (alerts?.critical_diligences || []).map(d => (
                  <div key={d.id} style={{ padding: '10px 14px', background: T.surface2, borderRadius: 8, borderLeft: '3px solid #ef4444', marginBottom: 8 }}>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500, color: T.text }}>{d.title}</div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>{d.source} · {d.deadline}</div>
                  </div>
                ))
              }
            </Card>
            <Card style={{ padding: '20px 22px', flex: 1 }}>
              <h3 style={{ fontFamily: 'EB Garamond', fontSize: 18, color: T.text, marginBottom: 12 }}>Indicateurs en risque</h3>
              {(alerts?.risk_indicators || []).length === 0
                ? <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textDim, textAlign: 'center', padding: '12px 0' }}>✅ Aucun indicateur en risque</div>
                : (alerts?.risk_indicators || []).map(i => (
                  <div key={i.code} style={{ padding: '10px 14px', background: T.surface2, borderRadius: 8, borderLeft: '3px solid #ef4444', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{i.code}</span>
                      <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textDim }}>{i.current_value} / {i.target} {i.unit}</span>
                    </div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textMuted, marginTop: 2 }}>{i.label}</div>
                  </div>
                ))
              }
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
