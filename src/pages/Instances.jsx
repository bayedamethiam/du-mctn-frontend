import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Award, Send, Plus, Pencil, Globe } from 'lucide-react';
import { instancesApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Btn, Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea } from '../components/UI.jsx';
import { T, scoreColor } from '../theme.js';

const REP_CATS = [
  { id:'all',       label:'Toutes',                  color:T.teal },
  { id:'onu',       label:'Système ONU',              color:'#3b82f6' },
  { id:'ua',        label:'Union Africaine',          color:'#f59e0b' },
  { id:'regional',  label:'Régional CEDEAO/UEMOA',   color:'#10b981' },
  { id:'industrie', label:'Industrie & Standards',   color:'#8b5cf6' },
  { id:'multilat',  label:'Multilatéral',             color:'#ec4899' },
];
const NIV = {
  absent:   { label:'Absent',          color:'#ef4444' },
  observ:   { label:'Observateur',     color:'#f59e0b' },
  membre:   { label:'Membre actif',    color:T.teal },
  influent: { label:'Acteur influent', color:'#10b981' },
  leader:   { label:'Leadeur',         color:'#a78bfa' },
};

const INST_EMPTY = { acronym:'', name:'', category:'onu', siege:'', niveau:'membre', responsible:'', focal:'', ndt_link:'', priority:'moyenne', score_presence:'10', score_contribution:'10', score_postes:'10', score_suivi:'10', mandats:'', gaps:'', next_meeting_label:'', next_meeting_date:'', next_meeting_lieu:'' };
const CONTRIB_EMPTY = { titre:'', date:'', statut:'planifie', impact:'moyenne' };

const Gauge = ({ value, size=52 }) => {
  const r=(size-8)/2, c=2*Math.PI*r, off=c-(value/100)*c, col=scoreColor(value);
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:col }}>{value}</span>
      </div>
    </div>
  );
};

