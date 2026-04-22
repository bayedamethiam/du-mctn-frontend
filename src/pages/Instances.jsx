import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Award, Send } from 'lucide-react';
import { instancesApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Btn, Spinner, ErrorBanner } from '../components/UI.jsx';
import { T, scoreColor } from '../theme.js';

const REP_CATS = [
  { id:'all', label:'Toutes', color:T.teal },
  { id:'onu', label:'Système ONU', color:'#3b82f6' },
  { id:'ua', label:'Union Africaine', color:'#f59e0b' },
  { id:'regional', label:'Régional CEDEAO/UEMOA', color:'#10b981' },
  { id:'industrie', label:'Industrie & Standards', color:'#8b5cf6' },
  { id:'multilat', label:'Multilatéral', color:'#ec4899' },
];
const NIV = { absent:{label:'Absent',color:'#ef4444'}, observ:{label:'Observateur',color:'#f59e0b'}, membre:{label:'Membre actif',color:T.teal}, influent:{label:'Acteur influent',color:'#10b981'}, leader:{label:'Leadeur',color:'#a78bfa'} };

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

  const load = useCallback(() => {
    instancesApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered   = catF === 'all' ? items : items.filter(i => i.category === catF);
  const avgScore   = items.length ? Math.round(items.reduce((s,i) => s + (i.scores?.presence||0) + (i.scores?.contribution||0) + (i.scores?.postes||0) + (i.scores?.suivi||0), 0) / items.length) : 0;
  const leaders    = items.filter(i => ['leader','influent'].includes(i.niveau)).length;
  const allContribs = items.flatMap(i => i.contributions || []);
  const totalGaps  = items.reduce((s,i) => s + (i.gaps||[]).length, 0);

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Représentation internationale" title="Présence du Sénégal dans les instances mondiales"
        subtitle="Qualité de présence et contributions techniques · NDT 2025–2034" color="#8b5cf6"
        stats={[
          { value:`${avgScore}/100`, label:'Score moyen', color:scoreColor(avgScore) },
          { value:`${leaders}/${items.length}`, label:'Bien représenté', color:'#10b981' },
          { value:allContribs.length, label:'Contributions', color:T.teal },
          { value:totalGaps, label:'Lacunes identifiées', color:'#f59e0b' },
        ]} />
      <div style={{ padding:28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
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
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {REP_CATS.map(c => (
            <Btn key={c.id} onClick={() => setCatF(c.id)} variant={catF===c.id?'ghost':'outline'} color={catF===c.id?c.color:T.textDim} size="sm">
              {c.label} <span style={{ opacity:0.6, fontSize:10, marginLeft:2 }}>{c.id==='all'?items.length:items.filter(i=>i.category===c.id).length}</span>
            </Btn>
          ))}
        </div>
        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
            {filtered.map(inst => {
              const score = (inst.scores?.presence||0)+(inst.scores?.contribution||0)+(inst.scores?.postes||0)+(inst.scores?.suivi||0);
              const niv   = NIV[inst.niveau] || NIV.membre;
              const catC  = REP_CATS.find(c=>c.id===inst.category)?.color || T.teal;
              const isSel = selected === inst.id;
              const statC = { soumis:{color:'#10b981',label:'Soumis'}, en_cours:{color:T.teal,label:'En cours'}, planifie:{color:'#f59e0b',label:'Planifié'} };
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
                      {isSel?<ChevronUp size={14} color={T.textDim}/>:<ChevronDown size={14} color={T.textDim}/>}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 14px', marginBottom:10 }}>
                      <PillarBar label="Présence" value={inst.scores?.presence||0} color={scoreColor((inst.scores?.presence||0)/25*100)}/>
                      <PillarBar label="Contributions" value={inst.scores?.contribution||0} color={scoreColor((inst.scores?.contribution||0)/25*100)}/>
                      <PillarBar label="Postes" value={inst.scores?.postes||0} color={scoreColor((inst.scores?.postes||0)/25*100)}/>
                      <PillarBar label="Suivi" value={inst.scores?.suivi||0} color={scoreColor((inst.scores?.suivi||0)/25*100)}/>
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
                        <div style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:T.textDim, marginBottom:8 }}>Contributions ({(inst.contributions||[]).length})</div>
                        {(inst.contributions||[]).map(c=>{
                          const sc=statC[c.statut]||{color:T.textDim,label:c.statut};
                          return <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'7px 10px', background:T.surface2, borderRadius:7, marginBottom:5, borderLeft:`2px solid ${sc.color}` }}>
                            <Send size={11} color={sc.color} style={{ marginTop:2, flexShrink:0 }}/>
                            <div style={{ flex:1 }}>
                              <div style={{ fontFamily:'DM Sans', fontSize:12, color:T.text }}>{c.titre}</div>
                              <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, marginTop:1 }}>{c.date}</div>
                            </div>
                            <span style={{ background:`${sc.color}20`, color:sc.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8 }}>{sc.label}</span>
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
    </div>
  );
}
