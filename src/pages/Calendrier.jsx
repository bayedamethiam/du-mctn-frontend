import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, List, Plus, X } from 'lucide-react';
import { projectMeetingsApi, diligencesApi, audiencesApi, instancesApi, intlEventsApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';

const TYPES = {
  meeting:   { color: '#06b6d4', label: 'RDV Projet'           },
  diligence: { color: '#f59e0b', label: 'Échéance diligence'   },
  audience:  { color: '#8b5cf6', label: 'Audience'             },
  instance:  { color: '#10b981', label: 'Réunion internationale'},
  evenement: { color: '#6366f1', label: 'Évén. int./nat./rég.' },
};

const EVT_TYPES  = ['Forum','Séminaire','Conférence','Atelier','RDV bilatéral','Réunion','Autre'];
const EVT_LEVELS = ['international','national','régional'];

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const toYMD  = d => d ? d.slice(0, 10) : '';

const INP = {
  background: T.surface2, border: `1px solid ${T.border}`,
  borderRadius: 8, padding: '10px 12px', color: T.text,
  fontSize: 13, fontFamily: 'DM Sans', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const SEL = { ...INP, cursor: 'pointer' };

const EMPTY_EVT = { title: '', date: '', time: '', type: 'Réunion', level: 'international', location: '', description: '' };

export default function Calendrier() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [mode, setMode]           = useState('month');
  const [current, setCurrent]     = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDay, setSelectedDay] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_EVT);
  const [editEvt, setEditEvt]     = useState(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const [meetings, dils, auds, insts, evts] = await Promise.all([
        projectMeetingsApi.all(),
        diligencesApi.list(),
        audiencesApi.list(),
        instancesApi.list(),
        intlEventsApi.list(),
      ]);

      const ev = [
        ...meetings.map(m => ({
          id: `m-${m.id}`, date: toYMD(m.date), time: m.time || '',
          title: m.title, subtitle: m.project_name || '', type: 'meeting', color: m.program_color || '#06b6d4',
        })),
        ...dils.filter(d => d.deadline && d.status !== 'fait').map(d => ({
          id: `d-${d.id}`, date: toYMD(d.deadline), time: '',
          title: d.title, subtitle: d.source, type: 'diligence', color: '#f59e0b',
        })),
        ...auds.filter(a => a.date).map(a => ({
          id: `a-${a.id}`, date: toYMD(a.date), time: a.time || '',
          title: a.institution, subtitle: a.objet || '', type: 'audience', color: '#8b5cf6',
        })),
        ...insts.filter(i => i.next_meeting_date).map(i => ({
          id: `i-${i.id}`, date: toYMD(i.next_meeting_date), time: '',
          title: i.next_meeting_label || `Réunion ${i.acronym}`, subtitle: i.acronym, type: 'instance', color: '#10b981',
        })),
        ...evts.map(e => ({
          id: `e-${e.id}`, _id: e.id, date: toYMD(e.date), time: e.time || '',
          title: e.title, subtitle: `${e.type} · ${e.level}${e.location ? ' · ' + e.location : ''}`,
          type: 'evenement', color: '#6366f1',
        })),
      ].filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      setEvents(ev);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayStr = toYMD(today.toISOString());

  const { year, month } = current;
  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const evByDate = useMemo(() => {
    const m = {};
    events.forEach(e => { (m[e.date] = m[e.date] || []).push(e); });
    return m;
  }, [events]);

  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return events.filter(e => e.date.startsWith(prefix));
  }, [events, year, month]);

  const prev    = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const next    = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0  } : { ...c, month: c.month + 1 });
  const goToday = () => { const d = new Date(); setCurrent({ year: d.getFullYear(), month: d.getMonth() }); setSelectedDay(null); };

  const openCreate = (date = '') => { setForm({ ...EMPTY_EVT, date }); setEditEvt(null); setShowModal(true); };

  const saveEvt = async () => {
    if (!form.title.trim() || !form.date) { setError('Titre et date requis'); return; }
    setSaving(true);
    try {
      if (editEvt) {
        await intlEventsApi.update(editEvt, form);
      } else {
        await intlEventsApi.create(form);
      }
      setShowModal(false);
      setLoading(true);
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const deleteEvt = async id => {
    if (!window.confirm('Supprimer cet événement ?')) return;
    try { await intlEventsApi.delete(id); await load(); } catch (e) { setError(e.message); }
  };

  const upcoming = events.filter(e => e.date >= todayStr);
  const dayStr = idx => {
    const n = idx - startOffset + 1;
    if (n < 1 || n > daysInMonth) return null;
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
  };

  const EventChip = ({ ev, compact = false }) => (
    <div style={{ display:'flex', alignItems:'center', gap: compact ? 3 : 5, padding: compact ? '1px 5px' : '4px 8px', borderRadius: compact ? 3 : 6, background:`${ev.color}18`, borderLeft:`2px solid ${ev.color}`, overflow:'hidden', cursor:'default' }}>
      <div style={{ width:5, height:5, borderRadius:'50%', background:ev.color, flexShrink:0 }} />
      <div style={{ overflow:'hidden', flex:1 }}>
        <div style={{ fontFamily:'DM Sans', fontSize: compact ? 10 : 12, fontWeight:600, color:T.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {ev.time && <span style={{ color: ev.color, marginRight: 3, fontWeight: 700 }}>{ev.time}</span>}
          {ev.title}
        </div>
        {!compact && ev.subtitle && <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ev.subtitle}</div>}
      </div>
    </div>
  );

  const selectedEvents = selectedDay ? (evByDate[selectedDay] || []) : [];

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Calendrier" title="Agenda · Toutes les échéances"
        subtitle="Rendez-vous projets · Diligences · Audiences · Événements int./nat./rég."
        stats={[
          { value: upcoming.length,  label: 'Événements à venir' },
          { value: monthEvents.length, label: 'Ce mois-ci', color: T.teal },
          { value: upcoming.filter(e => e.type === 'meeting').length,   label: 'RDV projets',  color: '#06b6d4' },
          { value: upcoming.filter(e => e.type === 'audience').length,  label: 'Audiences',    color: '#8b5cf6' },
          { value: upcoming.filter(e => e.type === 'evenement').length, label: 'Évén. int./nat.', color: '#6366f1' },
        ]} />

      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={36} /></div>
          : (
            <>
              {/* ── Barre de contrôle ── */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button onClick={prev} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:7, padding:'6px 10px', color:T.textMuted, cursor:'pointer', lineHeight:0 }}><ChevronLeft size={15}/></button>
                  <div style={{ fontFamily:'EB Garamond', fontSize:20, fontWeight:500, color:T.text, minWidth:200, textAlign:'center' }}>{MONTHS[month]} {year}</div>
                  <button onClick={next} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:7, padding:'6px 10px', color:T.textMuted, cursor:'pointer', lineHeight:0 }}><ChevronRight size={15}/></button>
                  <button onClick={goToday} style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:7, border:`1px solid ${T.border}`, background:'transparent', color:T.textMuted, cursor:'pointer', marginLeft:4 }}>Aujourd'hui</button>
                </div>

                {/* Bouton Nouvel événement */}
                <button onClick={() => openCreate(selectedDay || todayStr)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background:'#6366f1', color:'#fff', fontFamily:'DM Sans', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  <Plus size={13}/> Nouvel événement
                </button>

                {/* Légende */}
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginLeft:'auto', alignItems:'center' }}>
                  {Object.entries(TYPES).map(([k, t]) => (
                    <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:t.color }} />
                      <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>{t.label}</span>
                    </div>
                  ))}
                </div>

                {/* Toggle vue */}
                <div style={{ display:'flex', background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:3 }}>
                  {[['month', <CalendarDays size={13}/>, 'Mois'], ['list', <List size={13}/>, 'Liste']].map(([v, icon, lbl]) => (
                    <button key={v} onClick={() => setMode(v)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:5, border:'none', background:mode===v?T.teal:'transparent', color:mode===v?'#fff':T.textMuted, fontFamily:'DM Sans', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .15s' }}>
                      {icon} {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'month' ? (
                <div style={{ display:'grid', gridTemplateColumns: selectedDay ? '1fr 300px' : '1fr', gap:16 }}>
                  {/* ── Grille calendrier ── */}
                  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:`1px solid ${T.border}` }}>
                      {DAYS.map(d => <div key={d} style={{ padding:'10px 0', textAlign:'center', fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1, color:T.textDim, textTransform:'uppercase' }}>{d}</div>)}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                      {Array.from({ length: totalCells }).map((_, idx) => {
                        const ds     = dayStr(idx);
                        const dayNum = idx - startOffset + 1;
                        const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                        const isToday = ds === todayStr;
                        const isSel   = ds === selectedDay;
                        const dayEvs  = ds ? (evByDate[ds] || []) : [];
                        return (
                          <div key={idx} onClick={() => ds && inMonth && setSelectedDay(isSel ? null : ds)}
                            style={{ minHeight:90, padding:'6px 6px 4px', borderRight:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, background: isSel ? 'rgba(6,182,212,0.07)' : isToday ? 'rgba(255,255,255,0.03)' : 'transparent', cursor: inMonth ? 'pointer' : 'default', transition:'background .1s', boxSizing:'border-box' }}
                            onMouseEnter={e => { if (inMonth && !isSel) e.currentTarget.style.background='rgba(255,255,255,0.025)'; }}
                            onMouseLeave={e => { if (inMonth && !isSel) e.currentTarget.style.background='transparent'; }}>
                            <div style={{ width:24, height:24, borderRadius:'50%', background: isToday ? T.teal : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:4 }}>
                              <span style={{ fontFamily:'DM Sans', fontSize:12, fontWeight: isToday ? 700 : 400, color: isToday ? '#fff' : inMonth ? T.text : T.textDim }}>{inMonth ? dayNum : ''}</span>
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                              {dayEvs.slice(0, 3).map(ev => <EventChip key={ev.id} ev={ev} compact />)}
                              {dayEvs.length > 3 && <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim, paddingLeft:5 }}>+{dayEvs.length - 3} autre{dayEvs.length > 4 ? 's' : ''}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Panneau détail jour ── */}
                  {selectedDay && (
                    <div style={{ background:T.surface, border:`1px solid ${T.teal}30`, borderRadius:12, padding:16, height:'fit-content', maxHeight:620, overflowY:'auto' }} className="slide-in">
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                        <div style={{ fontFamily:'EB Garamond', fontSize:16, color:T.teal }}>
                          {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
                        </div>
                        <button onClick={() => openCreate(selectedDay)} title="Ajouter un événement ce jour"
                          style={{ background:'#6366f122', border:'1px solid #6366f133', borderRadius:6, padding:'4px 8px', color:'#6366f1', cursor:'pointer', lineHeight:0 }}>
                          <Plus size={13}/>
                        </button>
                      </div>
                      {selectedEvents.length === 0
                        ? <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim, fontStyle:'italic', padding:'12px 0' }}>Aucun événement ce jour</div>
                        : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {selectedEvents.map(ev => (
                              <div key={ev.id} style={{ padding:'10px 12px', borderRadius:8, background:`${ev.color}10`, border:`1px solid ${ev.color}25` }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                                  <div style={{ width:8, height:8, borderRadius:'50%', background:ev.color, flexShrink:0 }} />
                                  <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:ev.color, textTransform:'uppercase', letterSpacing:0.8 }}>{TYPES[ev.type]?.label}</span>
                                  {ev.time && <span style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, marginLeft:'auto' }}>{ev.time}</span>}
                                  {ev.type === 'evenement' && ev._id && (
                                    <button onClick={() => deleteEvt(ev._id)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'0 2px', lineHeight:0, marginLeft:4 }}
                                      onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}>
                                      <X size={11}/>
                                    </button>
                                  )}
                                </div>
                                <div style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:600, color:T.text, marginBottom:2 }}>{ev.title}</div>
                                {ev.subtitle && <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>{ev.subtitle}</div>}
                              </div>
                            ))}
                          </div>
                      }
                    </div>
                  )}
                </div>
              ) : (
                /* ── Vue Liste ── */
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {monthEvents.length === 0
                    ? <div style={{ textAlign:'center', padding:'40px 0', fontFamily:'DM Sans', fontSize:13, color:T.textDim }}>Aucun événement ce mois-ci</div>
                    : (() => {
                        const byDate = {};
                        monthEvents.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });
                        return Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, evs]) => {
                          const d = new Date(date + 'T12:00:00');
                          const isT = date === todayStr;
                          return (
                            <div key={date} style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:6 }}>
                              <div style={{ width:52, flexShrink:0, paddingTop:6, textAlign:'center' }}>
                                <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, textTransform:'uppercase' }}>{DAYS[(d.getDay()+6)%7]}</div>
                                <div style={{ width:34, height:34, borderRadius:'50%', background:isT?T.teal:'transparent', border:`1px solid ${isT?T.teal:T.border}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'3px auto 0' }}>
                                  <span style={{ fontFamily:'DM Sans', fontSize:14, fontWeight:700, color:isT?'#fff':T.text }}>{d.getDate()}</span>
                                </div>
                              </div>
                              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, paddingTop:4 }}>
                                {evs.map(ev => <EventChip key={ev.id} ev={ev} />)}
                              </div>
                            </div>
                          );
                        });
                      })()
                  }
                </div>
              )}
            </>
          )}
      </div>

      {/* ── Modal Nouvel événement ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background:'#0d1f3c', border:'1px solid rgba(255,255,255,0.12)', borderRadius:14, padding:28, width:520, maxHeight:'90vh', overflowY:'auto' }} className="slide-in">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontFamily:'EB Garamond', fontSize:22, color:T.text }}>{editEvt ? 'Modifier l\'événement' : 'Nouvel événement'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', lineHeight:0 }}><X size={18}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input placeholder="Titre *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={INP} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10 }}>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={INP} />
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ ...INP, width:110 }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={SEL}>
                  {EVT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} style={SEL}>
                  {EVT_LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </div>
              <input placeholder="Lieu / Ville" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={INP} />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                style={{ ...INP, resize:'vertical', lineHeight:1.5 }} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding:'9px 18px', borderRadius:8, border:`1px solid ${T.border}`, background:'transparent', color:T.textMuted, fontFamily:'DM Sans', fontSize:13, cursor:'pointer' }}>Annuler</button>
              <button onClick={saveEvt} disabled={saving}
                style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'#6366f1', color:'#fff', fontFamily:'DM Sans', fontSize:13, fontWeight:700, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? '...' : editEvt ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}