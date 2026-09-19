import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Award, Send, Plus, Pencil, Trash2, Globe } from 'lucide-react';
import { instancesApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Btn, Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea } from '../components/UI.jsx';
import { T } from '../theme.js';
import { useRefData } from '../context/RefContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { hasPerm } from '../permissions.js';

/* Piliers de score par défaut (surchargés par le paramètre instance_pillars) */
const PILLARS_FALLBACK = [
  { key:'presence', label:'Présence', max:40 }, { key:'contribution', label:'Contribution', max:30 },
  { key:'postes', label:'Postes', max:20 },     { key:'suivi', label:'Suivi', max:10 },
];

/* Clés de score disponibles côté base (colonnes score_*) - les piliers d'autres clés sont ignorés */
const SCORE_KEYS = ['presence','contribution','postes','suivi'];

const INST_EMPTY = { acronym:'', name:'', category:'', siege:'', niveau:'membre', responsible:'', focal:'', ndt_link:'', priority:'moyenne', mandats:'', gaps:'', next_meeting_label:'', next_meeting_date:'', next_meeting_lieu:'' };
const CONTRIB_EMPTY = { titre:'', date:'', statut:'planifie', impact:'moyenne' };   // statut/impact réalignés sur les référentiels à l'ouverture
const MONTH_SHORT = Array.from({ length: 12 }, (_, i) => { const s = new Intl.DateTimeFormat('fr-FR', { month:'short' }).format(new Date(2024, i, 1)).replace('.', ''); return s.charAt(0).toUpperCase() + s.slice(1); });
const lbl = { fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 };
const parseList = v => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };

/* Saisie entière (les scores sont stockés en INTEGER) */
const IntInput = ({ value, onChange, max, placeholder }) => (
  <input type="number" step={1} min={0} max={max} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
    style={{ width:'100%', background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 14px', color:T.text, fontSize:13, fontFamily:'DM Sans', outline:'none' }}/>
);

const Gauge = ({ value, size=52, color }) => {
  const r=(size-8)/2, c=2*Math.PI*r, off=c-(Math.min(100, value)/100)*c, col=color;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:col }}>{value}</span>
      </div>
    </div>
  );
};

