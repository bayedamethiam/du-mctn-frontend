import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Building, Mail, Calendar, Upload, File, X, Paperclip, Plus, Pencil, Trash2, Handshake, Globe } from 'lucide-react';
import { partnershipsApi, programsApi, instancesApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Btn, Spinner, ErrorBanner, Modal, Input, Select, Textarea, EmptyState } from '../components/UI.jsx';
import { T } from '../theme.js';
import { useRefData } from '../context/RefContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { hasPerm } from '../permissions.js';
import Instances from './Instances.jsx';

const SECTIONS = [
  { id:'partenaires', label:'Partenaires & accords',            icon:Handshake },
  { id:'instances',   label:'Représentation internationale',    icon:Globe },
];

const FT = { pdf:{color:'#ef4444',label:'PDF'}, word:{color:'#3b82f6',label:'Word'}, excel:{color:'#10b981',label:'Excel'}, ppt:{color:'#f97316',label:'PowerPoint'}, image:{color:'#8b5cf6',label:'Image'}, default:{color:T.textDim,label:'Doc'} };
/* Extensions acceptées par le serveur (lib/common.js ALLOWED_EXT) */
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.csv,.txt,.png,.jpg,.jpeg';

const EMPTY = { name:'', type:'', country:'', status:'', amount:'', amount_value:'', currency:'', contact:'', email:'', description:'', start_date:'', end_date:'', projects:[], next_meeting_date:'', next_meeting_label:'' };

