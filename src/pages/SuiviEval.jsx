import { useState, useEffect, useCallback, useRef } from 'react';
import { Target, Award, BarChart3, Calendar, Upload, X, File, Paperclip,
         CheckCircle, AlertCircle, AlertTriangle, Plus, Pencil, Clock, Trash2 } from 'lucide-react';
import { seApi, programsApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Btn, Select, Spinner, ErrorBanner,
         Modal, ModalFooter, Input } from '../components/UI.jsx';
import { T } from '../theme.js';
import { useRefData } from '../context/RefContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { hasPerm } from '../permissions.js';

/* ── helpers ───────────────────────────────────────────────── */
/* Progression vers la cible ; direction 'desc' = plus bas est mieux */
const pct = i => {
  const b = Number(i.baseline), t = Number(i.target), c = Number(i.current_value);
  const desc  = i.direction === 'desc';
  const range = desc ? b - t : t - b;
  if (isNaN(range) || isNaN(c)) return 0;
  if (range === 0) return (desc ? c <= t : c >= t) ? 100 : 0;   // baseline = cible : atteint ou non
  const done = desc ? b - c : c - b;
  return Math.max(0, Math.min(100, Math.round((done / range) * 100)));
};

const fmtNum = (v, compact) => {
  const n = Number(v);
  if (compact && Math.abs(n) >= 1000) return Math.abs(n) >= 1000000 ? `${(n/1000000).toFixed(1)}M` : `${Math.round(n/1000)}K`;
  return n.toLocaleString('fr-FR');
};
const fmtVal = (v, unit, compact = false) => {
  if (v == null || v === '' || isNaN(Number(v))) return '-';
  const s = fmtNum(v, compact);
  if (!unit) return s;
  return unit === '%' ? `${s}%` : `${s} ${unit}`;
};

/* Tendance signée, interprétée selon la direction de l'indicateur */
const trendInfo = ind => {
  const t = Number(ind.trend);
  if (!t || isNaN(t)) return null;
  const good = ind.direction === 'desc' ? t < 0 : t > 0;
  return { sign: t > 0 ? '+' : '−', arrow: t > 0 ? '↑' : '↓', abs: fmtVal(Math.abs(t), ind.unit, true), color: good ? '#10b981' : '#ef4444' };
};

const CYCLE_ICONS = [Clock, Calendar, BarChart3, Award];

/* Participants : tableau JSON (actuel) ou chaîne CSV (historique) */
const toParticipants = p => {
  if (Array.isArray(p)) return p.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof p !== 'string' || !p.trim()) return [];
  const s = p.trim();
  if (s.startsWith('[')) { try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(String).map(x => x.trim()).filter(Boolean); } catch { /* CSV */ } }
  return s.split(',').map(x => x.trim()).filter(Boolean);
};
const jsonField = (v, fb) => { if (v == null || v === '') return fb; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return fb; } };
/* Liste d'options + valeur courante si elle n'y figure plus (élément désactivé) */
const withCurrent = (list, value, labelOf) => value && !list.some(i => String(i.code) === String(value)) ? [...list, { code: value, label: labelOf(value) }] : list;

const FT = {
  pdf:     { color:'#ef4444', label:'PDF'  },
  word:    { color:'#3b82f6', label:'Word' },
  excel:   { color:'#10b981', label:'Excel'},
  ppt:     { color:'#f97316', label:'PPT'  },
  default: { color:T.textDim, label:'Doc'  },
};

const REVUE_EMPTY = { date:'', type:'', titre:'', animateur:'', statut:'', alertes:'0', decisions:'0', participants:'' };

const IND_EMPTY  = { code:'', label:'', category:'', unit:'', baseline:'', target:'', direction:'asc', program:'', current_value:'', status:'', trend:'', last_update:'', responsible:'', methodology:'', milestones:[] };
const EVAL_EMPTY = { annee: new Date().getFullYear(), statut:'', evaluateur:'', commanditaire:'', date:'', note_globale:'', description:'', notes:{}, conclusions:'', recommandations:'', alertes:'' };

const lbl = { fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 };
const taStyle = { background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:'DM Sans', width:'100%', boxSizing:'border-box', resize:'vertical' };

/* ── Gauge circulaire ──────────────────────────────────────── */
const Gauge = ({ value, size = 52 }) => {
  const ref = useRefData();
  const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c - (value / 100) * c, col = ref.scoreColor(value);
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 0.8s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:'DM Sans', fontSize:size>50?13:10, fontWeight:700, color:col }}>{value}</span>
      </div>
    </div>
  );
};

/* ── Sparkline ─────────────────────────────────────────────── */
const Sparkline = ({ milestones = [], color }) => {
  if (milestones.length < 2) return null;
  const vals = milestones.map(m => m.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const W = 110, H = 32;
  const pts = milestones.map((m, i) => {
    const x = (i / (milestones.length - 1)) * W;
    const y = H - ((m.value - min) / (max - min || 1)) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow:'visible', flexShrink:0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/>
      {milestones.map((m, i) => {
        const x = (i / (milestones.length - 1)) * W;
        const y = H - ((m.value - min) / (max - min || 1)) * H;
        return <circle key={i} cx={x} cy={y} r={2} fill={color}/>;
      })}
    </svg>
  );
};

/* ── Radar chart (évaluations) ─────────────────────────────── */
const RadarChart = ({ notes = {}, criteria = [], size = 130 }) => {
  const axes = criteria.map(c => ({ key:c.code, label:c.label }));
  if (axes.length < 3) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 18;
  const angle = i => (i * 2 * Math.PI) / axes.length - Math.PI / 2;
  const pt    = (i, pct) => ({ x: cx + Math.cos(angle(i)) * r * (pct / 100), y: cy + Math.sin(angle(i)) * r * (pct / 100) });
  const grid  = axes.map((_, i) => pt(i, 100));
  const poly  = axes.map((ax, i) => pt(i, notes[ax.key] || 0));
  const polyStr  = poly.map(p => `${p.x},${p.y}`).join(' ');
  const gridStr  = grid.map(p => `${p.x},${p.y}`).join(' ');
  const grid80   = axes.map((_, i) => pt(i, 80)).map(p => `${p.x},${p.y}`).join(' ');
  const grid60   = axes.map((_, i) => pt(i, 60)).map(p => `${p.x},${p.y}`).join(' ');
  return (
    <svg width={size} height={size}>
      <polygon points={gridStr} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
      <polygon points={grid80}  fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
      <polygon points={grid60}  fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>
      {axes.map((_, i) => { const e = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1}/>; })}
      <polygon points={polyStr} fill={`${T.teal}33`} stroke={T.teal} strokeWidth={1.5}/>
      {axes.map((ax, i) => { const e = pt(i, 120); return (
        <text key={i} x={e.x} y={e.y} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily:'DM Sans', fontSize:8, fill:'rgba(255,255,255,0.45)' }}>{ax.label}</text>
      ); })}
      {poly.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={T.teal}/>)}
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════
   PAGE PRINCIPALE
