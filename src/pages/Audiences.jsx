import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp, ArrowRight, Calendar, Edit2, Trash2, Check, X } from 'lucide-react';
import { audiencesApi, teamApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Btn, Select, Textarea, Spinner, ErrorBanner, Modal, ModalFooter } from '../components/UI.jsx';
import { T } from '../theme.js';
import { useRefData } from '../context/RefContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { can } from '../permissions.js';

const EMPTY = { institution: '', contact: '', date: '', time: '', objet: '', status: '', priority: '', suite_a_donner: '', followup_date: '', notes: '' };

const parseActions = a => {
  try {
    const p = typeof a.actions_json === 'string' ? JSON.parse(a.actions_json) : (a.actions_json || []);
    return Array.isArray(p) ? p : [];
  } catch (_) { return []; }
};

/* Date locale (et non UTC) au format YYYY-MM-DD */
const todayStr = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const inpStyle = {
  background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6,
  padding: '7px 10px', color: T.text, fontSize: 12, fontFamily: 'DM Sans', outline: 'none',
};
const fieldLbl = { fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 };

/* Sélecteur responsable (membre d'équipe) : stocke responsible_id + responsible (nom, compatibilité) */
const memberOf = (teamMembers, ac) =>
  teamMembers.find(m => ac.responsible_id != null && String(m.id) === String(ac.responsible_id)) ||
  teamMembers.find(m => ac.responsible && m.name === ac.responsible);

function ResponsibleSelect({ value, onChange, teamMembers, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inpStyle, cursor: 'pointer', ...style }}>
      <option value="">— Responsable —</option>
      {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
    </select>
  );
}

