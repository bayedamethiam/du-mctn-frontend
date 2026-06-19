import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Edit2 } from 'lucide-react';
import { diligencesApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Input, Btn, Select, Spinner, ErrorBanner, Modal, ModalFooter, EmptyState } from '../components/UI.jsx';
import { T } from '../theme.js';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY = { title: '', source: '', deadline: '', responsible: '', priority: 'moyenne', type: 'Note', status: 'planifie' };
const TYPES = ['Note', 'Rapport', 'Présentation', 'Compte rendu', 'Dashboard', 'Lettre'];

const isLate = d => {
  if (!d.deadline || d.status === 'fait') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(d.deadline) < today;
};

export default function Diligences() {
  const { user } = useAuth();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filterSt, setFilterSt] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const canDelete = ['admin', 'director'].includes(user?.role);

  const load = useCallback(() => {
    diligencesApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const q = search.toLowerCase();
    const matchS = d.title.toLowerCase().includes(q) || d.source.toLowerCase().includes(q) || (d.responsible || '').toLowerCase().includes(q);
    const matchF = filterSt === 'all' || (filterSt === 'late' ? isLate(d) : d.status === filterSt);
    return matchS && matchF;
  });

  const openCreate = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit   = d => { setForm({ title: d.title, source: d.source, deadline: d.deadline || '', responsible: d.responsible || '', priority: d.priority, type: d.type || 'Note', status: d.status }); setEditId(d.id); setShowModal(true); };

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

  const toggleStatus = async d => {
    try {
      const u = await diligencesApi.updateStatus(d.id, d.status === 'fait' ? 'en_cours' : 'fait');
      setItems(prev => prev.map(i => i.id === d.id ? u : i));
    } catch (e) { setError(e.message); }
  };

  const remove = async id => {
    if (!window.confirm('Supprimer cette diligence ?')) return;
    try { await diligencesApi.delete(id); setItems(prev => prev.filter(d => d.id !== id)); }
    catch (e) { setError(e.message); }
  };

  const counts = { all: items.length, planifie: items.filter(d => d.status === 'planifie').length, en_cours: items.filter(d => d.status === 'en_cours').length, fait: items.filter(d => d.status === 'fait').length, late: items.filter(isLate).length };

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Diligences" title="Suivi des instructions ministérielles"
        subtitle="Cabinet PM · Partenaires · Présidence · Traçabilité complète"
        stats={[{ value: counts.all, label: 'Total' }, { value: counts.en_cours, label: 'En cours', color: T.teal }, { value: counts.planifie, label: 'Planifiées', color: '#f59e0b' }, { value: counts.fait, label: 'Réalisées', color: '#10b981' }, { value: counts.late, label: 'En retard', color: '#ef4444' }]} />
      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input placeholder="Rechercher…" value={search} onChange={setSearch} icon={Search} style={{ flex: 1, minWidth: 220 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all','Toutes'],['planifie','Planifiées'],['en_cours','En cours'],['fait','Réalisées'],['late','En retard']].map(([v, l]) => (
              <Btn key={v} onClick={() => setFilterSt(v)} variant={filterSt === v ? 'ghost' : 'outline'} color={filterSt === v ? (v === 'late' ? '#ef4444' : T.teal) : T.textDim} size="sm">{l}{v === 'late' && counts.late > 0 ? ` (${counts.late})` : ''}</Btn>
            ))}
          </div>
          <Btn onClick={openCreate} color={T.teal}><Plus size={14} /> Nouvelle diligence</Btn>
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
                    : filtered.map(d => (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 500, color: T.text }}>{d.title}</div>
                          <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: 2 }}>{d.type}</div>
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
                        <td style={{ padding: '13px 16px' }}><Badge status={d.priority} /></td>
                        <td style={{ padding: '13px 16px' }}><Badge status={d.status} /></td>
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Btn onClick={() => openEdit(d)} variant="ghost" color={T.teal} size="sm"><Edit2 size={12} /></Btn>
                            <Btn onClick={() => toggleStatus(d)} variant="ghost" color="#10b981" size="sm">{d.status === 'fait' ? '↩' : '✓'}</Btn>
                            {canDelete && <Btn onClick={() => remove(d.id)} variant="ghost" color="#ef4444" size="sm"><Trash2 size={12} /></Btn>}
                          </div>
                        </td>
                      </tr>
                    ))
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
            <Input placeholder="Source *" value={form.source} onChange={v => setForm(f => ({ ...f, source: v }))} />
            <Input placeholder="Responsable" value={form.responsible} onChange={v => setForm(f => ({ ...f, responsible: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
            <Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}>
              <option value="critique">Critique</option>
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
            </Select>
            <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <ModalFooter onCancel={() => setShowModal(false)} onConfirm={save} loading={saving} confirmLabel={editId ? 'Enregistrer' : 'Créer'} />
      </Modal>
    </div>
  );
}
