import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp, ArrowRight, Calendar, Edit2, Trash2 } from 'lucide-react';
import { audiencesApi, teamApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Btn, Select, Textarea, Spinner, ErrorBanner, Modal, ModalFooter } from '../components/UI.jsx';
import { T, statusConf } from '../theme.js';

const EMPTY = { institution: '', contact: '', date: '', time: '', objet: '', status: 'planifiee', priority: 'haute', suite_a_donner: '', followup_date: '', notes: '' };

const parseActions = a => {
  try {
    const p = typeof a.actions_json === 'string' ? JSON.parse(a.actions_json) : (a.actions_json || []);
    return Array.isArray(p) ? p : [];
  } catch (_) { return []; }
};

const ACT_ST = {
  a_faire:  { label: 'À faire',  color: '#94a3b8' },
  en_cours: { label: 'En cours', color: '#f59e0b' },
  fait:     { label: 'Fait',     color: '#10b981' },
};
const CYCLE = { a_faire: 'en_cours', en_cours: 'fait', fait: 'a_faire' };
const todayStr = () => new Date().toISOString().slice(0, 10);

function AudienceActions({ audience, onSave, teamMembers }) {
  const [title, setTitle]             = useState('');
  const [responsible, setResponsible] = useState('');
  const [deadline, setDeadline]       = useState('');

  const actions = parseActions(audience);
  const today   = todayStr();
  const done    = actions.filter(ac => ac.status === 'fait').length;

  const isLate = ac => ac.deadline && ac.deadline < today && ac.status !== 'fait';

  const add = () => {
    if (!title.trim()) return;
    onSave(audience, [
      ...actions,
      { id: Date.now(), title: title.trim(), status: 'a_faire', deadline, responsible },
    ]);
    setTitle(''); setResponsible(''); setDeadline('');
  };

  const cycleAc  = id => onSave(audience, actions.map(ac => ac.id === id ? { ...ac, status: CYCLE[ac.status] || 'a_faire' } : ac));
  const deleteAc = id => onSave(audience, actions.filter(ac => ac.id !== id));

  const inpStyle = {
    background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6,
    padding: '7px 10px', color: T.text, fontSize: 12, fontFamily: 'DM Sans', outline: 'none',
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
        const st   = ACT_ST[ac.status] || ACT_ST.a_faire;
        const late = isLate(ac);
        return (
          <div key={ac.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => cycleAc(ac.id)} title="Changer le statut"
              style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${st.color}`, background: ac.status === 'fait' ? st.color : 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              {ac.status === 'fait' && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
              {ac.status === 'en_cours' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: ac.status === 'fait' ? T.textDim : T.text, textDecoration: ac.status === 'fait' ? 'line-through' : 'none' }}>
                {ac.title}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                {ac.responsible && (
                  <span style={{ fontFamily: 'DM Sans', fontSize: 10, color: T.textDim }}>👤 {ac.responsible}</span>
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
            <button onClick={() => deleteAc(ac.id)}
              style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: '2px 4px', lineHeight: 0, borderRadius: 4, marginTop: 2 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = T.textDim}>
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}

      {/* Formulaire d'ajout */}
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
          <select value={responsible} onChange={e => setResponsible(e.target.value)}
            style={{ ...inpStyle, flex: 1, cursor: 'pointer' }}>
            <option value="">— Responsable —</option>
            {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name} · {m.role}</option>)}
          </select>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
            style={{ ...inpStyle, width: 150 }} />
        </div>
      </div>
    </div>
  );
}

export default function Audiences() {
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

  const filtered = items.filter(a => {
    if (filter === 'suivi')  return a.status === 'tenue' && a.suite_a_donner;
    if (filter === 'all')    return true;
    return a.status === filter || a.priority === filter;
  });

  const openCreate = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
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
        setItems(prev => prev.map(a => a.id === editId ? u : a));
      } else {
        const n = await audiencesApi.create(form);
        setItems(prev => [n, ...prev]);
      }
      setShowModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async a => {
    try {
      const u = await audiencesApi.updateStatus(a.id, a.status === 'tenue' ? 'planifiee' : 'tenue');
      setItems(prev => prev.map(i => i.id === a.id ? u : i));
    } catch (e) { setError(e.message); }
  };

  const saveActions = async (audience, actions) => {
    try {
      const u = await audiencesApi.update(audience.id, { actions_json: JSON.stringify(actions) });
      setItems(prev => prev.map(i => i.id === audience.id ? u : i));
    } catch (e) { setError(e.message); }
  };

  const today = todayStr();
  const allActions = items.flatMap(parseActions);
  const lateActions = allActions.filter(ac => ac.deadline && ac.deadline < today && ac.status !== 'fait');
  const counts = {
    total: items.length,
    planifiees: items.filter(a => a.status === 'planifiee').length,
    tenues: items.filter(a => a.status === 'tenue').length,
    suivi: items.filter(a => a.status === 'tenue' && a.suite_a_donner).length,
    actions: allActions.filter(ac => ac.status !== 'fait').length,
    lateActions: lateActions.length,
  };

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
            {[['all','Toutes'],['planifiee','Planifiées'],['tenue','Tenues'],['suivi','Suites à donner'],['critique','Critiques']].map(([v,l]) => (
              <Btn key={v} onClick={() => setFilter(v)} variant={filter === v ? 'ghost' : 'outline'} color={filter === v ? '#8b5cf6' : T.textDim} size="sm">{l}</Btn>
            ))}
          </div>
          <Btn onClick={openCreate} color="#8b5cf6"><Plus size={14} /> Nouvelle audience</Btn>
        </div>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(a => {
                const isExp = expanded === a.id;
                const sc    = statusConf[a.status] || {};
                return (
                  <Card key={a.id}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : a.id)}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc.color || T.textDim, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <h4 style={{ fontFamily: 'EB Garamond', fontSize: 17, color: T.text }}>{a.institution}</h4>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textDim }}>— {a.contact}</span>
                          <Badge status={a.priority} /><Badge status={a.status} />
                        </div>
                        <div style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted, marginTop: 3 }}>{a.objet}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>{a.date}</span>
                        {a.suite_a_donner && a.status === 'tenue' && <span style={{ fontFamily: 'DM Sans', fontSize: 9, fontWeight: 700, color: '#8b5cf6' }}>● SUITE</span>}
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
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                              <Btn onClick={() => openEdit(a)} variant="outline" color={T.teal} size="sm"><Edit2 size={12} /> Modifier</Btn>
                              <Btn onClick={() => toggleStatus(a)} variant="outline" color={sc.color} size="sm">{a.status === 'tenue' ? '↩ Planifiée' : '✓ Tenue'}</Btn>
                            </div>
                          </div>
                        </div>

                        <AudienceActions audience={a} onSave={saveActions} teamMembers={teamMembers} />
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
            <input placeholder="Institution *" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
            <input placeholder="Contact" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
          </div>
          <input placeholder="Objet de l'audience" value={form.objet} onChange={e => setForm(f => ({ ...f, objet: e.target.value }))} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr 1fr', gap: 12 }}>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
            <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none', width: 110 }} />
            <Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}><option value="critique">Critique</option><option value="haute">Haute</option><option value="moyenne">Moyenne</option></Select>
            <Select value={form.status}   onChange={v => setForm(f => ({ ...f, status:   v }))}><option value="planifiee">Planifiée</option><option value="tenue">Tenue</option></Select>
          </div>
          <Textarea placeholder="Suite à donner…"  value={form.suite_a_donner} onChange={v => setForm(f => ({ ...f, suite_a_donner: v }))} rows={2} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input type="date" value={form.followup_date} onChange={e => setForm(f => ({ ...f, followup_date: e.target.value }))} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
            <Textarea placeholder="Notes de réunion" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={2} />
          </div>
        </div>
        <ModalFooter onCancel={() => setShowModal(false)} onConfirm={save} loading={saving} color="#8b5cf6" />
      </Modal>
    </div>
  );
}