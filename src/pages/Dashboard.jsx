import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, FileText, MessageSquare, CalendarDays } from 'lucide-react';
import { dashboardApi, programsApi, projectMeetingsApi, diligencesApi, audiencesApi, instancesApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';

const EVT_TYPES = {
  meeting:   { color: '#06b6d4', label: 'RDV Projet'   },
  diligence: { color: '#f59e0b', label: 'Diligence'    },
  audience:  { color: '#8b5cf6', label: 'Audience'     },
  instance:  { color: '#10b981', label: 'Réunion int.' },
};

const toYMD = d => d ? d.slice(0, 10) : '';
const todayStr = () => { const d = new Date(); d.setHours(0,0,0,0); return toYMD(d.toISOString()); };
const daysUntil = dateStr => Math.ceil((new Date(dateStr) - new Date(todayStr())) / 86400000);

function normalizeEvents(meetings, diligences, audiences, instances) {
  const today = todayStr();
  const evts = [];

  (meetings || []).forEach(m => {
    if (m.date >= today) evts.push({
      id: `m-${m.id}`, date: toYMD(m.date), time: m.time || '',
      title: m.title, subtitle: m.project_name || '', type: 'meeting',
    });
  });

  (diligences || []).forEach(d => {
    if (d.deadline && d.deadline >= today && d.status !== 'fait') evts.push({
      id: `d-${d.id}`, date: toYMD(d.deadline), time: '',
      title: d.title, subtitle: d.source || '', type: 'diligence',
    });
  });

  (audiences || []).forEach(a => {
    if (a.date && a.date >= today) evts.push({
      id: `a-${a.id}`, date: toYMD(a.date), time: '',
      title: a.title || a.interlocutor, subtitle: a.organization || '', type: 'audience',
    });
  });

  (instances || []).forEach(i => {
    if (i.next_meeting_date && i.next_meeting_date >= today) evts.push({
      id: `i-${i.id}`, date: toYMD(i.next_meeting_date), time: '',
      title: i.name, subtitle: i.type || '', type: 'instance',
    });
  });

  return evts.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

const fmtDate = str => {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
};

export default function Dashboard() {
  const [kpis, setKpis]             = useState(null);
  const [alerts, setAlerts]         = useState(null);
  const [programs, setPrograms]     = useState([]);
  const [upEvents, setUpEvents]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  useEffect(() => {
    Promise.all([
      dashboardApi.kpis(),
      dashboardApi.alerts(),
      programsApi.list(),
      projectMeetingsApi.all().catch(() => []),
      diligencesApi.list().catch(() => []),
      audiencesApi.list().catch(() => []),
      instancesApi.list().catch(() => []),
    ])
      .then(([k, a, p, meetings, dils, auds, insts]) => {
        setKpis(k); setAlerts(a); setPrograms(p);
        setUpEvents(normalizeEvents(meetings, dils, auds, insts).slice(0, 12));
      })
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
          { value: kpis?.total_projects || 0,       label: 'Projets actifs' },
          { value: kpis?.programs?.total || 0,       label: 'Programmes NDT' },
          { value: `${kpis?.avg_progress || 0}%`,   label: 'Avancement moyen', color: '#10b981' },
          { value: kpis?.partnerships_actifs || 0,   label: 'Partenaires actifs' },
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 20 }}>
          <Card style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'EB Garamond', fontSize: 18, color: T.text }}>Programmes NDT</h3>
              <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>{programs.length} programme{programs.length > 1 ? 's' : ''}</span>
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

          {/* Colonne droite — Événements à venir */}
          <Card style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CalendarDays size={16} color={T.teal} />
              <h3 style={{ fontFamily: 'EB Garamond', fontSize: 18, color: T.text }}>Événements à venir</h3>
            </div>
            {upEvents.length === 0 ? (
              <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textDim, textAlign: 'center', padding: '20px 0' }}>
                Aucun événement prévu
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 480 }}>
                {upEvents.map(evt => {
                  const meta = EVT_TYPES[evt.type];
                  const days = daysUntil(evt.date);
                  return (
                    <div key={evt.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: T.surface2, borderRadius: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evt.title}</div>
                        {evt.subtitle && <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evt.subtitle}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim }}>{fmtDate(evt.date)}{evt.time ? ` · ${evt.time}` : ''}</span>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 600, color: meta.color, background: `${meta.color}18`, padding: '1px 5px', borderRadius: 4 }}>{meta.label}</span>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, color: days === 0 ? '#10b981' : days <= 3 ? '#ef4444' : T.textDim, flexShrink: 0, marginTop: 2 }}>
                        {days === 0 ? 'Auj.' : `J-${days}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
