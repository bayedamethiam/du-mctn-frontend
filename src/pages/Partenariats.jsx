import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Building, Mail, Calendar, Upload, File, X, Paperclip } from 'lucide-react';
import { partnershipsApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Btn, Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';

const TYPES = [
  { id:'all', label:'Tous', color: T.teal },
  { id:'bailleur', label:'Bailleurs', color:'#10b981' },
  { id:'fondation', label:'Fondations', color:'#8b5cf6' },
  { id:'bilateral', label:'Bilatéraux', color:'#f59e0b' },
  { id:'multilateral', label:'Multilatéraux', color:'#3b82f6' },
  { id:'ong', label:'ONG', color:'#ec4899' },
];
const FT = { pdf:{color:'#ef4444',label:'PDF'}, word:{color:'#3b82f6',label:'Word'}, excel:{color:'#10b981',label:'Excel'}, default:{color:T.textDim,label:'Doc'} };

export default function Partenariats() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [typeF, setTypeF]       = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [uploading, setUploading] = useState({});
  const fileRefs = useRef({});

  const load = useCallback(() => {
    partnershipsApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = typeF === 'all' ? items : items.filter(p => p.type === typeF);

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

  const totalDocs = items.reduce((s, p) => s + (p.documents?.length || 0), 0);

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Partenariats stratégiques" title="Partenaires techniques & financiers"
        subtitle="Bailleurs, fondations, bilatéraux, ONG · Documents & suivi des accords" color="#10b981"
        stats={[{ value: items.length, label: 'Partenaires actifs' }, { value: totalDocs, label: 'Documents joints', color: '#10b981' }]} />
      <div style={{ padding: 28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${T.border}`, overflowX: 'auto' }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setTypeF(t.id)}
              style={{ fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500, padding: '14px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${typeF === t.id ? t.color : 'transparent'}`, color: typeF === t.id ? t.color : T.textMuted, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
              {t.label}
              {t.id !== 'all' && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>{items.filter(p => p.type === t.id).length}</span>}
            </button>
          ))}
        </div>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filtered.map(p => {
                const tc  = TYPES.find(t => t.id === p.type) || TYPES[0];
                const isExp = expanded === p.id;
                const projects = Array.isArray(p.projects) ? p.projects : JSON.parse(p.projects || '[]');
                return (
                  <Card key={p.id}>
                    <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : p.id)}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${tc.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building size={20} color={tc.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <h4 style={{ fontFamily: 'EB Garamond', fontSize: 18, color: T.text }}>{p.name}</h4>
                          <span style={{ background: `${tc.color}22`, color: tc.color, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4 }}>{tc.label}</span>
                          <Badge status={p.status} />
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{p.country}</span>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.teal, fontWeight: 600 }}>{p.amount}</span>
                          <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textDim }}>{projects.join(' · ')}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {(p.documents || []).length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${T.teal}15`, borderRadius: 6, padding: '4px 10px' }}>
                            <Paperclip size={12} color={T.teal} />
                            <span style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.teal, fontWeight: 600 }}>{p.documents.length}</span>
                          </div>
                        )}
                        {isExp ? <ChevronUp size={16} color={T.textMuted} /> : <ChevronDown size={16} color={T.textMuted} />}
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ borderTop: `1px solid ${T.border}`, padding: '18px 22px' }} className="slide-in">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                          <div>
                            <p style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textDim, marginBottom: 8 }}>Description</p>
                            <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>{p.description}</p>
                          </div>
                          <div>
                            <p style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textDim, marginBottom: 8 }}>Contact</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building size={13} color={T.textDim} /><span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{p.contact}</span></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={13} color={T.textDim} /><span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.teal }}>{p.email}</span></div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={13} color={T.textDim} /><span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{p.start_date} → {p.end_date}</span></div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <p style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textDim }}>Documents ({(p.documents || []).length})</p>
                            <div>
                              <input ref={el => fileRefs.current[p.id] = el} type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.pptx" style={{ display: 'none' }} onChange={e => handleUpload(p.id, e.target.files)} />
                              <Btn onClick={() => fileRefs.current[p.id]?.click()} variant="outline" color={T.teal} size="sm" disabled={uploading[p.id]}>
                                {uploading[p.id] ? <Spinner size={12} color={T.teal} /> : <Upload size={12} />} Joindre
                              </Btn>
                            </div>
                          </div>
                          {(p.documents || []).length === 0
                            ? <div style={{ padding: 16, background: T.surface2, borderRadius: 8, textAlign: 'center', fontFamily: 'DM Sans', fontSize: 12, color: T.textDim }}>Aucun document joint</div>
                            : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                              {(p.documents || []).map(doc => {
                                const ft = FT[doc.file_type] || FT.default;
                                return (
                                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: T.surface2, borderRadius: 8, border: `1px solid ${T.border}` }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 6, background: `${ft.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><File size={14} color={ft.color} /></div>
                                    <div style={{ flex: 1 }}>
                                      <button onClick={() => partnershipsApi.downloadDoc(p.id, doc.id, doc.name)} style={{ background: 'none', border: 'none', fontFamily: 'DM Sans', fontSize: 13, color: T.teal, cursor: 'pointer', padding: 0, textAlign: 'left' }}>{doc.name}</button>
                                      <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>{ft.label} · {doc.size} · {doc.date}</div>
                                    </div>
                                    <button onClick={() => removeDoc(p.id, doc.id)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer' }}
                                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = T.textDim}>
                                      <X size={14} />
                                    </button>
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
    </div>
  );
}