const PillarBar = ({ label, value, max, color }) => (
  <div>
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
      <span style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>{label}</span>
      <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color }}>{value}/{max}</span>
    </div>
    <div style={{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden' }}>
      <div style={{ width:`${max ? Math.min(100, (value/max)*100) : 0}%`, height:'100%', background:color, borderRadius:2, transition:'width 0.7s ease' }}/>
    </div>
  </div>
);

export default function Instances({ embedded = false }) {
  const ref = useRefData();
  const { user } = useAuth();
  const canEditInst     = hasPerm(user, 'instances.manage');
  const canDeleteInst   = hasPerm(user, 'instances.delete');
  const canEditContrib  = hasPerm(user, 'contributions.manage');
  const canDeleteContrib= hasPerm(user, 'contributions.delete');

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [catF, setCatF]         = useState('all');
  const [selected, setSelected] = useState(null);

  // Instance modal
  const [instModal, setInstModal]   = useState(false);
  const [editingInst, setEditingInst] = useState(null);
  const [savingInst, setSavingInst]   = useState(false);
  const [instForm, setInstForm]       = useState(INST_EMPTY);

  // Contribution modal
  const [contribModal, setContribModal] = useState(false);
  const [contribInstId, setContribInstId] = useState(null);
  const [editingContrib, setEditingContrib] = useState(null);
  const [savingContrib, setSavingContrib] = useState(false);
  const [contribForm, setContribForm]     = useState(CONTRIB_EMPTY);

  const load = useCallback(() => {
    instancesApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Référentiels & paramètres */
  const cats      = ref.list('instance_category');
  const catColor  = code => ref.color('instance_category', code, T.teal);
  const niv       = code => { const it = ref.item('instance_level', code); return { label: it?.label || code || '-', color: it?.color || T.teal, strong: !!it?.meta?.strong }; };
  const pillarsRaw = ref.json('instance_pillars', PILLARS_FALLBACK);
  const pillarsOk = Array.isArray(pillarsRaw) ? pillarsRaw.filter(p => p && SCORE_KEYS.includes(p.key)) : [];
  const pillars   = pillarsOk.length ? pillarsOk : PILLARS_FALLBACK;
  const maxTotal  = pillars.reduce((s, p) => s + (Number(p.max) || 0), 0) || 100;
  const [urg1, urg2] = (() => { const u = ref.json('instance_urgency_days', [30, 90]); return Array.isArray(u) && u.length >= 2 ? u.map(Number) : [30, 90]; })();
  const planLabel = `${ref.setting('plan_short')} ${ref.planPeriod}`.trim();
  const planShort = ref.setting('plan_short');

  const pillarVal = (inst, key) => Number(inst.scores?.[key] ?? inst[`score_${key}`] ?? 0) || 0;
  const scoreOf   = inst => { const sum = pillars.reduce((s, p) => s + pillarVal(inst, p.key), 0); return Math.round(sum / maxTotal * 100); };
  const withCurrent = (list, code) => code && !list.some(i => i.code === code) ? [...list, { code, label: code }] : list;

  const fi = k => v => setInstForm(p => ({ ...p, [k]: v }));
  const fc = k => v => setContribForm(p => ({ ...p, [k]: v }));

  const emptyScores = () => Object.fromEntries(pillars.map(p => [`score_${p.key}`, '0']));
  const openCreateInst = () => {
    setInstForm({ ...INST_EMPTY, ...emptyScores(), category: cats[0]?.code || '', niveau: ref.item('instance_level', 'membre') ? 'membre' : (ref.list('instance_level')[0]?.code || 'membre'), priority: ref.item('priority', 'moyenne') ? 'moyenne' : (ref.list('priority')[0]?.code || 'moyenne') });
    setEditingInst(null); setInstModal(true);
  };
  const openEditInst   = (inst, e) => {
    e.stopPropagation();
    const mandats = Array.isArray(inst.mandats) ? inst.mandats : parseList(inst.mandats_json);
    const gaps    = Array.isArray(inst.gaps) ? inst.gaps : parseList(inst.gaps_json);
    setInstForm({
      acronym:           inst.acronym||'',
      name:              inst.name||'',
      category:          inst.category||cats[0]?.code||'',
      siege:             inst.siege||'',
      niveau:            inst.niveau||'membre',
      responsible:       inst.responsible||'',
      focal:             inst.focal||'',
      ndt_link:          inst.ndt_link||'',
      priority:          inst.priority||'moyenne',
      ...Object.fromEntries(pillars.map(p => [`score_${p.key}`, String(pillarVal(inst, p.key))])),
      mandats:           mandats.join('\n'),
      gaps:              gaps.join('\n'),
      next_meeting_label:inst.nextMeeting?.label || inst.next_meeting_label||'',
      next_meeting_date: inst.nextMeeting?.date  || inst.next_meeting_date||'',
      next_meeting_lieu: inst.nextMeeting?.lieu  || inst.next_meeting_lieu||'',
    });
    setEditingInst(inst); setInstModal(true);
  };

  const handleSaveInst = async () => {
    if (!instForm.acronym || !instForm.name) return setError('Acronyme et nom requis');
    if (!instForm.category) return setError(cats.length ? 'Catégorie requise' : 'Catégorie requise - référentiel des catégories non chargé ou vide (Administration › Référentiels)');
    for (const p of pillars) {
      const v = Number(instForm[`score_${p.key}`] || 0);
      if (!Number.isInteger(v) || v < 0 || v > Number(p.max)) return setError(`Score « ${p.label} » : nombre entier entre 0 et ${p.max}`);
    }
    setSavingInst(true);
    try {
      const payload = {
        ...instForm,
        ...Object.fromEntries(pillars.map(p => [`score_${p.key}`, Number(instForm[`score_${p.key}`]) || 0])),
        mandats:  instForm.mandats.split('\n').map(s=>s.trim()).filter(Boolean),
        gaps:     instForm.gaps.split('\n').map(s=>s.trim()).filter(Boolean),
      };
      if (editingInst) {
        const updated = await instancesApi.update(editingInst.id, payload);
        if (updated) setItems(its => its.map(i => i.id === editingInst.id ? updated : i)); else load();
      } else {
        const created = await instancesApi.create(payload);
        if (created) setItems(its => [...its, created]); else load();
      }
      setInstModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingInst(false); }
  };

  const openAddContrib = (instId, e) => {
    e.stopPropagation();
    setContribForm({ ...CONTRIB_EMPTY, statut: ref.list('contribution_status')[0]?.code || CONTRIB_EMPTY.statut, impact: ref.list('contribution_impact')[0]?.code || CONTRIB_EMPTY.impact });
    setContribInstId(instId); setEditingContrib(null);
    setContribModal(true);
  };
  const openEditContrib = (instId, c, e) => {
    e.stopPropagation();
    setContribForm({ titre: c.titre || '', date: c.date || '', statut: c.statut || '', impact: c.impact || '' });
    setContribInstId(instId); setEditingContrib(c);
    setContribModal(true);
  };

  const handleSaveContrib = async () => {
    if (!contribForm.titre) return setError('Titre de la contribution requis');
    setSavingContrib(true);
    try {
      if (editingContrib) {
        const updated = await instancesApi.updateContribution(contribInstId, editingContrib.id, contribForm);
        if (updated) setItems(its => its.map(i => i.id === contribInstId ? { ...i, contributions:(i.contributions||[]).map(c => c.id === editingContrib.id ? updated : c) } : i)); else load();
      } else {
        const created = await instancesApi.createContribution(contribInstId, contribForm);
        if (created) setItems(its => its.map(i => i.id === contribInstId ? { ...i, contributions:[...(i.contributions||[]), created] } : i)); else load();
      }
      setContribModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingContrib(false); }
  };

  const handleDeleteInst = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette instance ?')) return;
    try {
      await instancesApi.delete(id);
      setItems(its => its.filter(i => i.id !== id));
      if (selected === id) setSelected(null);
    } catch (e) { setError(e.message); }
  };

  const handleDeleteContrib = async (instId, contribId, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette contribution ?')) return;
    try {
      await instancesApi.deleteContribution(instId, contribId);
      setItems(its => its.map(i => i.id === instId ? { ...i, contributions:(i.contributions||[]).filter(c=>c.id!==contribId) } : i));
    } catch (e) { setError(e.message); }
  };

  const isCritical   = inst => ref.has('priority', inst.priority, 'critical');
  const doneContribs = inst => (inst.contributions || []).filter(c => ref.has('contribution_status', c.statut, 'done')).length;
  const country      = ref.setting('country');
  const filtered     = catF === 'all' ? items : items.filter(i => i.category === catF);
  const avgScore     = items.length ? Math.round(items.reduce((s,i) => s + scoreOf(i), 0) / items.length) : 0;
  const leaders      = items.filter(i => niv(i.niveau).strong).length;
  const allContribs  = items.flatMap(i => i.contributions || []);
  const totalGaps    = items.reduce((s,i) => s + (i.gaps||[]).length, 0);
  /* Catégories affichées : référentiel + catégories inconnues présentes dans les données */
  const catTabs = [
    { id:'all', label:'Toutes', color:T.teal },
    ...cats.map(c => ({ id:c.code, label:c.label, color:c.color || T.teal })),
    ...[...new Set(items.map(i => i.category))].filter(c => c && !cats.some(x => x.code === c)).map(c => ({ id:c, label:c, color:T.textDim })),
  ];

  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingMeetings = items
    .filter(i => i.next_meeting_date || i.nextMeeting?.date)
    .map(i => ({
      inst: i,
      label: i.nextMeeting?.label || i.next_meeting_label || '',
      date:  i.nextMeeting?.date  || i.next_meeting_date  || '',
      lieu:  i.nextMeeting?.lieu  || i.next_meeting_lieu  || '',
    }))
    .filter(m => m.date && new Date(m.date) >= today)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const daysUntil = d => Math.ceil((new Date(d) - today) / 86400000);
  const urgencyColor = d => { const n = daysUntil(d); return n <= urg1 ? '#ef4444' : n <= urg2 ? '#f59e0b' : '#10b981'; };

  const statC  = code => ({ color: ref.color('contribution_status', code, T.textDim), label: ref.label('contribution_status', code) });
  const impC   = code => ({ color: ref.color('contribution_impact', code, T.textDim), label: ref.label('contribution_impact', code) });

  return (
    <div className={embedded ? undefined : 'fade-in'}>
      {!embedded && (
        <HeroBanner eyebrow="Représentation internationale" title={country ? `Présence internationale - ${country}` : 'Présence internationale'}
          subtitle={`Qualité de présence et contributions techniques · ${planLabel}`} color="#8b5cf6"
          stats={[
            { value:`${avgScore}/100`, label:'Score moyen', color:ref.scoreColor(avgScore) },
            { value:`${leaders}/${items.length}`, label:'Bien représenté', color:'#10b981' },
            { value:allContribs.length, label:'Contributions', color:T.teal },
            { value:totalGaps, label:'Lacunes identifiées', color:'#f59e0b' },
            { value:upcomingMeetings.length, label:'Réunions à venir', color:'#8b5cf6' },
          ]} />
      )}
      <div style={{ padding:28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')}/>
        {totalGaps > 0 && (
          <div style={{ background:'linear-gradient(135deg,#1a0a2e,#0f1a38)', border:'1px solid #8b5cf633', borderRadius:12, padding:'14px 20px', marginBottom:20, display:'flex', gap:14, alignItems:'flex-start' }}>
            <AlertCircle size={18} color="#f59e0b" style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:'#f59e0b', letterSpacing:1, textTransform:'uppercase', marginBottom:6 }}>{totalGaps} lacunes identifiées · Priorités d'action {planShort}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {items.filter(isCritical).map(i=>(
                  <span key={i.id} style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, background:'#ef444420', color:'#ef4444', padding:'3px 10px', borderRadius:20, border:'1px solid #ef444430' }}>{i.acronym} - {(i.gaps||[]).length} lacune{(i.gaps||[]).length>1?'s':''}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, gap:12 }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {catTabs.map(c => (
              <Btn key={c.id} onClick={() => setCatF(c.id)} variant={catF===c.id?'ghost':'outline'} color={catF===c.id?c.color:T.textDim} size="sm">
                {c.label} <span style={{ opacity:0.6, fontSize:10, marginLeft:2 }}>{c.id==='all'?items.length:items.filter(i=>i.category===c.id).length}</span>
              </Btn>
            ))}
          </div>
          {canEditInst && <Btn onClick={openCreateInst} color="#8b5cf6"><Plus size={14}/> Nouvelle instance</Btn>}
        </div>
        {/* ── Prochaines réunions ── */}
        {!loading && upcomingMeetings.length > 0 && (
          <Card style={{ marginBottom:20 }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#8b5cf6' }}>Prochaines réunions & forums</span>
              <span style={{ fontSize:10, background:'rgba(139,92,246,0.15)', color:'#8b5cf6', borderRadius:8, padding:'1px 8px', fontFamily:'DM Sans', fontWeight:700 }}>{upcomingMeetings.length}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:0 }}>
              {upcomingMeetings.map((m, idx) => {
                const catC = catColor(m.inst.category);
                const uc   = urgencyColor(m.date);
                const days = daysUntil(m.date);
                return (
                  <div key={m.inst.id} style={{ padding:'12px 16px', borderRight: idx < upcomingMeetings.length-1 ? `1px solid ${T.border}` : 'none', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:38, height:38, borderRadius:8, background:`${uc}15`, border:`1px solid ${uc}30`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:800, color:uc, lineHeight:1 }}>{m.date?.slice(8,10)}</div>
                      <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim, textTransform:'uppercase' }}>{MONTH_SHORT[parseInt(m.date?.slice(5,7))-1]}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:catC }}>{m.inst.acronym}</div>
                      <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.text, lineHeight:1.3, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.label || 'Réunion'}</div>
                      {m.lieu && <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>📍 {m.lieu}</div>}
                      <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:uc, marginTop:2 }}>
                        {days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : filtered.length === 0
          ? <div style={{ padding:'48px 24px', textAlign:'center', background:T.surface, borderRadius:12, border:`1px solid ${T.border}` }}>
              <Globe size={36} color="#8b5cf6" style={{ margin:'0 auto 12px', opacity:0.4 }}/>
              <div style={{ fontFamily:'EB Garamond', fontSize:20, color:T.textMuted, marginBottom:6 }}>Aucune instance</div>
              <div style={{ fontFamily:'DM Sans', fontSize:13, color:T.textDim }}>Ajoutez des instances de représentation internationale.</div>
            </div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
            {filtered.map(inst => {
              const score = scoreOf(inst);
              const nv    = niv(inst.niveau);
              const catC  = catColor(inst.category);
              const isSel = selected === inst.id;
              const lieu  = inst.nextMeeting?.lieu || inst.next_meeting_lieu;
              const meet  = inst.nextMeeting?.label || inst.next_meeting_label;
              return (
                <div key={inst.id} style={{ background:T.surface, border:`1px solid ${isSel?catC:T.border}`, borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'all 0.2s', boxShadow:isSel?`0 0 0 1px ${catC}44`:'' }}
                  onClick={() => setSelected(isSel?null:inst.id)}>
                  <div style={{ height:3, background:`linear-gradient(90deg,${catC},${nv.color})` }}/>
                  <div style={{ padding:'16px 18px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                      <Gauge value={score} size={54} color={ref.scoreColor(score)}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:800, color:catC }}>{inst.acronym}</span>
                          <span style={{ background:`${nv.color}22`, color:nv.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>{nv.label}</span>
                          {isCritical(inst)&&<span style={{ background:`${ref.color('priority',inst.priority,'#ef4444')}20`, color:ref.color('priority',inst.priority,'#ef4444'), fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>{ref.label('priority',inst.priority)}</span>}
                        </div>
                        <div style={{ fontFamily:'EB Garamond', fontSize:14, color:T.text, lineHeight:1.3, marginBottom:3 }}>{inst.name}</div>
                        <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>
                          {[inst.siege, inst.responsible && `Resp. ${inst.responsible}`, inst.focal && `Point focal : ${inst.focal}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {canEditInst && <button onClick={e => openEditInst(inst, e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Modifier"
                        onMouseEnter={e=>e.currentTarget.style.color=T.teal} onMouseLeave={e=>e.currentTarget.style.color=T.textMuted}><Pencil size={12}/></button>}
                      {canDeleteInst && <button onClick={e => handleDeleteInst(inst.id, e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Supprimer"
                        onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textMuted}><Trash2 size={12}/></button>}
                      {isSel?<ChevronUp size={14} color={T.textDim}/>:<ChevronDown size={14} color={T.textDim}/>}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 14px', marginBottom:10 }}>
                      {pillars.map(p => {
                        const v = pillarVal(inst, p.key);
                        return <PillarBar key={p.key} label={p.label} value={v} max={Number(p.max)} color={ref.scoreColor(p.max ? v/Number(p.max)*100 : 0)}/>;
                      })}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                      <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>{meet ? `🗓 ${meet}` : ''}{lieu ? ` · 📍 ${lieu}` : ''}</span>
                      <div style={{ display:'flex', gap:6 }}>
                        {doneContribs(inst)>0&&<span style={{ fontFamily:'DM Sans', fontSize:10, color:'#10b981', background:'#10b98115', padding:'2px 7px', borderRadius:8 }}>{doneContribs(inst)} contrib.</span>}
                        {(inst.gaps||[]).length>0&&<span style={{ fontFamily:'DM Sans', fontSize:10, color:'#f59e0b', background:'#f59e0b15', padding:'2px 7px', borderRadius:8 }}>{(inst.gaps||[]).length} lacune{(inst.gaps||[]).length>1?'s':''}</span>}
                      </div>
                    </div>
                  </div>
                  {isSel && (
                    <div style={{ borderTop:`1px solid ${T.border}`, padding:'16px 18px', background:'rgba(255,255,255,0.025)' }} className="slide-in" onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>Mandats</div>
                          {(inst.mandats||[]).length>0
                            ? (inst.mandats||[]).map((m,i)=><div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom:5 }}><Award size={11} color={catC} style={{ marginTop:2, flexShrink:0 }}/><span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.4 }}>{m}</span></div>)
                            : <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim, fontStyle:'italic' }}>Aucun mandat actuel</span>
                          }
                        </div>
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>Lien {planShort}</div>
                          <div style={{ background:`${catC}15`, borderRadius:8, padding:'8px 10px', border:`1px solid ${catC}25` }}>
                            <span style={{ fontFamily:'DM Sans', fontSize:11, color:catC }}>{inst.ndt_link || '-'}</span>
                          </div>
                          <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:8, lineHeight:1.6 }}>
                            <div>Catégorie : <span style={{ color:T.textMuted }}>{ref.label('instance_category', inst.category)}</span></div>
                            {inst.focal && <div>Point focal : <span style={{ color:T.textMuted }}>{inst.focal}</span></div>}
                            {(meet || inst.next_meeting_date) && <div>Prochaine réunion : <span style={{ color:T.textMuted }}>{[meet, inst.next_meeting_date, lieu].filter(Boolean).join(' · ')}</span></div>}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginBottom:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim }}>Contributions ({(inst.contributions||[]).length})</div>
                          {canEditContrib && <Btn onClick={e => openAddContrib(inst.id, e)} size="sm" variant="outline" color={catC}><Plus size={11}/> Ajouter</Btn>}
                        </div>
                        {(inst.contributions||[]).map(c=>{
                          const sc=statC(c.statut);
                          const ic=impC(c.impact);
                          return <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'7px 10px', background:T.surface2, borderRadius:7, marginBottom:5, borderLeft:`2px solid ${sc.color}` }}>
                            <Send size={11} color={sc.color} style={{ marginTop:2, flexShrink:0 }}/>
                            <div style={{ flex:1 }}>
                              <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.text }}>{c.titre}</div>
                              <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, marginTop:1 }}>
                                {c.date}{c.impact && <>{c.date ? ' · ' : ''}Impact : <span style={{ color:ic.color, fontWeight:600 }}>{ic.label}</span></>}
                              </div>
                            </div>
                            <span style={{ background:`${sc.color}20`, color:sc.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8 }}>{sc.label}</span>
                            {canEditContrib && <button onClick={e => openEditContrib(inst.id, c, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'1px 2px', lineHeight:0 }} title="Modifier"
                              onMouseEnter={e=>e.currentTarget.style.color=T.teal} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><Pencil size={11}/></button>}
                            {canDeleteContrib && <button onClick={e => handleDeleteContrib(inst.id, c.id, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:16, lineHeight:1 }} title="Supprimer">×</button>}
                          </div>;
                        })}
                      </div>
                      {(inst.gaps||[]).length>0&&(
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#f59e0b', marginBottom:8 }}>Lacunes & recommandations</div>
                          {(inst.gaps||[]).map((g,i)=><div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'5px 0', borderBottom:i<(inst.gaps||[]).length-1?`1px solid rgba(255,255,255,0.04)`:'none' }}><div style={{ width:5, height:5, borderRadius:'50%', background:'#f59e0b', marginTop:5, flexShrink:0 }}/><span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.5 }}>{g}</span></div>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* Modal instance */}
      <Modal open={instModal} onClose={() => setInstModal(false)} title={editingInst ? 'Modifier l\'instance' : 'Nouvelle instance'} width={600}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
            <div>
              <label style={lbl}>Acronyme *</label>
              <Input value={instForm.acronym} onChange={fi('acronym')} placeholder="Ex: UIT"/>
            </div>
            <div>
              <label style={lbl}>Nom complet *</label>
              <Input value={instForm.name} onChange={fi('name')} placeholder="Ex: Union Internationale des Télécommunications"/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Catégorie *</label>
              <Select value={instForm.category} onChange={fi('category')} style={{ width:'100%' }}>
                {withCurrent(cats, instForm.category).map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <label style={lbl}>Niveau</label>
              <Select value={instForm.niveau} onChange={fi('niveau')} style={{ width:'100%' }}>
                {withCurrent(ref.list('instance_level'), instForm.niveau).map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </Select>
            </div>
            <div>
              <label style={lbl}>Priorité</label>
              <Select value={instForm.priority} onChange={fi('priority')} style={{ width:'100%' }}>
                {withCurrent(ref.list('priority'), instForm.priority).map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </Select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Siège</label>
              <Input value={instForm.siege} onChange={fi('siege')} placeholder="Ville, Pays"/>
            </div>
            <div>
              <label style={lbl}>Responsable</label>
              <Input value={instForm.responsible} onChange={fi('responsible')} placeholder="Nom et prénom"/>
            </div>
            <div>
              <label style={lbl}>Point focal</label>
              <Input value={instForm.focal} onChange={fi('focal')} placeholder="Point focal technique"/>
            </div>
          </div>
          <div>
            <label style={lbl}>Lien {planShort}</label>
            <Input value={instForm.ndt_link} onChange={fi('ndt_link')} placeholder="Ex: Axe 1 - Infrastructure · P09 Innovation & IA"/>
          </div>
          <div>
            <label style={lbl}>Scores par pilier (total sur {maxTotal})</label>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(pillars.length, 4)},1fr)`, gap:10 }}>
              {pillars.map(p => (
                <div key={p.key}>
                  <label style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, display:'block', marginBottom:4 }}>{p.label} (0-{p.max})</label>
                  <IntInput value={instForm[`score_${p.key}`] ?? ''} onChange={fi(`score_${p.key}`)} max={Number(p.max)} placeholder={`0-${p.max}`}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Mandats (un par ligne)</label>
              <Textarea value={instForm.mandats} onChange={fi('mandats')} placeholder="Ex: Membre du Conseil&#10;Vice-président commission..." rows={3}/>
            </div>
            <div>
              <label style={lbl}>Lacunes (une par ligne)</label>
              <Textarea value={instForm.gaps} onChange={fi('gaps')} placeholder="Ex: Faible participation aux groupes de travail..." rows={3}/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Prochaine réunion</label>
              <Input value={instForm.next_meeting_label} onChange={fi('next_meeting_label')} placeholder="Ex: Assemblée mondiale 2026"/>
            </div>
            <div>
              <label style={lbl}>Date</label>
              <Input value={instForm.next_meeting_date} onChange={fi('next_meeting_date')} type="date"/>
            </div>
            <div>
              <label style={lbl}>Lieu</label>
              <Input value={instForm.next_meeting_lieu} onChange={fi('next_meeting_lieu')} placeholder="Ville, Pays"/>
            </div>
          </div>
        </div>
        <ModalFooter onCancel={() => setInstModal(false)} onConfirm={handleSaveInst} loading={savingInst} confirmLabel={editingInst ? 'Mettre à jour' : 'Créer l\'instance'} color="#8b5cf6"/>
      </Modal>

      {/* Modal contribution */}
      <Modal open={contribModal} onClose={() => setContribModal(false)} title={editingContrib ? 'Modifier la contribution' : 'Ajouter une contribution'} width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>Titre de la contribution *</label>
            <Input value={contribForm.titre} onChange={fc('titre')} placeholder={`Ex: Soumission position${country ? ` ${country}` : ''} sur la résolution 45`}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Date</label>
              <Input value={contribForm.date} onChange={fc('date')} type="date"/>
            </div>
            <div>
              <label style={lbl}>Statut</label>
              <Select value={contribForm.statut} onChange={fc('statut')} style={{ width:'100%' }}>
                {withCurrent(ref.list('contribution_status'), contribForm.statut).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <label style={lbl}>Impact</label>
              <Select value={contribForm.impact} onChange={fc('impact')} style={{ width:'100%' }}>
                {withCurrent(ref.list('contribution_impact'), contribForm.impact).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </div>
          </div>
        </div>
        <ModalFooter onCancel={() => setContribModal(false)} onConfirm={handleSaveContrib} loading={savingContrib} confirmLabel={editingContrib ? 'Mettre à jour' : 'Ajouter'} color="#8b5cf6"/>
      </Modal>
    </div>
  );
}