const parseProjects = p => { try { const r = Array.isArray(p.projects) ? p.projects : JSON.parse(p.projects || '[]'); return Array.isArray(r) ? r.map(String) : []; } catch { return []; } };
/* Date de document : 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS' (SQLite) ou ISO (PostgreSQL) */
const fmtDocDate = v => {
  if (!v) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(String(v)) ? String(v).replace(' ', 'T') : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('fr-FR');
};
const fmtAmount = (v, cur) => (v === null || v === undefined || v === '') ? '' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v))}${cur ? ` ${cur}` : ''}`;

const Field = ({ label, children }) => (
  <div>
    <label style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:T.textDim, display:'block', marginBottom:6 }}>{label}</label>
    {children}
  </div>
);

export default function Partenariats() {
  const ref = useRefData();
  const planShort = ref.setting('plan_short');
  const { user } = useAuth();
  const canWrite  = hasPerm(user, 'partnerships.manage');
  const canDelete = hasPerm(user, 'partnerships.delete');
  const canUpload = hasPerm(user, 'partnerships.docs');
  const canDelDoc = hasPerm(user, 'partnerships.docs.delete');

  const [section, setSection]   = useState('partenaires');
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
  const [allProjects, setAllProjects] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [instCount, setInstCount] = useState(0);
  const fileRefs = useRef({});

  const load = useCallback(() => {
    Promise.all([partnershipsApi.list(), programsApi.allProjects().catch(() => []), instancesApi.list().catch(() => []), programsApi.list().catch(() => [])])
      .then(([parts, projs, insts, progs]) => { setItems(parts); setAllProjects(projs); setInstCount(insts.length); setPrograms(progs); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const typeList = ref.list('partnership_type');
  const currencies = (() => { const c = ref.json('currencies', ['FCFA']); const arr = Array.isArray(c) ? c.filter(x => typeof x === 'string' && x) : []; return arr.length ? arr : ['FCFA']; })();
  const typeSubtitle = typeList.length
    ? `${typeList.slice(0, 4).map(t => t.label).join(', ')}${typeList.length > 4 ? '…' : ''} · Représentation internationale · Documents & suivi des accords`
    : 'Représentation internationale · Documents & suivi des accords';
  const TYPES = [{ id:'all', label:'Tous', color:T.teal }, ...typeList.map(t => ({ id:t.code, label:t.label, color:t.color || T.teal }))];
  /* Type inconnu du référentiel : code brut affiché (jamais « Tous ») */
  const typeConf = code => { const it = ref.item('partnership_type', code); return it ? { label:it.label, color:it.color || T.teal } : { label:code || '—', color:T.textDim }; };

  /* Liens : codes de programme existants (programmes entiers) ou ids de projets ; le reste = liens historiques */
  const programByCode = code => programs.find(pg => String(pg.code).toLowerCase() === String(code).toLowerCase());
  const resolveLink = id => {
    const prog = programByCode(id);
    if (prog) return { kind:'program', label:`${prog.code} · ${prog.name}`, short:prog.code, title:prog.name, color:prog.color || T.teal };
    const proj = allProjects.find(x => String(x.id) === String(id));
    if (proj) return { kind:'project', label:proj.name, short:proj.name, title:proj.program_name, color:proj.program_color || T.teal };
    return null;
  };

  const toggleLink = id => setForm(prev => ({
    ...prev,
    projects: prev.projects.includes(String(id))
      ? prev.projects.filter(x => x !== String(id))
      : [...prev.projects, String(id)],
  }));

  const filtered = typeF === 'all' ? items : items.filter(p => p.type === typeF);

  const openCreate = () => {
    const statuses = ref.list('partnership_status');
    const defStatus = statuses.find(s => ref.has('partnership_status', s.code, 'active'))?.code || statuses[0]?.code || '';
    setEditing(null);
    setForm({ ...EMPTY, type: typeList[0]?.code || '', status: defStatus, currency: currencies[0] });
    setModal(true);
  };
  const openEdit   = (p, e) => {
    e.stopPropagation();
    setEditing(p.id);
    setForm({ name:p.name, type:p.type, country:p.country||'', status:p.status||'', amount:p.amount||'', amount_value:p.amount_value ?? '', currency:p.currency||'', contact:p.contact||'', email:p.email||'', description:p.description||'', start_date:p.start_date||'', end_date:p.end_date||'', projects: parseProjects(p), next_meeting_date:p.next_meeting_date||'', next_meeting_label:p.next_meeting_label||'' });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.type) return setError('Nom et type requis');
    setSaving(true);
    try {
      /* form.projects conserve les codes historiques non reconnus (ils ne sont jamais supprimés silencieusement) */
      const payload = { ...form, projects: form.projects, amount_value: form.amount_value === '' ? null : Number(form.amount_value) };
      if (editing) {
        const updated = await partnershipsApi.update(editing, payload);
        if (updated) setItems(prev => prev.map(p => p.id === editing ? { ...p, ...updated } : p)); else load();
      } else {
        const created = await partnershipsApi.create(payload);
        if (created) setItems(prev => [...prev, { documents: [], ...created }]); else load();
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
        if (doc) setItems(prev => prev.map(p => p.id === pid ? { ...p, documents: [...(p.documents || []), doc] } : p));
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

  const downloadDoc = async (pid, doc) => {
    try { await partnershipsApi.downloadDoc(pid, doc.id, doc.name); }
    catch (e) { setError(e.message || 'Téléchargement impossible'); }
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const totalDocs = items.reduce((s, p) => s + (p.documents?.length || 0), 0);
  const activeCount = items.filter(p => ref.has('partnership_status', p.status, 'active')).length;

  const statusOptions = ref.list('partnership_status');
  const statusOpts = form.status && !statusOptions.some(s => s.code === form.status) ? [...statusOptions, { code:form.status, label:form.status }] : statusOptions;
  const typeOpts   = form.type && !typeList.some(t => t.code === form.type) ? [...typeList, { code:form.type, label:form.type }] : typeList;

  /* Groupes du sélecteur : programmes (sélectionnables) + leurs projets */
  const groups = [
    ...programs.map(pg => ({ code:pg.code, name:pg.name, color:pg.color || T.teal, projs: allProjects.filter(p => p.program_code === pg.code) })),
    ...(allProjects.some(p => !p.program_code || !programs.some(pg => pg.code === p.program_code))
      ? [{ code:null, name:'—', color:T.textDim, projs: allProjects.filter(p => !p.program_code || !programs.some(pg => pg.code === p.program_code)) }] : []),
  ];
  const unknownLinks = form.projects.filter(id => !resolveLink(id));

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Partenariats stratégiques" title="Partenaires techniques & financiers"
        subtitle={typeSubtitle} color="#10b981"
        stats={[
          { value: activeCount, label: 'Partenaires actifs' },
          { value: instCount,   label: 'Instances internationales', color:'#8b5cf6' },
          { value: totalDocs,   label: 'Documents joints', color:'#10b981' },
        ]} />
      <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, padding:'0 28px' }}>
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{ display:'flex', alignItems:'center', gap:7, fontFamily:'DM Sans', fontSize:13, fontWeight:600, padding:'16px 4px', marginRight:28, background:'none', border:'none', borderBottom:`2px solid ${active?T.teal:'transparent'}`, color:active?T.teal:T.textMuted, cursor:'pointer', transition:'all 0.2s' }}>
              <Icon size={15}/> {s.label}
            </button>
          );
        })}
      </div>
      {section === 'instances' ? <Instances embedded /> : (
      <>
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
          {canWrite && <Btn onClick={openCreate} color={T.teal}><Plus size={14}/> Nouveau partenariat</Btn>}
        </div>

        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : filtered.length === 0
            ? <EmptyState icon={Building} title="Aucun partenariat" subtitle={canWrite ? 'Cliquez sur « Nouveau partenariat » pour en ajouter un.' : undefined} />
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {filtered.map(p => {
                  const tc  = typeConf(p.type);
                  const isExp = expanded === p.id;
                  const links = parseProjects(p);
                  const amountFmt = fmtAmount(p.amount_value, p.currency);
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
                            <Badge status={p.status} domain="partnership_status"/>
                          </div>
                          <div style={{ display:'flex', gap:16, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                            <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted }}>{p.country}</span>
                            {amountFmt && <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.teal, fontWeight:700 }}>{amountFmt}</span>}
                            {p.amount && <span style={{ fontFamily:'DM Sans', fontSize:12, color:amountFmt ? T.textDim : T.teal, fontWeight:amountFmt ? 400 : 600 }}>{p.amount}</span>}
                            {links.length > 0 && (
                              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                                {links.map(id => {
                                  const l = resolveLink(id);
                                  return l ? (
                                    <span key={id} title={l.title} style={{ fontSize:10, background:`${l.color}18`, color:l.color, fontFamily:'DM Sans', fontWeight: l.kind === 'program' ? 800 : 600, padding:'1px 7px', borderRadius:4, border: l.kind === 'program' ? `1px solid ${l.color}40` : 'none' }}>
                                      {l.short}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {(p.documents||[]).length > 0 && (
                            <div style={{ display:'flex', alignItems:'center', gap:4, background:`${T.teal}15`, borderRadius:6, padding:'4px 10px' }}>
                              <Paperclip size={12} color={T.teal}/>
                              <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.teal, fontWeight:600 }}>{p.documents.length}</span>
                            </div>
                          )}
                          {canWrite && <button onClick={e => openEdit(p, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:4 }}
                            onMouseEnter={e=>e.currentTarget.style.color=T.teal} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><Pencil size={13}/></button>}
                          {canDelete && <button onClick={e => handleDelete(p.id, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:4 }}
                            onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><Trash2 size={13}/></button>}
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
                          {links.length > 0 && (
                            <div style={{ marginBottom:20 }}>
                              <p style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>{`Programmes & projets ${planShort}`}</p>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                {links.map(id => { const l = resolveLink(id) || { label:id, color:T.textDim }; return (
                                  <span key={id} style={{ fontSize:11, background:`${l.color}18`, color:l.color, fontFamily:'DM Sans', fontWeight:600, padding:'3px 9px', borderRadius:6 }}>{l.label}</span>
                                ); })}
                              </div>
                            </div>
                          )}
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                              <p style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim }}>Documents ({(p.documents||[]).length})</p>
                              {canUpload && <div>
                                <input ref={el => fileRefs.current[p.id] = el} type="file" multiple accept={FILE_ACCEPT} style={{ display:'none' }} onChange={e => { handleUpload(p.id, e.target.files); e.target.value = ''; }}/>
                                <Btn onClick={() => fileRefs.current[p.id]?.click()} variant="outline" color={T.teal} size="sm" disabled={uploading[p.id]}>
                                  {uploading[p.id] ? <Spinner size={12} color={T.teal}/> : <Upload size={12}/>} Joindre
                                </Btn>
                              </div>}
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
                                        <button onClick={() => downloadDoc(p.id, doc)} style={{ background:'none', border:'none', fontFamily:'DM Sans', fontSize:13, color:T.teal, cursor:'pointer', padding:0, textAlign:'left' }}>{doc.name}</button>
                                        <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>{[ft.label, doc.size, fmtDocDate(doc.date)].filter(Boolean).join(' · ')}</div>
                                      </div>
                                      {canDelDoc && <button onClick={() => removeDoc(p.id, doc.id)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer' }}
                                        onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textDim}><X size={14}/></button>}
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
                {!form.type && <option value="">—</option>}
                {typeOpts.map(t=><option key={t.code} value={t.code}>{t.label}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Pays"><Input value={form.country} onChange={v=>f('country',v)} placeholder={ref.setting('country') || 'Pays'}/></Field>
            <Field label="Statut">
              <Select value={form.status} onChange={v=>f('status',v)} style={{ width:'100%' }}>
                {statusOpts.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Contact"><Input value={form.contact} onChange={v=>f('contact',v)} placeholder="Nom du contact"/></Field>
            <Field label="Email"><Input value={form.email} onChange={v=>f('email',v)} placeholder="contact@partenaire.org" type="email"/></Field>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 110px 1fr', gap:12 }}>
            <Field label="Montant"><Input value={form.amount_value} onChange={v=>f('amount_value',v)} type="number" placeholder="150000000"/></Field>
            <Field label="Devise">
              <input list="du-currencies" value={form.currency} onChange={e=>f('currency',e.target.value)} placeholder={currencies[0]}
                style={{ width:'100%', background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px', color:T.text, fontSize:13, fontFamily:'DM Sans', outline:'none' }}/>
              <datalist id="du-currencies">{currencies.map(c => <option key={c} value={c}/>)}</datalist>
            </Field>
            <Field label="Détail"><Input value={form.amount} onChange={v=>f('amount',v)} placeholder="Ex: 923M FCFA/an, Technique…"/></Field>
          </div>
          <Field label="Description"><Textarea value={form.description} onChange={v=>f('description',v)} placeholder="Objet du partenariat…" rows={3}/></Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Date début"><Input value={form.start_date} onChange={v=>f('start_date',v)} type="date"/></Field>
            <Field label="Date fin"><Input value={form.end_date} onChange={v=>f('end_date',v)} type="date"/></Field>
          </div>
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, marginTop:2 }}>
            <p style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#6366f1', marginBottom:10 }}>Prochaine réunion (calendrier)</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Date de réunion"><Input value={form.next_meeting_date} onChange={v=>f('next_meeting_date',v)} type="date"/></Field>
              <Field label="Libellé"><Input value={form.next_meeting_label} onChange={v=>f('next_meeting_label',v)} placeholder="Ex: Revue annuelle BM"/></Field>
            </div>
          </div>
          <Field label={`Programmes / projets ${planShort} associés ${form.projects.length > 0 ? `(${form.projects.length} sélectionné${form.projects.length > 1 ? 's' : ''})` : ''}`}>
            {groups.length === 0
              ? <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim, padding:'8px 0' }}>Aucun programme ni projet disponible</div>
              : (
                <div style={{ maxHeight:220, overflowY:'auto', border:`1px solid ${T.border}`, borderRadius:8, padding:'8px 0' }}>
                  {groups.map(g => {
                    const progChecked = g.code && form.projects.some(x => x.toLowerCase() === String(g.code).toLowerCase());
                    return (
                      <div key={g.code || '—'}>
                        {g.code
                          ? <label style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px 3px', cursor:'pointer', background: progChecked ? `${g.color}10` : 'transparent' }} title="Associer le programme entier">
                              <input type="checkbox" checked={!!progChecked}
                                onChange={() => { const cur = form.projects.find(x => x.toLowerCase() === String(g.code).toLowerCase()); toggleLink(cur || g.code); }}
                                style={{ accentColor:g.color, width:13, height:13, cursor:'pointer', flexShrink:0 }}/>
                              <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:g.color, letterSpacing:1, textTransform:'uppercase' }}>{g.code} · {g.name}</span>
                            </label>
                          : <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:g.color, letterSpacing:1, textTransform:'uppercase', padding:'6px 12px 3px' }}>{g.name}</div>}
                        {g.projs.map(p => {
                          const checked = form.projects.includes(String(p.id));
                          return (
                            <label key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 12px 4px 32px', cursor:'pointer', background: checked ? `${g.color}10` : 'transparent' }}>
                              <input type="checkbox" checked={checked} onChange={() => toggleLink(p.id)}
                                style={{ accentColor: g.color, width:13, height:13, cursor:'pointer', flexShrink:0 }} />
                              <span style={{ fontFamily:'DM Sans', fontSize:12, color: checked ? T.text : T.textMuted }}>{p.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )
            }
            {unknownLinks.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginTop:8 }}>
                <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>Liens historiques conservés :</span>
                {unknownLinks.map(id => (
                  <span key={id} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, background:T.surface2, color:T.textMuted, fontFamily:'DM Sans', padding:'2px 8px', borderRadius:6 }}>
                    {id}<button onClick={() => toggleLink(id)} title="Retirer" style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', padding:0, lineHeight:0 }}><X size={11}/></button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
            <Btn onClick={() => setModal(false)} variant="ghost" color={T.textMuted}>Annuler</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? <Spinner size={14} color="#fff"/> : null}{editing ? 'Mettre à jour' : 'Créer'}</Btn>
          </div>
        </div>
      </Modal>
      </>
      )}
    </div>
  );
}
