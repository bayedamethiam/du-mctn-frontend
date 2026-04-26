import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, FolderOpen, Layers } from 'lucide-react';
import { programsApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Btn, Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea, EmptyState } from '../components/UI.jsx';
import { T } from '../theme.js';

/* ── Statuts du workflow projet ── */
const PROJ_STATUS = [
  { value:'structuration', label:'En structuration', color:'#f59e0b',  dot:'●' },
  { value:'maturation',    label:'Maturation',       color:'#8b5cf6',  dot:'●' },
  { value:'execution',     label:'En exécution',     color:'#06b6d4',  dot:'●' },
  { value:'cloture',       label:'Clôturé',          color:'#6b7280',  dot:'●' },
  { value:'exploitation',  label:'Exploitation',     color:'#10b981',  dot:'●' },
];
const projStatusConf = Object.fromEntries(PROJ_STATUS.map(s => [s.value, s]));
const projStatusColor = v => projStatusConf[v]?.color || T.textDim;
const projStatusLabel = v => projStatusConf[v]?.label || v;

/* ── Axes NDT (regroupement thématique des 12 programmes) ── */
const AXES = [
  { id:'all',     label:'Tous les axes',       codes:null,                                       color:T.teal },
  { id:'infra',   label:'Infrastructures',      codes:['P01','P10'],                              color:'#06b6d4' },
  { id:'services',label:'Services numériques',  codes:['P02','P03','P04'],                         color:'#8b5cf6' },
  { id:'humain',  label:'Capital humain',       codes:['P05','P06','P07'],                         color:'#10b981' },
  { id:'souv',    label:'Souveraineté & IA',    codes:['P08','P09'],                               color:'#ef4444' },
  { id:'eco',     label:'Économie inclusive',   codes:['P11','P12'],                               color:'#f59e0b' },
];

const PROG_EMPTY  = { budget:'', progress:'', status:'on_track' };
const PROJ_EMPTY  = { name:'', description:'', budget:'', status:'structuration', start_date:'', end_date:'', responsible:'' };

const isAdmin = user => user && ['admin','coordinator','director'].includes(user.role);

/* Badge statut projet inline */
const ProjBadge = ({ status }) => {
  const c = projStatusColor(status);
  return (
    <span style={{ background:`${c}18`, color:c, fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap', border:`1px solid ${c}33` }}>
      {projStatusLabel(status)}
    </span>
  );
};

/* Flèche de workflow */
const WorkflowArrow = () => (
  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, flexWrap:'wrap' }}>
    {PROJ_STATUS.map((s, i) => (
      <div key={s.value} style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ background:`${s.color}18`, color:s.color, fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:10, border:`1px solid ${s.color}33` }}>{s.label}</span>
        {i < PROJ_STATUS.length - 1 && i !== 2 && <span style={{ color:T.textDim, fontSize:12 }}>→</span>}
        {i === 2 && <span style={{ color:T.textDim, fontSize:12 }}>⤵</span>}
      </div>
    ))}
  </div>
);

