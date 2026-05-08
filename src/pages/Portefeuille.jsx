import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import { programsApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import HeroBanner from '../components/HeroBanner.jsx';
import { Badge, ProgressBar, Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea } from '../components/UI.jsx';
import { T } from '../theme.js';

/* ── Axes NDT ── */
const AXES_META = {
  "1": { color: "#3b82f6", label: "Souveraineté numérique" },
  "2": { color: "#14b8a6", label: "Digitalisation des services publics" },
  "3": { color: "#f59e0b", label: "Développement de l'économie numérique" },
  "4": { color: "#a78bfa", label: "Leadership africain dans le numérique" },
};

const codeToAx = code => {
  const n = parseInt(code?.replace('P', '')) || 0;
  if (n <= 3) return "1";
  if (n <= 6) return "2";
  if (n <= 9) return "3";
  return "4";
};

/* ── Workflow statuts projet ── */
const PROJ_STATUS = [
  { value: 'structuration', label: 'En structuration', color: '#f59e0b' },
  { value: 'maturation',    label: 'Maturation',       color: '#8b5cf6' },
  { value: 'execution',     label: 'En exécution',     color: '#06b6d4' },
  { value: 'cloture',       label: 'Clôturé',          color: '#6b7280' },
  { value: 'exploitation',  label: 'Exploitation',     color: '#10b981' },
];

const projColor = v => PROJ_STATUS.find(s => s.value === v)?.color || T.textDim;
const projLabel = v => PROJ_STATUS.find(s => s.value === v)?.label || v;
const pctFromStatus = s => ({ structuration: 15, maturation: 35, execution: 65, exploitation: 90, cloture: 100 })[s] || 0;

const PROG_EMPTY = { budget: '', progress: '', status: 'on_track' };
const PROJ_EMPTY = { name: '', description: '', budget: '', status: 'structuration', start_date: '', end_date: '', responsible: '' };

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

const ProjBadge = ({ status }) => {
  const c = projColor(status);
  return (
    <span style={{ background: `${c}18`, color: c, fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, border: `1px solid ${c}30`, whiteSpace: 'nowrap' }}>
      {projLabel(status)}
    </span>
  );
};

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
      const axOk = axFilter === 'all' || codeToAx(p.code) === axFilter;
      const q = search.toLowerCase();
      const srchOk = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
        (projMap[p.id] || []).some(pr => pr.name.toLowerCase().includes(q));
      return axOk && srchOk;
    }), [programs, projMap, axFilter, search]);

  /* ── Handlers programme ── */
  const openEditProg = (p, e) => {
    e.stopPropagation();
    setProgForm({ budget: String(p.budget || ''), progress: String(p.progress || ''), status: p.status || 'on_track' });
    setEditProg(p); setProgModal(true);
  };
  const handleSaveProg = async () => {
    setSavingProg(true);
    try {
      const updated = await programsApi.update(editProg.id, { budget: parseFloat(progForm.budget) || 0, progress: parseInt(progForm.progress) || 0, status: progForm.status });
      setPrograms(ps => ps.map(p => p.id === editProg.id ? { ...p, ...updated } : p));
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
    setProjForm({ name: proj.name || '', description: proj.description || '', budget: String(proj.budget || ''), status: proj.status || 'structuration', start_date: proj.start_date || '', end_date: proj.end_date || '', responsible: proj.responsible || '' });
    setEditProj(proj); setProjProgId(progId); setProjModal(true);
  };
  const handleSaveProj = async () => {
    if (!projForm.name) return;
    setSavingProj(true);
    try {
      const payload = { ...projForm, budget: parseFloat(projForm.budget) || 0 };
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
  const axes  = ["1", "2", "3", "4"];

  const cardProps = prog => ({
    prog,
    open: !!openProgs[prog.id],
    onToggle: () => toggleProg(prog.id),
    projs: projMap[prog.id] || [],
    loadingProj: !!loadingProj[prog.id],
    admin,
    onEditProg: openEditProg,
    onCreateProj: openCreateProj,
    onEditProj: openEditProj,
    onDeleteProj: handleDeleteProj,
  });

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

        {/* ── Recherche ── */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textDim, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un programme ou projet NDT…"
            style={{ width: '100%', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '9px 12px 9px 34px', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans' }} />
        </div>

        {/* ── Filtres axes ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {[['all', 'Tous les axes', '#3b82f6'], ...axes.map(ax => [ax, `Axe ${ax} — ${AXES_META[ax].label}`, AXES_META[ax].color])].map(([ax, lbl, col]) => (
            <button key={ax} onClick={() => setAxFilter(ax)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${axFilter === ax ? col : T.border}`,
                background: axFilter === ax ? `${col}20` : 'transparent', color: axFilter === ax ? col : T.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ── Liste des programmes ── */}
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          : axFilter === 'all'
            ? axes.map(ax => {
                const progs = filtered.filter(p => codeToAx(p.code) === ax);
                if (!progs.length) return null;
                const ac = AXES_META[ax];
                return (
                  <div key={ax} style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ width: 3, height: 24, background: ac.color, borderRadius: 2 }} />
                      <div style={{ fontFamily: 'EB Garamond', fontSize: 17, color: ac.color, fontWeight: 500 }}>
                        Axe {ax} — {ac.label}
                      </div>
                      <div style={{ fontSize: 11, color: T.textDim, marginLeft: 'auto', fontFamily: 'DM Sans' }}>
                        {progs.length} programmes · {progs.reduce((a, p) => a + (p.projects_count || 0), 0)} projets
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {progs.map(prog => <ProgramCard key={prog.id} {...cardProps(prog)} />)}
                    </div>
                  </div>
                );
              })
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(prog => <ProgramCard key={prog.id} {...cardProps(prog)} />)}
              </div>
        }
      </div>

      {/* ── Modal modifier programme ── */}
      <Modal open={progModal} onClose={() => setProgModal(false)} title={`${editProg?.code} — ${editProg?.name}`} width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Budget (Md FCFA)</label>
              <Input value={progForm.budget} onChange={v => setProgForm(f => ({ ...f, budget: v }))} type="number" placeholder="0.0" />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Avancement (%)</label>
              <Input value={progForm.progress} onChange={v => setProgForm(f => ({ ...f, progress: v }))} type="number" placeholder="0–100" />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Statut global</label>
            <Select value={progForm.status} onChange={v => setProgForm(f => ({ ...f, status: v }))} style={{ width: '100%' }}>
              <option value="on_track">✅ On track</option>
              <option value="attention">⚠ Attention</option>
              <option value="risque">🔴 Risque</option>
            </Select>
          </div>
        </div>
        <ModalFooter onCancel={() => setProgModal(false)} onConfirm={handleSaveProg} loading={savingProg} confirmLabel="Mettre à jour" color={editProg?.color || '#06b6d4'} />
      </Modal>

      {/* ── Modal créer/modifier projet ── */}
      <Modal open={projModal} onClose={() => setProjModal(false)} title={editProj ? 'Modifier le projet' : 'Nouveau projet'} width={540}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Nom du projet *</label>
            <Input value={projForm.name} onChange={v => setProjForm(f => ({ ...f, name: v }))} placeholder="Intitulé du projet" />
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Description / Entité</label>
            <Textarea value={projForm.description} onChange={v => setProjForm(f => ({ ...f, description: v }))} placeholder="Objectifs, périmètre, entité responsable..." rows={2} />
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 8 }}>Statut</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {PROJ_STATUS.map(s => (
                <button key={s.value} onClick={() => setProjForm(f => ({ ...f, status: s.value }))}
                  style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 8,
                    border: `1px solid ${projForm.status === s.value ? s.color : T.border}`,
                    background: projForm.status === s.value ? `${s.color}18` : 'transparent',
                    color: projForm.status === s.value ? s.color : T.textMuted, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Budget (Md FCFA)</label>
              <Input value={projForm.budget} onChange={v => setProjForm(f => ({ ...f, budget: v }))} type="number" placeholder="0.0" />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Date début</label>
              <Input value={projForm.start_date} onChange={v => setProjForm(f => ({ ...f, start_date: v }))} type="date" />
            </div>
            <div>
              <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Date fin</label>
              <Input value={projForm.end_date} onChange={v => setProjForm(f => ({ ...f, end_date: v }))} type="date" />
            </div>
          </div>
          <div>
            <label style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 }}>Responsable</label>
            <Input value={projForm.responsible} onChange={v => setProjForm(f => ({ ...f, responsible: v }))} placeholder="Chef de projet" />
          </div>
        </div>
        <ModalFooter onCancel={() => setProjModal(false)} onConfirm={handleSaveProj} loading={savingProj}
          confirmLabel={editProj ? 'Mettre à jour' : 'Créer'}
          color={programs.find(p => p.id === projProgId)?.color || '#06b6d4'} />
      </Modal>
    </div>
  );
}

