import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, FolderOpen, LayoutGrid, CalendarDays } from 'lucide-react';
import { programsApi, teamApi, axesApi, workflowTemplatesApi, projectMeetingsApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import HeroBanner from '../components/HeroBanner.jsx';
import { Badge, ProgressBar, Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea } from '../components/UI.jsx';
import { T } from '../theme.js';

/* ── Phases par défaut (template NDT) ── */
const DEFAULT_PHASES = [
  { key: 'structuration', label: 'Structuration', color: '#f59e0b', weight: 10, start_date: '', end_date: '', progress: 0 },
  { key: 'maturation',    label: 'Maturation',    color: '#8b5cf6', weight: 20, start_date: '', end_date: '', progress: 0 },
  { key: 'execution',     label: 'Exécution',     color: '#06b6d4', weight: 70, start_date: '', end_date: '', progress: 0 },
];

const AX_COLORS = ['#3b82f6','#14b8a6','#f59e0b','#a78bfa','#10b981','#ef4444','#8b5cf6','#06b6d4'];

/* poids en % entiers (ex: weight=70 → 70%) */
const computeGlobal = phases =>
  Math.round(phases.reduce((s, ph) => s + (ph.progress || 0) * (ph.weight || 0) / 100, 0));

/* Retourne 'late' | 'ok' | null */
const isProjectLate = phases => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return phases.some(ph => ph.end_date && new Date(ph.end_date) < today && ph.progress < 100);
};

/* Deserialize phases depuis un projet API */
const parsePhases = proj => {
  try {
    const p = typeof proj.phases === 'string' ? JSON.parse(proj.phases) : proj.phases;
    if (Array.isArray(p) && p.length > 0) return p;
  } catch (_) {}
  return DEFAULT_PHASES.map(ph => ({ ...ph }));
};


const PROG_EMPTY = { code: '', name: '', description: '', budget: '', progress: '0', status: 'on_track', color: '#3b82f6', axis_id: '' };
const AXE_EMPTY  = { code: '', label: '', color: '#3b82f6', position: '' };
const PROJ_EMPTY = {
  name: '', description: '', budget: '', status: 'structuration',
  start_date: '', end_date: '', responsible: '',
  phases: DEFAULT_PHASES.map(ph => ({ ...ph })),
};

const isAdmin = u => u && ['admin', 'coordinator', 'director'].includes(u.role);

/* ── Cercle de progression (style new_version) ── */
const CircleProgress = ({ pct, color = '#06b6d4', size = 38 }) => {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, dash = (pct / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={4} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={4} fill="none"
        strokeDasharray={`${dash.toFixed(1)} ${c.toFixed(1)}`} strokeLinecap="round" />
    </svg>
  );
};

