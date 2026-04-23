import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Building, Mail, Calendar, Upload, File, X, Paperclip, Plus, Pencil, Trash2 } from 'lucide-react';
import { partnershipsApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Btn, Spinner, ErrorBanner, Modal, Input, Select, Textarea, EmptyState } from '../components/UI.jsx';
import { T } from '../theme.js';

const TYPES = [
  { id:'all',        label:'Tous',          color: T.teal },
  { id:'bailleur',   label:'Bailleurs',     color:'#10b981' },
  { id:'fondation',  label:'Fondations',    color:'#8b5cf6' },
  { id:'bilateral',  label:'Bilatéraux',    color:'#f59e0b' },
  { id:'multilateral',label:'Multilatéraux',color:'#3b82f6' },
  { id:'ong',        label:'ONG',           color:'#ec4899' },
  { id:'prive',      label:'Privé',         color:'#06b6d4' },
];
const FT = { pdf:{color:'#ef4444',label:'PDF'}, word:{color:'#3b82f6',label:'Word'}, excel:{color:'#10b981',label:'Excel'}, default:{color:T.textDim,label:'Doc'} };

const EMPTY = { name:'', type:'bailleur', country:'', status:'actif', amount:'', contact:'', email:'', description:'', start_date:'', end_date:'', projects:'' };

const Field = ({ label, children }) => (
  <div>
    <label style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:T.textDim, display:'block', marginBottom:6 }}>{label}</label>
    {children}
  </div>
);

