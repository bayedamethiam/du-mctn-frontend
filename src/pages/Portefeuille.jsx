import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import { programsApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, ProgressBar, Btn, Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea } from '../components/UI.jsx';
import { T } from '../theme.js';

/* ── Workflow statuts projet ── */
const PROJ_STATUS = [
  { value:'structuration', label:'En structuration', color:'#f59e0b' },
  { value:'maturation',    label:'Maturation',       color:'#8b5cf6' },
  { value:'execution',     label:'En exécution',     color:'#06b6d4' },
  { value:'cloture',       label:'Clôturé',          color:'#6b7280' },
  { value:'exploitation',  label:'Exploitation',     color:'#10b981' },
];
const projColor = v => PROJ_STATUS.find(s => s.value === v)?.color || T.textDim;
const projLabel = v => PROJ_STATUS.find(s => s.value === v)?.label || v;

/* ── Axes NDT ── */
const AXES = [
  { id:'all',      label:'Tous',              codes:null,                  color:T.teal     },
  { id:'infra',    label:'Infrastructures',   codes:['P01','P10'],         color:'#06b6d4'  },
  { id:'services', label:'Services',          codes:['P02','P03','P04'],   color:'#8b5cf6'  },
  { id:'humain',   label:'Capital humain',    codes:['P05','P06','P07'],   color:'#10b981'  },
  { id:'souv',     label:'Souveraineté & IA', codes:['P08','P09'],         color:'#ef4444'  },
  { id:'eco',      label:'Éco. inclusive',    codes:['P11','P12'],         color:'#f59e0b'  },
];

const PROG_EMPTY = { budget:'', progress:'', status:'on_track' };
const PROJ_EMPTY = { name:'', description:'', budget:'', status:'structuration', start_date:'', end_date:'', responsible:'' };

const isAdmin = u => u && ['admin','coordinator','director'].includes(u.role);

const ProjBadge = ({ status }) => {
  const c = projColor(status);
  return (
    <span style={{ background:`${c}18`, color:c, fontFamily:'DM Sans', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8, border:`1px solid ${c}30`, whiteSpace:'nowrap' }}>
      {projLabel(status)}
    </span>
  );
};

