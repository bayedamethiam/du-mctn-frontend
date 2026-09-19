import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Edit2 } from 'lucide-react';
import { diligencesApi, teamApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Input, Btn, Select, Spinner, ErrorBanner, Modal, ModalFooter, EmptyState, Textarea } from '../components/UI.jsx';
import { T } from '../theme.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRefData } from '../context/RefContext.jsx';
import { hasPerm } from '../permissions.js';

const EMPTY = { title: '', source: '', deadline: '', responsible: '', priority: '', type: '', status: '', notes: '' };
const isLateWith = closed => d => {
  if (!d.deadline || closed.includes(String(d.status))) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(d.deadline) < today;
};

const fieldStyle = { width: '100%', background: T.field, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' };

export default function Diligences() {
  const { user } = useAuth();
  const ref = useRefData();
  const [items, setItems]       = useState([]);
  const [team, setTeam]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filterSt, setFilterSt] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const canDelete = hasPerm(user, 'diligences.delete');
  const canEdit   = hasPerm(user, 'diligences.manage');

  const statuses   = ref.list('diligence_status');
  const priorities = ref.list('priority');
  const types      = ref.list('diligence_type');
  const closedCodes = ref.codes('diligence_status', 'closed');
  const isLate      = isLateWith(closedCodes);

  const load = useCallback(() => {
    diligencesApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
    teamApi.list().then(t => setTeam(Array.isArray(t) ? t : [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const q = search.toLowerCase();
    const matchS = (d.title || '').toLowerCase().includes(q) || (d.source || '').toLowerCase().includes(q) || (d.responsible || '').toLowerCase().includes(q) || (d.notes || '').toLowerCase().includes(q);
    const matchF = filterSt === 'all' || (filterSt === 'late' ? isLate(d) : d.status === filterSt);
    return matchS && matchF;
  });

  /* Sources existantes triées par fréquence (suggestions + sous-titre) */
  const sourceCounts = items.reduce((m, d) => { const s = (d.source || '').trim(); if (s) m[s] = (m[s] || 0) + 1; return m; }, {});
  const sources      = Object.keys(sourceCounts).sort((a, b) => sourceCounts[b] - sourceCounts[a]);
  const teamNames    = [...new Set(team.map(m => m.name).filter(Boolean))];
  const subtitle     = sources.length ? `${sources.slice(0, 3).join(' · ')} · Traçabilité complète` : 'Traçabilité complète des instructions et demandes';

  const openCreate = () => {
    /* Priorité par défaut : première non critique / non haute du référentiel */
    const defPriority = priorities.find(p => !ref.has('priority', p.code, 'critical') && !ref.has('priority', p.code, 'high')) || priorities[0];
    setForm({ ...EMPTY, status: statuses[0]?.code || '', type: types[0]?.code || '', priority: defPriority?.code || '' });
    setEditId(null); setShowModal(true);
  };
  const openEdit = d => { setForm({ title: d.title, source: d.source, deadline: d.deadline || '', responsible: d.responsible || '', priority: d.priority || priorities[0]?.code || '', type: d.type || '', status: d.status, notes: d.notes || '' }); setEditId(d.id); setShowModal(true); };

  const save = async () => {
    if (!form.title || !form.source) { setError('Titre et source requis'); return; }
    setSaving(true);
    try {
      if (editId) {
        const u = await diligencesApi.update(editId, form);
        setItems(prev => prev.map(d => d.id === editId ? u : d));
      } else {
        const n = await diligencesApi.create(form);
        setItems(prev => [n, ...prev]);
      }
      setShowModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  /* Bascule rapide : non terminé → premier statut « done » ; terminé → dernier statut ouvert.
   * Ne passe jamais par un statut annulé (le choix complet reste dans la modale). */
  const nextStatus = d => {
    if (!statuses.length) return null;
    if (ref.has('diligence_status', d.status, 'done')) {
      const open = statuses.filter(s => !closedCodes.includes(String(s.code)));
      return open[open.length - 1] || null;
    }
    return statuses.find(s => ref.has('diligence_status', s.code, 'done')) || null;
  };
  const cycleStatus = async d => {
    const next = nextStatus(d);
    if (!next) return;
    try {
      const u = await diligencesApi.updateStatus(d.id, next.code);
      setItems(prev => prev.map(i => i.id === d.id ? u : i));
    } catch (e) { setError(e.message); }
  };

  const remove = async id => {
    if (!window.confirm('Supprimer cette diligence ?')) return;
    try { await diligencesApi.delete(id); setItems(prev => prev.filter(d => d.id !== id)); }
    catch (e) { setError(e.message); }
  };

  const late = items.filter(isLate).length;
  const withCurrent = (list, value) => value && !list.some(i => i.code === value) ? [...list, { code: value, label: value }] : list;

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Diligences" title="Suivi des instructions ministérielles"
        subtitle={subtitle}
        stats={[
          { value: items.length, label: 'Total' },
          ...statuses.map(s => ({ value: items.filter(d => d.status === s.code).length, label: s.label, color: s.color || T.teal })),
          { value: late, label: 'En retard', color: '#ef4444' },
        ]} />
      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input placeholder="Rechercher…" value={search} onChange={setSearch} icon={Search} style={{ flex: 1, minWidth: 220 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['all', 'Toutes'], ...statuses.map(s => [s.code, s.label]), ['late', 'En retard']].map(([v, l]) => (
              <Btn key={v} onClick={() => setFilterSt(v)} variant={filterSt === v ? 'ghost' : 'outline'} color={filterSt === v ? (v === 'late' ? '#ef4444' : T.teal) : T.textDim} size="sm">{l}{v === 'late' && late > 0 ? ` (${late})` : ''}</Btn>
            ))}
          </div>
          {canEdit && <Btn onClick={openCreate} color={T.teal}><Plus size={14} /> Nouvelle diligence</Btn>}
        </div>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          : (
            <Card>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {['Diligence','Source','Échéance','Responsable','Priorité','Statut','Actions'].map(h => (
                      <th key={h} style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.5, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={7}><EmptyState title="Aucun résultat" subtitle={search ? `Aucune diligence pour "${search}"` : 'Aucune diligence enregistrée'} /></td></tr>
                    : filtered.map(d => {
                      const next = nextStatus(d);
                      return (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 500, color: T.text }}>{d.title}</div>
                          <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: 2 }}>{ref.label('diligence_type', d.type)}</div>
                          {d.notes && <div title={d.notes} style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textMuted, marginTop: 4, maxWidth: 360, whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>📝 {d.notes}</div>}
                        </td>
                        <td style={{ padding: '13px 16px', fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{d.source}</td>
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                          {d.deadline ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: isLate(d) ? '#ef4444' : T.textMuted, fontWeight: isLate(d) ? 700 : 400 }}>{d.deadline}</span>
                              {isLate(d) && <span style={{ fontSize: 10, fontFamily: 'DM Sans', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', borderRadius: 4, padding: '1px 6px', letterSpacing: 0.5 }}>⚠ En retard</span>}
                            </div>
                          ) : <span style={{ color: T.textDim, fontSize: 12, fontFamily: 'DM Sans' }}>—</span>}
                        </td>
                        <td style={{ padding: '13px 16px', fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{d.responsible}</td>
                        <td style={{ padding: '13px 16px' }}><Badge status={d.priority} domain="priority" /></td>
                        <td style={{ padding: '13px 16px' }}><Badge status={d.status} domain="diligence_status" /></td>
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {canEdit && <Btn onClick={() => openEdit(d)} variant="ghost" color={T.teal} size="sm"><Edit2 size={12} /></Btn>}
                            {canEdit && next && (
                              <span title={`Passer à : ${next.label}`}>
                                <Btn onClick={() => cycleStatus(d)} variant="ghost" color={next.color || '#10b981'} size="sm">
                                  {ref.has('diligence_status', next.code, 'done') ? '✓' : '↩'}
                                </Btn>
                              </span>
                            )}
                            {canDelete && <Btn onClick={() => remove(d.id)} variant="ghost" color="#ef4444" size="sm"><Trash2 size={12} /></Btn>}
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </Card>
          )}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Modifier la diligence' : 'Nouvelle diligence'} width={540}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="Intitulé de la diligence *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input list="dil-sources" placeholder="Source *" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} style={fieldStyle} />
            <input list="dil-team" placeholder="Responsable" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} style={fieldStyle} />
            <datalist id="dil-sources">{sources.map(s => <option key={s} value={s} />)}</datalist>
            <datalist id="dil-team">{teamNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={{ background: T.field, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
            <Select value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}>
              {withCurrent(statuses, form.status).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
            </Select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}>
              {withCurrent(priorities, form.priority).map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </Select>
            <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}>
              {withCurrent(types, form.type).map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
            </Select>
          </div>
          <Textarea placeholder="Notes, suites données, commentaires…" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={3} />
        </div>
        <ModalFooter onCancel={() => setShowModal(false)} onConfirm={save} loading={saving} confirmLabel={editId ? 'Enregistrer' : 'Créer'} />
      </Modal>
    </div>
  );
}