export default function Portefeuille() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [programs, setPrograms] = useState([]);
  const [projMap, setProjMap]   = useState({});   // id → projects[]
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loadingProj, setLoadingProj] = useState({});
  const [search, setSearch]     = useState('');
  const [axeF, setAxeF]         = useState('all');

  /* Modals programme */
  const [progModal, setProgModal]   = useState(false);
  const [editProg, setEditProg]     = useState(null);
  const [savingProg, setSavingProg] = useState(false);
  const [progForm, setProgForm]     = useState(PROG_EMPTY);

  /* Modals projet */
  const [projModal, setProjModal]   = useState(false);
  const [editProj, setEditProj]     = useState(null);
  const [projProgId, setProjProgId] = useState(null);
  const [savingProj, setSavingProj] = useState(false);
  const [projForm, setProjForm]     = useState(PROJ_EMPTY);

  const load = useCallback(() => {
    programsApi.list().then(setPrograms).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Charger les projets d'un programme au 1er expand */
  const toggleExpand = async id => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (projMap[id]) return;
    setLoadingProj(l => ({ ...l, [id]:true }));
    try {
      const projs = await programsApi.listProjects(id);
      setProjMap(m => ({ ...m, [id]: projs }));
    } catch (e) { setError(e.message); }
    finally { setLoadingProj(l => ({ ...l, [id]:false })); }
  };

  /* ── Filtrage ── */
  const axeDef = AXES.find(a => a.id === axeF);
  const filtered = programs.filter(p => {
    const matchAxe   = !axeDef?.codes || axeDef.codes.includes(p.code);
    const q          = search.toLowerCase();
    const matchSearch = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
      (projMap[p.id]||[]).some(pr => pr.name.toLowerCase().includes(q));
    return matchAxe && matchSearch;
  });

  /* ── Modals programme ── */
  const openEditProg = (p, e) => {
    e.stopPropagation();
    setProgForm({ budget:String(p.budget||''), progress:String(p.progress||''), status:p.status||'on_track' });
    setEditProg(p); setProgModal(true);
  };
  const handleSaveProg = async () => {
    setSavingProg(true);
    try {
      const updated = await programsApi.update(editProg.id, { budget:parseFloat(progForm.budget)||0, progress:parseInt(progForm.progress)||0, status:progForm.status });
      setPrograms(ps => ps.map(p => p.id === editProg.id ? { ...p, ...updated } : p));
      setProgModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingProg(false); }
  };

  /* ── Modals projet ── */
  const openCreateProj = (progId, e) => {
    e.stopPropagation();
    setProjForm(PROJ_EMPTY); setEditProj(null); setProjProgId(progId); setProjModal(true);
  };
  const openEditProj = (proj, progId, e) => {
    e.stopPropagation();
    setProjForm({ name:proj.name||'', description:proj.description||'', budget:String(proj.budget||''), status:proj.status||'structuration', start_date:proj.start_date||'', end_date:proj.end_date||'', responsible:proj.responsible||'' });
    setEditProj(proj); setProjProgId(progId); setProjModal(true);
  };
  const handleSaveProj = async () => {
    if (!projForm.name) return;
    setSavingProj(true);
    try {
      const payload = { ...projForm, budget: parseFloat(projForm.budget)||0 };
      if (editProj) {
        const updated = await programsApi.updateProject(editProj.id, payload);
        setProjMap(m => ({ ...m, [projProgId]: (m[projProgId]||[]).map(p => p.id===editProj.id ? updated : p) }));
      } else {
        const created = await programsApi.createProject(projProgId, payload);
        setProjMap(m => ({ ...m, [projProgId]: [...(m[projProgId]||[]), created] }));
        setPrograms(ps => ps.map(p => p.id===projProgId ? { ...p, projects_count:(p.projects_count||0)+1 } : p));
      }
      setProjModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingProj(false); }
  };
  const handleDeleteProj = async (proj, progId, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le projet « ${proj.name} » ?`)) return;
    try {
      await programsApi.deleteProject(proj.id);
      setProjMap(m => ({ ...m, [progId]: (m[progId]||[]).filter(p => p.id!==proj.id) }));
      setPrograms(ps => ps.map(p => p.id===progId ? { ...p, projects_count:Math.max(0,(p.projects_count||1)-1) } : p));
    } catch (e) { setError(e.message); }
  };

  const total = programs.reduce((s, p) => s + (p.budget||0), 0).toFixed(1);
  const avgP  = programs.length ? Math.round(programs.reduce((s,p) => s + p.progress, 0) / programs.length) : 0;
  const totalProjects = programs.reduce((s,p) => s + (p.projects_count||0), 0);

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Portefeuille NDT 2025–2034" title="12 programmes prioritaires"
        subtitle="New Deal Technologique · Suivi budgétaire et physique"
        stats={[
          { value: programs.length,    label: 'Programmes' },
          { value: totalProjects,      label: 'Projets', color: '#8b5cf6' },
          { value: `${total} Md`,      label: 'FCFA total', color: '#10b981' },
          { value: `${avgP}%`,         label: 'Avancement moyen' },
        ]} />

      <div style={{ padding:'20px 28px 0' }}>
        {/* ── Barre recherche + filtres ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
          <div style={{ position:'relative', maxWidth:400 }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.textDim, pointerEvents:'none' }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un programme ou un projet..."
              style={{ width:'100%', background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px 9px 36px', color:T.text, fontSize:13, fontFamily:'DM Sans', outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, color:T.textDim, textTransform:'uppercase' }}>Axe :</span>
            {AXES.map(a => (
              <Btn key={a.id} onClick={() => setAxeF(a.id)} variant={axeF===a.id?'ghost':'outline'} color={axeF===a.id?a.color:T.textDim} size="sm">
                {a.label}
                {a.codes && <span style={{ opacity:0.6, fontSize:10, marginLeft:3 }}>({a.codes.length})</span>}
              </Btn>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:'0 28px 28px' }}>
        <ErrorBanner error={error} onDismiss={() => setError('')}/>
        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : filtered.length === 0
          ? <EmptyState icon={Layers} title="Aucun programme trouvé" subtitle="Essayez un autre filtre ou modifiez votre recherche."/>
          : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {filtered.map(p => {
                const isExp  = expanded === p.id;
                const projs  = projMap[p.id] || [];
                const pColor = p.color || T.teal;
                const axeInfo = AXES.find(a => a.codes?.includes(p.code));
                return (
                  <div key={p.id} style={{ background:T.surface, border:`1px solid ${isExp?pColor+'55':T.border}`, borderRadius:14, overflow:'hidden', transition:'all 0.2s', boxShadow:isExp?`0 0 0 1px ${pColor}22, 0 8px 30px ${pColor}11`:'' }}>
                    {/* ── Header programme ── */}
                    <div style={{ height:3, background:`linear-gradient(90deg,${pColor},${pColor}44)` }}/>
                    <div style={{ padding:'18px 22px', cursor:'pointer', display:'flex', alignItems:'center', gap:16 }} onClick={() => toggleExpand(p.id)}>
                      <div style={{ width:48, height:48, borderRadius:12, background:`${pColor}18`, border:`1px solid ${pColor}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:800, color:pColor }}>{p.code}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                          <span style={{ fontFamily:'EB Garamond', fontSize:18, color:T.text, fontWeight:500 }}>{p.name}</span>
                          <Badge status={p.status}/>
                          {axeInfo && <span style={{ fontFamily:'DM Sans', fontSize:10, color:axeInfo.color, background:`${axeInfo.color}15`, padding:'2px 7px', borderRadius:8 }}>{axeInfo.label}</span>}
                        </div>
                        <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>
                            <span style={{ fontFamily:'EB Garamond', fontSize:20, color:pColor, fontWeight:500 }}>{p.projects_count}</span> projet{p.projects_count!==1?'s':''}
                          </span>
                          <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>
                            <span style={{ fontFamily:'EB Garamond', fontSize:20, color:T.text, fontWeight:500 }}>{p.budget}</span> Md FCFA
                          </span>
                          <div style={{ flex:1, maxWidth:200 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>Avancement</span>
                              <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:pColor }}>{p.progress}%</span>
                            </div>
                            <ProgressBar value={p.progress} color={pColor} height={4}/>
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }} onClick={e=>e.stopPropagation()}>
                        {admin && (
                          <button onClick={e => openEditProg(p, e)} style={{ background:`${pColor}15`, border:`1px solid ${pColor}33`, color:pColor, cursor:'pointer', padding:'6px 10px', borderRadius:7, display:'flex', alignItems:'center', gap:4, fontFamily:'DM Sans', fontSize:11, fontWeight:600 }} title="Modifier le programme">
                            <Pencil size={12}/> Modifier
                          </button>
                        )}
                        <div onClick={() => toggleExpand(p.id)} style={{ cursor:'pointer', padding:'4px 6px' }}>
                          {isExp ? <ChevronUp size={16} color={T.textMuted}/> : <ChevronDown size={16} color={T.textMuted}/>}
                        </div>
                      </div>
                    </div>

                    {/* ── Projets (expanded) ── */}
                    {isExp && (
                      <div style={{ borderTop:`1px solid ${T.border}`, padding:'18px 22px', background:'rgba(255,255,255,0.018)' }} className="slide-in">
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                          <div>
                            <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:pColor, marginBottom:4 }}>Projets du programme</div>
                            <WorkflowArrow/>
                          </div>
                          {admin && (
                            <Btn onClick={e => openCreateProj(p.id, e)} color={pColor} size="sm"><Plus size={12}/> Ajouter un projet</Btn>
                          )}
                        </div>

                        {loadingProj[p.id]
                          ? <div style={{ display:'flex', justifyContent:'center', padding:24 }}><Spinner size={24}/></div>
                          : projs.length === 0
                          ? <div style={{ padding:'24px 16px', textAlign:'center', background:T.surface2, borderRadius:10 }}>
                              <FolderOpen size={28} color={pColor} style={{ margin:'0 auto 8px', opacity:0.4 }}/>
                              <div style={{ fontFamily:'DM Sans', fontSize:13, color:T.textDim }}>Aucun projet enregistré pour ce programme.</div>
                              {admin && <div style={{ marginTop:8 }}><Btn onClick={e => openCreateProj(p.id, e)} color={pColor} size="sm" variant="outline"><Plus size={11}/> Premier projet</Btn></div>}
                            </div>
                          : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                              {projs.map(proj => {
                                const sc = projStatusColor(proj.status);
                                return (
                                  <div key={proj.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:T.surface2, borderRadius:10, border:`1px solid ${T.border}`, borderLeft:`3px solid ${sc}` }}>
                                    <div style={{ flex:1 }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                                        <span style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:600, color:T.text }}>{proj.name}</span>
                                        <ProjBadge status={proj.status}/>
                                      </div>
                                      <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                                        {proj.responsible && <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>👤 {proj.responsible}</span>}
                                        {proj.budget > 0 && <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>💰 {proj.budget} Md FCFA</span>}
                                        {proj.start_date && <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>📅 {proj.start_date}{proj.end_date?` → ${proj.end_date}`:''}</span>}
                                      </div>
                                      {proj.description && <p style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:4, lineHeight:1.5 }}>{proj.description}</p>}
                                    </div>
                                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                      {proj.progress > 0 && (
                                        <div style={{ textAlign:'center', minWidth:44 }}>
                                          <div style={{ fontFamily:'EB Garamond', fontSize:20, color:sc, fontWeight:500 }}>{proj.progress}%</div>
                                          <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim }}>avancement</div>
                                        </div>
                                      )}
                                      {admin && <>
                                        <button onClick={e => openEditProj(proj, p.id, e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'5px 7px', borderRadius:6 }} title="Modifier"><Pencil size={13}/></button>
                                        <button onClick={e => handleDeleteProj(proj, p.id, e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'5px 7px', borderRadius:6 }} title="Supprimer"
                                          onMouseEnter={ev=>ev.currentTarget.style.color='#ef4444'} onMouseLeave={ev=>ev.currentTarget.style.color=T.textMuted}><Trash2 size={13}/></button>
                                      </>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* ── Modal modifier programme ── */}
      <Modal open={progModal} onClose={() => setProgModal(false)} title={`Modifier · ${editProg?.code} — ${editProg?.name}`} width={440}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Budget (Md FCFA)</label>
              <Input value={progForm.budget} onChange={v=>setProgForm(f=>({...f,budget:v}))} type="number" placeholder="0.0"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Avancement (%)</label>
              <Input value={progForm.progress} onChange={v=>setProgForm(f=>({...f,progress:v}))} type="number" placeholder="0–100"/>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Statut global</label>
            <Select value={progForm.status} onChange={v=>setProgForm(f=>({...f,status:v}))} style={{ width:'100%' }}>
              <option value="on_track">✅ On track</option>
              <option value="attention">⚠ Attention</option>
              <option value="risque">🔴 Risque</option>
            </Select>
          </div>
        </div>
        <ModalFooter onCancel={() => setProgModal(false)} onConfirm={handleSaveProg} loading={savingProg} confirmLabel="Mettre à jour" color={editProg?.color||T.teal}/>
      </Modal>

      {/* ── Modal créer/modifier projet ── */}
      <Modal open={projModal} onClose={() => setProjModal(false)} title={editProj ? 'Modifier le projet' : 'Nouveau projet'} width={560}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Nom du projet *</label>
            <Input value={projForm.name} onChange={v=>setProjForm(f=>({...f,name:v}))} placeholder="Intitulé du projet"/>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Description</label>
            <Textarea value={projForm.description} onChange={v=>setProjForm(f=>({...f,description:v}))} placeholder="Objectifs et périmètre du projet..." rows={2}/>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:8 }}>Statut (cycle de vie)</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PROJ_STATUS.map(s => (
                <button key={s.value} onClick={() => setProjForm(f=>({...f,status:s.value}))}
                  style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, padding:'6px 12px', borderRadius:8, border:`1px solid ${projForm.status===s.value?s.color:T.border}`, background:projForm.status===s.value?`${s.color}18`:'transparent', color:projForm.status===s.value?s.color:T.textMuted, cursor:'pointer', transition:'all 0.15s' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Budget (Md FCFA)</label>
              <Input value={projForm.budget} onChange={v=>setProjForm(f=>({...f,budget:v}))} type="number" placeholder="0.0"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date début</label>
              <Input value={projForm.start_date} onChange={v=>setProjForm(f=>({...f,start_date:v}))} type="date"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date fin</label>
              <Input value={projForm.end_date} onChange={v=>setProjForm(f=>({...f,end_date:v}))} type="date"/>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Responsable</label>
            <Input value={projForm.responsible} onChange={v=>setProjForm(f=>({...f,responsible:v}))} placeholder="Nom du chef de projet"/>
          </div>
        </div>
        <ModalFooter onCancel={() => setProjModal(false)} onConfirm={handleSaveProj} loading={savingProj} confirmLabel={editProj ? 'Mettre à jour' : 'Créer le projet'} color={programs.find(p=>p.id===projProgId)?.color||T.teal}/>
      </Modal>
    </div>
  );
}