/* ── Carte Programme (style new_version) ── */
function ProgramCard({ prog, open, onToggle, projs, loadingProj, admin, onEditProg, onCreateProj, onEditProj, onDeleteProj }) {
  const ax     = codeToAx(prog.code);
  const ac     = AXES_META[ax];
  const pColor = prog.color || ac.color;

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
            <button onClick={e => onEditProg(prog, e)}
              style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '3px 5px', borderRadius: 5, lineHeight: 0 }}
              title="Modifier le programme">
              <Pencil size={12} />
            </button>
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
                    const pct = pctFromStatus(proj.status);
                    const pc  = projColor(proj.status);
                    return (
                      <div key={proj.id}
                        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', position: 'relative', transition: 'border-color .2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, lineHeight: 1.4, paddingRight: 44, fontFamily: 'DM Sans' }}>{proj.name}</div>
                            {proj.description && (
                              <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, lineHeight: 1.4, fontFamily: 'DM Sans' }}>{proj.description}</div>
                            )}
                            {proj.responsible && (
                              <div style={{ fontSize: 10, color: T.textDim, marginTop: 3, fontFamily: 'DM Sans' }}>👤 {proj.responsible}</div>
                            )}
                            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <ProjBadge status={proj.status} />
                              {admin && (
                                <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
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
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Cercle progression positionné en haut à droite */}
                          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <CircleProgress pct={pct} color={pc} size={38} />
                            <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, marginTop: -22, textAlign: 'center', fontFamily: 'DM Sans' }}>{pct}%</div>
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