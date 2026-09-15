import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, FileText, MessageSquare, CalendarDays } from 'lucide-react';
import { dashboardApi, programsApi, projectMeetingsApi, diligencesApi, audiencesApi, instancesApi, intlEventsApi, partnershipsApi } from '../api.js';
import { useRefData } from '../context/RefContext.jsx';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';

const EVT_TYPES = {
  meeting:     { color: '#06b6d4', label: 'RDV Projet'   },
  diligence:   { color: '#f59e0b', label: 'Diligence'    },
  audience:    { color: '#8b5cf6', label: 'Audience'     },
  instance:    { color: '#10b981', label: 'Réunion int.' },
  event:       { color: '#6366f1', label: 'Événement'    },
  partnership: { color: '#14b8a6', label: 'Partenaire'   },
};

const toYMD = d => d ? String(d).slice(0, 10) : '';
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysUntil = dateStr => Math.round((new Date(`${dateStr}T00:00:00`) - new Date(`${todayStr()}T00:00:00`)) / 86400000);

function normalizeEvents({ meetings, diligences, audiences, instances, events, partnerships }, ref) {
  const today = todayStr();
  const evts = [];
  const push = (cond, e) => { if (cond) evts.push(e); };

  (meetings || []).forEach(m => push(m.date && toYMD(m.date) >= today, {
    id: `m-${m.id}`, date: toYMD(m.date), time: m.time || '',
    title: m.title, subtitle: m.project_name || '', type: 'meeting',
  }));

  (diligences || []).forEach(d => push(d.deadline && toYMD(d.deadline) >= today && !ref.has('diligence_status', d.status, 'closed'), {
    id: `d-${d.id}`, date: toYMD(d.deadline), time: '',
    title: d.title, subtitle: d.source || '', type: 'diligence',
  }));

  (audiences || []).forEach(a => push(a.date && toYMD(a.date) >= today, {
    id: `a-${a.id}`, date: toYMD(a.date), time: a.time || '',
    title: a.objet || a.institution, subtitle: [a.objet ? a.institution : '', a.contact].filter(Boolean).join(' · '), type: 'audience',
  }));

  (instances || []).forEach(i => push(i.next_meeting_date && toYMD(i.next_meeting_date) >= today, {
    id: `i-${i.id}`, date: toYMD(i.next_meeting_date), time: '',
    title: i.acronym || i.name, subtitle: i.next_meeting_label || ref.label('instance_category', i.category), type: 'instance',
  }));

  (events || []).forEach(e => push(e.date && toYMD(e.date) >= today, {
    id: `e-${e.id}`, date: toYMD(e.date), time: e.time || '',
    title: e.title, subtitle: [ref.label('event_type', e.type), e.location].filter(Boolean).join(' · '), type: 'event',
  }));

  (partnerships || []).forEach(p => push(p.next_meeting_date && toYMD(p.next_meeting_date) >= today, {
    id: `p-${p.id}`, date: toYMD(p.next_meeting_date), time: '',
    title: p.next_meeting_label || p.name, subtitle: p.next_meeting_label ? p.name : '', type: 'partnership',
  }));

  return evts.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

const fmtDate = str => {
  if (!str) return '';
  const [y, m, d] = String(str).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export default function Dashboard() {
  const ref = useRefData();
  const [kpis, setKpis]             = useState(null);
  const [alerts, setAlerts]         = useState(null);
  const [programs, setPrograms]     = useState([]);
  const [rawEvents, setRawEvents]   = useState(null);
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
      intlEventsApi.list().catch(() => []),
      partnershipsApi.list().catch(() => []),
    ])
      .then(([k, a, p, meetings, diligences, audiences, instances, events, partnerships]) => {
        setKpis(k); setAlerts(a); setPrograms(p);
        setRawEvents({ meetings, diligences, audiences, instances, events, partnerships });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={36} /></div>;

  const planShort = ref.setting('plan_short');
  const alertDays = Number(ref.setting('alert_days')) || 3;
  const upEvents  = rawEvents ? normalizeEvents(rawEvents, ref).slice(0, 20) : [];

  /* Statuts nominaux / en alerte : marqueurs meta du référentiel program_status */
  const okCodes     = ref.codes('program_status', 'nominal');
  const alertCodes  = ref.codes('program_status', 'alert');
  const progByStat  = kpis?.programs?.by_status || {};
  const sumCodes    = codes => codes.reduce((s, c) => s + (Number(progByStat[c]) || 0), 0);
  const progOk      = sumCodes(okCodes);
  const progAlert   = sumCodes(alertCodes);
  const alertDetail = alertCodes.filter(c => Number(progByStat[c]) > 0).map(c => `${progByStat[c]} ${ref.label('program_status', c).toLowerCase()}`).join(' · ');
  const okLabel     = okCodes.length ? okCodes.map(c => ref.label('program_status', c)).join(' / ').toLowerCase() : 'nominaux';

  const kpiCards = [
    { icon: CheckCircle,   label: `Programmes ${okLabel}`, value: progOk,
      sub: `${kpis?.avg_progress || 0}% avancement moyen · ${kpis?.projects?.on_track ?? 0} projets dans les délais`, color: '#10b981' },
    { icon: AlertCircle,   label: 'Programmes en alerte', value: progAlert,
      sub: `${alertDetail || 'Attention requise'} · ${kpis?.projects?.en_retard ?? 0} projet(s) en retard`, color: '#f59e0b' },
    { icon: FileText,      label: 'Diligences critiques', value: kpis?.diligences?.urgentes || 0,
      sub: `${kpis?.diligences?.hautes || 0} haute(s) priorité · ${kpis?.diligences?.en_retard || 0} en retard`, color: '#ef4444' },
    { icon: MessageSquare, label: 'Audiences : suivi',    value: kpis?.audiences_suivi || 0, sub: 'Suites à donner', color: '#8b5cf6' },
  ];

  return (
    <div className="fade-in">
      <HeroBanner eyebrow={`${ref.setting('org_name')} · ${ref.setting('ministry_short')}`} title="Tableau de bord stratégique"
        subtitle={`${ref.setting('plan_name')} ${ref.planPeriod} · Pilotage en temps réel`}
        stats={[
          { value: kpis?.projects?.active ?? kpis?.total_projects ?? 0, label: 'Projets actifs' },
          { value: kpis?.programs?.total || 0,       label: `Programmes ${planShort}` },
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
              <h3 style={{ fontFamily: 'EB Garamond', fontSize: 18, color: T.text }}>Programmes {planShort}</h3>
              <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>{programs.length} programme{programs.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 480, paddingRight: 4 }}>
              {programs.map(p => (
                <div key={p.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{p.code} · {p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: p.color || T.teal, fontWeight: 600 }}>{p.progress}%</span>
                      <Badge status={p.status} domain="program_status" />
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
                  <div key={d.id} style={{ padding: '10px 14px', background: T.surface2, borderRadius: 8, borderLeft: `3px solid ${ref.color('priority', d.priority, '#ef4444')}`, marginBottom: 8 }}>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500, color: T.text }}>{d.title}</div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>
                      {d.source}{d.deadline ? ` · ${fmtDate(d.deadline)}` : ''}
                      {d.overdue && <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: 6 }}>⚠ en retard</span>}
                      {!ref.has('priority', d.priority, 'critical') &&<span style={{ marginLeft: 6 }}>· {ref.label('priority', d.priority)}</span>}
                    </div>
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
                      <div style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, color: days === 0 ? '#10b981' : days <= alertDays ? '#ef4444' : T.textDim, flexShrink: 0, marginTop: 2 }}>
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