const ProjBadge = ({ color = T.textDim, label = '—' }) => (
  <span style={{ background: `${color}18`, color, fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, border: `1px solid ${color}30`, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

export default function Portefeuille() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [programs, setPrograms]     = useState([]);
  const [projMap, setProjMap]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [openProgs, setOpenProgs]   = useState({});
  const [loadingProj, setLoadingProj] = useState({});

  const [search, setSearch]   = useState('');
  const [axFilter, setAxFilter] = useState('all');

  /* Modals programme */
  const [progModal, setProgModal]   = useState(false);
  const [editProg, setEditProg]     = useState(null);   // null = création
  const [savingProg, setSavingProg] = useState(false);
  const [progForm, setProgForm]     = useState(PROG_EMPTY);

  /* Modals projet */
  const [projModal, setProjModal]   = useState(false);
  const [editProj, setEditProj]     = useState(null);
  const [projProgId, setProjProgId] = useState(null);
  const [savingProj, setSavingProj] = useState(false);
  const [projForm, setProjForm]     = useState(PROJ_EMPTY);
  const [teamMembers, setTeamMembers]     = useState([]);
  const [axes, setAxes]                   = useState([]);
  const [wfTemplates, setWfTemplates]     = useState([]);
  const [savingTpl, setSavingTpl]         = useState(false);
  const [tplNameInput, setTplNameInput]   = useState('');
  const [showTplSave, setShowTplSave]     = useState(false);

  /* Modal Rendez-vous */
  const RDV_EMPTY = { title: '', date: '', time: '', type: 'Réunion', participants: '', notes: '' };
  const RDV_TYPES = ['Comité de pilotage', 'Revue technique', 'Réunion partenaires', 'Point interne', 'Réunion', 'Autre'];
  const [rdvModal, setRdvModal]     = useState(false);
  const [rdvProject, setRdvProject] = useState(null);
  const [meetings, setMeetings]     = useState([]);
  const [rdvLoading, setRdvLoading] = useState(false);
  const [rdvForm, setRdvForm]       = useState(RDV_EMPTY);
  const [savingRdv, setSavingRdv]   = useState(false);
  const [editRdv, setEditRdv]       = useState(null);

  const openRdv = async (proj, e) => {
    e.stopPropagation();
    setRdvProject(proj); setRdvModal(true); setRdvForm(RDV_EMPTY); setEditRdv(null);
    setRdvLoading(true);
    try { setMeetings(await projectMeetingsApi.list(proj.id)); }
    catch (err) { setError(err.message); }
    finally { setRdvLoading(false); }
  };
  const handleSaveRdv = async () => {
    if (!rdvForm.title || !rdvForm.date) return;
    setSavingRdv(true);
    try {
      if (editRdv) {
        const updated = await projectMeetingsApi.update(editRdv.id, rdvForm);
        setMeetings(ms => ms.map(m => m.id === editRdv.id ? updated : m));
      } else {
        const created = await projectMeetingsApi.create(rdvProject.id, rdvForm);
        setMeetings(ms => [...ms, created]);
      }
      setRdvForm(RDV_EMPTY); setEditRdv(null);
    } catch (err) { setError(err.message); }
    finally { setSavingRdv(false); }
  };
  const handleDeleteRdv = async id => {
    if (!window.confirm('Supprimer ce rendez-vous ?')) return;
    try { await projectMeetingsApi.delete(id); setMeetings(ms => ms.filter(m => m.id !== id)); }
    catch (err) { setError(err.message); }
  };

  /* Modals axes */
  const [axeModal, setAxeModal]   = useState(false);
  const [editAxe, setEditAxe]     = useState(null);
  const [savingAxe, setSavingAxe] = useState(false);
  const [axeForm, setAxeForm]     = useState(AXE_EMPTY);

  const load = useCallback(() => {
    Promise.all([programsApi.list(), teamApi.list(), axesApi.list(), workflowTemplatesApi.list()])
      .then(([progs, team, axList, tpls]) => { setPrograms(progs); setTeamMembers(team); setAxes(axList); setWfTemplates(tpls); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleProg = async id => {
    const isOpen = !!openProgs[id];
    setOpenProgs(p => ({ ...p, [id]: !isOpen }));
    if (!isOpen && !projMap[id]) {
      setLoadingProj(l => ({ ...l, [id]: true }));
      try {
        const projs = await programsApi.listProjects(id);
        setProjMap(m => ({ ...m, [id]: projs }));
      } catch (e) { setError(e.message); }
      finally { setLoadingProj(l => ({ ...l, [id]: false })); }
    }
  };

  const filtered = useMemo(() =>
    programs.filter(p => {
      const axOk = axFilter === 'all' || String(p.axis_id) === String(axFilter);
      const q = search.toLowerCase();
      const srchOk = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
        (projMap[p.id] || []).some(pr => pr.name.toLowerCase().includes(q));
      return axOk && srchOk;
    }), [programs, projMap, axFilter, search]);

  /* ── Handlers programme ── */
  const openCreateProg = () => {
    setProgForm(PROG_EMPTY); setEditProg(null); setProgModal(true);
  };
  const openEditProg = (p, e) => {
    e.stopPropagation();
    setProgForm({ code: p.code || '', name: p.name || '', description: p.description || '', budget: String(p.budget || ''), progress: String(p.progress || '0'), status: p.status || 'on_track', color: p.color || '#3b82f6', axis_id: String(p.axis_id || '') });
    setEditProg(p); setProgModal(true);
  };

  /* ── Handlers axes ── */
  const openCreateAxe = () => { setAxeForm(AXE_EMPTY); setEditAxe(null); setAxeModal(true); };
  const openEditAxe   = axe => { setAxeForm({ code: axe.code, label: axe.label, color: axe.color, position: String(axe.position || 0) }); setEditAxe(axe); setAxeModal(true); };
  const handleSaveAxe = async () => {
    if (!axeForm.code || !axeForm.label) return;
    setSavingAxe(true);
    try {
      const payload = { ...axeForm, position: parseInt(axeForm.position) || 0 };
      if (editAxe) {
        const updated = await axesApi.update(editAxe.id, payload);
        setAxes(as => as.map(a => a.id === editAxe.id ? updated : a));
      } else {
        const created = await axesApi.create(payload);
        setAxes(as => [...as, created].sort((a, b) => a.position - b.position));
      }
      setAxeModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingAxe(false); }
  };
  const handleDeleteAxe = async axe => {
    if (!window.confirm(`Supprimer l'axe « ${axe.label} » ?`)) return;
    try {
      await axesApi.delete(axe.id);
      setAxes(as => as.filter(a => a.id !== axe.id));
    } catch (e) { setError(e.message); }
  };
  const handleSaveProg = async () => {
    if (!progForm.name || !progForm.code) return;
    setSavingProg(true);
    try {
      const payload = { ...progForm, budget: parseFloat(progForm.budget) || 0, progress: parseInt(progForm.progress) || 0 };
      if (editProg) {
        const updated = await programsApi.update(editProg.id, payload);
        setPrograms(ps => ps.map(p => p.id === editProg.id ? { ...p, ...updated } : p));
      } else {
        const created = await programsApi.create(payload);
        setPrograms(ps => [...ps, created]);
      }
      setProgModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingProg(false); }
  };
  const handleDeleteProg = async (p, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le programme « ${p.code} — ${p.name} » et tous ses projets ?`)) return;
    try {
      await programsApi.delete(p.id);
      setPrograms(ps => ps.filter(x => x.id !== p.id));
      setProjMap(m => { const n = { ...m }; delete n[p.id]; return n; });
    } catch (e) { setError(e.message); }
  };

  /* ── Handlers projet ── */
  const openCreateProj = (progId, e) => {
    e.stopPropagation();
    setProjForm(PROJ_EMPTY); setEditProj(null); setProjProgId(progId); setProjModal(true);
  };
  const openEditProj = (proj, progId, e) => {
    e.stopPropagation();
    setProjForm({
      name: proj.name || '', description: proj.description || '',
      budget: String(proj.budget || ''), status: proj.status || 'structuration',
      start_date: proj.start_date || '', end_date: proj.end_date || '',
      responsible: proj.responsible || '',
      phases: parsePhases(proj),
    });
    setEditProj(proj); setProjProgId(progId); setProjModal(true);
  };
  const handleSaveProj = async () => {
    if (!projForm.name) return;
    setSavingProj(true);
    try {
      const payload = {
        name: projForm.name, description: projForm.description,
        budget: parseFloat(projForm.budget) || 0,
        status: projForm.status, start_date: projForm.start_date,
        end_date: projForm.end_date, responsible: projForm.responsible,
        phases: JSON.stringify(projForm.phases),
        progress: computeGlobal(projForm.phases),
      };
      if (editProj) {
        const updated = await programsApi.updateProject(editProj.id, payload);
        setProjMap(m => ({ ...m, [projProgId]: (m[projProgId] || []).map(p => p.id === editProj.id ? updated : p) }));
      } else {
        const created = await programsApi.createProject(projProgId, payload);
        setProjMap(m => ({ ...m, [projProgId]: [...(m[projProgId] || []), created] }));
        setPrograms(ps => ps.map(p => p.id === projProgId ? { ...p, projects_count: (p.projects_count || 0) + 1 } : p));
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
      setProjMap(m => ({ ...m, [progId]: (m[progId] || []).filter(p => p.id !== proj.id) }));
      setPrograms(ps => ps.map(p => p.id === progId ? { ...p, projects_count: Math.max(0, (p.projects_count || 1) - 1) } : p));
    } catch (e) { setError(e.message); }
  };

  const total = programs.reduce((s, p) => s + (p.budget || 0), 0).toFixed(1);
  const avgP  = programs.length ? Math.round(programs.reduce((s, p) => s + p.progress, 0) / programs.length) : 0;

  const cardProps = prog => ({
    prog,
    open: !!openProgs[prog.id],
    onToggle: () => toggleProg(prog.id),
    projs: projMap[prog.id] || [],
    loadingProj: !!loadingProj[prog.id],
    admin,
    onEditProg:   openEditProg,
    onDeleteProg: handleDeleteProg,
    onCreateProj: openCreateProj,
    onEditProj:   openEditProj,
    onDeleteProj: handleDeleteProj,
    onRDV:        openRdv,
  });

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Portefeuille NDT 2025–2034" title={`${programs.length} programmes prioritaires`}
        subtitle="New Deal Technologique · Suivi budgétaire et physique"
        stats={[
          { value: programs.length, label: 'Programmes' },
          { value: programs.reduce((s,p) => s + (p.projects_count||0), 0), label: 'Projets total' },
          { value: `${total} Md`,   label: 'FCFA total', color: '#10b981' },
          { value: `${avgP}%`,      label: 'Avancement moyen' },
        ]}
        action={admin ? { label: 'Nouveau programme', onClick: openCreateProg, icon: <LayoutGrid size={14}/> } : null} />

      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {/* ── Recherche ── */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textDim, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un programme ou projet NDT…"
            style={{ width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '9px 12px 9px 34px', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans' }} />
        </div>

        {/* ── Filtres axes ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setAxFilter('all')}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${axFilter === 'all' ? '#3b82f6' : T.border}`,
              background: axFilter === 'all' ? '#3b82f620' : 'transparent', color: axFilter === 'all' ? '#3b82f6' : T.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', fontFamily: 'DM Sans' }}>
            Tous les axes
          </button>
          {axes.map(ax => (
            <button key={ax.id} onClick={() => setAxFilter(ax.id)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${String(axFilter) === String(ax.id) ? ax.color : T.border}`,
                background: String(axFilter) === String(ax.id) ? `${ax.color}20` : 'transparent',
                color: String(axFilter) === String(ax.id) ? ax.color : T.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>
              {ax.label}
            </button>
          ))}
          {admin && (
            <button onClick={openCreateAxe}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20,
                border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
              <Plus size={11} /> Gérer les axes
            </button>
          )}
        </div>

        {/* ── Liste des programmes ── */}
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          : axFilter === 'all'
            ? (() => {
                const axisIds = new Set(axes.map(a => String(a.id)));
                const noAxis  = filtered.filter(p => !p.axis_id || !axisIds.has(String(p.axis_id)));
                return (
                  <>
                    {axes.map(ax => {
                      const progs = filtered.filter(p => String(p.axis_id) === String(ax.id));
                      if (!progs.length) return null;
                      return (
                        <div key={ax.id} style={{ marginBottom: 28 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ width: 3, height: 24, background: ax.color, borderRadius: 2 }} />
                            <div style={{ fontFamily: 'EB Garamond', fontSize: 17, color: ax.color, fontWeight: 500 }}>{ax.label}</div>
                            {admin && (
                              <div style={{ display: 'flex', gap: 3, marginLeft: 6 }}>
                                <button onClick={() => openEditAxe(ax)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 4px', borderRadius: 4, lineHeight: 0 }}><Pencil size={11}/></button>
                                <button onClick={() => handleDeleteAxe(ax)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 4px', borderRadius: 4, lineHeight: 0 }}
                                  onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}><Trash2 size={11}/></button>
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: T.textDim, marginLeft: 'auto', fontFamily: 'DM Sans' }}>
                              {progs.length} programmes · {progs.reduce((a, p) => a + (p.projects_count || 0), 0)} projets
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {progs.map(prog => <ProgramCard key={prog.id} {...cardProps(prog)} />)}
                          </div>
                        </div>
                      );
                    })}
                    {noAxis.length > 0 && (
                      <div style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ width: 3, height: 24, background: T.textDim, borderRadius: 2 }} />
                          <div style={{ fontFamily: 'EB Garamond', fontSize: 17, color: T.textMuted, fontWeight: 500 }}>Sans axe</div>
                          <div style={{ fontSize: 11, color: T.textDim, marginLeft: 'auto', fontFamily: 'DM Sans' }}>{noAxis.length} programmes</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {noAxis.map(prog => <ProgramCard key={prog.id} {...cardProps(prog)} />)}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(prog => <ProgramCard key={prog.id} {...cardProps(prog)} />)}
              </div>
        }
      </div>

      {/* ── Modal créer / modifier programme ── */}
      <Modal open={progModal} onClose={() => setProgModal(false)} title={editProg ? `Modifier — ${editProg.code}` : 'Nouveau programme'} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Code *</label>
              <Input value={progForm.code} onChange={v => setProgForm(f => ({ ...f, code: v.toUpperCase() }))} placeholder="P13" disabled={!!editProg} />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Nom du programme *</label>
              <Input value={progForm.name} onChange={v => setProgForm(f => ({ ...f, name: v }))} placeholder="Intitulé du programme" />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Axe NDT *</label>
            <Select value={progForm.axis_id} onChange={v => setProgForm(f => ({ ...f, axis_id: v }))} style={{ width: '100%' }}>
              <option value="">— Sélectionner un axe —</option>
              {axes.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Description</label>
            <Input value={progForm.description} onChange={v => setProgForm(f => ({ ...f, description: v }))} placeholder="Périmètre et objectifs stratégiques" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Budget (Md FCFA)</label>
              <Input value={progForm.budget} onChange={v => setProgForm(f => ({ ...f, budget: v }))} type="number" placeholder="0.0" />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Avancement (%)</label>
              <Input value={progForm.progress} onChange={v => setProgForm(f => ({ ...f, progress: v }))} type="number" placeholder="0–100" />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Statut</label>
              <Select value={progForm.status} onChange={v => setProgForm(f => ({ ...f, status: v }))} style={{ width: '100%' }}>
                <option value="on_track">✅ On track</option>
                <option value="attention">⚠️ Attention</option>
                <option value="risque">🔴 Risque</option>
              </Select>
            </div>
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 8 }}>Couleur</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AX_COLORS.map(c => (
                <button key={c} onClick={() => setProgForm(f => ({ ...f, color: c }))}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: progForm.color === c ? `3px solid #fff` : `2px solid transparent`,
                    cursor: 'pointer', outline: progForm.color === c ? `2px solid ${c}` : 'none', transition: 'all .15s' }} />
              ))}
              <input type="color" value={progForm.color} onChange={e => setProgForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: 'transparent' }} title="Couleur personnalisée" />
            </div>
          </div>
        </div>
        <ModalFooter onCancel={() => setProgModal(false)} onConfirm={handleSaveProg} loading={savingProg}
          confirmLabel={editProg ? 'Mettre à jour' : 'Créer le programme'} color={progForm.color || '#06b6d4'} />
      </Modal>

      {/* ── Modal créer / modifier axe ── */}
      <Modal open={axeModal} onClose={() => setAxeModal(false)} title={editAxe ? `Modifier l'axe` : 'Nouvel axe'} width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Code *</label>
              <Input value={axeForm.code} onChange={v => setAxeForm(f => ({ ...f, code: v }))} placeholder="A1" disabled={!!editAxe} />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Libellé *</label>
              <Input value={axeForm.label} onChange={v => setAxeForm(f => ({ ...f, label: v }))} placeholder="Intitulé de l'axe" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 8 }}>Couleur</label>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                {AX_COLORS.map(c => (
                  <button key={c} onClick={() => setAxeForm(f => ({ ...f, color: c }))}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: c,
                      border: axeForm.color === c ? '3px solid #fff' : '2px solid transparent',
                      cursor: 'pointer', outline: axeForm.color === c ? `2px solid ${c}` : 'none', transition: 'all .15s' }} />
                ))}
                <input type="color" value={axeForm.color} onChange={e => setAxeForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
              </div>
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Ordre</label>
              <Input value={axeForm.position} onChange={v => setAxeForm(f => ({ ...f, position: v }))} type="number" placeholder="1" />
            </div>
          </div>
          {/* Liste des axes existants */}
          {axes.length > 0 && !editAxe && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: T.textDim, fontFamily: 'DM Sans', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Axes existants</div>
              {axes.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${T.border}10` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: 'DM Sans' }}>{a.label}</div>
                  <button onClick={() => openEditAxe(a)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 5px', borderRadius: 4, lineHeight: 0 }}><Pencil size={11}/></button>
                  <button onClick={() => handleDeleteAxe(a)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 5px', borderRadius: 4, lineHeight: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}><Trash2 size={11}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <ModalFooter onCancel={() => setAxeModal(false)} onConfirm={handleSaveAxe} loading={savingAxe}
          confirmLabel={editAxe ? 'Mettre à jour' : 'Créer l\'axe'} color={axeForm.color || '#06b6d4'} />
      </Modal>

      {/* ── Modal créer/modifier projet ── */}
      <Modal open={projModal} onClose={() => setProjModal(false)} title={editProj ? 'Modifier le projet' : 'Nouveau projet'} width={580}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Infos générales */}
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Nom du projet *</label>
            <Input value={projForm.name} onChange={v => setProjForm(f => ({ ...f, name: v }))} placeholder="Intitulé du projet" />
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Description / Entité</label>
            <Textarea value={projForm.description} onChange={v => setProjForm(f => ({ ...f, description: v }))} placeholder="Objectifs, périmètre, entité responsable..." rows={2} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Budget (Md FCFA)</label>
              <Input value={projForm.budget} onChange={v => setProjForm(f => ({ ...f, budget: v }))} type="number" placeholder="0.0" />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Début projet</label>
              <Input value={projForm.start_date} onChange={v => setProjForm(f => ({ ...f, start_date: v }))} type="date" />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Fin projet</label>
              <Input value={projForm.end_date} onChange={v => setProjForm(f => ({ ...f, end_date: v }))} type="date" />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Chef de projet</label>
            <Select value={projForm.responsible} onChange={v => setProjForm(f => ({ ...f, responsible: v }))} style={{ width: '100%' }}>
              <option value="">— Non assigné —</option>
              {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name} · {m.role}</option>)}
            </Select>
          </div>

          {/* ── Workflow phases dynamique ── */}
          {(() => {
            const phases   = projForm.phases || [];
            const activeIdx = phases.findIndex(p => p.key === projForm.status);
            const global    = computeGlobal(phases);
            const sumW      = phases.reduce((s, p) => s + (p.weight || 0), 0);

            const setPhase = (i, field, val) => setProjForm(f => {
              const ps = f.phases.map((p, j) => j === i ? { ...p, [field]: val } : p);
              return { ...f, phases: ps };
            });
            const advanceTo = (i) => setProjForm(f => {
              const ps = [...f.phases];
              const today = new Date().toISOString().slice(0, 10);
              if (!ps[i].start_date) ps[i] = { ...ps[i], start_date: today };
              return { ...f, phases: ps, status: ps[i].key };
            });
            const addPhase = () => setProjForm(f => ({
              ...f,
              phases: [...f.phases, { key: `phase_${Date.now()}`, label: 'Nouvelle phase', color: AX_COLORS[f.phases.length % AX_COLORS.length], weight: 0, start_date: '', end_date: '', progress: 0 }],
            }));
            const removePhase = (i) => setProjForm(f => {
              const ps = f.phases.filter((_, j) => j !== i);
              const newStatus = f.phases[i].key === f.status ? (ps[i] || ps[i - 1])?.key || '' : f.status;
              return { ...f, phases: ps, status: newStatus };
            });

            return (
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                {/* En-tête */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11, color: T.textDim, fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Workflow</div>
                  <div style={{ fontSize: 11, fontFamily: 'DM Sans', fontWeight: 700, color: sumW === 100 ? '#10b981' : '#f59e0b' }}>
                    Σ {sumW}% {sumW !== 100 ? '⚠' : '✓'}
                  </div>
                  <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, color: '#06b6d4' }}>{global}% global</div>
                  {!editProj && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={addPhase} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, cursor: 'pointer' }}>
                        <Plus size={11} /> Phase
                      </button>
                    </div>
                  )}
                </div>
                {/* ── Enregistrer / gérer les templates (création uniquement) ── */}
                {!editProj && <div style={{ marginBottom: 12 }}>
                  {!showTplSave ? (
                    <button onClick={() => { setShowTplSave(true); setTplNameInput(''); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600,
                        padding: '5px 12px', borderRadius: 6, border: `1px solid #10b98155`, background: 'rgba(16,185,129,0.08)',
                        color: '#10b981', cursor: 'pointer' }}>
                      <Plus size={11} /> Enregistrer comme template réutilisable
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={tplNameInput} onChange={e => setTplNameInput(e.target.value)}
                        placeholder="Nom du template (ex: Cycle NDT standard)…" autoFocus
                        onKeyDown={e => e.key === 'Enter' && !savingTpl && tplNameInput.trim() && document.getElementById('btn-save-tpl')?.click()}
                        style={{ flex: 1, background: '#0d1b30', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', color: T.text, fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }} />
                      <button id="btn-save-tpl" disabled={savingTpl || !tplNameInput.trim()} onClick={async () => {
                        if (!tplNameInput.trim()) return;
                        setSavingTpl(true);
                        try {
                          const created = await workflowTemplatesApi.create({ name: tplNameInput.trim(), phases: JSON.stringify(phases) });
                          setWfTemplates(ts => [...ts, created]);
                          setShowTplSave(false);
                        } catch (e2) { setError(e2.message); }
                        finally { setSavingTpl(false); }
                      }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans', cursor: savingTpl ? 'wait' : 'pointer', opacity: !tplNameInput.trim() ? 0.5 : 1 }}>
                        {savingTpl ? '…' : 'Enregistrer'}
                      </button>
                      <button onClick={() => setShowTplSave(false)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                  )}
                  {/* Liste des templates avec suppression */}
                  {wfTemplates.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {wfTemplates.map(t => (
                        <div key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, borderRadius: 6, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                          <button onClick={() => {
                            try {
                              const ps = typeof t.phases === 'string' ? JSON.parse(t.phases) : t.phases;
                              setProjForm(f => ({ ...f, phases: ps.map(p => ({ ...p, start_date: '', end_date: '', progress: 0 })), status: ps[0]?.key || f.status }));
                            } catch (_) {}
                          }} style={{ padding: '4px 10px', background: 'transparent', border: 'none', color: T.textMuted, fontSize: 11, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: 500 }}>
                            📋 {t.name}
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm(`Supprimer le template « ${t.name} » ?`)) return;
                            try {
                              await workflowTemplatesApi.delete(t.id);
                              setWfTemplates(ts => ts.filter(x => x.id !== t.id));
                            } catch (e2) { setError(e2.message); }
                          }} style={{ padding: '4px 6px', background: 'transparent', border: 'none', borderLeft: `1px solid ${T.border}`, color: T.textDim, cursor: 'pointer', lineHeight: 0 }}
                            onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}>
                            <Trash2 size={9} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>}

                {phases.map((ph, i) => {
                  const done   = i < activeIdx || (activeIdx === -1 && i < phases.length);
                  const active = i === activeIdx;
                  const late   = ph.end_date && new Date(ph.end_date) < new Date() && ph.progress < 100;

                  /* ── Phase complétée ── */
                  if (done) return (
                    <div key={ph.key || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', marginBottom: 6, borderRadius: 8, background: `${ph.color}08`, border: `1px solid ${ph.color}25` }}>
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="7.5" fill={ph.color}/><polyline points="3.5,7.5 6.5,10.5 11.5,4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <div style={{ flex: 1, fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, color: ph.color }}>{ph.label}</div>
                      <div style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>{ph.start_date && ph.end_date ? `${ph.start_date} → ${ph.end_date}` : ph.end_date || ph.start_date || ''}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ph.color, fontFamily: 'DM Sans' }}>{ph.progress}%</div>
                      {!editProj && <button onClick={() => setProjForm(f => ({ ...f, status: ph.key }))} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 10, fontFamily: 'DM Sans', padding: '1px 5px', borderRadius: 4 }}>modifier</button>}
                      {!editProj && <button onClick={() => removePhase(i)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', lineHeight: 0, padding: 2 }} title="Supprimer"><Trash2 size={10} /></button>}
                    </div>
                  );

                  /* ── Phase active ── */
                  if (active) return (
                    <div key={ph.key || i} style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 8, background: `${ph.color}0d`, border: `2px solid ${ph.color}50` }}>
                      {/* Titre + contrôles */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: ph.color, boxShadow: `0 0 5px ${ph.color}`, flexShrink: 0 }} />
                        {/* Label */}
                        {editProj
                          ? <div style={{ flex: 1, fontFamily: 'DM Sans', fontSize: 13, fontWeight: 700, color: ph.color }}>{ph.label}</div>
                          : <input value={ph.label} onChange={e => setPhase(i, 'label', e.target.value)}
                              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 700, color: ph.color }} />}
                        {/* Poids */}
                        {editProj
                          ? <span style={{ fontSize: 11, color: T.textDim, fontFamily: 'DM Sans' }}>{ph.weight}%</span>
                          : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="number" min={0} max={100} value={ph.weight}
                                onChange={e => setPhase(i, 'weight', Math.min(100, Math.max(0, parseInt(e.target.value)||0)))}
                                style={{ width: 44, background: '#0d1b30', border: `1px solid ${ph.color}44`, borderRadius: 5, padding: '3px 4px', color: ph.color, fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans', textAlign: 'center', outline: 'none' }} />
                              <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>%</span>
                            </div>}
                        {/* Couleur (création seulement) */}
                        {!editProj && <input type="color" value={ph.color} onChange={e => setPhase(i, 'color', e.target.value)}
                          style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />}
                        <span style={{ fontSize: 10, background: `${ph.color}20`, color: ph.color, borderRadius: 4, padding: '2px 7px', fontFamily: 'DM Sans', fontWeight: 700 }}>Active</span>
                        {late && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, fontFamily: 'DM Sans' }}>⚠ En retard</span>}
                        <div style={{ fontSize: 15, fontWeight: 800, color: ph.progress === 100 ? '#10b981' : ph.color, fontFamily: 'DM Sans' }}>{ph.progress}%</div>
                        {!editProj && <button onClick={() => removePhase(i)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', lineHeight: 0, padding: 2 }}><Trash2 size={10} /></button>}
                      </div>
                      {/* Barre cliquable */}
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 10, cursor: 'pointer' }}
                        onClick={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setPhase(i, 'progress', Math.min(100, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 100))));
                        }}>
                        <div style={{ width: `${ph.progress}%`, height: '100%', background: `linear-gradient(90deg,${ph.color}99,${ph.color})`, borderRadius: 4, transition: 'width .12s' }} />
                      </div>
                      {/* Dates + % */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                        <div>
                          <label style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim, display: 'block', marginBottom: 3 }}>Début</label>
                          <Input value={ph.start_date} onChange={v => setPhase(i, 'start_date', v)} type="date" />
                        </div>
                        <div>
                          <label style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim, display: 'block', marginBottom: 3 }}>Fin prévue {late && <span style={{ color: '#ef4444' }}>⚠ dépassée</span>}</label>
                          <Input value={ph.end_date} onChange={v => setPhase(i, 'end_date', v)} type="date"
                            style={{ borderColor: late ? 'rgba(239,68,68,0.5)' : undefined }} />
                        </div>
                        <input type="number" min={0} max={100} value={ph.progress}
                          onChange={e => setPhase(i, 'progress', Math.min(100, Math.max(0, parseInt(e.target.value)||0)))}
                          style={{ width: 58, background: '#0d1b30', border: `1px solid ${ph.color}55`, borderRadius: 6, padding: '8px 6px', color: ph.color, fontSize: 14, fontWeight: 800, fontFamily: 'DM Sans', textAlign: 'center', outline: 'none' }} />
                      </div>
                      {/* Bouton phase suivante si 100% */}
                      {ph.progress === 100 && i < phases.length - 1 && (
                        <button onClick={() => advanceTo(i + 1)}
                          style={{ marginTop: 10, width: '100%', padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700,
                            background: `linear-gradient(90deg,${ph.color}25,${phases[i+1].color}25)`, color: phases[i+1].color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          ✓ Démarrer « {phases[i+1].label} » →
                        </button>
                      )}
                    </div>
                  );

                  /* ── Phase à venir ── */
                  return (
                    <div key={ph.key || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 6, borderRadius: 8, border: `1px solid ${T.border}`, background: `${ph.color}06` }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}><rect x="1.5" y="5.5" width="10" height="6.5" rx="2" fill={T.textDim}/><path d="M3.5 5.5V4a3 3 0 016 0v1.5" stroke={T.textDim} strokeWidth="1.4" fill="none" strokeLinecap="round"/></svg>
                      {editProj
                        ? <div style={{ flex: 1, fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.textMuted }}>{ph.label}</div>
                        : <input value={ph.label} onChange={e => setPhase(i, 'label', e.target.value)}
                            placeholder="Nom de la phase"
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: T.textMuted }} />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        {editProj
                          ? <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'DM Sans' }}>{ph.weight}%</span>
                          : <>
                              <input type="number" min={0} max={100} value={ph.weight}
                                onChange={e => setPhase(i, 'weight', Math.min(100, Math.max(0, parseInt(e.target.value)||0)))}
                                style={{ width: 40, background: '#0d1b30', border: `1px solid ${T.border}`, borderRadius: 5, padding: '3px 4px', color: T.textMuted, fontSize: 11, fontFamily: 'DM Sans', textAlign: 'center', outline: 'none' }} />
                              <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>%</span>
                            </>}
                      </div>
                      {!editProj && <input type="color" value={ph.color} onChange={e => setPhase(i, 'color', e.target.value)}
                        style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />}
                      <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>Non démarré</span>
                      {!editProj && <button onClick={() => removePhase(i)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', lineHeight: 0, padding: 2 }}
                        onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}>
                        <Trash2 size={10} />
                      </button>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <ModalFooter onCancel={() => setProjModal(false)} onConfirm={handleSaveProj} loading={savingProj}
          confirmLabel={editProj ? 'Mettre à jour' : 'Créer'}
          color={programs.find(p => p.id === projProgId)?.color || '#06b6d4'} />
      </Modal>

      {/* ── Modal Rendez-vous projet ── */}
      <Modal open={rdvModal} onClose={() => setRdvModal(false)} title={`Rendez-vous — ${rdvProject?.name || ''}`} width={580}>
        {/* Formulaire ajout/édition */}
        <div style={{ background: 'rgba(6,182,212,0.04)', border: `1px solid rgba(6,182,212,0.15)`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', fontFamily: 'DM Sans', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            {editRdv ? 'Modifier le rendez-vous' : 'Ajouter un rendez-vous'}
          </div>
          <Input placeholder="Intitulé du rendez-vous *" value={rdvForm.title} onChange={v => setRdvForm(f => ({ ...f, title: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <Input value={rdvForm.date} onChange={v => setRdvForm(f => ({ ...f, date: v }))} type="date" />
            <Input value={rdvForm.time} onChange={v => setRdvForm(f => ({ ...f, time: v }))} type="time" />
            <Select value={rdvForm.type} onChange={v => setRdvForm(f => ({ ...f, type: v }))}>
              {RDV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div style={{ marginTop: 8 }}>
            <Input placeholder="Participants (noms séparés par des virgules)" value={rdvForm.participants} onChange={v => setRdvForm(f => ({ ...f, participants: v }))} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Textarea placeholder="Notes / ordre du jour…" value={rdvForm.notes} onChange={v => setRdvForm(f => ({ ...f, notes: v }))} rows={2} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            {editRdv && <button onClick={() => { setEditRdv(null); setRdvForm(RDV_EMPTY); }}
              style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 12, fontFamily: 'DM Sans', cursor: 'pointer' }}>
              Annuler
            </button>}
            <button disabled={savingRdv || !rdvForm.title || !rdvForm.date} onClick={handleSaveRdv}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#06b6d4', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'DM Sans', cursor: savingRdv ? 'wait' : 'pointer', opacity: (!rdvForm.title || !rdvForm.date) ? 0.5 : 1 }}>
              {savingRdv ? '…' : editRdv ? 'Mettre à jour' : '+ Ajouter'}
            </button>
          </div>
        </div>

        {/* Liste des rendez-vous */}
        {rdvLoading
          ? <div style={{ textAlign: 'center', padding: 20 }}><Spinner size={24} /></div>
          : meetings.length === 0
          ? <div style={{ textAlign: 'center', padding: '16px 0', color: T.textDim, fontSize: 12, fontFamily: 'DM Sans' }}>Aucun rendez-vous enregistré</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {meetings.map(m => {
                const isPast = m.date && new Date(m.date) < new Date();
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, opacity: isPast ? 0.7 : 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4', fontFamily: 'DM Sans', lineHeight: 1 }}>{m.date?.slice(8)}</div>
                      <div style={{ fontSize: 9, color: T.textDim, fontFamily: 'DM Sans', textTransform: 'uppercase' }}>{['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][parseInt(m.date?.slice(5,7))-1]}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, color: T.text }}>{m.title}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>{m.time || ''}</span>
                        <span style={{ fontSize: 10, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontFamily: 'DM Sans', padding: '1px 6px', borderRadius: 4 }}>{m.type}</span>
                        {m.participants && <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>👥 {m.participants}</span>}
                      </div>
                      {m.notes && <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, fontStyle: 'italic', fontFamily: 'DM Sans', lineHeight: 1.4 }}>{m.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button onClick={() => { setEditRdv(m); setRdvForm({ title: m.title, date: m.date, time: m.time || '', type: m.type, participants: m.participants || '', notes: m.notes || '' }); }}
                        style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}>
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => handleDeleteRdv(m.id)}
                        style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}
                        onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </Modal>
    </div>
  );
}

/* ── Carte Programme (style new_version) ── */
function ProgramCard({ prog, open, onToggle, projs, loadingProj, admin, onEditProg, onDeleteProg, onCreateProj, onEditProj, onDeleteProj, onRDV }) {
  const pColor = prog.color || '#06b6d4';

  return (
    <div style={{ background: T.surface, border: `1px solid ${open ? pColor + '40' : T.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color .2s' }}>

      {/* ── En-tête programme ── */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: pColor, minWidth: 36, fontFamily: 'DM Sans' }}>{prog.code}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'EB Garamond', fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{prog.name}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, fontFamily: 'DM Sans' }}>{prog.projects_count || 0} projets · {prog.budget} Mds FCFA</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge status={prog.status} />
          {admin && (
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={e => onEditProg(prog, e)}
                style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 5px', borderRadius: 5, lineHeight: 0 }}
                title="Modifier le programme">
                <Pencil size={12} />
              </button>
              <button onClick={e => onDeleteProg(prog, e)}
                style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 5px', borderRadius: 5, lineHeight: 0 }}
                title="Supprimer le programme"
                onMouseEnter={ev => ev.currentTarget.style.color = '#ef4444'}
                onMouseLeave={ev => ev.currentTarget.style.color = T.textDim}>
                <Trash2 size={12} />
              </button>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pColor, fontFamily: 'DM Sans' }}>{prog.progress}%</div>
            <div style={{ width: 70, marginTop: 4 }}><ProgressBar value={prog.progress} color={pColor} height={4} /></div>
          </div>
          {open ? <ChevronUp size={14} style={{ color: T.textDim }} /> : <ChevronDown size={14} style={{ color: T.textDim }} />}
        </div>
      </div>

      {/* ── Section projets (expanded) ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 16px', background: T.bg }}>
          {prog.description && (
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 12, fontStyle: 'italic', fontFamily: 'DM Sans' }}>{prog.description}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.textDim, textTransform: 'uppercase', fontFamily: 'DM Sans' }}>
              Projets associés ({projs.length})
            </div>
            {admin && (
              <button onClick={e => onCreateProj(prog.id, e)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 7, border: `1px solid ${pColor}44`, background: `${pColor}12`, color: pColor, cursor: 'pointer' }}>
                <Plus size={11} /> Ajouter
              </button>
            )}
          </div>

          {loadingProj
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner size={20} /></div>
            : projs.length === 0
              ? <div style={{ padding: '14px 0', textAlign: 'center' }}>
                  <FolderOpen size={22} color={pColor} style={{ margin: '0 auto 5px', opacity: 0.35 }} />
                  <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>Aucun projet</div>
                </div>
              : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {projs.map(proj => {
                    const _phases  = parsePhases(proj);
                    const _activePh = _phases.find(p => p.key === proj.status);
                    const pct = proj.progress || 0;
                    const pc  = _activePh?.color || '#06b6d4';
                    return (
                      <div key={proj.id}
                        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', position: 'relative', transition: 'border-color .2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, lineHeight: 1.4, paddingRight: 48, fontFamily: 'DM Sans' }}>{proj.name}</div>
                            {proj.description && (
                              <div style={{ fontSize: 11, color: T.textDim, marginTop: 3, lineHeight: 1.4, fontFamily: 'DM Sans' }}>{proj.description}</div>
                            )}
                            {proj.responsible && (
                              <div style={{ fontSize: 10, color: T.textDim, marginTop: 3, fontFamily: 'DM Sans' }}>👤 {proj.responsible}</div>
                            )}

                            {/* Workflow séquentiel */}
                            {(() => {
                              const phases  = parsePhases(proj);
                              const phIdx   = phases.findIndex(p => p.key === proj.status);
                              const activePh = phases[phIdx];
                              const late    = isProjectLate(phases);
                              return (
                                <div style={{ marginTop: 8 }}>
                                  {/* Pastilles séquentielles */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5, flexWrap: 'wrap' }}>
                                    {phases.map((ph, i) => {
                                      const done   = phIdx === -1 ? true : i < phIdx;
                                      const active = i === phIdx;
                                      return (
                                        <div key={ph.key || i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                          {i > 0 && <div style={{ width: 10, height: 1, background: done ? `${ph.color}60` : T.border }} />}
                                          <div title={`${ph.label} : ${ph.progress}%`} style={{
                                            width: active ? 8 : 6, height: active ? 8 : 6, borderRadius: '50%', flexShrink: 0,
                                            background: done ? ph.color : active ? ph.color : T.border,
                                            opacity: done || active ? 1 : 0.3,
                                            boxShadow: active ? `0 0 5px ${ph.color}` : 'none',
                                          }} />
                                        </div>
                                      );
                                    })}
                                    <div style={{ marginLeft: 5, fontSize: 10, color: activePh?.color || T.textDim, fontFamily: 'DM Sans', fontWeight: 600 }}>
                                      {activePh?.label || proj.status}
                                    </div>
                                    {late && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, fontFamily: 'DM Sans', marginLeft: 4 }}>⚠ retard</span>}
                                  </div>
                                  {/* Barre phase active */}
                                  {activePh && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ width: `${activePh.progress}%`, height: '100%', background: late ? '#ef4444' : activePh.color, borderRadius: 2, transition: 'width .3s' }} />
                                      </div>
                                      <div style={{ fontSize: 9, fontWeight: 700, color: late ? '#ef4444' : activePh.color, fontFamily: 'DM Sans', minWidth: 24, textAlign: 'right' }}>{activePh.progress}%</div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <ProjBadge color={_activePh?.color} label={_activePh?.label || proj.status} />
                              <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                                <button onClick={e => onRDV(proj, e)} title="Rendez-vous"
                                  style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}
                                  onMouseEnter={ev => ev.currentTarget.style.color = '#06b6d4'}
                                  onMouseLeave={ev => ev.currentTarget.style.color = T.textDim}>
                                  <CalendarDays size={11} />
                                </button>
                                {admin && <>
                                  <button onClick={e => onEditProj(proj, prog.id, e)}
                                    style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}>
                                    <Pencil size={11} />
                                  </button>
                                  <button onClick={e => onDeleteProj(proj, prog.id, e)}
                                    style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}
                                    onMouseEnter={ev => ev.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={ev => ev.currentTarget.style.color = T.textDim}>
                                    <Trash2 size={11} />
                                  </button>
                                </>}
                              </div>
                            </div>
                          </div>

                          {/* Cercle % global pondéré */}
                          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <CircleProgress pct={pct} color={pc} size={40} />
                            <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, marginTop: -24, textAlign: 'center', fontFamily: 'DM Sans' }}>{pct}%</div>
                          </div>
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
}