const PillarBar = ({ label, value, max=25, color }) => (
  <div>
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
      <span style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>{label}</span>
      <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color }}>{value}/{max}</span>
    </div>
    <div style={{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden' }}>
      <div style={{ width:`${(value/max)*100}%`, height:'100%', background:color, borderRadius:2, transition:'width 0.7s ease' }}/>
    </div>
  </div>
);

export default function Instances() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [catF, setCatF]         = useState('all');
  const [selected, setSelected] = useState(null);

  // Instance modal
  const [instModal, setInstModal]   = useState(false);
  const [editingInst, setEditingInst] = useState(null);
  const [savingInst, setSavingInst]   = useState(false);
  const [instForm, setInstForm]       = useState(INST_EMPTY);

  // Contribution modal
  const [contribModal, setContribModal] = useState(false);
  const [contribInstId, setContribInstId] = useState(null);
  const [savingContrib, setSavingContrib] = useState(false);
  const [contribForm, setContribForm]     = useState(CONTRIB_EMPTY);

  const load = useCallback(() => {
    instancesApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const fi = k => v => setInstForm(p => ({ ...p, [k]: v }));
  const fc = k => v => setContribForm(p => ({ ...p, [k]: v }));

  const openCreateInst = () => { setInstForm(INST_EMPTY); setEditingInst(null); setInstModal(true); };
  const openEditInst   = (inst, e) => {
    e.stopPropagation();
    const mandats = Array.isArray(inst.mandats) ? inst.mandats : JSON.parse(inst.mandats_json||'[]');
    const gaps    = Array.isArray(inst.gaps) ? inst.gaps : JSON.parse(inst.gaps_json||'[]');
    setInstForm({
      acronym:           inst.acronym||'',
      name:              inst.name||'',
      category:          inst.category||'onu',
      siege:             inst.siege||'',
      niveau:            inst.niveau||'membre',
      responsible:       inst.responsible||'',
      focal:             inst.focal||'',
      ndt_link:          inst.ndt_link||'',
      priority:          inst.priority||'moyenne',
      score_presence:    String(inst.scores?.presence || inst.score_presence || 10),
      score_contribution:String(inst.scores?.contribution || inst.score_contribution || 10),
      score_postes:      String(inst.scores?.postes || inst.score_postes || 10),
      score_suivi:       String(inst.scores?.suivi || inst.score_suivi || 10),
      mandats:           mandats.join('\n'),
      gaps:              gaps.join('\n'),
      next_meeting_label:inst.nextMeeting?.label || inst.next_meeting_label||'',
      next_meeting_date: inst.nextMeeting?.date  || inst.next_meeting_date||'',
      next_meeting_lieu: inst.nextMeeting?.lieu  || inst.next_meeting_lieu||'',
    });
    setEditingInst(inst); setInstModal(true);
  };

  const handleSaveInst = async () => {
    if (!instForm.acronym || !instForm.name) return;
    setSavingInst(true);
    try {
      const payload = {
        ...instForm,
        score_presence:     parseInt(instForm.score_presence)||0,
        score_contribution: parseInt(instForm.score_contribution)||0,
        score_postes:       parseInt(instForm.score_postes)||0,
        score_suivi:        parseInt(instForm.score_suivi)||0,
        mandats:  instForm.mandats.split('\n').map(s=>s.trim()).filter(Boolean),
        gaps:     instForm.gaps.split('\n').map(s=>s.trim()).filter(Boolean),
      };
      if (editingInst) {
        const updated = await instancesApi.update(editingInst.id, payload);
        setItems(its => its.map(i => i.id === editingInst.id ? updated : i));
      } else {
        const created = await instancesApi.create(payload);
        setItems(its => [...its, created]);
      }
      setInstModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingInst(false); }
  };

  const openAddContrib = (instId, e) => {
    e.stopPropagation();
    setContribForm(CONTRIB_EMPTY);
    setContribInstId(instId);
    setContribModal(true);
  };

  const handleSaveContrib = async () => {
    if (!contribForm.titre) return;
    setSavingContrib(true);
    try {
      const created = await instancesApi.createContribution(contribInstId, contribForm);
      setItems(its => its.map(i => i.id === contribInstId ? { ...i, contributions:[...(i.contributions||[]), created] } : i));
      setContribModal(false);
    } catch (e) { setError(e.message); }
    finally { setSavingContrib(false); }
  };

  const handleDeleteContrib = async (instId, contribId, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette contribution ?')) return;
    try {
      await instancesApi.deleteContribution(instId, contribId);
      setItems(its => its.map(i => i.id === instId ? { ...i, contributions:(i.contributions||[]).filter(c=>c.id!==contribId) } : i));
    } catch (e) { setError(e.message); }
  };

  const filtered     = catF === 'all' ? items : items.filter(i => i.category === catF);
  const avgScore     = items.length ? Math.round(items.reduce((s,i) => s + (i.scores?.presence||0) + (i.scores?.contribution||0) + (i.scores?.postes||0) + (i.scores?.suivi||0), 0) / items.length) : 0;
  const leaders      = items.filter(i => ['leader','influent'].includes(i.niveau)).length;
  const allContribs  = items.flatMap(i => i.contributions || []);
  const totalGaps    = items.reduce((s,i) => s + (i.gaps||[]).length, 0);

  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingMeetings = items
    .filter(i => i.next_meeting_date || i.nextMeeting?.date)
    .map(i => ({
      inst: i,
      label: i.nextMeeting?.label || i.next_meeting_label || '',
      date:  i.nextMeeting?.date  || i.next_meeting_date  || '',
      lieu:  i.nextMeeting?.lieu  || i.next_meeting_lieu  || '',
    }))
    .filter(m => m.date && new Date(m.date) >= today)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const daysUntil = d => Math.ceil((new Date(d) - today) / 86400000);
  const urgencyColor = d => { const n = daysUntil(d); return n <= 30 ? '#ef4444' : n <= 90 ? '#f59e0b' : '#10b981'; };

  const statC = { soumis:{color:'#10b981',label:'Soumis'}, en_cours:{color:T.teal,label:'En cours'}, planifie:{color:'#f59e0b',label:'Planifié'} };

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Représentation internationale" title="Présence du Sénégal dans les instances mondiales"
        subtitle="Qualité de présence et contributions techniques · NDT 2025–2034" color="#8b5cf6"
        stats={[
          { value:`${avgScore}/100`, label:'Score moyen', color:scoreColor(avgScore) },
          { value:`${leaders}/${items.length}`, label:'Bien représenté', color:'#10b981' },
          { value:allContribs.length, label:'Contributions', color:T.teal },
          { value:totalGaps, label:'Lacunes identifiées', color:'#f59e0b' },
          { value:upcomingMeetings.length, label:'Réunions à venir', color:'#8b5cf6' },
        ]} />
      <div style={{ padding:28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')}/>
        {totalGaps > 0 && (
          <div style={{ background:'linear-gradient(135deg,#1a0a2e,#0f1a38)', border:'1px solid #8b5cf633', borderRadius:12, padding:'14px 20px', marginBottom:20, display:'flex', gap:14, alignItems:'flex-start' }}>
            <AlertCircle size={18} color="#f59e0b" style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:'#f59e0b', letterSpacing:1, textTransform:'uppercase', marginBottom:6 }}>{totalGaps} lacunes identifiées · Priorités d'action NDT</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {items.filter(i=>i.priority==='critique').map(i=>(
                  <span key={i.id} style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, background:'#ef444420', color:'#ef4444', padding:'3px 10px', borderRadius:20, border:'1px solid #ef444430' }}>{i.acronym} — {(i.gaps||[]).length} lacune{(i.gaps||[]).length>1?'s':''}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {REP_CATS.map(c => (
              <Btn key={c.id} onClick={() => setCatF(c.id)} variant={catF===c.id?'ghost':'outline'} color={catF===c.id?c.color:T.textDim} size="sm">
                {c.label} <span style={{ opacity:0.6, fontSize:10, marginLeft:2 }}>{c.id==='all'?items.length:items.filter(i=>i.category===c.id).length}</span>
              </Btn>
            ))}
          </div>
          <Btn onClick={openCreateInst} color="#8b5cf6"><Plus size={14}/> Nouvelle instance</Btn>
        </div>
        {/* ── Prochaines réunions ── */}
        {!loading && upcomingMeetings.length > 0 && (
          <Card style={{ marginBottom:20 }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#8b5cf6' }}>Prochaines réunions & forums</span>
              <span style={{ fontSize:10, background:'rgba(139,92,246,0.15)', color:'#8b5cf6', borderRadius:8, padding:'1px 8px', fontFamily:'DM Sans', fontWeight:700 }}>{upcomingMeetings.length}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:0 }}>
              {upcomingMeetings.map((m, idx) => {
                const catC = REP_CATS.find(c=>c.id===m.inst.category)?.color || T.teal;
                const uc   = urgencyColor(m.date);
                const days = daysUntil(m.date);
                return (
                  <div key={m.inst.id} style={{ padding:'12px 16px', borderRight: idx < upcomingMeetings.length-1 ? `1px solid ${T.border}` : 'none', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:38, height:38, borderRadius:8, background:`${uc}15`, border:`1px solid ${uc}30`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:800, color:uc, lineHeight:1 }}>{m.date?.slice(8)}</div>
                      <div style={{ fontFamily:'DM Sans', fontSize:9, color:T.textDim, textTransform:'uppercase' }}>{['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][parseInt(m.date?.slice(5,7))-1]}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, color:catC }}>{m.inst.acronym}</div>
                      <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.text, lineHeight:1.3, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.label || 'Réunion'}</div>
                      {m.lieu && <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim }}>📍 {m.lieu}</div>}
                      <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, color:uc, marginTop:2 }}>
                        {days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : filtered.length === 0
          ? <div style={{ padding:'48px 24px', textAlign:'center', background:T.surface, borderRadius:12, border:`1px solid ${T.border}` }}>
              <Globe size={36} color="#8b5cf6" style={{ margin:'0 auto 12px', opacity:0.4 }}/>
              <div style={{ fontFamily:'EB Garamond', fontSize:20, color:T.textMuted, marginBottom:6 }}>Aucune instance</div>
              <div style={{ fontFamily:'DM Sans', fontSize:13, color:T.textDim }}>Ajoutez des instances de représentation internationale.</div>
            </div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
            {filtered.map(inst => {
              const score = (inst.scores?.presence||0)+(inst.scores?.contribution||0)+(inst.scores?.postes||0)+(inst.scores?.suivi||0);
              const niv   = NIV[inst.niveau] || NIV.membre;
              const catC  = REP_CATS.find(c=>c.id===inst.category)?.color || T.teal;
              const isSel = selected === inst.id;
              return (
                <div key={inst.id} style={{ background:T.surface, border:`1px solid ${isSel?catC:T.border}`, borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'all 0.2s', boxShadow:isSel?`0 0 0 1px ${catC}44`:'' }}
                  onClick={() => setSelected(isSel?null:inst.id)}>
                  <div style={{ height:3, background:`linear-gradient(90deg,${catC},${niv.color})` }}/>
                  <div style={{ padding:'16px 18px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                      <Gauge value={score} size={54}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                          <span style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:800, color:catC }}>{inst.acronym}</span>
                          <span style={{ background:`${niv.color}22`, color:niv.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>{niv.label}</span>
                          {inst.priority==='critique'&&<span style={{ background:'#ef444420', color:'#ef4444', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>Critique</span>}
                        </div>
                        <div style={{ fontFamily:'EB Garamond', fontSize:14, color:T.text, lineHeight:1.3, marginBottom:3 }}>{inst.name}</div>
                        <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>{inst.siege} · Resp. {inst.responsible}</div>
                      </div>
                      <button onClick={e => openEditInst(inst, e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Modifier"><Pencil size={12}/></button>
                      {isSel?<ChevronUp size={14} color={T.textDim}/>:<ChevronDown size={14} color={T.textDim}/>}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 14px', marginBottom:10 }}>
                      <PillarBar label="Présence"      value={inst.scores?.presence||0}     color={scoreColor((inst.scores?.presence||0)/25*100)}/>
                      <PillarBar label="Contributions" value={inst.scores?.contribution||0} color={scoreColor((inst.scores?.contribution||0)/25*100)}/>
                      <PillarBar label="Postes"        value={inst.scores?.postes||0}       color={scoreColor((inst.scores?.postes||0)/25*100)}/>
                      <PillarBar label="Suivi"         value={inst.scores?.suivi||0}        color={scoreColor((inst.scores?.suivi||0)/25*100)}/>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                      <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>🗓 {inst.nextMeeting?.label||inst.next_meeting_label}</span>
                      <div style={{ display:'flex', gap:6 }}>
                        {(inst.contributions||[]).filter(c=>c.statut==='soumis').length>0&&<span style={{ fontFamily:'DM Sans', fontSize:10, color:'#10b981', background:'#10b98115', padding:'2px 7px', borderRadius:8 }}>{(inst.contributions||[]).filter(c=>c.statut==='soumis').length} contrib.</span>}
                        {(inst.gaps||[]).length>0&&<span style={{ fontFamily:'DM Sans', fontSize:10, color:'#f59e0b', background:'#f59e0b15', padding:'2px 7px', borderRadius:8 }}>{(inst.gaps||[]).length} lacune{(inst.gaps||[]).length>1?'s':''}</span>}
                      </div>
                    </div>
                  </div>
                  {isSel && (
                    <div style={{ borderTop:`1px solid ${T.border}`, padding:'16px 18px', background:'rgba(255,255,255,0.025)' }} className="slide-in" onClick={e=>e.stopPropagation()}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>Mandats</div>
                          {(inst.mandats||[]).length>0
                            ? (inst.mandats||[]).map((m,i)=><div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom:5 }}><Award size={11} color={catC} style={{ marginTop:2, flexShrink:0 }}/><span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.4 }}>{m}</span></div>)
                            : <span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textDim, fontStyle:'italic' }}>Aucun mandat actuel</span>
                          }
                        </div>
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>Lien NDT</div>
                          <div style={{ background:`${catC}15`, borderRadius:8, padding:'8px 10px', border:`1px solid ${catC}25` }}>
                            <span style={{ fontFamily:'DM Sans', fontSize:11, color:catC }}>{inst.ndt_link}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginBottom:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim }}>Contributions ({(inst.contributions||[]).length})</div>
                          <Btn onClick={e => openAddContrib(inst.id, e)} size="sm" variant="outline" color={catC}><Plus size={11}/> Ajouter</Btn>
                        </div>
                        {(inst.contributions||[]).map(c=>{
                          const sc=statC[c.statut]||{color:T.textDim,label:c.statut};
                          return <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'7px 10px', background:T.surface2, borderRadius:7, marginBottom:5, borderLeft:`2px solid ${sc.color}` }}>
                            <Send size={11} color={sc.color} style={{ marginTop:2, flexShrink:0 }}/>
                            <div style={{ flex:1 }}>
                              <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.text }}>{c.titre}</div>
                              <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, marginTop:1 }}>{c.date}</div>
                            </div>
                            <span style={{ background:`${sc.color}20`, color:sc.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8 }}>{sc.label}</span>
                            <button onClick={e => handleDeleteContrib(inst.id, c.id, e)} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:16, lineHeight:1 }} title="Supprimer">×</button>
                          </div>;
                        })}
                      </div>
                      {(inst.gaps||[]).length>0&&(
                        <div>
                          <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#f59e0b', marginBottom:8 }}>Lacunes & recommandations</div>
                          {(inst.gaps||[]).map((g,i)=><div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'5px 0', borderBottom:i<(inst.gaps||[]).length-1?`1px solid rgba(255,255,255,0.04)`:'none' }}><div style={{ width:5, height:5, borderRadius:'50%', background:'#f59e0b', marginTop:5, flexShrink:0 }}/><span style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.5 }}>{g}</span></div>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* Modal instance */}
      <Modal open={instModal} onClose={() => setInstModal(false)} title={editingInst ? 'Modifier l\'instance' : 'Nouvelle instance'} width={600}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Acronyme *</label>
              <Input value={instForm.acronym} onChange={fi('acronym')} placeholder="Ex: UIT"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Nom complet *</label>
              <Input value={instForm.name} onChange={fi('name')} placeholder="Ex: Union Internationale des Télécommunications"/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Catégorie</label>
              <Select value={instForm.category} onChange={fi('category')} style={{ width:'100%' }}>
                {REP_CATS.slice(1).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Niveau</label>
              <Select value={instForm.niveau} onChange={fi('niveau')} style={{ width:'100%' }}>
                {Object.entries(NIV).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Priorité</label>
              <Select value={instForm.priority} onChange={fi('priority')} style={{ width:'100%' }}>
                <option value="normale">Normale</option>
                <option value="moyenne">Moyenne</option>
                <option value="elevee">Élevée</option>
                <option value="critique">Critique</option>
              </Select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Siège</label>
              <Input value={instForm.siege} onChange={fi('siege')} placeholder="Ville, Pays"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Responsable</label>
              <Input value={instForm.responsible} onChange={fi('responsible')} placeholder="Nom et prénom"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Point focal</label>
              <Input value={instForm.focal} onChange={fi('focal')} placeholder="Point focal technique"/>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Lien NDT</label>
            <Input value={instForm.ndt_link} onChange={fi('ndt_link')} placeholder="Ex: Axe 1 — Infrastructure · P09 Innovation & IA"/>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Scores (0–25 par pilier)</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
              {[['score_presence','Présence'],['score_contribution','Contribution'],['score_postes','Postes'],['score_suivi','Suivi']].map(([k,l]) => (
                <div key={k}>
                  <label style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, display:'block', marginBottom:4 }}>{l}</label>
                  <Input value={instForm[k]} onChange={fi(k)} type="number" placeholder="0–25"/>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Mandats (un par ligne)</label>
              <Textarea value={instForm.mandats} onChange={fi('mandats')} placeholder="Ex: Membre du Conseil&#10;Vice-président commission..." rows={3}/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Lacunes (une par ligne)</label>
              <Textarea value={instForm.gaps} onChange={fi('gaps')} placeholder="Ex: Faible participation aux groupes de travail..." rows={3}/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Prochaine réunion</label>
              <Input value={instForm.next_meeting_label} onChange={fi('next_meeting_label')} placeholder="Ex: Assemblée mondiale 2026"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date</label>
              <Input value={instForm.next_meeting_date} onChange={fi('next_meeting_date')} type="date"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Lieu</label>
              <Input value={instForm.next_meeting_lieu} onChange={fi('next_meeting_lieu')} placeholder="Ville, Pays"/>
            </div>
          </div>
        </div>
        <ModalFooter onCancel={() => setInstModal(false)} onConfirm={handleSaveInst} loading={savingInst} confirmLabel={editingInst ? 'Mettre à jour' : 'Créer l\'instance'} color="#8b5cf6"/>
      </Modal>

      {/* Modal contribution */}
      <Modal open={contribModal} onClose={() => setContribModal(false)} title="Ajouter une contribution" width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Titre de la contribution *</label>
            <Input value={contribForm.titre} onChange={fc('titre')} placeholder="Ex: Soumission position Sénégal sur la résolution 45"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Date</label>
              <Input value={contribForm.date} onChange={fc('date')} type="date"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Statut</label>
              <Select value={contribForm.statut} onChange={fc('statut')} style={{ width:'100%' }}>
                <option value="planifie">Planifié</option>
                <option value="en_cours">En cours</option>
                <option value="soumis">Soumis</option>
              </Select>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Impact</label>
              <Select value={contribForm.impact} onChange={fc('impact')} style={{ width:'100%' }}>
                <option value="faible">Faible</option>
                <option value="moyenne">Moyenne</option>
                <option value="elevee">Élevée</option>
              </Select>
            </div>
          </div>
        </div>
        <ModalFooter onCancel={() => setContribModal(false)} onConfirm={handleSaveContrib} loading={savingContrib} confirmLabel="Ajouter" color="#8b5cf6"/>
      </Modal>
    </div>
  );
}
