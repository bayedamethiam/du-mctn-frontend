import { useState, useEffect, useCallback } from 'react';
import { Mail, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { teamApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';

export default function Equipe() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('hierarchy');

  const load = useCallback(() => {
    teamApi.list().then(setMembers).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const byLevel = members.reduce((acc, m) => { (acc[m.level] = acc[m.level] || []).push(m); return acc; }, {});

  const MemberCard = ({ member, featured = false }) => {
    const isSel    = selected === member.id;
    const expertise = Array.isArray(member.expertise) ? member.expertise : JSON.parse(member.expertise_json || '[]');
    return (
      <div onClick={() => setSelected(isSel ? null : member.id)}
        style={{ background:T.surface, border:`1px solid ${isSel?member.color:T.border}`, borderRadius:featured?14:12, padding:featured?'22px 24px':'16px 18px', cursor:'pointer', transition:'all 0.2s', boxShadow:isSel?`0 0 0 1px ${member.color}44, 0 8px 30px ${member.color}22`:'' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:featured?18:14 }}>
          <div style={{ flexShrink:0, width:featured?56:44, height:featured?56:44, borderRadius:'50%', background:`linear-gradient(135deg,${member.color}44,${member.color}22)`, border:`2px solid ${member.color}66`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontFamily:'DM Sans', fontWeight:700, fontSize:featured?18:14, color:member.color }}>{member.initials}</span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'EB Garamond', fontSize:featured?20:16, fontWeight:500, color:T.text, lineHeight:1.2 }}>{member.name}</div>
            <div style={{ fontFamily:'DM Sans', fontSize:featured?12:11, color:member.color, fontWeight:600, marginTop:2 }}>{member.role}</div>
            <div style={{ display:'flex', gap:5, marginTop:8, flexWrap:'wrap' }}>
              {expertise.slice(0, featured?4:2).map((e,i) => <span key={i} style={{ background:`${member.color}15`, color:member.color, fontFamily:'DM Sans', fontSize:10, padding:'2px 7px', borderRadius:4 }}>{e}</span>)}
            </div>
          </div>
          {isSel?<ChevronUp size={14} color={T.textMuted}/>:<ChevronDown size={14} color={T.textMuted}/>}
        </div>
        {isSel && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}` }} className="slide-in">
            <p style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.7, marginBottom:12 }}>{member.bio}</p>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              <a href={`mailto:${member.email}`} style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans', fontSize:11, color:T.teal, textDecoration:'none' }}><Mail size={12}/> {member.email}</a>
              <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans', fontSize:11, color:T.textDim }}><Phone size={12}/> {member.phone}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const Divider = ({ label, color }) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0 12px' }}>
      <div style={{ height:1, flex:1, background:`linear-gradient(90deg,${color}44,transparent)` }}/>
      <span style={{ fontFamily:'DM Sans', fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color }}>{label}</span>
      <div style={{ height:1, flex:1, background:`linear-gradient(90deg,transparent,${color}44)` }}/>
    </div>
  );

  return (
    <div className="fade-in">
      <HeroBanner eyebrow="Unité de Livraison · MCTN" title="Équipe & Organisation"
        subtitle="Ministère de la Communication, des Télécommunications et du Numérique"
        stats={[{ value:members.length, label:'Membres' }, { value:'4', label:'Niveaux' }, { value:'7', label:'Départements', color:'#10b981' }]} />
      <div style={{ padding:28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:24 }}>
          <div style={{ display:'flex', background:T.surface2, borderRadius:8, padding:3, border:`1px solid ${T.border}` }}>
            {[['hierarchy','Hiérarchie'],['grid','Grille']].map(([v,l]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:500, padding:'7px 16px', borderRadius:6, border:'none', background:viewMode===v?T.teal:'transparent', color:viewMode===v?'#fff':T.textMuted, cursor:'pointer', transition:'all 0.2s' }}>{l}</button>
            ))}
          </div>
        </div>
        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : viewMode === 'hierarchy'
            ? <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
                <div><Divider label="Direction" color={T.teal}/>
                  <div style={{ maxWidth:440, margin:'0 auto' }}>
                    {(byLevel[1]||[]).map(m => <MemberCard key={m.id} member={m} featured/>)}
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:1, height:24, background:`linear-gradient(180deg,${T.teal}66,#8b5cf666)` }}/></div>
                <div><Divider label="Coordinateurs" color="#8b5cf6"/>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
                    {(byLevel[2]||[]).map(m => <MemberCard key={m.id} member={m} featured/>)}
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:1, height:24, background:`linear-gradient(180deg,#8b5cf666,#10b98166)` }}/></div>
                <div><Divider label="Chargés de mission" color="#10b981"/>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                    {(byLevel[3]||[]).map(m => <MemberCard key={m.id} member={m}/>)}
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:1, height:24, background:`linear-gradient(180deg,#10b98166,#f59e0b66)` }}/></div>
                <div><Divider label="Assistants" color="#f59e0b"/>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                    {(byLevel[4]||[]).map(m => <MemberCard key={m.id} member={m}/>)}
                  </div>
                </div>
              </div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                {members.map(m => <MemberCard key={m.id} member={m}/>)}
              </div>
        }
      </div>
    </div>
  );
}
