import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, FolderOpen, LayoutGrid, CalendarDays } from 'lucide-react';
import { programsApi, teamApi, axesApi, workflowTemplatesApi, projectMeetingsApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRefData } from '../context/RefContext.jsx';
import { hasPerm } from '../permissions.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Badge, ProgressBar, Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea } from '../components/UI.jsx';
import { T } from '../theme.js';

/* ── Phases de secours (utilisées uniquement si aucun template n'est disponible) ── */
const FALLBACK_PHASES = [
  { key: 'structuration', label: 'Structuration', color: '#f59e0b', weight: 10, start_date: '', end_date: '', progress: 0 },
  { key: 'maturation',    label: 'Maturation',    color: '#8b5cf6', weight: 20, start_date: '', end_date: '', progress: 0 },
  { key: 'execution',     label: 'Exécution',     color: '#06b6d4', weight: 70, start_date: '', end_date: '', progress: 0 },
];



const AX_COLORS = ['#3b82f6','#14b8a6','#f59e0b','#a78bfa','#10b981','#ef4444','#8b5cf6','#06b6d4'];

const toPhases = raw => {
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(p) && p.length > 0) return p;
  } catch (_) {}
  return null;
};
const resetPhases = ps => ps.map(p => ({ ...p, start_date: '', end_date: '', progress: 0 }));

/* Phases du template par défaut (is_default=1, sinon le premier), sinon repli */
const defaultPhasesFrom = templates => {
  const tpl = templates.find(t => Number(t.is_default) === 1) || templates[0];
  return resetPhases((tpl && toPhases(tpl.phases)) || FALLBACK_PHASES);
};

/* poids en % entiers (ex: weight=70 → 70%) */
const computeGlobal = phases =>
  Math.round(phases.reduce((s, ph) => s + (Number(ph.progress) || 0) * (Number(ph.weight) || 0) / 100, 0));
const sumWeights = phases => phases.reduce((s, p) => s + (Number(p.weight) || 0), 0);

const isProjectLate = phases => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return phases.some(ph => ph.end_date && new Date(ph.end_date) < today && ph.progress < 100);
};

/* Deserialize phases depuis un projet API */
const parsePhases = (proj, fallback = FALLBACK_PHASES) => toPhases(proj.phases) || fallback.map(ph => ({ ...ph }));

const monthShort = ymd => {
  if (!ymd) return '';
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
};

const AXE_EMPTY  = { code: '', label: '', color: '#3b82f6', position: '' };
const lbl = { fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 };

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