export default function Portefeuille() {
  const { user }  = useAuth();
  const admin     = isAdmin(user);

  const [programs, setPrograms] = useState([]);
  const [projMap, setProjMap]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loadingProj, setLoadingProj] = useState({});

  const [search, setSearch] = useState('');
  const [axeF, setAxeF]     = useState('all');

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
  const axeDef   = AXES.find(a => a.id === axeF);
  const filtered = programs.filter(p => {
    const matchAxe    = !axeDef?.codes || axeDef.codes.includes(p.code);
    const q           = search.toLowerCase();
    const matchSearch = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
      (projMap[p.id]||[]).some(pr => pr.name.toLowerCase().includes(q));
    return matchAxe && matchSearch;
  });

  /* ── Handlers programme ── */
  const openEditProg = (p, e) => {
    e.stopPropagation();
    setProgForm({ budget:String(p.budget||''), progress:String(p.progress||''), status:p.status||'on_track' });
    setEditProg(p); setProgModal(true);
  };
  const handleSaveProg = async () => {
    setSavingProg(true);
    try {
      const updated = await programsApi.update(editProg.id, { budget:parseFloat(progForm.budget)||0, progress:parseInt(progForm.progress)||0, status:progForm.status });
      setPrograms(ps => ps.map(p => p.id===editProg.id ? { ...p, ...updated } : p));
      setProgModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingProg(false); }
  };

  /* ── Handlers projet ── */
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
      const payload = { ...projForm, budget:parseFloat(projForm.budget)||0 };
      if (editProj) {
        const updated = await programsApi.updateProject(editProj.id, payload);
        setProjMap(m => ({ ...m, [projProgId]:(m[projProgId]||[]).map(p => p.id===editProj.id ? updated : p) }));
      } else {
        const created = await programsApi.createProject(projProgId, payload);
        setProjMap(m => ({ ...m, [projProgId]:[...(m[projProgId]||[]), created] }));
        setPrograms(ps => ps.map(p => p.id===projProgId ? { ...p, projects_count:(p.projects_count||0)+1 } : p));
      }
      setProjModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingProj(false); }
  };
  const handleDeleteProj = async (proj, progId, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer « ${proj.name} » ?`)) return;
    try {
      await programsApi.deleteProject(proj.id);
      setProjMap(m => ({ ...m, [progId]:(m[progId]||[]).filter(p => p.id!==proj.id) }));
      setPrograms(ps => ps.map(p => p.id===progId ? { ...p, projects_count:Math.max(0,(p.projects_count||1)-1) } : p));
    } catch (e) { setError(e.message); }
  };

  const total = programs.reduce((s,p) => s + (p.budget||0), 0).toFixed(1);
  const avgP  = programs.length ? Math.round(programs.reduce((s,p) => s + p.progress, 0) / programs.length) : 0;

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Portefeuille NDT 2025–2034" title="12 programmes prioritaires"
        subtitle="New Deal Technologique · Suivi budgétaire et physique"
        stats={[
          { value: programs.length, label: 'Programmes' },
          { value: `${total} Md`,   label: 'FCFA total', color: '#10b981' },
          { value: `${avgP}%`,      label: 'Avancement moyen' },
        ]} />

      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {/* ── Recherche + filtres axes ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          <div style={{ position:'relative', maxWidth:380 }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.textDim, pointerEvents:'none' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un programme ou un projet..."
              style={{ width:'100%', background:T.surface2, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px 9px 36px', color:T.text, fontSize:13, fontFamily:'DM Sans', outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, color:T.textDim, textTransform:'uppercase', marginRight:2 }}>Axe :</span>
            {AXES.map(a => (
              <button key={a.id} onClick={() => setAxeF(a.id)}
                style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, padding:'5px 12px', borderRadius:20, border:`1px solid ${axeF===a.id?a.color:T.border}`, background:axeF===a.id?`${a.color}18`:'transparent', color:axeF===a.id?a.color:T.textMuted, cursor:'pointer', transition:'all 0.15s' }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grille des programmes ── */}
        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, alignItems:'start' }}>
              {filtered.map(p => {
                const pColor = p.color || T.teal;
                const isExp  = expanded === p.id;
                const projs  = projMap[p.id] || [];
                return (
                  <Card key={p.id} style={{ padding:'18px 20px', cursor:'pointer', border:`1px solid ${isExp?pColor+'55':T.border}`, transition:'all 0.2s' }}
                    onClick={() => toggleExpand(p.id)}>

                    {/* ── En-tête carte (identique à l'original) ── */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <div style={{ flex:1, marginRight:8 }}>
                        <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:2, color:pColor, textTransform:'uppercase' }}>{p.code}</span>
                        <h4 style={{ fontFamily:'EB Garamond', fontSize:17, color:T.text, marginTop:2, lineHeight:1.2 }}>{p.name}</h4>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                        <Badge status={p.status}/>
                        {admin && (
                          <button onClick={e => openEditProg(p, e)}
                            style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'3px 5px', borderRadius:5, lineHeight:0 }}
                            title="Modifier le programme">
                            <Pencil size={12}/>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Stats (identique à l'original) ── */}
                    <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                      <div>
                        <div style={{ fontFamily:'EB Garamond', fontSize:22, color:pColor, fontWeight:500 }}>{p.projects_count}</div>
                        <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>Projets</div>
                      </div>
                      <div>
                        <div style={{ fontFamily:'EB Garamond', fontSize:22, color:T.text, fontWeight:500 }}>{p.budget}Md</div>
                        <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>FCFA</div>
                      </div>
                    </div>

                    {/* ── Barre avancement (identique à l'original) ── */}
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>Avancement physique</span>
                      <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, color:pColor }}>{p.progress}%</span>
                    </div>
                    <ProgressBar value={p.progress} color={pColor} height={5}/>

                    {/* ── Chevron expand ── */}
                    <div style={{ display:'flex', justifyContent:'center', marginTop:10 }}>
                      {isExp
                        ? <ChevronUp size={14} color={pColor}/>
                        : <ChevronDown size={14} color={T.textDim}/>
                      }
                    </div>

                    {/* ── Section projets (expanded) ── */}
                    {isExp && (
                      <div style={{ marginTop:12, paddingTop:14, borderTop:`1px solid ${T.border}` }} className="slide-in" onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:pColor }}>Projets</span>
                          {admin && (
                            <button onClick={e => openCreateProj(p.id, e)}
                              style={{ display:'inline-flex', alignItems:'center', gap:4, fontFamily:'DM Sans', fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:7, border:`1px solid ${pColor}44`, background:`${pColor}12`, color:pColor, cursor:'pointer' }}>
                              <Plus size={11}/> Ajouter
                            </button>
                          )}
                        </div>

                        {loadingProj[p.id]
                          ? <div style={{ display:'flex', justifyContent:'center', padding:16 }}><Spinner size={20}/></div>
                          : projs.length === 0
                          ? <div style={{ padding:'14px 0', textAlign:'center' }}>
                              <FolderOpen size={22} color={pColor} style={{ margin:'0 auto 5px', opacity:0.35 }}/>
                              <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>Aucun projet</div>
                            </div>
                          : <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                              {projs.map(proj => (
                                <div key={proj.id} style={{ padding:'9px 11px', background:T.surface2, borderRadius:8, borderLeft:`3px solid ${projColor(proj.status)}` }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6 }}>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:600, color:T.text, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{proj.name}</div>
                                      <ProjBadge status={proj.status}/>
                                      {proj.responsible && <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, marginTop:4 }}>👤 {proj.responsible}</div>}
                                    </div>
                                    {admin && (
                                      <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                                        <button onClick={e => openEditProj(proj, p.id, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'3px 4px', borderRadius:4 }}><Pencil size={11}/></button>
                                        <button onClick={e => handleDeleteProj(proj, p.id, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:'3px 4px', borderRadius:4 }}
                                          onMouseEnter={ev=>ev.currentTarget.style.color='#ef4444'} onMouseLeave={ev=>ev.currentTarget.style.color=T.textDim}><Trash2 size={11}/></button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                        }
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )
        }
      </div>

      {/* ── Modal modifier programme ── */}
      <Modal open={progModal} onClose={() => setProgModal(false)} title={`${editProg?.code} — ${editProg?.name}`} width={420}>
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
      <Modal open={projModal} onClose={() => setProjModal(false)} title={editProj ? 'Modifier le projet' : 'Nouveau projet'} width={540}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Nom du projet *</label>
            <Input value={projForm.name} onChange={v=>setProjForm(f=>({...f,name:v}))} placeholder="Intitulé du projet"/>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Description</label>
            <Textarea value={projForm.description} onChange={v=>setProjForm(f=>({...f,description:v}))} placeholder="Objectifs et périmètre..." rows={2}/>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:8 }}>Statut</label>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
              {PROJ_STATUS.map(s => (
                <button key={s.value} onClick={() => setProjForm(f=>({...f,status:s.value}))}
                  style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, padding:'5px 11px', borderRadius:8, border:`1px solid ${projForm.status===s.value?s.color:T.border}`, background:projForm.status===s.value?`${s.color}18`:'transparent', color:projForm.status===s.value?s.color:T.textMuted, cursor:'pointer', transition:'all 0.15s' }}>
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
            <Input value={projForm.responsible} onChange={v=>setProjForm(f=>({...f,responsible:v}))} placeholder="Chef de projet"/>
          </div>
        </div>
        <ModalFooter onCancel={() => setProjModal(false)} onConfirm={handleSaveProj} loading={savingProj} confirmLabel={editProj ? 'Mettre à jour' : 'Créer'} color={programs.find(p=>p.id===projProgId)?.color||T.teal}/>
      </Modal>
    </div>
  );
}
