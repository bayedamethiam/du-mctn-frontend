import { useState, useEffect, useCallback } from 'react';
import { Mail, Phone, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { teamApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea, Btn, EmptyState } from '../components/UI.jsx';
import { T } from '../theme.js';

const COLORS = ['#06b6d4','#10b981','#8b5cf6','#f59e0b','#3b82f6','#ec4899','#ef4444','#f97316'];
const LEVELS = [
  { v:'1', l:'Niveau 1 — Direction' },
  { v:'2', l:'Niveau 2 — Coordinateur' },
  { v:'3', l:'Niveau 3 — Chargé de mission' },
  { v:'4', l:'Niveau 4 — Assistant' },
];
const EMPTY = { name:'', role:'', level:'3', department:'', initials:'', color:'#06b6d4', expertise:'', email:'', phone:'', bio:'' };

export default function Equipe() {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('hierarchy');
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(EMPTY);

  const load = useCallback(() => {
    teamApi.list().then(setMembers).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit   = m => {
    const expertise = Array.isArray(m.expertise) ? m.expertise : JSON.parse(m.expertise_json || '[]');
    setForm({ name:m.name||'', role:m.role||'', level:String(m.level||3), department:m.department||'', initials:m.initials||'', color:m.color||'#06b6d4', expertise:expertise.join(', '), email:m.email||'', phone:m.phone||'', bio:m.bio||'' });
    setEditing(m); setModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.role) return;
    setSaving(true);
    try {
      const payload = { ...form, level: parseInt(form.level), expertise: form.expertise.split(',').map(s => s.trim()).filter(Boolean) };
      if (editing) {
        const updated = await teamApi.update(editing.id, payload);
        setMembers(ms => ms.map(m => m.id === editing.id ? updated : m));
      } else {
        const created = await teamApi.create(payload);
        setMembers(ms => [...ms, created]);
      }
      setModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce membre ?')) return;
    try {
      await teamApi.delete(id);
      setMembers(ms => ms.filter(m => m.id !== id));
      if (selected === id) setSelected(null);
    } catch (e) { setError(e.message); }
  };

  const byLevel = members.reduce((acc, m) => { (acc[m.level] = acc[m.level] || []).push(m); return acc; }, {});

  const MemberCard = ({ member, featured = false }) => {
    const isSel     = selected === member.id;
    const expertise = Array.isArray(member.expertise) ? member.expertise : JSON.parse(member.expertise_json || '[]');
    return (
      <div onClick={() => setSelected(isSel ? null : member.id)}
        style={{ background:T.surface, border:`1px solid ${isSel?member.color:T.border}`, borderRadius:featured?14:12, padding:featured?'22px 24px':'16px 18px', cursor:'pointer', transition:'all 0.2s', marginBottom:10, boxShadow:isSel?`0 0 0 1px ${member.color}44, 0 8px 30px ${member.color}22`:'' }}>
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
          <div style={{ display:'flex', gap:2, alignItems:'center' }} onClick={e => e.stopPropagation()}>
            <button onClick={e => { e.stopPropagation(); openEdit(member); }} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Modifier"><Pencil size={12}/></button>
            <button onClick={e => handleDelete(member.id, e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Supprimer"><Trash2 size={12}/></button>
            {isSel ? <ChevronUp size={14} color={T.textMuted}/> : <ChevronDown size={14} color={T.textMuted}/>}
          </div>
        </div>
        {isSel && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}` }} className="slide-in">
            <p style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.7, marginBottom:12 }}>{member.bio}</p>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              {member.email && <a href={`mailto:${member.email}`} style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans', fontSize:11, color:T.teal, textDecoration:'none' }}><Mail size={12}/> {member.email}</a>}
              {member.phone && <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans', fontSize:11, color:T.textDim }}><Phone size={12}/> {member.phone}</div>}
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
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ display:'flex', background:T.surface2, borderRadius:8, padding:3, border:`1px solid ${T.border}` }}>
            {[['hierarchy','Hiérarchie'],['grid','Grille']].map(([v,l]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:500, padding:'7px 16px', borderRadius:6, border:'none', background:viewMode===v?T.teal:'transparent', color:viewMode===v?'#fff':T.textMuted, cursor:'pointer', transition:'all 0.2s' }}>{l}</button>
            ))}
          </div>
          <Btn onClick={openCreate} color={T.teal}><Plus size={14}/> Nouveau membre</Btn>
        </div>

        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : members.length === 0
          ? <EmptyState icon={Users} title="Aucun membre" subtitle="Ajoutez des membres à l'équipe en cliquant sur « Nouveau membre »." />
          : viewMode === 'hierarchy'
          ? <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
              <div><Divider label="Direction" color={T.teal}/>
                <div style={{ maxWidth:440, margin:'0 auto' }}>
                  {(byLevel[1]||[]).map(m => <MemberCard key={m.id} member={m} featured/>)}
                </div>
              </div>
              {(byLevel[2]||[]).length > 0 && <>
                <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:1, height:24, background:`linear-gradient(180deg,${T.teal}66,#8b5cf666)` }}/></div>
                <div><Divider label="Coordinateurs" color="#8b5cf6"/>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
                    {(byLevel[2]||[]).map(m => <MemberCard key={m.id} member={m} featured/>)}
                  </div>
                </div>
              </>}
              {(byLevel[3]||[]).length > 0 && <>
                <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:1, height:24, background:`linear-gradient(180deg,#8b5cf666,#10b98166)` }}/></div>
                <div><Divider label="Chargés de mission" color="#10b981"/>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                    {(byLevel[3]||[]).map(m => <MemberCard key={m.id} member={m}/>)}
                  </div>
                </div>
              </>}
              {(byLevel[4]||[]).length > 0 && <>
                <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:1, height:24, background:`linear-gradient(180deg,#10b98166,#f59e0b66)` }}/></div>
                <div><Divider label="Assistants" color="#f59e0b"/>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                    {(byLevel[4]||[]).map(m => <MemberCard key={m.id} member={m}/>)}
                  </div>
                </div>
              </>}
            </div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {members.map(m => <MemberCard key={m.id} member={m}/>)}
            </div>
        }
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le membre' : 'Nouveau membre'} width={580}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Nom complet *</label>
              <Input value={form.name} onChange={f('name')} placeholder="Prénom Nom"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Fonction / Rôle *</label>
              <Input value={form.role} onChange={f('role')} placeholder="Ex: Coordonnateur S&E"/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Niveau hiérarchique</label>
              <Select value={form.level} onChange={f('level')} style={{ width:'100%' }}>
                {LEVELS.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
              </Select>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Département</label>
              <Input value={form.department} onChange={f('department')} placeholder="Ex: S&E, DPI, e-Gov..."/>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Initiales</label>
              <Input value={form.initials} onChange={f('initials')} placeholder="Ex: MD"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Couleur</label>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap', paddingTop:4 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => f('color')(c)} style={{ width:26, height:26, borderRadius:'50%', background:c, border:form.color===c?'3px solid white':'2px solid transparent', cursor:'pointer', transition:'all 0.15s', outline:'none' }}/>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Expertises (séparées par des virgules)</label>
            <Input value={form.expertise} onChange={f('expertise')} placeholder="Ex: Suivi-Évaluation, Indicateurs, Tableau de bord"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Email</label>
              <Input value={form.email} onChange={f('email')} placeholder="prenom.nom@mctn.sn" type="email"/>
            </div>
            <div>
              <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Téléphone</label>
              <Input value={form.phone} onChange={f('phone')} placeholder="+221 77 000 00 00"/>
            </div>
          </div>
          <div>
            <label style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 }}>Biographie / Description du rôle</label>
            <Textarea value={form.bio} onChange={f('bio')} placeholder="Responsabilités et expériences du membre..." rows={3}/>
          </div>
        </div>
        <ModalFooter onCancel={() => setModal(false)} onConfirm={handleSave} loading={saving} confirmLabel={editing ? 'Mettre à jour' : 'Ajouter'}/>
      </Modal>
    </div>
  );
}