═══════════════════════════════════════════════════════════ */
export default function SuiviEval() {
  const ref      = useRefData();
  const { user } = useAuth();
  const scoreColor = ref.scoreColor;
  const orgName    = ref.setting('org_name');
  const planShort  = ref.setting('plan_short');
  const planEnd    = ref.setting('plan_end');
  const curYear    = String(new Date().getFullYear());
  const catOf    = code => { const it = ref.item('indicator_category', code); return { code, label: it?.label || code, color: it?.color || T.teal }; };
  const indStatuses  = ref.list('indicator_status');
  const revTypes     = ref.list('revue_type');
  const revStatuses  = ref.list('revue_status');
  const evalStatuses = ref.list('evaluation_status');
  const criteria     = ref.list('eval_criteria');
  const docTags      = ref.list('doc_tag');
  const defaultTag   = docTags[0]?.code || 'Autre';   // aligné sur refDefault(db,'doc_tag','Autre') côté API
  const seCycleRaw   = ref.json('se_cycle', []);
  const seCycle      = Array.isArray(seCycleRaw) ? seCycleRaw : [];
  const revTypeLabels = revTypes.map(t => t.label).filter(Boolean).join(' · ');
  const labelOf      = domain => code => ref.label(domain, code);
  const canEditInd   = hasPerm(user, 'indicators.update');
  const canManageInd = hasPerm(user, 'indicators.manage');
  const canManageRev = hasPerm(user, 'revues.manage');
  const canManageEval = hasPerm(user, 'evaluations.manage');
  const canRevDocs   = hasPerm(user, 'revues.docs');          // joindre une pièce jointe de revue
  const canRevDocsDel= hasPerm(user, 'revues.docs.delete');   // la retirer

  const [programs, setPrograms] = useState([]);
  const [tab, setTab]           = useState('overview');
  const [indicators, setInd]    = useState([]);
  const [revues, setRevues]     = useState([]);
  const [evaluations, setEvals] = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [catF, setCatF]         = useState('all');
  const [statusF, setStatusF]   = useState('all');
  const [selInd, setSelInd]     = useState(null);
  const [expRevue, setExpRevue] = useState(null);
  const [uploadTags, setUploadTags] = useState({});
  const [uploading, setUploading]   = useState({});
  const revFileRefs = useRef({});

  const [revModal, setRevModal]     = useState(false);
  const [editingRev, setEditingRev] = useState(null);
  const [savingRev, setSavingRev]   = useState(false);
  const [revForm, setRevForm]       = useState(REVUE_EMPTY);

  const [indModal, setIndModal]       = useState(false);
  const [editingInd, setEditingInd]   = useState(null);
  const [savingInd, setSavingInd]     = useState(false);
  const [indForm, setIndForm]         = useState(IND_EMPTY);

  const [evalModal, setEvalModal]     = useState(false);
  const [editingEval, setEditingEval] = useState(null);
  const [savingEval, setSavingEval]   = useState(false);
  const [evalForm, setEvalForm]       = useState(EVAL_EMPTY);

  /* Catégories actives + catégories désactivées encore utilisées par des indicateurs */
  const indCats = ref.list('indicator_category', { includeInactive: true })
    .filter(c => c.is_active || indicators.some(i => String(i.category) === String(c.code)));
  const CATS    = [{ code:'all', label:'Tous', color:T.teal }, ...indCats.map(c => ({ ...c, color: c.color || T.teal }))];
  const activeCats = indCats.filter(c => c.is_active);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ind, rev, ev, st, progs] = await Promise.all([
        seApi.indicators(), seApi.revues(), seApi.evaluations(), seApi.stats(), programsApi.list().catch(() => []),
      ]);
      setInd(ind); setRevues(rev); setEvals(ev); setStats(st); setPrograms(Array.isArray(progs) ? progs : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rf = k => v => setRevForm(p => ({ ...p, [k]: v }));
  const ef = k => v => setEvalForm(p => ({ ...p, [k]: v }));
  const enf = k => v => setEvalForm(p => ({ ...p, notes: { ...p.notes, [k]: v } }));
  const inf = k => v => setIndForm(p => ({ ...p, [k]: v }));

  const setMs = (i, k) => v => setIndForm(p => ({ ...p, milestones: p.milestones.map((m, j) => j === i ? { ...m, [k]: v } : m) }));
  const addMs = () => setIndForm(p => ({ ...p, milestones: [...p.milestones, { year:'', value:'' }] }));
  const rmMs  = i => setIndForm(p => ({ ...p, milestones: p.milestones.filter((_, j) => j !== i) }));

  const openCreateInd = () => {
    setEditingInd(null);
    setIndForm({ ...IND_EMPTY, category: catF !== 'all' ? catF : (activeCats[0]?.code || ''), status: indStatuses[0]?.code || '' });
    setIndModal(true);
  };
  const openEditInd = (ind, e) => {
    e.stopPropagation();
    setEditingInd(ind);
    const s = v => v ?? '';
    setIndForm({ code: s(ind.code), label: s(ind.label), category: s(ind.category), unit: s(ind.unit), baseline: s(ind.baseline), target: s(ind.target),
      direction: ind.direction === 'desc' ? 'desc' : 'asc', program: s(ind.program), current_value: s(ind.current_value), status: ind.status || indStatuses[0]?.code || '',
      trend: s(ind.trend), last_update: s(ind.last_update), responsible: s(ind.responsible), methodology: s(ind.methodology),
      milestones: (ind.milestones || []).map(m => ({ year: String(m.year ?? ''), value: String(m.value ?? '') })) });
    setIndModal(true);
  };

  const handleSaveInd = async () => {
    const f = { ...indForm, code: String(indForm.code).trim(), label: String(indForm.label).trim(), unit: String(indForm.unit).trim() };
    if (!f.code || !f.label || !f.category || !f.unit || f.target === '') return setError('Code, libellé, catégorie, unité et cible requis');
    const ms = f.milestones.filter(m => String(m.year).trim() !== '');
    if (ms.some(m => !/^\d{4}$/.test(String(m.year).trim()))) return setError('Chaque jalon doit avoir une année sur 4 chiffres');
    if (ms.some(m => m.value === '' || isNaN(Number(m.value)))) return setError('Chaque jalon doit avoir une valeur numérique');
    const num = v => (v === '' || v == null) ? null : Number(v);
    const baseline = num(f.baseline) ?? 0;
    const payload = { code: f.code, label: f.label, category: f.category, unit: f.unit, direction: f.direction,
      baseline, target: num(f.target), current_value: num(f.current_value) ?? baseline, trend: num(f.trend), status: f.status,
      program: f.program || null, last_update: f.last_update || null, responsible: f.responsible || null, methodology: f.methodology || null };
    setSavingInd(true);
    let saved = null;
    try {
      saved = editingInd ? await seApi.updateIndicator(editingInd.id, payload) : await seApi.createIndicator(payload);
      await seApi.setMilestones(saved.id, ms.map(m => ({ year: String(m.year).trim(), value: Number(m.value) })));
      setInd(await seApi.indicators());
      setIndModal(false);
    } catch (e) {
      /* Indicateur créé mais jalons refusés : on bascule la modale en édition pour éviter un doublon */
      if (!editingInd && saved?.id) {
        setEditingInd(saved);
        seApi.indicators().then(setInd).catch(() => {});
        setError(`Indicateur créé, mais jalons non enregistrés : ${e.message}`);
      } else setError(e.message);
    }
    finally { setSavingInd(false); }
  };

  const handleDeleteInd = async (ind, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer l'indicateur ${ind.code} et ses jalons ?`)) return;
    try { await seApi.deleteIndicator(ind.id); setInd(prev => prev.filter(i => i.id !== ind.id)); } catch (e) { setError(e.message); }
  };

  const openCreateEval = () => { setEvalForm({ ...EVAL_EMPTY, statut: evalStatuses[0]?.code || '' }); setEditingEval(null); setEvalModal(true); };
  const openEditEval = (ev, e) => {
    e.stopPropagation();
    const notes = (ev.notes_json && typeof ev.notes_json === 'object') ? ev.notes_json : {};
    setEvalForm({
      annee: ev.annee, statut: ev.statut, evaluateur: ev.evaluateur || '', commanditaire: ev.commanditaire || '',
      date: ev.date || '', note_globale: ev.note_globale ?? '', description: ev.description || '',
      notes: Object.fromEntries(criteria.map(c => [c.code, notes[c.code] ?? ''])),
      conclusions: (Array.isArray(ev.conclusions_json) ? ev.conclusions_json : []).join('\n'),
      recommandations: (Array.isArray(ev.recommandations_json) ? ev.recommandations_json : []).join('\n'),
      alertes: (Array.isArray(ev.alertes_json) ? ev.alertes_json : []).join('\n'),
    });
    setEditingEval(ev); setEvalModal(true);
  };

  const handleSaveEval = async () => {
    if (!evalForm.annee) return setError('Année requise');
    const in0to100 = v => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 100; };
    if (evalForm.note_globale !== '' && evalForm.note_globale != null && !in0to100(evalForm.note_globale)) return setError('La note globale doit être comprise entre 0 et 100');
    const notes = {};
    for (const [k, v] of Object.entries(evalForm.notes || {})) {
      if (v === '' || v == null) continue;
      if (!in0to100(v)) return setError('Les notes par critère doivent être comprises entre 0 et 100');
      notes[k] = Number(v);
    }
    setSavingEval(true);
    try {
      const toLines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
      const payload = { annee: Number(evalForm.annee), statut: evalForm.statut, evaluateur: evalForm.evaluateur, commanditaire: evalForm.commanditaire, date: evalForm.date, description: evalForm.description, note_globale: evalForm.note_globale !== '' && evalForm.note_globale != null ? Math.round(Number(evalForm.note_globale)) : null, notes_json: notes, conclusions_json: toLines(evalForm.conclusions), recommandations_json: toLines(evalForm.recommandations), alertes_json: toLines(evalForm.alertes) };
      const parseEval = raw => ({ ...raw, notes_json: jsonField(raw.notes_json, {}), conclusions_json: jsonField(raw.conclusions_json, []), recommandations_json: jsonField(raw.recommandations_json, []), alertes_json: jsonField(raw.alertes_json, []) });
      if (editingEval) {
        const updated = await seApi.updateEvaluation(editingEval.id, payload);
        setEvals(prev => prev.map(e => e.id === editingEval.id ? parseEval(updated) : e));
      } else {
        const created = await seApi.createEvaluation(payload);
        setEvals(prev => [...prev, parseEval(created)].sort((a, b) => a.annee - b.annee));
      }
      setEvalModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingEval(false); }
  };

  const handleDeleteEval = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette évaluation ?')) return;
    try { await seApi.deleteEvaluation(id); setEvals(prev => prev.filter(e => e.id !== id)); } catch (e) { setError(e.message); }
  };

  const handleDeleteRevue = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette revue et ses documents ?')) return;
    try { await seApi.deleteRevue(id); setRevues(prev => prev.filter(r => r.id !== id)); } catch (e) { setError(e.message); }
  };

  const openCreateRevue = () => { setRevForm({ ...REVUE_EMPTY, type: revTypes[0]?.code || '', statut: revStatuses[0]?.code || '' }); setEditingRev(null); setRevModal(true); };
  const openEditRevue   = (r, e) => {
    e.stopPropagation();
    setRevForm({ date:r.date||'', type:r.type||revTypes[0]?.code||'', titre:r.titre||'', animateur:r.animateur||'',
      statut:r.statut||revStatuses[0]?.code||'', alertes:String(r.alertes||0), decisions:String(r.decisions||0),
      participants: toParticipants(r.participants).join(', ') });
    setEditingRev(r); setRevModal(true);
  };

  const handleSaveRevue = async () => {
    if (!revForm.date || !revForm.titre) return setError('Date et titre requis');
    const intOk = v => v === '' || v == null || /^\d+$/.test(String(v).trim());
    if (!intOk(revForm.alertes) || !intOk(revForm.decisions)) return setError('Alertes et décisions doivent être des entiers positifs');
    setSavingRev(true);
    try {
      const payload = { ...revForm, alertes:parseInt(revForm.alertes, 10)||0, decisions:parseInt(revForm.decisions, 10)||0,
        participants: toParticipants(revForm.participants) };
      if (editingRev) {
        const updated = await seApi.updateRevue(editingRev.id, payload);
        setRevues(rs => rs.map(r => r.id === editingRev.id ? { ...r, ...updated } : r));
      } else {
        const created = await seApi.createRevue(payload);
        setRevues(rs => [created, ...rs]);
      }
      setRevModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingRev(false); }
  };

  const handleRevUpload = async (rid, files, tag) => {
    if (!files?.length) return;
    setUploading(u => ({ ...u, [rid]:true }));
    try {
      for (const file of Array.from(files)) {
        const doc = await seApi.uploadRevueDoc(rid, file, tag || defaultTag);
        setRevues(prev => prev.map(r => r.id === rid ? { ...r, documents:[...(r.documents||[]), doc] } : r));
      }
    } catch (e) { setError(e.message); }
    finally { setUploading(u => ({ ...u, [rid]:false })); }
  };

  const downloadRevDoc = async (rid, doc) => {
    try { await seApi.downloadRevueDoc(rid, doc.id, doc.name); }
    catch (e) { setError(e.message || 'Téléchargement impossible'); }
  };

  const removeRevDoc = async (rid, did) => {
    try {
      await seApi.deleteRevueDoc(rid, did);
      setRevues(prev => prev.map(r => r.id !== rid ? r : { ...r, documents:(r.documents||[]).filter(d=>d.id!==did) }));
    } catch (e) { setError(e.message); }
  };

  const filteredInd = indicators.filter(i => {
    const okCat  = catF === 'all'    || i.category === catF;
    const okStat = statusF === 'all' || i.status   === statusF;
    return okCat && okStat;
  });

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={36}/></div>;

  const statusGroups = indStatuses.map(s => ({ ...s, inds: indicators.filter(i => i.status === s.code) }));
  const avgProg = stats?.avg_progress || 0;
  const nInd    = indicators.length;

  const tabs = [
    { id:'overview',    icon:BarChart3, label:"Vue d'ensemble"           },
    { id:'indicateurs', icon:Target,    label:`Indicateurs ${planShort}`  },
    { id:'revues',      icon:Calendar,  label:'Revues & COPIL'            },
    { id:'evaluations', icon:Award,     label:'Évaluations indépendantes' },
  ];

  return (
    <div className="fade-in">
      <HeroBanner eyebrow={`${orgName} · ${planShort} ${ref.planPeriod}`} title="Dispositif de Suivi-Évaluation"
        subtitle={['Pilotage en temps réel', revTypeLabels, `${nInd} indicateur${nInd>1?'s':''} suivi${nInd>1?'s':''}`].filter(Boolean).join(' · ')}
        stats={[
          { value:`${avgProg}%`,                    label:'Avancement moy. programmes', color:scoreColor(avgProg) },
          ...statusGroups.map(s => ({ value:s.inds.length, label:s.label, color:s.color || T.teal })),
          { value:stats?.total_decisions || 0,       label:'Décisions prises',      color:T.teal    },
        ]}/>

      {/* Sous-onglets */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${T.border}`, padding:'0 28px', background:'rgba(255,255,255,0.015)', position:'sticky', top:0, zIndex:10 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:7, fontFamily:'DM Sans', fontSize:12, fontWeight:tab===t.id?600:400, padding:'15px 20px', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?T.teal:'transparent'}`, color:tab===t.id?T.teal:T.textMuted, cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap' }}>
            <t.icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')}/>

        {/* ══ VUE D'ENSEMBLE ══════════════════════════════════ */}
        {tab === 'overview' && (
          <div>
            {/* Bannière ambition */}
            <div style={{ background:'linear-gradient(135deg,#0d2a0d,#0a2210 40%,#071a2a)', border:`1px solid #10b98133`, borderRadius:14, padding:'20px 28px', marginBottom:24, display:'flex', alignItems:'center', gap:20, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', right:-30, top:-30, width:200, height:200, background:'radial-gradient(circle,#10b98115,transparent 70%)', borderRadius:'50%' }}/>
              <div style={{ width:60, height:60, borderRadius:14, background:'linear-gradient(135deg,#f59e0b,#d97706)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Award size={28} color="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:'#f59e0b', marginBottom:6 }}>Ambition stratégique · {ref.setting('plan_name')}</div>
                <div style={{ fontFamily:'EB Garamond', fontSize:22, fontWeight:500, color:T.text, lineHeight:1.2 }}>{ref.setting('plan_ambition')}</div>
                <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, marginTop:6 }}>{[`${nInd} indicateur${nInd>1?'s':''} suivi${nInd>1?'s':''}`, orgName && `Suivi piloté par ${orgName}`, revTypeLabels].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ textAlign:'center', flexShrink:0 }}>
                <div style={{ fontFamily:'EB Garamond', fontSize:42, fontWeight:600, color:'#f59e0b', lineHeight:1 }}>{avgProg}%</div>
                <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:3 }}>avancement moy. programmes</div>
              </div>
            </div>

            {/* Statuts */}
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(statusGroups.length, 4) || 1},1fr)`, gap:14, marginBottom:28 }}>
              {statusGroups.map(g => ({
                count:g.inds.length, label:g.label, sub:g.meta?.desc || '', color:g.color || T.teal,
                icon: ref.has('indicator_status', g.code, 'nominal') ? CheckCircle
                    : ref.has('indicator_status', g.code, 'critical') ? AlertCircle
                    : ref.has('indicator_status', g.code, 'alert') ? AlertTriangle : Clock,
                ids:g.inds.map(i => i.code),
              })).map((s,i) => (
                <div key={i} style={{ background:T.surface, border:`1px solid ${s.color}33`, borderRadius:12, padding:'18px 20px', borderLeft:`4px solid ${s.color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontFamily:'EB Garamond', fontSize:42, fontWeight:500, color:s.color, lineHeight:1 }}>{s.count}</div>
                      <div style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:600, color:T.text, marginTop:4 }}>{s.label}</div>
                      <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:2 }}>{s.sub}</div>
                    </div>
                    <div style={{ background:`${s.color}20`, borderRadius:10, padding:10 }}><s.icon size={18} color={s.color}/></div>
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {s.ids.map(code => (
                      <span key={code} style={{ background:`${s.color}18`, color:s.color, fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6 }}>{code}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Portefeuille NDT */}
            {stats?.programs?.length > 0 && (
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 24px', marginBottom:28 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                  <h3 style={{ fontFamily:'EB Garamond', fontSize:20, color:T.text, margin:0 }}>Portefeuille {planShort} - Avancement par programme</h3>
                  <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:scoreColor(avgProg) }}>{avgProg}% moy. programmes</span>
                </div>
                <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginBottom:16 }}>
                  {stats.progress_mode === 'projects'
                    ? `Progression calculée à partir des projets (pondérée par budget) des ${stats.programs.length} programmes`
                    : `Progression basée sur le suivi réel des ${stats.programs.length} programmes opérationnels`}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                  {stats.programs.map(prog => {
                    const scol = ref.color('program_status', prog.status, '#ef4444');
                    return (
                      <div key={prog.code} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 13px', background:T.surface2, borderRadius:8, border:`1px solid ${T.border}` }}>
                        <div style={{ width:36, height:36, borderRadius:7, background:`${scol}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${scol}30` }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:9, fontWeight:800, color:scol }}>{prog.code}</span>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textMuted, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{prog.name}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1 }}><ProgressBar value={prog.progress} color={scol} height={4}/></div>
                            <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:scol, flexShrink:0 }}>{prog.progress}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catégories */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16, marginBottom:28 }}>
              {CATS.slice(1).map(cat => {
                const catInds = indicators.filter(i => i.category === cat.code);
                const avg = catInds.length ? Math.round(catInds.reduce((s,i)=>s+pct(i),0)/catInds.length) : 0;
                return (
                  <div key={cat.code}style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'18px 20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                      <div>
                        <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, color:cat.color, textTransform:'uppercase', marginBottom:3 }}>{cat.label}</div>
                        <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>{catInds.length} indicateur{catInds.length>1?'s':''}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:'EB Garamond', fontSize:28, color:scoreColor(avg), fontWeight:500, lineHeight:1 }}>{avg}%</div>
                        <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>progression</div>
                      </div>
                    </div>
                    <ProgressBar value={avg} color={cat.color} height={6}/>
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:14 }}>
                      {catInds.map(ind => {
                        const p = pct(ind);
                        return (
                          <div key={ind.id}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textMuted }}>
                                <span style={{ color:cat.color, fontWeight:700 }}>{ind.code}</span> · {ind.label.length>42?ind.label.slice(0,42)+'…':ind.label}
                              </span>
                              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                                <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:scoreColor(p) }}>{p}%</span>
                                <div style={{ width:7, height:7, borderRadius:'50%', background:scoreColor(p) }}/>
                              </div>
                            </div>
                            <ProgressBar value={p} color={scoreColor(p)} height={3}/>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cycle S&E */}
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'20px 24px' }}>
              <h3 style={{ fontFamily:'EB Garamond', fontSize:20, color:T.text, marginBottom:16 }}>Cycle de pilotage S&E - {orgName}</h3>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(seCycle.length, 4) || 1},1fr)`, gap:12 }}>
                {(Array.isArray(seCycle) ? seCycle : []).map((c, i) => ({ ...c, color: c.color || T.teal, icon: CYCLE_ICONS[i % CYCLE_ICONS.length] })).map((c, i) => (
                  <div key={i} style={{ background:`${c.color}10`, border:`1px solid ${c.color}25`, borderRadius:10, padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <c.icon size={16} color={c.color}/>
                      <span style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:700, color:c.color }}>{c.freq}</span>
                    </div>
                    <p style={{ fontFamily:'DM Sans', fontSize:11, color:T.textMuted, lineHeight:1.65 }}>{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ INDICATEURS ══════════════════════════════════════ */}
        {tab === 'indicateurs' && (
          <div>
            <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
              {/* Filtre catégorie */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
                {CATS.map(c => {
                  const col = c.color || T.teal;
                  return (
                  <button key={c.code} onClick={() => setCatF(c.code)}
                    style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:500, padding:'7px 13px', borderRadius:8, border:`1px solid ${catF===c.code?col:T.border}`, background:catF===c.code?`${col}20`:T.surface, color:catF===c.code?col:T.textMuted, cursor:'pointer', transition:'all 0.2s' }}>
                    {c.label}
                  </button>
                  );
                })}
              </div>
              {/* Filtre statut */}
              <div style={{ display:'flex', gap:6 }}>
                {[['all','Tous'], ...indStatuses.map(s => [s.code, s.label])].map(([v,l]) => (
                  <button key={v} onClick={() => setStatusF(v)}
                    style={{ fontFamily:'DM Sans', fontSize:11, padding:'7px 13px', borderRadius:8, border:`1px solid ${statusF===v?T.teal:T.border}`, background:statusF===v?`${T.teal}20`:T.surface, color:statusF===v?T.teal:T.textMuted, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
              {canManageInd && <Btn onClick={openCreateInd} color={T.teal}><Plus size={14}/> Nouvel indicateur</Btn>}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filteredInd.map(ind => {
                const p = pct(ind);
                const cat = catOf(ind.category);
                const tr  = trendInfo(ind);
                const isOpen = selInd === ind.id;
                return (
                  <Card key={ind.id} style={{ border:`1px solid ${isOpen?cat.color+'55':T.border}` }}>
                    <div style={{ padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:16 }}
                      onClick={() => setSelInd(isOpen ? null : ind.id)}>
                      {/* Code badge */}
                      <div style={{ width:44, height:44, borderRadius:10, background:`${cat.color}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${cat.color}33` }}>
                        <span style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:800, color:cat.color }}>{ind.code}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:600, color:T.text }}>{ind.label}</span>
                          <Badge status={ind.status} domain="indicator_status"/>
                          {tr && <span style={{ fontFamily:'DM Sans', fontSize:10, color:tr.color }}>{tr.arrow} {tr.sign}{tr.abs}/an</span>}
                          {ind.direction === 'desc' && <span style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>↓ plus bas = mieux</span>}
                        </div>
                        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>Base : {fmtVal(ind.baseline, ind.unit, true)}</span>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:scoreColor(p) }}>
                                {fmtVal(ind.current_value, ind.unit === '%' ? '%' : '', true)} / {fmtVal(ind.target, ind.unit, true)} · {p}%
                              </span>
                            </div>
                            <ProgressBar value={p} color={scoreColor(p)} height={5}/>
                          </div>
                          <Sparkline milestones={ind.milestones||[]} color={scoreColor(p)}/>
                        </div>
                      </div>
                      <div style={{ flexShrink:0, textAlign:'right', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                        <Gauge value={p} size={52}/>
                        <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim }}>{ind.last_update || '-'}</div>
                        <div style={{ display:'flex', gap:2 }}>
                          {canEditInd && <button onClick={e => openEditInd(ind, e)} title="Modifier"
                            style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'2px 4px', borderRadius:4 }}
                            onMouseEnter={e=>e.currentTarget.style.color=T.teal} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}>
                            <Pencil size={12}/>
                          </button>}
                          {canManageInd && <button onClick={e => handleDeleteInd(ind, e)} title="Supprimer"
                            style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'2px 4px', borderRadius:4 }}
                            onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}>
                            <Trash2 size={12}/>
                          </button>}
                        </div>
                      </div>
                    </div>

                    {/* Détail étendu */}
                    {isOpen && (
                      <div style={{ borderTop:`1px solid ${T.border}`, padding:'16px 20px' }} className="slide-in">
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
                          {/* Jalons */}
                          <div>
                            <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:10 }}>Jalons cibles</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                              {(ind.milestones||[]).map((m, i) => {
                                const isCur = String(m.year) === curYear;
                                return (
                                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 10px', background:isCur?`${cat.color}18`:T.surface2, borderRadius:6, border:isCur?`1px solid ${cat.color}33`:'none' }}>
                                    <span style={{ fontFamily:'DM Sans', fontSize:11, color:isCur?cat.color:T.textDim, fontWeight:isCur?700:400 }}>{m.year}</span>
                                    <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:isCur?cat.color:T.textMuted }}>{fmtVal(m.value, ind.unit, true)}</span>
                                    {isCur && <span style={{ fontFamily:'DM Sans', fontSize:9, color:cat.color }}>● actuel</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* Méthodologie */}
                          <div>
                            <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:10 }}>Méthodologie & source</div>
                            <p style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.7 }}>{ind.methodology}</p>
                            <div style={{ marginTop:10, fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>
                              <div>🗓 MAJ : <span style={{ color:T.teal }}>{ind.last_update}</span></div>
                              <div style={{ marginTop:3 }}>👤 <span style={{ color:T.textMuted }}>{ind.responsible}</span></div>
                            </div>
                          </div>
                          {/* Programme NDT */}
                          <div>
                            <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:10 }}>Programme {planShort} associé</div>
                            <div style={{ background:`${cat.color}15`, border:`1px solid ${cat.color}25`, borderRadius:8, padding:'10px 14px' }}>
                              <span style={{ fontFamily:'DM Sans', fontSize:12, color:cat.color, fontWeight:600 }}>{ind.program || '-'}</span>
                              {ind.program_name && <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textMuted, marginTop:3 }}>{ind.program_name}</div>}
                            </div>
                            {ind.program_progress != null && (
                              <div style={{ marginTop:10 }}>
                                <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:6 }}>Avancement programme</div>
                                <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:5 }}>
                                  <span style={{ fontFamily:'EB Garamond', fontSize:24, fontWeight:500, color:scoreColor(ind.program_progress) }}>{ind.program_progress}%</span>
                                  <span style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>implémentation</span>
                                </div>
                                <ProgressBar value={ind.program_progress} color={scoreColor(ind.program_progress)} height={4}/>
                              </div>
                            )}
                            {tr && (
                              <div style={{ marginTop:12 }}>
                                <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:6 }}>Vitesse de progression</div>
                                <div style={{ fontFamily:'EB Garamond', fontSize:22, color:tr.color }}>{tr.sign}{tr.abs}<span style={{ fontSize:13, color:T.textDim }}>/an</span></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
              {filteredInd.length === 0 && (
                <div style={{ padding:'32px', textAlign:'center', background:T.surface, borderRadius:12, border:`1px solid ${T.border}` }}>
                  <div style={{ fontFamily:'DM Sans', fontSize:13, color:T.textDim }}>Aucun indicateur pour ces filtres</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ REVUES ═══════════════════════════════════════════ */}
        {tab === 'revues' && (
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, background:`${T.teal}12`, border:`1px solid ${T.teal}25`, borderRadius:8, padding:'7px 14px' }}>
                  <Paperclip size={13} color={T.teal}/>
                  <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.teal, fontWeight:600 }}>
                    {revues.reduce((s,r)=>s+(r.documents||[]).length,0)} documents joints
                  </span>
                </div>
                {canManageRev && <Btn onClick={openCreateRevue} color={T.teal}><Plus size={14}/> Nouvelle revue</Btn>}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {revues.map(r => {
                  const tc   = { color: ref.color('revue_type', r.type, T.teal), label: ref.label('revue_type', r.type) };
                  const held = ref.has('revue_status', r.statut, 'held');
                  const stc  = ref.color('revue_status', r.statut, held ? '#10b981' : '#f59e0b');
                  const isExp = expRevue === r.id;
                  return (
                    <Card key={r.id} style={{ border:`1px solid ${isExp?tc.color+'44':T.border}` }}>
                      <div style={{ height:3, background:`linear-gradient(90deg,${tc.color}99,transparent)`, borderRadius:'12px 12px 0 0' }}/>
                      <div style={{ padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:14 }}
                        onClick={() => setExpRevue(isExp?null:r.id)}>
                        <div style={{ background:`${tc.color}20`, border:`1px solid ${tc.color}33`, borderRadius:10, padding:'8px 12px', textAlign:'center', flexShrink:0, minWidth:58 }}>
                          <div style={{ fontFamily:'DM Sans', fontSize:18, fontWeight:800, color:tc.color, lineHeight:1 }}>{r.date?.slice(8,10)}</div>
                          <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim, textTransform:'uppercase' }}>{new Date(r.date+'T12:00:00').toLocaleString('fr-FR',{month:'short'})}</div>
                          <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim }}>{r.date?.slice(0,4)}</div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:5 }}>
                            <span style={{ background:`${tc.color}20`, color:tc.color, fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>{tc.label}</span>
                            <span style={{ background:`${stc}26`, color:stc, fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>
                              {held ? '✓' : '○'} {ref.label('revue_status', r.statut)}
                            </span>
                            {(r.documents||[]).length>0 && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:`${tc.color}15`, color:tc.color, fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>
                                <Paperclip size={9}/>{r.documents.length}
                              </span>
                            )}
                          </div>
                          <div style={{ fontFamily:'EB Garamond', fontSize:15, color:T.text, marginBottom:4 }}>{r.titre}</div>
                          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>🎙 {r.animateur}</span>
                            {held && (
                              <>
                                <span style={{ fontFamily:'DM Sans', fontSize:11, color:r.alertes>0?'#f59e0b':T.textDim }}>⚠ {r.alertes} alerte{r.alertes>1?'s':''}</span>
                                <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.teal }}>✓ {r.decisions} décision{r.decisions>1?'s':''}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {canManageRev && <>
                        <button onClick={e=>openEditRevue(r,e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Modifier">
                          <Pencil size={12}/>
                        </button>
                        <button onClick={e=>handleDeleteRevue(r.id,e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Supprimer"
                          onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textMuted}>
                          <Trash2 size={12}/>
                        </button>
                        </>}
                      </div>

                      {isExp && (
                        <div style={{ borderTop:`1px solid ${T.border}`, padding:'16px 18px' }} className="slide-in">
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <Paperclip size={13} color={tc.color}/>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:tc.color }}>
                                Pièces jointes ({(r.documents||[]).length})
                              </span>
                            </div>
                            {canRevDocs && (
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <Select value={uploadTags[r.id]||defaultTag} onChange={v=>setUploadTags(t=>({...t,[r.id]:v}))} style={{ fontSize:11, padding:'5px 8px' }}>
                                {docTags.map(t=><option key={t.code} value={t.code}>{t.label}</option>)}
                              </Select>
                              <input ref={el=>revFileRefs.current[r.id]=el} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.csv,.txt,.png,.jpg,.jpeg" style={{ display:'none' }}
                                onChange={e=>{ const fl = Array.from(e.target.files||[]); e.target.value=''; handleRevUpload(r.id,fl,uploadTags[r.id]); }}/>
                              <Btn onClick={()=>revFileRefs.current[r.id]?.click()} variant="outline" color={tc.color} size="sm" disabled={uploading[r.id]}>
                                {uploading[r.id]?<Spinner size={12} color={tc.color}/>:<Upload size={12}/>} Joindre
                              </Btn>
                            </div>
                            )}
                          </div>
                          {(r.documents||[]).length===0
                            ? <div style={{ padding:14, background:T.surface2, borderRadius:8, textAlign:'center', fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>Aucun document joint</div>
                            : <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                              {(r.documents||[]).map(doc => {
                                const ft = FT[doc.file_type]||FT.default;
                                return (
                                  <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:T.surface2, borderRadius:9, border:`1px solid ${T.border}` }}>
                                    <div style={{ width:32, height:32, borderRadius:6, background:`${ft.color}22`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                      <File size={14} color={ft.color}/>
                                    </div>
                                    <div style={{ flex:1 }}>
                                      <button onClick={()=>downloadRevDoc(r.id,doc)}style={{ background:'none', border:'none', fontFamily:'DM Sans', fontSize:12, color:T.teal, cursor:'pointer', padding:0 }}>{doc.name}</button>
                                      <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>{ft.label} · {doc.size} · {doc.date}</div>
                                    </div>
                                    <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:T.teal, background:`${T.teal}18`, padding:'3px 8px', borderRadius:8 }}>{ref.label('doc_tag', doc.tag)}</span>
                                    {canRevDocsDel && <button onClick={()=>removeRevDoc(r.id,doc.id)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer' }}
                                      onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}>
                                      <X size={13}/>
                                    </button>}
                                  </div>
                                );
                              })}
                            </div>
                          }
                        </div>
                      )}
                    </Card>
                  );
                })}
                {revues.length === 0 && (
                  <div style={{ padding:'48px 24px', textAlign:'center', background:T.surface, borderRadius:12, border:`1px solid ${T.border}` }}>
                    <Calendar size={36} color={T.teal} style={{ margin:'0 auto 12px', opacity:0.4 }}/>
                    <div style={{ fontFamily:'EB Garamond', fontSize:20, color:T.textMuted, marginBottom:6 }}>Aucune revue</div>
                    <div style={{ fontFamily:'DM Sans', fontSize:13, color:T.textDim }}>Planifiez votre première revue en cliquant sur « Nouvelle revue ».</div>
                  </div>
                )}
              </div>
            </div>

            {/* Statistiques revues */}
            <Card style={{ padding:'18px 20px', alignSelf:'start' }}>
              <h4 style={{ fontFamily:'EB Garamond', fontSize:18, color:T.text, marginBottom:14 }}>Statistiques</h4>
              {[
                { label:'Revues tenues',   value:revues.filter(r=>ref.has('revue_status', r.statut, 'held')).length, color:'#10b981' },
                { label:'Revues à venir',  value:revues.filter(r=>ref.has('revue_status', r.statut, 'open')).length, color:'#f59e0b' },
                { label:'Alertes soulevées',  value:revues.reduce((s,r)=>s+(Number(r.alertes)||0),0),    color:'#f59e0b' },
                { label:'Décisions prises',   value:revues.reduce((s,r)=>s+(Number(r.decisions)||0),0),  color:T.teal    },
                { label:'Documents archivés', value:revues.reduce((s,r)=>s+(r.documents||[]).length,0),  color:'#8b5cf6' },
              ].map((s,i,arr) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:i<arr.length-1?`1px solid ${T.border}`:'none' }}>
                  <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>{s.label}</span>
                  <span style={{ fontFamily:'EB Garamond', fontSize:24, color:s.color }}>{s.value}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ══ ÉVALUATIONS ══════════════════════════════════════ */}
        {tab === 'evaluations' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              {canManageEval && <Btn onClick={openCreateEval} color="#f59e0b"><Plus size={14}/> Nouvelle évaluation</Btn>}
            </div>
            {evaluations.map(ev => {
              const isDone = ref.has('evaluation_status', ev.statut, 'closed');
              const sc = ref.color('evaluation_status', ev.statut, isDone ? '#10b981' : '#f59e0b');
              const concl = Array.isArray(ev.conclusions_json)     ? ev.conclusions_json     : [];
              const recs  = Array.isArray(ev.recommandations_json) ? ev.recommandations_json : [];
              const alts  = Array.isArray(ev.alertes_json)         ? ev.alertes_json         : [];
              const notes = ev.notes_json && typeof ev.notes_json === 'object' ? ev.notes_json : {};
              return (
                <Card key={ev.id}>
                  <div style={{ height:4, background:`linear-gradient(90deg,${sc},${sc}88)` }}/>
                  <div style={{ padding:'20px 24px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                          <h3 style={{ fontFamily:'EB Garamond', fontSize:22, color:T.text }}>Évaluation {ev.annee}</h3>
                          <span style={{ background:`${sc}20`, color:sc, fontFamily:'DM Sans', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:10 }}>
                            {isDone ? '✓' : '○'} {ref.label('evaluation_status', ev.statut)}
                          </span>
                          {canManageEval && <>
                          <button onClick={e => openEditEval(ev, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'2px 4px' }}
                            onMouseEnter={e=>e.currentTarget.style.color=T.teal} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><Pencil size={13}/></button>
                          <button onClick={e => handleDeleteEval(ev.id, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'2px 4px' }}
                            onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><Trash2 size={13}/></button>
                          </>}
                        </div>
                        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>🏢 {ev.evaluateur}</span>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>📅 {ev.date}</span>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>📋 {ev.commanditaire}</span>
                        </div>
                      </div>
                      {isDone && ev.note_globale != null && (
                        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                          <RadarChart notes={notes} criteria={criteria} size={130}/>
                          <Gauge value={ev.note_globale} size={68}/>
                        </div>
                      )}
                    </div>

                    {isDone ? (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:10 }}>Conclusions</div>
                          {concl.map((c,i) => (
                            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'6px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
                              <div style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', marginTop:5, flexShrink:0 }}/>
                              <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.6 }}>{c}</span>
                            </div>
                          ))}
                          {alts.length > 0 && (
                            <div style={{ marginTop:12 }}>
                              <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#f59e0b', marginBottom:8 }}>Alertes</div>
                              {alts.map((a,i) => (
                                <div key={i} style={{ display:'flex', gap:8, padding:'5px 0' }}>
                                  <AlertCircle size={12} color="#f59e0b" style={{ marginTop:2, flexShrink:0 }}/>
                                  <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>{a}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:10 }}>Recommandations</div>
                          {recs.map((r,i) => (
                            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'6px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
                              <div style={{ width:5, height:5, borderRadius:'50%', background:T.teal, marginTop:5, flexShrink:0 }}/>
                              <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.6 }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (ev.description || alts.length > 0) && (
                      <div style={{ background:T.surface2, borderRadius:10, padding:'14px 18px' }}>
                        {ev.description && <p style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, whiteSpace:'pre-line' }}>{ev.description}</p>}
                        {alts.map((a,i) => (
                          <div key={i} style={{ display:'flex', gap:8, marginTop:ev.description || i > 0 ? 8 : 0 }}>
                            <Calendar size={12} color="#f59e0b" style={{ marginTop:2 }}/>
                            <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
            {evaluations.length === 0 && (
              <div style={{ padding:'48px 24px', textAlign:'center', background:T.surface, borderRadius:12, border:`1px solid ${T.border}` }}>
                <Award size={36} color={T.teal} style={{ margin:'0 auto 12px', opacity:0.4 }}/>
                <div style={{ fontFamily:'EB Garamond', fontSize:20, color:T.textMuted }}>Aucune évaluation enregistrée</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal indicateur ── */}
      <Modal open={indModal} onClose={() => setIndModal(false)} title={editingInd ? `Modifier ${editingInd.code} - ${editingInd.label?.slice(0,40)}` : 'Nouvel indicateur'} width={620}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <ErrorBanner error={error} onDismiss={() => setError('')}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 3fr', gap:12 }}>
            <div>
              <label style={lbl}>Code *</label>
              <Input value={indForm.code} onChange={inf('code')} placeholder="IND-01"/>
            </div>
            <div>
              <label style={lbl}>Libellé *</label>
              <Input value={indForm.label} onChange={inf('label')} placeholder="Intitulé de l'indicateur"/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Catégorie *</label>
              <Select value={indForm.category} onChange={inf('category')} style={{ width:'100%' }}>
                <option value="" disabled>Choisir…</option>
                {withCurrent(activeCats, indForm.category, labelOf('indicator_category')).map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <label style={lbl}>Unité *</label>
              <Input value={indForm.unit} onChange={inf('unit')} placeholder="%, rang, Md FCFA…"/>
            </div>
            <div>
              <label style={lbl}>Sens</label>
              <Select value={indForm.direction} onChange={inf('direction')} style={{ width:'100%' }}>
                <option value="asc">Plus haut = mieux</option>
                <option value="desc">Plus bas = mieux</option>
              </Select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Baseline{indForm.unit ? ` (${indForm.unit})` : ''}</label>
              <Input value={indForm.baseline} onChange={inf('baseline')} type="number" placeholder="0"/>
            </div>
            <div>
              <label style={lbl}>Valeur actuelle{indForm.unit ? ` (${indForm.unit})` : ''}</label>
              <Input value={indForm.current_value} onChange={inf('current_value')} type="number" placeholder="0"/>
            </div>
            <div>
              <label style={lbl}>Cible {planEnd} *</label>
              <Input value={indForm.target} onChange={inf('target')} type="number" placeholder="0"/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Programme {planShort}</label>
              <Select value={indForm.program} onChange={inf('program')} style={{ width:'100%' }}>
                <option value="">- Aucun -</option>
                {programs.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
                {indForm.program && !programs.some(p => p.code === indForm.program) && <option value={indForm.program}>{indForm.program}</option>}
              </Select>
            </div>
            <div>
              <label style={lbl}>Statut</label>
              <Select value={indForm.status} onChange={inf('status')} style={{ width:'100%' }}>
                {withCurrent(indStatuses, indForm.status, labelOf('indicator_status')).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Tendance annuelle ({indForm.unit || '-'}/an)</label>
              <Input value={indForm.trend} onChange={inf('trend')} type="number" placeholder="0"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date de mise à jour</label>
              <Input value={indForm.last_update} onChange={inf('last_update')} placeholder={`Ex: T1 ${curYear}`}/>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Responsable</label>
            <Input value={indForm.responsible} onChange={inf('responsible')} placeholder="Nom / Direction responsable"/>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Méthodologie & source</label>
            <textarea value={indForm.methodology} onChange={e => inf('methodology')(e.target.value)} rows={3} placeholder="Source des données, méthode de calcul…"
              style={{ background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:'DM Sans', width:'100%', boxSizing:'border-box', resize:'vertical' }}/>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <label style={{ ...lbl, marginBottom:0 }}>Jalons cibles</label>
              <Btn onClick={addMs} variant="ghost" color={T.teal} size="sm"><Plus size={12}/> Jalon</Btn>
            </div>
            {indForm.milestones.length === 0 && <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, background:T.surface2, borderRadius:8, padding:'8px 12px' }}>Aucun jalon</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {indForm.milestones.map((m, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, alignItems:'center' }}>
                  <Input value={m.year} onChange={setMs(i, 'year')} placeholder="Année"/>
                  <Input value={m.value} onChange={setMs(i, 'value')} type="number" placeholder={`Valeur${indForm.unit ? ` (${indForm.unit})` : ''}`}/>
                  <button onClick={() => rmMs(i)} title="Retirer" style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'4px 6px' }}
                    onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><X size={13}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ModalFooter onCancel={() => setIndModal(false)} onConfirm={handleSaveInd} loading={savingInd} confirmLabel={editingInd ? 'Enregistrer' : 'Créer'}/>
      </Modal>

      {/* ── Modal évaluation ── */}
      <Modal open={evalModal} onClose={() => setEvalModal(false)} title={editingEval ? `Modifier évaluation ${editingEval.annee}` : 'Nouvelle évaluation'} width={600}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <ErrorBanner error={error} onDismiss={() => setError('')}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Année *</label>
              <Input value={evalForm.annee} onChange={ef('annee')} type="number" placeholder={curYear}/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Statut</label>
              <Select value={evalForm.statut} onChange={ef('statut')} style={{ width:'100%' }}>
                {withCurrent(evalStatuses, evalForm.statut, labelOf('evaluation_status')).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date</label>
              <Input value={evalForm.date} onChange={ef('date')} type="date"/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Évaluateur</label>
              <Input value={evalForm.evaluateur} onChange={ef('evaluateur')} placeholder="Cabinet / Institution"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Commanditaire</label>
              <Input value={evalForm.commanditaire} onChange={ef('commanditaire')} placeholder="Ex: Ministère, PTF…"/>
            </div>
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea value={evalForm.description} onChange={e => ef('description')(e.target.value)} rows={2} placeholder="Ex: Évaluateur sélectionné par appel d'offres ouvert…" style={taStyle}/>
          </div>
          {ref.has('evaluation_status', evalForm.statut, 'closed') && (<>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Note globale (0-100)</label>
              <Input value={evalForm.note_globale} onChange={ef('note_globale')} type="number" placeholder="75"/>
            </div>
            <div>
              <p style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:T.textDim, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Notes par critère (0-100)</p>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(criteria.length, 5) || 1},1fr)`, gap:8 }}>
                {criteria.map(({ code:k, label:l }) => (
                  <div key={k}>
                    <label style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, display:'block', marginBottom:4 }}>{l}</label>
                    <Input value={evalForm.notes[k] ?? ''} onChange={enf(k)} type="number" placeholder="0"/>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Conclusions (une par ligne)</label>
              <textarea value={evalForm.conclusions} onChange={e => ef('conclusions')(e.target.value)} rows={3}
                style={{ background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:'DM Sans', width:'100%', boxSizing:'border-box', resize:'vertical' }}/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Recommandations (une par ligne)</label>
              <textarea value={evalForm.recommandations} onChange={e => ef('recommandations')(e.target.value)} rows={3}
                style={{ background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:'DM Sans', width:'100%', boxSizing:'border-box', resize:'vertical' }}/>
            </div>
          </>)}
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>{ref.has('evaluation_status', evalForm.statut, 'closed') ? 'Alertes (une par ligne)' : 'Notes / Étapes planifiées (une par ligne)'}</label>
            <textarea value={evalForm.alertes} onChange={e => ef('alertes')(e.target.value)} rows={3}
              style={{ background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:'DM Sans', width:'100%', boxSizing:'border-box', resize:'vertical' }}/>
          </div>
        </div>
        <ModalFooter onCancel={() => setEvalModal(false)} onConfirm={handleSaveEval} loading={savingEval} confirmLabel={editingEval ? 'Mettre à jour' : 'Créer'}/>
      </Modal>

      {/* Modal revue */}
      <Modal open={revModal} onClose={() => setRevModal(false)} title={editingRev ? 'Modifier la revue' : 'Nouvelle revue'} width={520}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <ErrorBanner error={error} onDismiss={() => setError('')}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date *</label>
              <Input value={revForm.date} onChange={rf('date')} type="date"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Type</label>
              <Select value={revForm.type} onChange={rf('type')} style={{ width:'100%' }}>
                {withCurrent(revTypes, revForm.type, labelOf('revue_type')).map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Titre *</label>
            <Input value={revForm.titre} onChange={rf('titre')} placeholder={`Ex: ${revTypes[0]?.label || 'Revue'} - ${planShort} ${curYear}`}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Animateur</label>
              <Input value={revForm.animateur} onChange={rf('animateur')} placeholder="Nom du modérateur"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Statut</label>
              <Select value={revForm.statut} onChange={rf('statut')} style={{ width:'100%' }}>
                {withCurrent(revStatuses, revForm.statut, labelOf('revue_status')).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Participants (séparés par virgules)</label>
            <Input value={revForm.participants} onChange={rf('participants')} placeholder="Ex: DG, Coord. S&E, Ministère Finances..."/>
          </div>
          {ref.has('revue_status', revForm.statut, 'held') && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Alertes soulevées</label>
                <Input value={revForm.alertes} onChange={rf('alertes')} type="number" placeholder="0"/>
              </div>
              <div>
                <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Décisions prises</label>
                <Input value={revForm.decisions} onChange={rf('decisions')} type="number" placeholder="0"/>
              </div>
            </div>
          )}
        </div>
        <ModalFooter onCancel={() => setRevModal(false)} onConfirm={handleSaveRevue} loading={savingRev} confirmLabel={editingRev ? 'Mettre à jour' : 'Créer la revue'}/>
      </Modal>
    </div>
  );
}