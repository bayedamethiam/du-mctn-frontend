import { useState, useEffect, useCallback, useRef } from 'react';
import { Target, Award, BarChart3, Calendar, Upload, X, File, Paperclip,
         CheckCircle, AlertCircle, Plus, Pencil, Clock } from 'lucide-react';
import { seApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Btn, Select, Spinner, ErrorBanner,
         Modal, ModalFooter, Input } from '../components/UI.jsx';
import { T, scoreColor } from '../theme.js';

/* ── helpers ───────────────────────────────────────────────── */
const pct = i => {
  const range = i.target - i.baseline;
  if (!range) return 0;
  return Math.min(100, Math.round(((i.current_value - i.baseline) / range) * 100));
};

const fmtVal = (v, unit, compact = false) => {
  if (!v && v !== 0) return '—';
  if (unit === '%' || unit === 'pts de gain') return `${v}${unit === '%' ? '%' : ' pts'}`;
  if (compact && v >= 1000) return v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}K`;
  return Number(v).toLocaleString('fr-FR');
};

const DOC_TAGS = ['Compte rendu','Rapport évaluation','Résumé exécutif','Décisions','Alertes','Dashboard','Annexes','Présentation','Autre'];

const CATS = [
  { id:'all',         label:'Tous',              color: T.teal      },
  { id:'connect',     label:'Connectivité',       color:'#10b981'    },
  { id:'competences', label:'Compétences',        color:'#8b5cf6'    },
  { id:'eco',         label:'Économie Numérique', color:'#f59e0b'    },
  { id:'admin',       label:'Administration',     color:'#3b82f6'    },
];

const REV_TYPE = {
  mensuelle:     { color: T.teal,    label:'Mensuelle'      },
  trimestrielle: { color:'#8b5cf6',  label:'Trimestrielle'  },
  annuelle:      { color:'#f59e0b',  label:'Annuelle'       },
};

const FT = {
  pdf:     { color:'#ef4444', label:'PDF'  },
  word:    { color:'#3b82f6', label:'Word' },
  excel:   { color:'#10b981', label:'Excel'},
  ppt:     { color:'#f97316', label:'PPT'  },
  default: { color:T.textDim, label:'Doc'  },
};

const REVUE_EMPTY = { date:'', type:'mensuelle', titre:'', animateur:'', statut:'planifiee', alertes:'0', decisions:'0', participants:'' };

/* ── Gauge circulaire ──────────────────────────────────────── */
const Gauge = ({ value, size = 52 }) => {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c - (value / 100) * c, col = scoreColor(value);
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
const RadarChart = ({ notes = {}, size = 130 }) => {
  const axes = [
    { key:'pertinence',  label:'Pertinence'  },
    { key:'efficacite',  label:'Efficacité'  },
    { key:'efficience',  label:'Efficience'  },
    { key:'impact',      label:'Impact'      },
    { key:'durabilite',  label:'Durabilité'  },
  ];
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ind, rev, ev, st] = await Promise.all([
        seApi.indicators(), seApi.revues(), seApi.evaluations(), seApi.stats(),
      ]);
      setInd(ind); setRevues(rev); setEvals(ev); setStats(st);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rf = k => v => setRevForm(p => ({ ...p, [k]: v }));

  const openCreateRevue = () => { setRevForm(REVUE_EMPTY); setEditingRev(null); setRevModal(true); };
  const openEditRevue   = (r, e) => {
    e.stopPropagation();
    setRevForm({ date:r.date||'', type:r.type||'mensuelle', titre:r.titre||'', animateur:r.animateur||'',
      statut:r.statut||'planifiee', alertes:String(r.alertes||0), decisions:String(r.decisions||0),
      participants: Array.isArray(r.participants) ? r.participants.join(', ') : (r.participants || '') });
    setEditingRev(r); setRevModal(true);
  };

  const handleSaveRevue = async () => {
    if (!revForm.date || !revForm.titre) return;
    setSavingRev(true);
    try {
      const payload = { ...revForm, alertes:parseInt(revForm.alertes)||0, decisions:parseInt(revForm.decisions)||0,
        participants: revForm.participants.split(',').map(s=>s.trim()).filter(Boolean) };
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
        const doc = await seApi.uploadRevueDoc(rid, file, tag || 'Compte rendu');
        setRevues(prev => prev.map(r => r.id === rid ? { ...r, documents:[...(r.documents||[]), doc] } : r));
      }
    } catch (e) { setError(e.message); }
    finally { setUploading(u => ({ ...u, [rid]:false })); }
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

  const onTrack = indicators.filter(i => i.status === 'on_track').length;
  const attn    = indicators.filter(i => i.status === 'attention').length;
  const risk    = indicators.filter(i => i.status === 'risque').length;
  const avgProg = stats?.avg_progress || 0;

  const tabs = [
    { id:'overview',    icon:BarChart3, label:"Vue d'ensemble"           },
    { id:'indicateurs', icon:Target,    label:'Indicateurs NDT'           },
    { id:'revues',      icon:Calendar,  label:'Revues & COPIL'            },
    { id:'evaluations', icon:Award,     label:'Évaluations indépendantes' },
  ];

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Delivery Unit · NDT 2025–2034" title="Dispositif de Suivi-Évaluation"
        subtitle="Pilotage en temps réel · Revues mensuelles · Évaluations annuelles indépendantes · 15 indicateurs macroéconomiques & sectoriels"
        stats={[
          { value:`${avgProg}%`,                    label:'Avancement moyen NDT',  color:scoreColor(avgProg) },
          { value:onTrack,                           label:'Indicateurs on track',  color:'#10b981' },
          { value:attn,                              label:'En vigilance',          color:'#f59e0b' },
          { value:risk,                              label:'En risque',             color:'#ef4444' },
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
                <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:'#f59e0b', marginBottom:6 }}>Ambition stratégique · New Deal Technologique</div>
                <div style={{ fontFamily:'EB Garamond', fontSize:22, fontWeight:500, color:T.text, lineHeight:1.2 }}>Top 3 Africain dans l'exportation de services numériques à l'horizon 2034</div>
                <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, marginTop:6 }}>15 indicateurs macroéconomiques & sectoriels · Suivi piloté par la Delivery Unit · Revues mensuelles & évaluations annuelles indépendantes</div>
              </div>
              <div style={{ textAlign:'center', flexShrink:0 }}>
                <div style={{ fontFamily:'EB Garamond', fontSize:42, fontWeight:600, color:'#f59e0b', lineHeight:1 }}>{avgProg}%</div>
                <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:3 }}>avancement moyen</div>
              </div>
            </div>

            {/* Statuts */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:28 }}>
              {[
                { count:onTrack, label:'On track',     sub:'Progression nominale',      color:'#10b981', icon:CheckCircle, ids:indicators.filter(i=>i.status==='on_track').map(i=>i.code)  },
                { count:attn,    label:'En vigilance',  sub:'Suivi renforcé requis',      color:'#f59e0b', icon:AlertCircle, ids:indicators.filter(i=>i.status==='attention').map(i=>i.code) },
                { count:risk,    label:'En risque',     sub:'Action corrective urgente',  color:'#ef4444', icon:AlertCircle, ids:indicators.filter(i=>i.status==='risque').map(i=>i.code)    },
              ].map((s,i) => (
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

            {/* Catégories */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16, marginBottom:28 }}>
              {CATS.slice(1).map(cat => {
                const catInds = indicators.filter(i => i.category === cat.id);
                const avg = catInds.length ? Math.round(catInds.reduce((s,i)=>s+pct(i),0)/catInds.length) : 0;
                return (
                  <div key={cat.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'18px 20px' }}>
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
              <h3 style={{ fontFamily:'EB Garamond', fontSize:20, color:T.text, marginBottom:16 }}>Cycle de pilotage S&E — Delivery Unit</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { freq:'Hebdomadaire', icon:Clock,    color:T.teal,    desc:'Collecte données terrain · Alertes précoces · Tableau de bord temps réel · Correspondance avec équipes programmes' },
                  { freq:'Mensuelle',    icon:Calendar,  color:'#10b981', desc:'Revue des 15 indicateurs NDT · Décisions correctives · Compte rendu transmis au Cabinet Ministre' },
                  { freq:'Trimestrielle',icon:BarChart3, color:'#8b5cf6', desc:'COPIL inter-programmes · Revue financière · Rapport au PM · Mise à jour du portefeuille NDT' },
                  { freq:'Annuelle',     icon:Award,     color:'#f59e0b', desc:'Évaluation indépendante externe · Rapport public · Revue stratégique Ministre · Ajustement NDT' },
                ].map((c, i) => (
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
                {CATS.map(c => (
                  <button key={c.id} onClick={() => setCatF(c.id)}
                    style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:500, padding:'7px 13px', borderRadius:8, border:`1px solid ${catF===c.id?c.color:T.border}`, background:catF===c.id?`${c.color}20`:T.surface, color:catF===c.id?c.color:T.textMuted, cursor:'pointer', transition:'all 0.2s' }}>
                    {c.label}
                  </button>
                ))}
              </div>
              {/* Filtre statut */}
              <div style={{ display:'flex', gap:6 }}>
                {[['all','Tous'],['on_track','On track'],['attention','Vigilance'],['risque','Risque']].map(([v,l]) => (
                  <button key={v} onClick={() => setStatusF(v)}
                    style={{ fontFamily:'DM Sans', fontSize:11, padding:'7px 13px', borderRadius:8, border:`1px solid ${statusF===v?T.teal:T.border}`, background:statusF===v?`${T.teal}20`:T.surface, color:statusF===v?T.teal:T.textMuted, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filteredInd.map(ind => {
                const p = pct(ind);
                const cat = CATS.find(c => c.id === ind.category) || CATS[0];
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
                          <Badge status={ind.status}/>
                          {ind.trend > 0 && <span style={{ fontFamily:'DM Sans', fontSize:10, color:'#10b981' }}>↑ +{fmtVal(ind.trend, ind.unit, true)}/an</span>}
                        </div>
                        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>Base : {fmtVal(ind.baseline, ind.unit, true)}</span>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:scoreColor(p) }}>
                                {fmtVal(ind.current_value, ind.unit, true)} / {fmtVal(ind.target, ind.unit, true)} · {p}%
                              </span>
                            </div>
                            <ProgressBar value={p} color={scoreColor(p)} height={5}/>
                          </div>
                          <Sparkline milestones={ind.milestones||[]} color={scoreColor(p)}/>
                        </div>
                      </div>
                      <div style={{ flexShrink:0, textAlign:'right' }}>
                        <Gauge value={p} size={52}/>
                        <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim, marginTop:3 }}>{ind.last_update}</div>
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
                                const isCur = String(m.year) === '2026';
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
                            <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:10 }}>Programme NDT associé</div>
                            <div style={{ background:`${cat.color}15`, border:`1px solid ${cat.color}25`, borderRadius:8, padding:'10px 14px' }}>
                              <span style={{ fontFamily:'DM Sans', fontSize:12, color:cat.color, fontWeight:600 }}>{ind.program || '—'}</span>
                            </div>
                            {ind.trend > 0 && (
                              <div style={{ marginTop:12 }}>
                                <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:6 }}>Vitesse de progression</div>
                                <div style={{ fontFamily:'EB Garamond', fontSize:22, color:'#10b981' }}>+{fmtVal(ind.trend, ind.unit, true)}<span style={{ fontSize:13, color:T.textDim }}>/an</span></div>
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
                <Btn onClick={openCreateRevue} color={T.teal}><Plus size={14}/> Nouvelle revue</Btn>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {revues.map(r => {
                  const tc   = REV_TYPE[r.type] || { color:T.teal, label:r.type };
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
                            <span style={{ background:r.statut==='tenue'?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)', color:r.statut==='tenue'?'#10b981':'#f59e0b', fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>
                              {r.statut==='tenue'?'✓ Tenue':'○ Planifiée'}
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
                            {r.statut==='tenue' && (
                              <>
                                <span style={{ fontFamily:'DM Sans', fontSize:11, color:r.alertes>0?'#f59e0b':T.textDim }}>⚠ {r.alertes} alerte{r.alertes>1?'s':''}</span>
                                <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.teal }}>✓ {r.decisions} décision{r.decisions>1?'s':''}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button onClick={e=>openEditRevue(r,e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Modifier">
                          <Pencil size={12}/>
                        </button>
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
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <Select value={uploadTags[r.id]||'Compte rendu'} onChange={v=>setUploadTags(t=>({...t,[r.id]:v}))} style={{ fontSize:11, padding:'5px 8px' }}>
                                {DOC_TAGS.map(t=><option key={t} value={t}>{t}</option>)}
                              </Select>
                              <input ref={el=>revFileRefs.current[r.id]=el} type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.pptx" style={{ display:'none' }}
                                onChange={e=>handleRevUpload(r.id,e.target.files,uploadTags[r.id])}/>
                              <Btn onClick={()=>revFileRefs.current[r.id]?.click()} variant="outline" color={tc.color} size="sm" disabled={uploading[r.id]}>
                                {uploading[r.id]?<Spinner size={12} color={tc.color}/>:<Upload size={12}/>} Joindre
                              </Btn>
                            </div>
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
                                      <button onClick={()=>seApi.downloadRevueDoc(r.id,doc.id,doc.name)} style={{ background:'none', border:'none', fontFamily:'DM Sans', fontSize:12, color:T.teal, cursor:'pointer', padding:0 }}>{doc.name}</button>
                                      <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>{ft.label} · {doc.size} · {doc.date}</div>
                                    </div>
                                    <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:T.teal, background:`${T.teal}18`, padding:'3px 8px', borderRadius:8 }}>{doc.tag}</span>
                                    <button onClick={()=>removeRevDoc(r.id,doc.id)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer' }}
                                      onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}>
                                      <X size={13}/>
                                    </button>
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
                { label:'Revues tenues',     value:revues.filter(r=>r.statut==='tenue').length,         color:'#10b981' },
                { label:'Planifiées',         value:revues.filter(r=>r.statut==='planifiee').length,      color:'#f59e0b' },
                { label:'Alertes soulevées',  value:revues.reduce((s,r)=>s+(r.alertes||0),0),            color:'#f59e0b' },
                { label:'Décisions prises',   value:revues.reduce((s,r)=>s+(r.decisions||0),0),          color:T.teal    },
                { label:'Documents archivés', value:revues.reduce((s,r)=>s+(r.documents||[]).length,0),  color:'#8b5cf6' },
              ].map((s,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:i<4?`1px solid ${T.border}`:'none' }}>
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
            {evaluations.map(ev => {
              const isDone = ev.statut === 'terminee';
              const sc = isDone ? '#10b981' : '#f59e0b';
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
                            {isDone?'✓ Terminée':'○ Planifiée'}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>🏢 {ev.evaluateur}</span>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>📅 {ev.date}</span>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>📋 {ev.commanditaire}</span>
                        </div>
                      </div>
                      {isDone && ev.note_globale && (
                        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                          <RadarChart notes={notes} size={130}/>
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
                    ) : (
                      <div style={{ background:T.surface2, borderRadius:10, padding:'14px 18px' }}>
                        <p style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>Évaluation planifiée — Évaluateur sélectionné par appel d'offres ouvert.</p>
                        {alts.map((a,i) => (
                          <div key={i} style={{ display:'flex', gap:8, marginTop:8 }}>
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

      {/* Modal revue */}
      <Modal open={revModal} onClose={() => setRevModal(false)} title={editingRev ? 'Modifier la revue' : 'Nouvelle revue'} width={520}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date *</label>
              <Input value={revForm.date} onChange={rf('date')} type="date"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Type</label>
              <Select value={revForm.type} onChange={rf('type')} style={{ width:'100%' }}>
                <option value="mensuelle">Mensuelle</option>
                <option value="trimestrielle">Trimestrielle</option>
                <option value="annuelle">Annuelle</option>
              </Select>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Titre *</label>
            <Input value={revForm.titre} onChange={rf('titre')} placeholder="Ex: Revue mensuelle janvier 2026 — NDT"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Animateur</label>
              <Input value={revForm.animateur} onChange={rf('animateur')} placeholder="Nom du modérateur"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Statut</label>
              <Select value={revForm.statut} onChange={rf('statut')} style={{ width:'100%' }}>
                <option value="planifiee">Planifiée</option>
                <option value="tenue">Tenue</option>
              </Select>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Participants (séparés par virgules)</label>
            <Input value={revForm.participants} onChange={rf('participants')} placeholder="Ex: DG, Coord. S&E, Ministère Finances..."/>
          </div>
          {revForm.statut === 'tenue' && (
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