const ProjBadge = ({ color = T.textDim, label = '-' }) => (
  <span style={{ background: `${color}18`, color, fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, border: `1px solid ${color}30`, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

export default function Portefeuille() {
  const { user } = useAuth();
  const ref = useRefData();

  /* Droits alignés sur authorize() côté backend (clés de lib/permissions.js) */
  const perms = {
    progCreate: hasPerm(user, 'programs.create'),
    progUpdate: hasPerm(user, 'programs.update'),
    progDelete: hasPerm(user, 'programs.delete'),
    axes:       hasPerm(user, 'axes.manage'),
    projCreate: hasPerm(user, 'projects.create'),
    projUpdate: hasPerm(user, 'projects.update'),
    projDelete: hasPerm(user, 'projects.delete'),
    tplCreate:  hasPerm(user, 'templates.manage'),
    tplUpdate:  hasPerm(user, 'templates.manage'),
    tplDelete:  hasPerm(user, 'templates.delete'),
    rdvEdit:    hasPerm(user, 'meetings.manage'),
    rdvDelete:  hasPerm(user, 'meetings.delete'),
  };

  const planShort    = ref.setting('plan_short');
  const currency     = ref.setting('currency_unit');
  const progressMode = ref.setting('program_progress_mode') || 'manual';
  const progStatuses = ref.list('program_status');
  const meetingTypes = ref.list('meeting_type');
  const closedStatuses = (() => { const v = ref.json('project_closed_statuses', ['cloture']); return Array.isArray(v) ? v.filter(Boolean).map(String) : ['cloture']; })();
  const excludedProgs  = (() => { const v = ref.json('stats_excluded_programs', []); return Array.isArray(v) ? v.map(String) : []; })();

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
  const [progForm, setProgForm]     = useState({});

  /* Modals projet */
  const [projModal, setProjModal]   = useState(false);
  const [editProj, setEditProj]     = useState(null);
  const [projProgId, setProjProgId] = useState(null);
  const [savingProj, setSavingProj] = useState(false);
  const [projForm, setProjForm]     = useState({ phases: [] });
  const [teamMembers, setTeamMembers]     = useState([]);
  const [axes, setAxes]                   = useState([]);
  const [wfTemplates, setWfTemplates]     = useState([]);
  const [savingTpl, setSavingTpl]         = useState(false);
  const [tplNameInput, setTplNameInput]   = useState('');
  const [showTplSave, setShowTplSave]     = useState(false);

  /* Modal édition template */
  const [tplModal, setTplModal] = useState(null); // { id, name, description, phases }

  /* Modal Rendez-vous */
  const defaultRdvType = meetingTypes[0]?.code || 'Réunion';
  const RDV_EMPTY = { title: '', date: '', time: '', type: defaultRdvType, participants: '', notes: '' };
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

  /* Rafraîchit les agrégats (avancement / budget projets) après modification d'un projet */
  const refreshPrograms = () => programsApi.list().then(setPrograms).catch(() => {});

  const defaultPhases = useMemo(() => defaultPhasesFrom(wfTemplates), [wfTemplates]);

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
    setProgForm({ code: '', name: '', description: '', budget: '', progress: '0', status: progStatuses[0]?.code || 'on_track', color: '#3b82f6', axis_id: '' });
    setEditProg(null); setProgModal(true);
  };
  const openEditProg = (p, e) => {
    e.stopPropagation();
    const manual = p.manual_progress ?? p.progress;
    setProgForm({ code: p.code || '', name: p.name || '', description: p.description || '', budget: String(p.budget ?? ''), progress: String(manual ?? '0'), status: p.status || progStatuses[0]?.code || 'on_track', color: p.color || '#3b82f6', axis_id: String(p.axis_id || '') });
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
        setAxes(as => as.map(a => a.id === editAxe.id ? updated : a).sort((a, b) => a.position - b.position));
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
    if (!window.confirm(`Supprimer le programme « ${p.code} - ${p.name} » et tous ses projets ?`)) return;
    try {
      await programsApi.delete(p.id);
      setPrograms(ps => ps.filter(x => x.id !== p.id));
      setProjMap(m => { const n = { ...m }; delete n[p.id]; return n; });
    } catch (e) { setError(e.message); }
  };

  /* ── Handlers projet ── */
  const openCreateProj = (progId, e) => {
    e.stopPropagation();
    const phases = defaultPhases.map(ph => ({ ...ph }));
    setProjForm({ name: '', description: '', budget: '', status: phases[0]?.key || '', start_date: '', end_date: '', responsible: '', phases });
    setEditProj(null); setProjProgId(progId); setProjModal(true); setShowTplSave(false);
  };
  const openEditProj = (proj, progId, e) => {
    e.stopPropagation();
    const phases = parsePhases(proj, defaultPhases);
    setProjForm({
      name: proj.name || '', description: proj.description || '',
      budget: String(proj.budget ?? ''), status: proj.status || phases[0]?.key || '',
      start_date: proj.start_date || '', end_date: proj.end_date || '',
      responsible: proj.responsible || '',
      phases,
    });
    setEditProj(proj); setProjProgId(progId); setProjModal(true); setShowTplSave(false);
  };
  const handleSaveProj = async () => {
    if (!projForm.name) return;
    const sw = sumWeights(projForm.phases || []);
    if (projForm.phases?.length && sw !== 100 && !window.confirm(`La somme des poids des phases est de ${sw}% (au lieu de 100%). Enregistrer quand même ?`)) return;
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
      }
      setProjModal(false);
      refreshPrograms();
    } catch (e) { setError(e.message); }
    finally { setSavingProj(false); }
  };
  const handleDeleteProj = async (proj, progId, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer « ${proj.name} » ?`)) return;
    try {
      await programsApi.deleteProject(proj.id);
      setProjMap(m => ({ ...m, [progId]: (m[progId] || []).filter(p => p.id !== proj.id) }));
      refreshPrograms();
    } catch (e) { setError(e.message); }
  };

  /* ── Templates de workflow ── */
  const applyTemplate = t => {
    const ps = toPhases(t.phases);
    if (!ps) return;
    if (editProj && !window.confirm(`Remplacer les phases du projet par le template « ${t.name} » ? L'avancement et les dates des phases seront réinitialisés.`)) return;
    const fresh = resetPhases(ps);
    setProjForm(f => ({ ...f, phases: fresh, status: fresh[0]?.key || f.status }));
  };
  const openEditTpl = t => setTplModal({ id: t.id, name: t.name || '', description: t.description || '', is_default: Number(t.is_default) === 1, phases: (toPhases(t.phases) || []).map(p => ({ ...p })) });
  const handleSaveTpl = async () => {
    if (!tplModal?.name.trim()) return;
    const sw = sumWeights(tplModal.phases);
    if (sw !== 100 && !window.confirm(`La somme des poids est de ${sw}% (au lieu de 100%). Enregistrer quand même ?`)) return;
    setSavingTpl(true);
    try {
      const updated = await workflowTemplatesApi.update(tplModal.id, { name: tplModal.name.trim(), description: tplModal.description, is_default: tplModal.is_default ? 1 : 0, phases: JSON.stringify(resetPhases(tplModal.phases)) });
      /* Un seul modèle par défaut : les autres sont remis à 0 côté serveur */
      setWfTemplates(ts => ts.map(x => x.id === tplModal.id ? updated : (tplModal.is_default ? { ...x, is_default: 0 } : x)));
      setTplModal(null);
    } catch (e) { setError(e.message); }
    finally { setSavingTpl(false); }
  };

  const total = programs.reduce((s, p) => s + (Number(p.budget) || 0), 0).toFixed(1);
  const statProgs = programs.filter(p => !excludedProgs.includes(String(p.code)));
  const avgP  = statProgs.length ? Math.round(statProgs.reduce((s, p) => s + (Number(p.progress) || 0), 0) / statProgs.length) : 0;

  const cardProps = prog => ({
    prog,
    open: !!openProgs[prog.id],
    onToggle: () => toggleProg(prog.id),
    projs: projMap[prog.id] || [],
    loadingProj: !!loadingProj[prog.id],
    perms, currency, progressMode, defaultPhases, closedStatuses,
    onEditProg:   openEditProg,
    onDeleteProg: handleDeleteProg,
    onCreateProj: openCreateProj,
    onEditProj:   openEditProj,
    onDeleteProj: handleDeleteProj,
    onRDV:        openRdv,
  });

  const budgetGap = editProg && (editProg.projects_count || 0) > 0
    ? Math.round(((parseFloat(progForm.budget) || 0) - (Number(editProg.projects_budget) || 0)) * 100) / 100 : 0;

  return (
    <div className="fade-in">
      <HeroBanner eyebrow={`Portefeuille ${planShort} ${ref.planPeriod}`} title={`${programs.length} programmes prioritaires`}
        subtitle={`${ref.setting('plan_name')} · Suivi budgétaire et physique`}
        stats={[
          { value: programs.length, label: 'Programmes' },
          { value: programs.reduce((s,p) => s + (parseInt(p.projects_count)||0), 0), label: 'Projets total' },
          { value: total,           label: `${currency} total`, color: '#10b981' },
          { value: `${avgP}%`,      label: 'Avancement moyen' },
        ]}
        action={perms.progCreate ? { label: 'Nouveau programme', onClick: openCreateProg, icon: <LayoutGrid size={14}/> } : null} />

      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {/* ── Recherche ── */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textDim, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Rechercher un programme ou projet ${planShort}…`}
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
          {perms.axes && (
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
                            {perms.axes && (
                              <div style={{ display: 'flex', gap: 3, marginLeft: 6 }}>
                                <button onClick={() => openEditAxe(ax)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 4px', borderRadius: 4, lineHeight: 0 }}><Pencil size={11}/></button>
                                <button onClick={() => handleDeleteAxe(ax)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 4px', borderRadius: 4, lineHeight: 0 }}
                                  onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}><Trash2 size={11}/></button>
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: T.textDim, marginLeft: 'auto', fontFamily: 'DM Sans' }}>
                              {progs.length} programmes · {progs.reduce((a, p) => a + (parseInt(p.projects_count) || 0), 0)} projets
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
      <Modal open={progModal} onClose={() => setProgModal(false)} title={editProg ? `Modifier - ${editProg.code}` : 'Nouveau programme'} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Code *</label>
              <Input value={progForm.code} onChange={v => setProgForm(f => ({ ...f, code: v.toUpperCase() }))} placeholder="P13" />
            </div>
            <div>
              <label style={lbl}>Nom du programme *</label>
              <Input value={progForm.name} onChange={v => setProgForm(f => ({ ...f, name: v }))} placeholder="Intitulé du programme" />
            </div>
          </div>
          <div>
            <label style={lbl}>Axe {planShort} *</label>
            <Select value={progForm.axis_id} onChange={v => setProgForm(f => ({ ...f, axis_id: v }))} style={{ width: '100%' }}>
              <option value="">- Sélectionner un axe -</option>
              {axes.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </div>
          <div>
            <label style={lbl}>Description</label>
            <Input value={progForm.description} onChange={v => setProgForm(f => ({ ...f, description: v }))} placeholder="Périmètre et objectifs stratégiques" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Budget ({currency})</label>
              <Input value={progForm.budget} onChange={v => setProgForm(f => ({ ...f, budget: v }))} type="number" placeholder="0.0" />
            </div>
            <div>
              <label style={lbl}>Avancement (%)</label>
              <Input value={progressMode === 'projects' && editProg?.projects_progress != null ? String(editProg.projects_progress) : progForm.progress}
                onChange={v => setProgForm(f => ({ ...f, progress: v }))} type="number" placeholder="0-100" disabled={progressMode === 'projects'} />
            </div>
            <div>
              <label style={lbl}>Statut</label>
              <Select value={progForm.status} onChange={v => setProgForm(f => ({ ...f, status: v }))} style={{ width: '100%' }}>
                {progStatuses.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                {progForm.status && !progStatuses.some(s => s.code === progForm.status) && <option value={progForm.status}>{progForm.status}</option>}
              </Select>
            </div>
          </div>
          {(progressMode === 'projects' || (editProg && editProg.projects_progress != null)) && (
            <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: -6, lineHeight: 1.5 }}>
              {progressMode === 'projects'
                ? <>Avancement calculé automatiquement depuis les projets (pondéré par budget){editProg?.projects_progress == null ? ' - aucun projet : valeur manuelle conservée' : ''}.</>
                : <>Avancement calculé depuis les projets : <b style={{ color: '#06b6d4' }}>{editProg.projects_progress}%</b> (saisie manuelle : {progForm.progress || 0}%).</>}
            </div>
          )}
          {budgetGap !== 0 && (
            <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '6px 10px' }}>
              ⚠ Écart budgétaire : programme {parseFloat(progForm.budget) || 0} vs somme des projets {editProg.projects_budget} {currency} ({budgetGap > 0 ? '+' : ''}{budgetGap})
            </div>
          )}
          <div>
            <label style={{ ...lbl, marginBottom: 8 }}>Couleur</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AX_COLORS.map(c => (
                <button key={c} onClick={() => setProgForm(f => ({ ...f, color: c }))}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: progForm.color === c ? `3px solid #fff` : `2px solid transparent`,
                    cursor: 'pointer', outline: progForm.color === c ? `2px solid ${c}` : 'none', transition: 'all .15s' }} />
              ))}
              <input type="color" value={progForm.color || '#3b82f6'} onChange={e => setProgForm(f => ({ ...f, color: e.target.value }))}
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
              <label style={lbl}>Code *</label>
              <Input value={axeForm.code} onChange={v => setAxeForm(f => ({ ...f, code: v }))} placeholder="A1" />
            </div>
            <div>
              <label style={lbl}>Libellé *</label>
              <Input value={axeForm.label} onChange={v => setAxeForm(f => ({ ...f, label: v }))} placeholder="Intitulé de l'axe" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 12 }}>
            <div>
              <label style={{ ...lbl, marginBottom: 8 }}>Couleur</label>
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
              <label style={lbl}>Ordre</label>
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
                  <div style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans', minWidth: 24 }}>{a.code}</div>
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
      <Modal open={projModal} onClose={() => setProjModal(false)} title={editProj ? 'Modifier le projet' : 'Nouveau projet'} width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Infos générales */}
          <div>
            <label style={lbl}>Nom du projet *</label>
            <Input value={projForm.name} onChange={v => setProjForm(f => ({ ...f, name: v }))} placeholder="Intitulé du projet" />
          </div>
          <div>
            <label style={lbl}>Description / Entité</label>
            <Textarea value={projForm.description} onChange={v => setProjForm(f => ({ ...f, description: v }))} placeholder="Objectifs, périmètre, entité responsable..." rows={2} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Budget ({currency})</label>
              <Input value={projForm.budget} onChange={v => setProjForm(f => ({ ...f, budget: v }))} type="number" placeholder="0.0" />
            </div>
            <div>
              <label style={lbl}>Début projet</label>
              <Input value={projForm.start_date} onChange={v => setProjForm(f => ({ ...f, start_date: v }))} type="date" />
            </div>
            <div>
              <label style={lbl}>Fin projet</label>
              <Input value={projForm.end_date} onChange={v => setProjForm(f => ({ ...f, end_date: v }))} type="date" />
            </div>
          </div>
          <div>
            <label style={lbl}>Chef de projet</label>
            <Select value={projForm.responsible} onChange={v => setProjForm(f => ({ ...f, responsible: v }))} style={{ width: '100%' }}>
              <option value="">- Non assigné -</option>
              {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name} · {m.role}</option>)}
            </Select>
          </div>

          <div>
            <label style={lbl}>Statut du projet</label>
            <Select value={projForm.status || ''} onChange={v => setProjForm(f => ({ ...f, status: v }))} style={{ width: '100%' }}>
              <optgroup label="Phase en cours">
                {(projForm.phases || []).map(ph => <option key={ph.key} value={ph.key}>{ph.label}</option>)}
              </optgroup>
              <optgroup label="Clôture">
                {closedStatuses.map(c => <option key={c} value={c}>{ref.label('project_status', c)}</option>)}
              </optgroup>
              {projForm.status && !(projForm.phases || []).some(ph => ph.key === projForm.status) && !closedStatuses.includes(projForm.status) &&
                <option value={projForm.status}>{projForm.status}</option>}
            </Select>
          </div>

          {/* ── Workflow phases dynamique ── */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            <PhaseEditor phases={projForm.phases || []} status={projForm.status}
              onChange={ps => setProjForm(f => ({ ...f, phases: ps }))}
              onStatus={st => setProjForm(f => ({ ...f, status: st }))}
              onPhasesAndStatus={(ps, st) => setProjForm(f => ({ ...f, phases: ps, status: st }))}>
              {/* ── Templates : appliquer / enregistrer / modifier / supprimer ── */}
              <div style={{ marginBottom: 12 }}>
                {perms.tplCreate && (!showTplSave ? (
                  <button onClick={() => { setShowTplSave(true); setTplNameInput(''); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600,
                      padding: '5px 12px', borderRadius: 6, border: `1px solid #10b98155`, background: 'rgba(16,185,129,0.08)',
                      color: '#10b981', cursor: 'pointer' }}>
                    <Plus size={11} /> Enregistrer comme template réutilisable
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={tplNameInput} onChange={e => setTplNameInput(e.target.value)}
                      placeholder="Nom du template (ex: Cycle standard)…" autoFocus
                      onKeyDown={e => e.key === 'Enter' && !savingTpl && tplNameInput.trim() && document.getElementById('btn-save-tpl')?.click()}
                      style={{ flex: 1, background: '#0d1b30', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', color: T.text, fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }} />
                    <button id="btn-save-tpl" disabled={savingTpl || !tplNameInput.trim()} onClick={async () => {
                      if (!tplNameInput.trim()) return;
                      setSavingTpl(true);
                      try {
                        const created = await workflowTemplatesApi.create({ name: tplNameInput.trim(), phases: JSON.stringify(resetPhases(projForm.phases || [])) });
                        setWfTemplates(ts => [...ts, created]);
                        setShowTplSave(false);
                      } catch (e2) { setError(e2.message); }
                      finally { setSavingTpl(false); }
                    }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans', cursor: savingTpl ? 'wait' : 'pointer', opacity: !tplNameInput.trim() ? 0.5 : 1 }}>
                      {savingTpl ? '…' : 'Enregistrer'}
                    </button>
                    <button onClick={() => setShowTplSave(false)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {wfTemplates.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {wfTemplates.map(t => (
                      <div key={t.id} title={t.description || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, borderRadius: 6, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                        <button onClick={() => applyTemplate(t)} style={{ padding: '4px 10px', background: 'transparent', border: 'none', color: T.textMuted, fontSize: 11, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: 500 }}>
                          📋 {t.name}{Number(t.is_default) === 1 ? ' ★' : ''}
                        </button>
                        {perms.tplUpdate && (
                          <button onClick={() => openEditTpl(t)} title="Modifier le template"
                            style={{ padding: '4px 6px', background: 'transparent', border: 'none', borderLeft: `1px solid ${T.border}`, color: T.textDim, cursor: 'pointer', lineHeight: 0 }}>
                            <Pencil size={9} />
                          </button>
                        )}
                        {perms.tplDelete && (
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
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PhaseEditor>
          </div>
        </div>
        <ModalFooter onCancel={() => setProjModal(false)} onConfirm={handleSaveProj} loading={savingProj}
          confirmLabel={editProj ? 'Mettre à jour' : 'Créer'}
          color={programs.find(p => p.id === projProgId)?.color || '#06b6d4'} />
      </Modal>

      {/* ── Modal modifier un template de workflow ── */}
      <Modal open={!!tplModal} onClose={() => setTplModal(null)} title="Modifier le template" width={560}>
        {tplModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Nom *</label>
              <Input value={tplModal.name} onChange={v => setTplModal(t => ({ ...t, name: v }))} placeholder="Nom du template" />
            </div>
            <div>
              <label style={lbl}>Description</label>
              <Textarea value={tplModal.description} onChange={v => setTplModal(t => ({ ...t, description: v }))} rows={2} placeholder="Usage, cycle couvert…" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!tplModal.is_default} onChange={e => setTplModal(t => ({ ...t, is_default: e.target.checked }))} />
              Modèle par défaut <span style={{ fontSize: 11, color: T.textDim }}>(appliqué aux nouveaux projets)</span>
            </label>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <PhaseEditor phases={tplModal.phases} onChange={ps => setTplModal(t => ({ ...t, phases: ps }))} />
            </div>
          </div>
        )}
        <ModalFooter onCancel={() => setTplModal(null)} onConfirm={handleSaveTpl} loading={savingTpl} confirmLabel="Mettre à jour" color="#10b981" />
      </Modal>

      {/* ── Modal Rendez-vous projet ── */}
      <Modal open={rdvModal} onClose={() => setRdvModal(false)} title={`Rendez-vous - ${rdvProject?.name || ''}`} width={580}>
        {/* Formulaire ajout/édition */}
        {perms.rdvEdit && (
        <div style={{ background: 'rgba(6,182,212,0.04)', border: `1px solid rgba(6,182,212,0.15)`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', fontFamily: 'DM Sans', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            {editRdv ? 'Modifier le rendez-vous' : 'Ajouter un rendez-vous'}
          </div>
          <Input placeholder="Intitulé du rendez-vous *" value={rdvForm.title} onChange={v => setRdvForm(f => ({ ...f, title: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <Input value={rdvForm.date} onChange={v => setRdvForm(f => ({ ...f, date: v }))} type="date" />
            <Input value={rdvForm.time} onChange={v => setRdvForm(f => ({ ...f, time: v }))} type="time" />
            <Select value={rdvForm.type} onChange={v => setRdvForm(f => ({ ...f, type: v }))}>
              {meetingTypes.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              {rdvForm.type && !meetingTypes.some(t => t.code === rdvForm.type) && <option value={rdvForm.type}>{rdvForm.type}</option>}
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
        )}

        {/* Liste des rendez-vous */}
        {rdvLoading
          ? <div style={{ textAlign: 'center', padding: 20 }}><Spinner size={24} /></div>
          : meetings.length === 0
          ? <div style={{ textAlign: 'center', padding: '16px 0', color: T.textDim, fontSize: 12, fontFamily: 'DM Sans' }}>Aucun rendez-vous enregistré</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {meetings.map(m => {
                const isPast = m.date && new Date(m.date) < new Date();
                const tColor = ref.color('meeting_type', m.type, '#06b6d4');
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, opacity: isPast ? 0.7 : 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4', fontFamily: 'DM Sans', lineHeight: 1 }}>{m.date?.slice(8, 10)}</div>
                      <div style={{ fontSize: 9, color: T.textDim, fontFamily: 'DM Sans', textTransform: 'uppercase' }}>{monthShort(m.date)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, color: T.text }}>{m.title}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>{m.time || ''}</span>
                        <span style={{ fontSize: 10, background: `${tColor}1a`, color: tColor, fontFamily: 'DM Sans', padding: '1px 6px', borderRadius: 4 }}>{ref.label('meeting_type', m.type)}</span>
                        {m.participants && <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>👥 {m.participants}</span>}
                      </div>
                      {m.notes && <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, fontStyle: 'italic', fontFamily: 'DM Sans', lineHeight: 1.4 }}>{m.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {perms.rdvEdit && (
                        <button onClick={() => { setEditRdv(m); setRdvForm({ title: m.title, date: m.date, time: m.time || '', type: m.type, participants: m.participants || '', notes: m.notes || '' }); }}
                          style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}>
                          <Pencil size={11} />
                        </button>
                      )}
                      {perms.rdvDelete && (
                        <button onClick={() => handleDeleteRdv(m.id)}
                          style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}>
                          <Trash2 size={11} />
                        </button>
                      )}
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

/* ── Éditeur de phases (projet : avec statut, avancement et dates ; template : structure seule) ── */
function PhaseEditor({ phases, status, onChange, onStatus, onPhasesAndStatus, children }) {
  const projectMode = !!onStatus;
  const [expanded, setExpanded] = useState({});
  const activeIdx = projectMode ? phases.findIndex(p => p.key === status) : -1;
  const global    = computeGlobal(phases);
  const sumW      = sumWeights(phases);
  const numIn     = v => Math.min(100, Math.max(0, parseInt(v) || 0));

  const setPhase = (i, field, val) => onChange(phases.map((p, j) => j === i ? { ...p, [field]: val } : p));
  const activate = i => {
    const ps = [...phases];
    const today = new Date().toISOString().slice(0, 10);
    if (!ps[i].start_date) ps[i] = { ...ps[i], start_date: today };
    onPhasesAndStatus(ps, ps[i].key);
  };
  const addPhase = () => onChange([...phases, { key: `phase_${Date.now()}`, label: 'Nouvelle phase', color: AX_COLORS[phases.length % AX_COLORS.length], weight: 0, start_date: '', end_date: '', progress: 0 }]);
  const removePhase = i => {
    if (!window.confirm(`Supprimer la phase « ${phases[i].label} » ?`)) return;
    const ps = phases.filter((_, j) => j !== i);
    if (projectMode && phases[i].key === status) onPhasesAndStatus(ps, (ps[i] || ps[i - 1])?.key || '');
    else onChange(ps);
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= phases.length) return;
    const ps = [...phases]; [ps[i], ps[j]] = [ps[j], ps[i]];
    onChange(ps);
  };

  const iconBtn = { background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', lineHeight: 0, padding: 2 };
  const weightIn = (ph, i, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <input type="number" min={0} max={100} value={ph.weight} title="Poids"
        onChange={e => setPhase(i, 'weight', numIn(e.target.value))}
        style={{ width: 44, background: '#0d1b30', border: `1px solid ${color}44`, borderRadius: 5, padding: '3px 4px', color, fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans', textAlign: 'center', outline: 'none' }} />
      <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'DM Sans' }}>%</span>
    </div>
  );

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: T.textDim, fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Workflow</div>
        <div style={{ fontSize: 11, fontFamily: 'DM Sans', fontWeight: 700, color: sumW === 100 ? '#10b981' : '#f59e0b' }}>
          Σ {sumW}% {sumW !== 100 ? '⚠' : '✓'}
        </div>
        {projectMode && <div style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, color: '#06b6d4' }}>{global}% global</div>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={addPhase} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, cursor: 'pointer' }}>
            <Plus size={11} /> Phase
          </button>
        </div>
      </div>
      {sumW !== 100 && phases.length > 0 && (
        <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: '#f59e0b', marginBottom: 10 }}>
          ⚠ La somme des poids doit être égale à 100 % (actuellement {sumW} %).
        </div>
      )}
      {children}

      {phases.map((ph, i) => {
        const active = projectMode && i === activeIdx;
        const done   = projectMode && !active && (activeIdx === -1 || i < activeIdx);
        const open   = active || !!expanded[ph.key];
        const late   = projectMode && ph.end_date && new Date(ph.end_date) < new Date() && ph.progress < 100;
        const color  = ph.color || '#06b6d4';
        const box = active
          ? { marginBottom: 10, padding: '12px 14px', borderRadius: 8, background: `${color}0d`, border: `2px solid ${color}50` }
          : done
            ? { marginBottom: 6, padding: '7px 12px', borderRadius: 8, background: `${color}08`, border: `1px solid ${color}25` }
            : { marginBottom: 6, padding: '8px 12px', borderRadius: 8, background: `${color}06`, border: `1px solid ${T.border}` };

        return (
          <div key={ph.key || i} style={box}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {done
                ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}><circle cx="7.5" cy="7.5" r="7.5" fill={color}/><polyline points="3.5,7.5 6.5,10.5 11.5,4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : active
                  ? <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
                  : <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, opacity: 0.35, flexShrink: 0 }} />}
              <input value={ph.label} onChange={e => setPhase(i, 'label', e.target.value)} placeholder="Nom de la phase"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'DM Sans', fontSize: active ? 13 : 12, fontWeight: 700, color: done || active ? color : T.textMuted }} />
              {weightIn(ph, i, active || done ? color : T.textMuted)}
              <input type="color" value={color} onChange={e => setPhase(i, 'color', e.target.value)} title="Couleur"
                style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
              {projectMode && (active
                ? <span style={{ fontSize: 10, background: `${color}20`, color, borderRadius: 4, padding: '2px 7px', fontFamily: 'DM Sans', fontWeight: 700 }}>Active</span>
                : <button onClick={() => activate(i)} title="Définir comme phase en cours"
                    style={{ background: 'none', border: `1px solid ${T.border}`, color: T.textDim, cursor: 'pointer', fontSize: 10, fontFamily: 'DM Sans', padding: '1px 6px', borderRadius: 4 }}>
                    activer
                  </button>)}
              {late && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, fontFamily: 'DM Sans' }}>⚠</span>}
              {projectMode && <div style={{ fontSize: active ? 15 : 12, fontWeight: active ? 800 : 700, color: ph.progress === 100 ? '#10b981' : (done || active ? color : T.textDim), fontFamily: 'DM Sans', minWidth: 30, textAlign: 'right' }}>{ph.progress || 0}%</div>}
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Monter" style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={11} /></button>
              <button onClick={() => move(i, 1)} disabled={i === phases.length - 1} title="Descendre" style={{ ...iconBtn, opacity: i === phases.length - 1 ? 0.3 : 1 }}><ChevronDown size={11} /></button>
              {projectMode && !active && (
                <button onClick={() => setExpanded(x => ({ ...x, [ph.key]: !x[ph.key] }))} title="Avancement et dates"
                  style={{ ...iconBtn, fontSize: 10, fontFamily: 'DM Sans', lineHeight: 1, padding: '1px 4px' }}>
                  {open ? 'fermer' : 'détails'}
                </button>
              )}
              <button onClick={() => removePhase(i)} title="Supprimer" style={iconBtn}
                onMouseEnter={e => e.currentTarget.style.color='#ef4444'} onMouseLeave={e => e.currentTarget.style.color=T.textDim}>
                <Trash2 size={10} />
              </button>
            </div>

            {projectMode && open && (
              <div style={{ marginTop: 10 }}>
                {/* Barre cliquable */}
                <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 10, cursor: 'pointer' }}
                  onClick={e => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setPhase(i, 'progress', numIn(Math.round(((e.clientX - r.left) / r.width) * 100)));
                  }}>
                  <div style={{ width: `${ph.progress || 0}%`, height: '100%', background: `linear-gradient(90deg,${color}99,${color})`, borderRadius: 4, transition: 'width .12s' }} />
                </div>
                {/* Dates + % */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim, display: 'block', marginBottom: 3 }}>Début</label>
                    <Input value={ph.start_date || ''} onChange={v => setPhase(i, 'start_date', v)} type="date" />
                  </div>
                  <div>
                    <label style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim, display: 'block', marginBottom: 3 }}>Fin prévue {late && <span style={{ color: '#ef4444' }}>⚠ dépassée</span>}</label>
                    <Input value={ph.end_date || ''} onChange={v => setPhase(i, 'end_date', v)} type="date" />
                  </div>
                  <input type="number" min={0} max={100} value={ph.progress || 0}
                    onChange={e => setPhase(i, 'progress', numIn(e.target.value))}
                    style={{ width: 58, background: '#0d1b30', border: `1px solid ${color}55`, borderRadius: 6, padding: '8px 6px', color, fontSize: 14, fontWeight: 800, fontFamily: 'DM Sans', textAlign: 'center', outline: 'none' }} />
                </div>
                {/* Bouton phase suivante si 100% */}
                {active && ph.progress === 100 && i < phases.length - 1 && (
                  <button onClick={() => activate(i + 1)}
                    style={{ marginTop: 10, width: '100%', padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700,
                      background: `linear-gradient(90deg,${color}25,${phases[i+1].color}25)`, color: phases[i+1].color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    ✓ Démarrer « {phases[i+1].label} » →
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Carte Programme (style new_version) ── */
function ProgramCard({ prog, open, onToggle, projs, loadingProj, perms, currency, progressMode, defaultPhases, closedStatuses = [], onEditProg, onDeleteProg, onCreateProj, onEditProj, onDeleteProj, onRDV }) {
  const ref = useRefData();   // libellés des statuts de projet hors phases
  const pColor = prog.color || '#06b6d4';
  const hasProjProgress = prog.projects_progress != null;
  const budgetGap = (prog.projects_count || 0) > 0 && Math.abs((Number(prog.budget) || 0) - (Number(prog.projects_budget) || 0)) > 0.005;

  return (
    <div style={{ background: T.surface, border: `1px solid ${open ? pColor + '40' : T.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color .2s' }}>

      {/* ── En-tête programme ── */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: pColor, minWidth: 36, fontFamily: 'DM Sans' }}>{prog.code}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'EB Garamond', fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{prog.name}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, fontFamily: 'DM Sans' }}>
            {prog.projects_count || 0} projets · {prog.budget} {currency}
            {budgetGap && <span title={`Somme des budgets projets : ${prog.projects_budget} ${currency}`} style={{ color: '#f59e0b', marginLeft: 6 }}>⚠ écart projets : {prog.projects_budget} {currency}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge status={prog.status} domain="program_status" />
          {(perms.progUpdate || perms.progDelete) && (
            <div style={{ display: 'flex', gap: 2 }}>
              {perms.progUpdate && (
                <button onClick={e => onEditProg(prog, e)}
                  style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 5px', borderRadius: 5, lineHeight: 0 }}
                  title="Modifier le programme">
                  <Pencil size={12} />
                </button>
              )}
              {perms.progDelete && (
                <button onClick={e => onDeleteProg(prog, e)}
                  style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 5px', borderRadius: 5, lineHeight: 0 }}
                  title="Supprimer le programme"
                  onMouseEnter={ev => ev.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={ev => ev.currentTarget.style.color = T.textDim}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pColor, fontFamily: 'DM Sans' }}>{prog.progress}%</div>
            <div style={{ width: 70, marginTop: 4 }}><ProgressBar value={prog.progress} color={pColor} height={4} /></div>
            {hasProjProgress && progressMode !== 'projects' && (
              <div title="Avancement calculé depuis les projets (pondéré par budget)" style={{ fontSize: 9, color: T.textDim, fontFamily: 'DM Sans', marginTop: 3 }}>projets : {prog.projects_progress}%</div>
            )}
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
            {perms.projCreate && (
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
                    const phases   = parsePhases(proj, defaultPhases);
                    const phIdx    = phases.findIndex(p => p.key === proj.status);
                    const activePh = phases[phIdx];
                    const closed   = closedStatuses.includes(proj.status);
                    const late     = !closed && isProjectLate(phases);
                    const stLabel  = activePh?.label || (closed ? ref.label('project_status', proj.status) : proj.status);
                    const pct = proj.progress || 0;
                    const pc  = activePh?.color || '#06b6d4';
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
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5, flexWrap: 'wrap' }}>
                                {phases.map((ph, i) => {
                                  const done   = phIdx === -1 ? true : i < phIdx;
                                  const active = i === phIdx;
                                  return (
                                    <div key={ph.key || i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                      {i > 0 && <div style={{ width: 10, height: 1, background: done ? `${ph.color}60` : T.border }} />}
                                      <div title={`${ph.label} : ${ph.progress}%`} style={{
                                        width: active ? 8 : 6, height: active ? 8 : 6, borderRadius: '50%', flexShrink: 0,
                                        background: done || active ? ph.color : T.border,
                                        opacity: done || active ? 1 : 0.3,
                                        boxShadow: active ? `0 0 5px ${ph.color}` : 'none',
                                      }} />
                                    </div>
                                  );
                                })}
                                <div style={{ marginLeft: 5, fontSize: 10, color: activePh?.color || T.textDim, fontFamily: 'DM Sans', fontWeight: 600 }}>
                                  {stLabel}
                                </div>
                                {late && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, fontFamily: 'DM Sans', marginLeft: 4 }}>⚠ retard</span>}
                              </div>
                              {activePh && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ width: `${activePh.progress}%`, height: '100%', background: late ? '#ef4444' : activePh.color, borderRadius: 2, transition: 'width .3s' }} />
                                  </div>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: late ? '#ef4444' : activePh.color, fontFamily: 'DM Sans', minWidth: 24, textAlign: 'right' }}>{activePh.progress}%</div>
                                </div>
                              )}
                            </div>

                            <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <ProjBadge color={activePh?.color} label={stLabel} />
                              <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                                <button onClick={e => onRDV(proj, e)} title="Rendez-vous"
                                  style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}
                                  onMouseEnter={ev => ev.currentTarget.style.color = '#06b6d4'}
                                  onMouseLeave={ev => ev.currentTarget.style.color = T.textDim}>
                                  <CalendarDays size={11} />
                                </button>
                                {perms.projUpdate && (
                                  <button onClick={e => onEditProj(proj, prog.id, e)}
                                    style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}>
                                    <Pencil size={11} />
                                  </button>
                                )}
                                {perms.projDelete && (
                                  <button onClick={e => onDeleteProj(proj, prog.id, e)}
                                    style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 4px', borderRadius: 4 }}
                                    onMouseEnter={ev => ev.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={ev => ev.currentTarget.style.color = T.textDim}>
                                    <Trash2 size={11} />
                                  </button>
                                )}
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