function AudienceActions({ audience, onSave, teamMembers, canEdit }) {
  const ref = useRefData();
  const [title, setTitle]             = useState('');
  const [responsible, setResponsible] = useState('');
  const [deadline, setDeadline]       = useState('');
  const [editAc, setEditAc]           = useState(null); // { id, title, responsible_id, deadline }

  const actions  = parseActions(audience);
  const today    = todayStr();
  const isDone   = code => ref.has('action_status', code, 'closed');
  const done     = actions.filter(ac => isDone(ac.status)).length;
  /* Cycle de statut : ordre du référentiel (statuts actifs) */
  const stCodes  = ref.list('action_status').map(s => String(s.code));
  const firstOpen = stCodes.find(c => !isDone(c)) ?? stCodes[0] ?? null;
  const stOf     = code => ({ label: ref.label('action_status', code), color: ref.color('action_status', code, '#94a3b8') });

  const isLate = ac => ac.deadline && ac.deadline < today && !isDone(ac.status);
  const respFields = id => {
    const m = teamMembers.find(x => String(x.id) === String(id));
    return { responsible_id: m ? m.id : null, responsible: m ? m.name : '' };
  };

  const add = () => {
    if (!title.trim()) return;
    onSave(audience, [
      ...actions,
      { id: Date.now(), title: title.trim(), status: firstOpen, deadline, ...respFields(responsible) },
    ]);
    setTitle(''); setResponsible(''); setDeadline('');
  };

  const cycleAc  = id => {
    if (!stCodes.length) return;
    onSave(audience, actions.map(ac => {
      if (ac.id !== id) return ac;
      const i = stCodes.indexOf(String(ac.status));
      return { ...ac, status: stCodes[(i + 1) % stCodes.length] };
    }));
  };
  const deleteAc = id => onSave(audience, actions.filter(ac => ac.id !== id));
  const startEdit = ac => {
    const sel = memberOf(teamMembers, ac)?.id ?? '';
    setEditAc({ id: ac.id, title: ac.title || '', responsible_id: sel, initialSel: String(sel), deadline: ac.deadline || '', legacy: ac.responsible || '' });
  };
  const saveEdit = () => {
    if (!editAc?.title.trim()) return;
    onSave(audience, actions.map(ac => {
      if (ac.id !== editAc.id) return ac;
      // Sélection inchangée (membre désactivé absent de la liste active, ou texte libre historique) : responsable d'origine conservé (id + nom)
      const unchanged = String(editAc.responsible_id) === editAc.initialSel;
      const resp = unchanged
        ? { responsible_id: ac.responsible_id ?? null, responsible: ac.responsible || '' }
        : respFields(editAc.responsible_id);
      return { ...ac, title: editAc.title.trim(), deadline: editAc.deadline, ...resp };
    }));
    setEditAc(null);
  };

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
      <div style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b5cf6', marginBottom: 10 }}>
        Actions post-audience · {done}/{actions.length} réalisées
      </div>

      {actions.length === 0 && (
        <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textDim, fontStyle: 'italic', marginBottom: 10 }}>
          Aucune action définie
        </div>
      )}

      {actions.map(ac => {
        const st   = stOf(ac.status);
        const late = isLate(ac);
        const respName = memberOf(teamMembers, ac)?.name || ac.responsible;
        if (editAc?.id === ac.id) return (
          <div key={ac.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <input value={editAc.title} onChange={e => setEditAc(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && saveEdit()}
              placeholder="Titre de l'action *" style={inpStyle} autoFocus />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <ResponsibleSelect value={editAc.responsible_id} onChange={v => setEditAc(p => ({ ...p, responsible_id: v }))} teamMembers={teamMembers} style={{ flex: 1 }} />
              <input type="date" value={editAc.deadline} onChange={e => setEditAc(p => ({ ...p, deadline: e.target.value }))} style={{ ...inpStyle, width: 150 }} />
              <button onClick={saveEdit} title="Enregistrer" style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 4, lineHeight: 0 }}><Check size={14} /></button>
              <button onClick={() => setEditAc(null)} title="Annuler" style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: 4, lineHeight: 0 }}><X size={14} /></button>
            </div>
            {editAc.legacy && !memberOf(teamMembers, ac) && String(editAc.responsible_id) === editAc.initialSel && <span style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim }}>Responsable actuel (hors liste active) : {editAc.legacy}</span>}
          </div>
        );
        return (
          <div key={ac.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => canEdit && cycleAc(ac.id)} title="Changer le statut"
              style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${st.color}`, background: isDone(ac.status) ? st.color : 'transparent', flexShrink: 0, cursor: canEdit ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              {isDone(ac.status) && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
              {!isDone(ac.status) && ac.status !== firstOpen && <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: isDone(ac.status) ? T.textDim : T.text, textDecoration: isDone(ac.status) ? 'line-through' : 'none' }}>
                {ac.title}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                {respName && (
                  <span style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim }}>👤 {respName}</span>
                )}
                {ac.deadline && (
                  <span style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: late ? 700 : 400, color: late ? '#ef4444' : T.textDim, display: 'flex', alignItems: 'center', gap: 3 }}>
                    📅 {ac.deadline}
                    {late && <span style={{ background: '#ef444422', color: '#ef4444', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>⚠ En retard</span>}
                  </span>
                )}
              </div>
            </div>

            <span style={{ fontSize: 10, fontFamily: 'DM Sans', color: st.color, fontWeight: 600, minWidth: 55, textAlign: 'right', marginTop: 2 }}>{st.label}</span>
            {canEdit && <>
              <button onClick={() => startEdit(ac)} title="Modifier"
                style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 4px', lineHeight: 0, borderRadius: 4, marginTop: 2 }}
                onMouseEnter={e => e.currentTarget.style.color = T.teal}
                onMouseLeave={e => e.currentTarget.style.color = T.textDim}>
                <Edit2 size={11} />
              </button>
              <button onClick={() => deleteAc(ac.id)} title="Supprimer"
                style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 4px', lineHeight: 0, borderRadius: 4, marginTop: 2 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = T.textDim}>
                <Trash2 size={11} />
              </button>
            </>}
          </div>
        );
      })}

      {/* Formulaire d'ajout */}
      {canEdit && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Titre de l'action *"
              onKeyDown={e => e.key === 'Enter' && add()}
              style={{ ...inpStyle, flex: 1 }} />
            <button onClick={add}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans', cursor: 'pointer', flexShrink: 0 }}>
              + Ajouter
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <ResponsibleSelect value={responsible} onChange={setResponsible} teamMembers={teamMembers} style={{ flex: 1 }} />
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              style={{ ...inpStyle, width: 150 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Audiences() {
  const ref = useRefData();
  const { user } = useAuth();
  const canWrite  = can(user, 'analyst');
  const canDelete = can(user, 'director');

  const [items, setItems]           = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all');
  const [expanded, setExpanded]     = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [editId, setEditId]         = useState(null);

  const load = useCallback(() => {
    Promise.all([audiencesApi.list(), teamApi.list().catch(() => [])])
      .then(([auds, team]) => { setItems(auds); setTeamMembers(team); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const statusList   = ref.list('audience_status');
  const priorityList = ref.list('priority');
  const isHeld    = code => ref.has('audience_status', code, 'held');
  const isOpen    = code => ref.has('audience_status', code, 'open');
  const isActDone = code => ref.has('action_status', code, 'closed');
  const firstHeld   = statusList.find(s => isHeld(s.code))?.code ?? ref.codes('audience_status', 'held')[0];
  const firstOpenSt = statusList.find(s => isOpen(s.code))?.code ?? ref.codes('audience_status', 'open')[0];

  /* Filtres générés depuis les référentiels : s:<statut>, p:<priorité> (priorités affichées si utilisées) */
  const filters = [
    ['all', 'Toutes'],
    ...statusList.map(s => [`s:${s.code}`, s.label]),
    ['suivi', 'Suites à donner'],
    ...priorityList.filter(p => items.some(a => a.priority === p.code)).map(p => [`p:${p.code}`, p.label]),
  ];

  const filtered = items.filter(a => {
    if (filter === 'suivi')  return isHeld(a.status) && a.suite_a_donner;
    if (filter === 'all')    return true;
    if (filter.startsWith('s:')) return a.status === filter.slice(2);
    if (filter.startsWith('p:')) return a.priority === filter.slice(2);
    return true;
  });

  const openCreate = () => {
    const defPriority = priorityList.find(p => ref.has('priority', p.code, 'high'))?.code || priorityList[0]?.code || '';
    setForm({ ...EMPTY, status: firstOpenSt || statusList[0]?.code || '', priority: defPriority });
    setEditId(null); setShowModal(true);
  };
  const openEdit   = a  => {
    setForm({ institution: a.institution, contact: a.contact || '', date: a.date || '', time: a.time || '', objet: a.objet || '', status: a.status, priority: a.priority, suite_a_donner: a.suite_a_donner || '', followup_date: a.followup_date || '', notes: a.notes || '' });
    setEditId(a.id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.institution) { setError('Institution requise'); return; }
    setSaving(true);
    try {
      if (editId) {
        const u = await audiencesApi.update(editId, form);
        if (u) setItems(prev => prev.map(a => a.id === editId ? u : a)); else load();
      } else {
        const n = await audiencesApi.create(form);
        if (n) setItems(prev => [n, ...prev]); else load();
      }
      setShowModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async a => {
    try {
      const next = isHeld(a.status) ? firstOpenSt : firstHeld;
      if (!next) return setError("Référentiel des statuts d'audience incomplet");
      const u = await audiencesApi.updateStatus(a.id, next);
      if (u) setItems(prev => prev.map(i => i.id === a.id ? u : i)); else load();
    } catch (e) { setError(e.message); }
  };

  const remove = async a => {
    if (!window.confirm(`Supprimer l'audience « ${a.institution} » ?`)) return;
    try {
      await audiencesApi.delete(a.id);
      setItems(prev => prev.filter(i => i.id !== a.id));
      if (expanded === a.id) setExpanded(null);
    } catch (e) { setError(e.message); }
  };

  const saveActions = async (audience, actions) => {
    try {
      const u = await audiencesApi.update(audience.id, { actions_json: JSON.stringify(actions) });
      if (u) setItems(prev => prev.map(i => i.id === audience.id ? u : i)); else load();
    } catch (e) { setError(e.message); }
  };

  const today = todayStr();
  const allActions = items.flatMap(parseActions);
  const lateActions = allActions.filter(ac => ac.deadline && ac.deadline < today && !isActDone(ac.status));
  const counts = {
    total: items.length,
    planifiees: items.filter(a => isOpen(a.status)).length,
    tenues: items.filter(a => isHeld(a.status)).length,
    suivi: items.filter(a => isHeld(a.status) && a.suite_a_donner).length,
    actions: allActions.filter(ac => !isActDone(ac.status)).length,
    lateActions: lateActions.length,
  };

  const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none', width: '100%' };
  const withCurrent = (list, code) => list.some(i => i.code === code) || !code ? list : [...list, { code, label: code }];

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Audiences reçues" title="Registre des audiences & suivi" color="#8b5cf6"
        subtitle="Institutions, structures et partenaires · Suites à donner"
        stats={[
          { value: counts.total,       label: 'Enregistrées' },
          { value: counts.planifiees,  label: 'À venir',           color: '#f59e0b' },
          { value: counts.tenues,      label: 'Tenues',             color: '#10b981' },
          { value: counts.suivi,       label: 'Suites à donner',    color: '#8b5cf6' },
          { value: counts.actions,     label: 'Actions en cours',   color: '#ef4444' },
          { value: counts.lateActions, label: 'Actions en retard',  color: '#dc2626' },
        ]} />
      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
            {filters.map(([v,l]) => (
              <Btn key={v} onClick={() => setFilter(v)} variant={filter === v ? 'ghost' : 'outline'} color={filter === v ? '#8b5cf6' : T.textDim} size="sm">{l}</Btn>
            ))}
          </div>
          {canWrite && <Btn onClick={openCreate} color="#8b5cf6"><Plus size={14} /> Nouvelle audience</Btn>}
        </div>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(a => {
                const isExp = expanded === a.id;
                const stColor = ref.color('audience_status', a.status, T.textDim);
                return (
                  <Card key={a.id}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : a.id)}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: stColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <h4 style={{ fontFamily: 'EB Garamond', fontSize: 17, color: T.text }}>{a.institution}</h4>
                          {a.contact && <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textDim }}>— {a.contact}</span>}
                          <Badge status={a.priority} domain="priority" /><Badge status={a.status} domain="audience_status" />
                        </div>
                        <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted, marginTop: 3 }}>{a.objet}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>{a.date}{a.time ? ` · ${a.time}` : ''}</span>
                        {a.suite_a_donner && isHeld(a.status) && <span style={{ fontFamily: 'DM Sans', fontSize: 9, fontWeight: 700, color: '#8b5cf6' }}>● SUITE</span>}
                      </div>
                      {isExp ? <ChevronUp size={16} color={T.textMuted} /> : <ChevronDown size={16} color={T.textMuted} />}
                    </div>
                    {isExp && (
                      <div style={{ borderTop: `1px solid ${T.border}`, padding: '16px 20px' }} className="slide-in">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                          <div style={{ background: '#8b5cf622', borderRadius: 10, padding: '14px 16px', border: '1px solid #8b5cf633' }}>
                            <div style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b5cf6', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ArrowRight size={12} /> Suite à donner
                            </div>
                            <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.text, lineHeight: 1.6 }}>{a.suite_a_donner || <span style={{ color: T.textDim, fontStyle: 'italic' }}>Aucune suite définie</span>}</p>
                            {a.followup_date && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={12} color={T.textDim} /><span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>Échéance : {a.followup_date}</span></div>}
                          </div>
                          <div>
                            <div style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textDim, marginBottom: 8 }}>Notes</div>
                            <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>{a.notes || <span style={{ color: T.textDim, fontStyle: 'italic' }}>Aucune note</span>}</p>
                            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {canWrite && <Btn onClick={() => openEdit(a)} variant="outline" color={T.teal} size="sm"><Edit2 size={12} /> Modifier</Btn>}
                              {canWrite && <Btn onClick={() => toggleStatus(a)} variant="outline" color={stColor} size="sm">{isHeld(a.status) ? `↩ ${ref.label('audience_status', firstOpenSt)}` : `✓ ${ref.label('audience_status', firstHeld)}`}</Btn>}
                              {canDelete && <Btn onClick={() => remove(a)} variant="outline" color="#ef4444" size="sm"><Trash2 size={12} /> Supprimer</Btn>}
                            </div>
                          </div>
                        </div>

                        <AudienceActions audience={a} onSave={saveActions} teamMembers={teamMembers} canEdit={canWrite} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? "Modifier l'audience" : 'Nouvelle audience'} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input placeholder="Institution *" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} style={inputStyle} />
            <input placeholder="Contact" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} style={inputStyle} />
          </div>
          <input placeholder="Objet de l'audience" value={form.objet} onChange={e => setForm(f => ({ ...f, objet: e.target.value }))} style={inputStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr 1fr', gap: 12 }}>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
            <Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}>
              {withCurrent(priorityList, form.priority).map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </Select>
            <Select value={form.status}   onChange={v => setForm(f => ({ ...f, status:   v }))}>
              {withCurrent(statusList, form.status).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
            </Select>
          </div>
          <Textarea placeholder="Suite à donner…"  value={form.suite_a_donner} onChange={v => setForm(f => ({ ...f, suite_a_donner: v }))} rows={2} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLbl}>Échéance de la suite</label>
              <input type="date" value={form.followup_date} onChange={e => setForm(f => ({ ...f, followup_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={fieldLbl}>Notes</label>
              <Textarea placeholder="Notes de réunion" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={2} />
            </div>
          </div>
        </div>
        <ModalFooter onCancel={() => setShowModal(false)} onConfirm={save} loading={saving} color="#8b5cf6" />
      </Modal>
    </div>
  );
}