export default function Partenariats() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [typeF, setTypeF]       = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [uploading, setUploading] = useState({});
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const fileRefs = useRef({});

  const load = useCallback(() => {
    partnershipsApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = typeF === 'all' ? items : items.filter(p => p.type === typeF);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (p, e) => {
    e.stopPropagation();
    const projects = Array.isArray(p.projects) ? p.projects : JSON.parse(p.projects || '[]');
    setEditing(p.id);
    setForm({ name:p.name, type:p.type, country:p.country||'', status:p.status, amount:p.amount||'', contact:p.contact||'', email:p.email||'', description:p.description||'', start_date:p.start_date||'', end_date:p.end_date||'', projects:projects.join(', ') });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.type) return setError('Nom et type requis');
    setSaving(true);
    try {
      const payload = { ...form, projects: JSON.stringify(form.projects.split(',').map(s=>s.trim()).filter(Boolean)) };
      if (editing) {
        const updated = await partnershipsApi.update(editing, payload);
        setItems(prev => prev.map(p => p.id === editing ? { ...p, ...updated } : p));
      } else {
        const created = await partnershipsApi.create(payload);
        setItems(prev => [...prev, { ...created, documents: [] }]);
      }
      setModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (pid, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce partenariat ?')) return;
    try {
      await partnershipsApi.delete(pid);
      setItems(prev => prev.filter(p => p.id !== pid));
    } catch (e) { setError(e.message); }
  };

  const handleUpload = async (pid, files) => {
    if (!files?.length) return;
    setUploading(u => ({ ...u, [pid]: true }));
    try {
      for (const file of Array.from(files)) {
        const doc = await partnershipsApi.uploadDoc(pid, file);
        setItems(prev => prev.map(p => p.id === pid ? { ...p, documents: [...(p.documents || []), doc] } : p));
      }
    } catch (e) { setError(e.message); }
    finally { setUploading(u => ({ ...u, [pid]: false })); }
  };

  const removeDoc = async (pid, did) => {
    try {
      await partnershipsApi.deleteDoc(pid, did);
      setItems(prev => prev.map(p => p.id === pid ? { ...p, documents: (p.documents || []).filter(d => d.id !== did) } : p));
    } catch (e) { setError(e.message); }
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const totalDocs = items.reduce((s, p) => s + (p.documents?.length || 0), 0);

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Partenariats stratégiques" title="Partenaires techniques & financiers"
        subtitle="Bailleurs, fondations, bilatéraux, ONG · Documents & suivi des accords" color="#10b981"
        stats={[{ value: items.length, label: 'Partenaires' }, { value: totalDocs, label: 'Documents joints', color: '#10b981' }]} />
      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.border}`, overflowX: 'auto' }}>
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setTypeF(t.id)}
                style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:500, padding:'14px 16px', background:'none', border:'none', borderBottom:`2px solid ${typeF===t.id?t.color:'transparent'}`, color:typeF===t.id?t.color:T.textMuted, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.2s' }}>
                {t.label}
                {t.id !== 'all' && <span style={{ marginLeft:5, fontSize:10, opacity:0.7 }}>{items.filter(p=>p.type===t.id).length}</span>}
              </button>
            ))}
          </div>
          <Btn onClick={openCreate} color={T.teal}><Plus size={14}/> Nouveau partenariat</Btn>
        </div>

        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : filtered.length === 0
            ? <EmptyState icon={Building} title="Aucun partenariat" subtitle="Cliquez sur « Nouveau partenariat » pour en ajouter un." />
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {filtered.map(p => {
                  const tc  = TYPES.find(t => t.id === p.type) || TYPES[0];
                  const isExp = expanded === p.id;
                  const projects = Array.isArray(p.projects) ? p.projects : JSON.parse(p.projects || '[]');
                  return (
                    <Card key={p.id}>
                      <div style={{ padding:'18px 22px', display:'flex', alignItems:'center', gap:16, cursor:'pointer' }} onClick={() => setExpanded(isExp ? null : p.id)}>
                        <div style={{ width:44, height:44, borderRadius:10, background:`${tc.color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Building size={20} color={tc.color}/>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                            <h4 style={{ fontFamily:'EB Garamond', fontSize:18, color:T.text }}>{p.name}</h4>
                            <span style={{ background:`${tc.color}22`, color:tc.color, fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'2px 8px', borderRadius:4 }}>{tc.label}</span>
                            <Badge status={p.status}/>
                          </div>
                          <div style={{ display:'flex', gap:16, marginTop:4, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>{p.country}</span>
                            <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.teal, fontWeight:600 }}>{p.amount}</span>
                            <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>{projects.join(' · ')}</span>
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {(p.documents||[]).length > 0 && (
                            <div style={{ display:'flex', alignItems:'center', gap:4, background:`${T.teal}15`, borderRadius:6, padding:'4px 10px' }}>
                              <Paperclip size={12} color={T.teal}/>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.teal, fontWeight:600 }}>{p.documents.length}</span>
                            </div>
                          )}
                          <button onClick={e => openEdit(p, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:4 }}
                            onMouseEnter={e=>e.currentTarget.style.color=T.teal} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><Pencil size={13}/></button>
                          <button onClick={e => handleDelete(p.id, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:4 }}
                            onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><Trash2 size={13}/></button>
                          {isExp ? <ChevronUp size={16} color={T.textMuted}/> : <ChevronDown size={16} color={T.textMuted}/>}
                        </div>
                      </div>
                      {isExp && (
                        <div style={{ borderTop:`1px solid ${T.border}`, padding:'18px 22px' }} className="slide-in">
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
                            <div>
                              <p style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>Description</p>
                              <p style={{ fontFamily:'DM Sans', fontSize:13, color:T.textMuted, lineHeight:1.6 }}>{p.description || '—'}</p>
                            </div>
                            <div>
                              <p style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>Contact</p>
                              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}><Building size={13} color={T.textDim}/><span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>{p.contact}</span></div>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}><Mail size={13} color={T.textDim}/><span style={{ fontFamily:'DM Sans', fontSize:12, color:T.teal }}>{p.email}</span></div>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}><Calendar size={13} color={T.textDim}/><span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>{p.start_date} → {p.end_date}</span></div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                              <p style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim }}>Documents ({(p.documents||[]).length})</p>
                              <div>
                                <input ref={el => fileRefs.current[p.id] = el} type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.pptx" style={{ display:'none' }} onChange={e => handleUpload(p.id, e.target.files)}/>
                                <Btn onClick={() => fileRefs.current[p.id]?.click()} variant="outline" color={T.teal} size="sm" disabled={uploading[p.id]}>
                                  {uploading[p.id] ? <Spinner size={12} color={T.teal}/> : <Upload size={12}/>} Joindre
                                </Btn>
                              </div>
                            </div>
                            {(p.documents||[]).length === 0
                              ? <div style={{ padding:16, background:T.surface2, borderRadius:8, textAlign:'center', fontFamily:'DM Sans', fontSize:12, color:T.textDim }}>Aucun document joint</div>
                              : <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                                {(p.documents||[]).map(doc => {
                                  const ft = FT[doc.file_type] || FT.default;
                                  return (
                                    <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:T.surface2, borderRadius:8, border:`1px solid ${T.border}` }}>
                                      <div style={{ width:32, height:32, borderRadius:6, background:`${ft.color}22`, display:'flex', alignItems:'center', justifyContent:'center' }}><File size={14} color={ft.color}/></div>
                                      <div style={{ flex:1 }}>
                                        <button onClick={() => partnershipsApi.downloadDoc(p.id, doc.id, doc.name)} style={{ background:'none', border:'none', fontFamily:'DM Sans', fontSize:13, color:T.teal, cursor:'pointer', padding:0, textAlign:'left' }}>{doc.name}</button>
                                        <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>{ft.label} · {doc.size} · {doc.date}</div>
                                      </div>
                                      <button onClick={() => removeDoc(p.id, doc.id)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer' }}
                                        onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><X size={14}/></button>
                                    </div>
                                  );
                                })}
                              </div>
                            }
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le partenariat' : 'Nouveau partenariat'} width={580}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Nom *"><Input value={form.name} onChange={v=>f('name',v)} placeholder="Banque Mondiale"/></Field>
            <Field label="Type *">
              <Select value={form.type} onChange={v=>f('type',v)} style={{ width:'100%' }}>
                {TYPES.filter(t=>t.id!=='all').map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Pays"><Input value={form.country} onChange={v=>f('country',v)} placeholder="Sénégal"/></Field>
            <Field label="Statut">
              <Select value={form.status} onChange={v=>f('status',v)} style={{ width:'100%' }}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
                <option value="en_negociation">En négociation</option>
              </Select>
            </Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Contact"><Input value={form.contact} onChange={v=>f('contact',v)} placeholder="Nom du contact"/></Field>
            <Field label="Email"><Input value={form.email} onChange={v=>f('email',v)} placeholder="contact@partenaire.org" type="email"/></Field>
          </div>
          <Field label="Montant / Enveloppe"><Input value={form.amount} onChange={v=>f('amount',v)} placeholder="150M USD"/></Field>
          <Field label="Description"><Textarea value={form.description} onChange={v=>f('description',v)} placeholder="Objet du partenariat…" rows={3}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Date début"><Input value={form.start_date} onChange={v=>f('start_date',v)} type="date"/></Field>
            <Field label="Date fin"><Input value={form.end_date} onChange={v=>f('end_date',v)} type="date"/></Field>
          </div>
          <Field label="Projets associés (séparés par virgule)"><Input value={form.projects} onChange={v=>f('projects',v)} placeholder="PAENS, e-ID, Goin Digital"/></Field>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
            <Btn onClick={() => setModal(false)} variant="ghost" color={T.textMuted}>Annuler</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? <Spinner size={14} color="#fff"/> : null}{editing ? 'Mettre à jour' : 'Créer'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
