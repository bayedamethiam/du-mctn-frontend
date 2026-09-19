import { useState, useEffect, useCallback } from 'react';
import { Mail, Phone, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Users, RotateCcw, UserCheck, UserPlus } from 'lucide-react';
import { api, teamApi, programsApi, usersApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Spinner, ErrorBanner, Modal, ModalFooter, Input, Select, Textarea, Btn, EmptyState } from '../components/UI.jsx';
import PasswordChecklist, { usePasswordPolicy } from '../components/PasswordChecklist.jsx';
import { checkPassword } from '../utils/passwordPolicy.js';
import { T } from '../theme.js';
import { useRefData } from '../context/RefContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { hasPerm } from '../permissions.js';

const COLORS = ['#06b6d4','#10b981','#8b5cf6','#f59e0b','#3b82f6','#ec4899','#ef4444','#f97316'];
/* Libellé unique des membres sans pôle (vues Hiérarchie et Pôles) */
const NO_POLE = 'Sans pôle';
const EMPTY = { name:'', role:'', level:'', department:'', initials:'', color:'#06b6d4', expertise:'', email:'', phone:'', bio:'', user_id:'' };
const lbl = { fontFamily:'DM Sans', fontSize:11, color:T.textDim, display:'block', marginBottom:5 };
const parseExpertise = m => { if (Array.isArray(m.expertise)) return m.expertise; try { const a = JSON.parse(m.expertise_json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };

/* Accès applicatif du membre : account.status renvoyé par GET /team (null = aucun compte lié) */
const ACCESS = {
  actif:      { label: 'Accès actif',           color: '#10b981' },
  invitation: { label: 'Invitation en attente', color: '#f59e0b' },
  inactif:    { label: 'Accès désactivé',       color: '#ef4444' },
};
const NO_ACCESS = { label: 'Sans accès', color: '#94a3b8' };
const accessConf = m => ACCESS[m?.account?.status] || NO_ACCESS;

const AccessChip = ({ member, title }) => {
  const c = accessConf(member);
  return (
    <span title={title || undefined}
      style={{ fontFamily:'DM Sans', fontSize:9, fontWeight:600, letterSpacing:0.2, color:c.color, background:`${c.color}18`, border:`1px solid ${c.color}33`, borderRadius:20, padding:'1px 7px', whiteSpace:'nowrap' }}>
      {c.label}
    </span>
  );
};

export default function Equipe() {
  const ref = useRefData();
  const { user } = useAuth();
  const canManage = hasPerm(user, 'team.manage');
  const canDelete = hasPerm(user, 'team.delete');
  const canSeeUsers = hasPerm(user, 'users.read', 'users.manage');
  const canManageUsers = hasPerm(user, 'users.manage');
  const policy = usePasswordPolicy();
  const mailEnabled = !!policy?.email_enabled;

  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('hierarchy');
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [users, setUsers]       = useState(null); // null = liste indisponible (droits) → champ masqué
  /* Création d'accès applicatif depuis la fiche */
  const [accessFor, setAccessFor]   = useState(null);
  const [accessForm, setAccessForm] = useState({ email:'', role:'', password:'' });
  const [accessError, setAccessError] = useState('');
  const [accessSaving, setAccessSaving] = useState(false);
  /* Désactivation : le compte lié peut être désactivé en même temps */
  const [delFor, setDelFor]     = useState(null);
  const [delAccount, setDelAccount] = useState(true);
  const [delSaving, setDelSaving]   = useState(false);

  const load = useCallback(() => {
    // Inactifs inclus : réservé directeur / admin (api.js partagé non modifié → appel direct)
    const list = showInactive && canManage ? api.get('/team?include_inactive=1') : teamApi.list();
    list.then(setMembers).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [showInactive, canManage]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    programsApi.list().then(setPrograms).catch(() => {});
    if (canSeeUsers) usersApi.list().then(u => setUsers(Array.isArray(u) ? u : (u?.users || null))).catch(() => setUsers(null));
  }, [canSeeUsers]);

  const f = k => v => { setFormError(''); setForm(p => ({ ...p, [k]: v })); };

  /* Référentiels */
  const levelList = ref.list('team_level');
  const poleList  = ref.list('team_pole');
  const levelLabel = lv => ref.label('team_level', String(lv));
  const poleColor  = pole => ref.item('team_pole', pole)?.color || '#6b7280';
  const poleIdx    = pole => { const i = poleList.findIndex(p => p.code === pole); return i === -1 ? 999 : i; };
  const byPoleOrder = (a, b) => poleIdx(a) - poleIdx(b) || String(a).localeCompare(String(b));
  const programOf  = tag => programs.find(p => String(p.code).toLowerCase() === String(tag).trim().toLowerCase());

  /* Niveau par défaut d'un nouveau membre : avant-dernier niveau du référentiel (ex. « Chargé de mission »),
     sinon le seul niveau disponible */
  const defaultLevel = () => String((levelList.length >= 2 ? levelList[levelList.length - 2] : levelList[0])?.code ?? '');
  const openCreate = () => { setForm({ ...EMPTY, level: defaultLevel() }); setFormError(''); setEditing(null); setModal(true); };
  const openEdit   = m => {
    const expertise = parseExpertise(m);
    setFormError('');
    setForm({ name:m.name||'', role:m.role||'', level:m.level != null ? String(m.level) : defaultLevel(), department:m.department||'', initials:m.initials||'', color:m.color||'#06b6d4', expertise:expertise.join(', '), email:m.email||'', phone:m.phone||'', bio:m.bio||'', user_id:m.user_id||'' });
    setEditing(m); setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.role.trim()) return setFormError('Nom complet et fonction / rôle requis');
    const level = parseInt(form.level, 10);
    if (!Number.isInteger(level)) return setFormError(levelList.length ? 'Niveau hiérarchique requis' : 'Niveau hiérarchique requis - référentiel des niveaux vide (Administration › Référentiels)');
    setSaving(true);
    try {
      const payload = { ...form, level, expertise: form.expertise.split(',').map(s => s.trim()).filter(Boolean) };
      if (users === null) delete payload.user_id; // champ non modifiable sans accès à la liste des comptes
      // Membre rattaché à un compte : l'identité vient du compte, inutile de la renvoyer (le serveur la réécrit)
      if (editing?.account && String(payload.user_id ?? '') === String(editing.user_id ?? ''))
        for (const k of ['name', 'email', 'phone']) delete payload[k];
      if (editing) {
        const updated = await teamApi.update(editing.id, payload);
        if (updated) setMembers(ms => ms.map(m => m.id === editing.id ? updated : m)); else load();
      } else {
        const created = await teamApi.create(payload);
        if (created) setMembers(ms => [...ms, created]); else load();
      }
      setModal(false);
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  /* Désactivation : avec un accès encore ouvert, on demande s'il faut le couper en même temps */
  const askDelete = (m, e) => {
    e.stopPropagation();
    setError(''); setInfo('');
    if (m.account && m.account.status !== 'inactif' && canManageUsers) { setDelAccount(true); setDelFor(m); return; }
    if (window.confirm('Désactiver ce membre ?')) doDelete(m, false);
  };

  const doDelete = async (m, deactivateAccount) => {
    setDelSaving(true);
    try {
      const r = await teamApi.delete(m.id, { deactivateAccount });
      setMembers(ms => showInactive
        ? ms.map(x => x.id === m.id ? { ...x, is_active: 0, account: x.account && r?.account_deactivated ? { ...x.account, is_active: 0, status: 'inactif' } : x.account } : x)
        : ms.filter(x => x.id !== m.id));
      if (selected === m.id) setSelected(null);
      setDelFor(null);
      if (r?.account_deactivated) setInfo(`Fiche et accès de ${m.name} désactivés`);
    } catch (e) { setError(e.message); setDelFor(null); load(); }
    finally { setDelSaving(false); }
  };

  /* Création de l'accès applicatif : compte pré-rempli depuis la fiche + invitation par email */
  const defaultRole = () => (ref.roles || [])[(ref.roles || []).length - 1]?.code || '';
  const openAccess = (m, e) => {
    e.stopPropagation();
    setError(''); setInfo(''); setAccessError('');
    setAccessForm({ email: m.email || '', role: defaultRole(), password: '' });
    setAccessFor(m);
  };

  const saveAccess = async () => {
    const email = accessForm.email.trim();
    if (!email) return setAccessError('Email requis pour créer un accès');
    if (!mailEnabled) {
      const unmet = checkPassword(accessForm.password || '', policy, { email, name: accessFor.name });
      if (unmet.length) return setAccessError(`Mot de passe non conforme : ${unmet.join(' · ')}`);
    }
    setAccessSaving(true);
    try {
      const body = mailEnabled
        ? { email, role: accessForm.role, send_invite: true }
        : { email, role: accessForm.role, password: accessForm.password, send_invite: false };
      const updated = await teamApi.createAccount(accessFor.id, body);
      if (updated?.id) setMembers(ms => ms.map(m => m.id === updated.id ? { ...m, ...updated } : m)); else load();
      setInfo(updated?.invite_error || (updated?.invited ? `Invitation envoyée à ${email}` : `Accès créé pour ${accessFor.name} (${email})`));
      setAccessFor(null);
    } catch (e) { setAccessError(e.message); }
    finally { setAccessSaving(false); }
  };

  const handleReactivate = async (id, e) => {
    e.stopPropagation();
    try {
      const updated = await teamApi.update(id, { is_active: 1 });
      if (updated) setMembers(ms => ms.map(m => m.id === id ? updated : m)); else load();
    } catch (e) { setError(e.message); }
  };

  const isActive = m => m.is_active === undefined || Number(m.is_active) === 1;
  const active   = members.filter(isActive);
  const byLevel  = members.reduce((acc, m) => { (acc[m.level] = acc[m.level] || []).push(m); return acc; }, {});
  const byPole   = members.reduce((acc, m) => { const k = m.department || NO_POLE; (acc[k] = acc[k] || []).push(m); return acc; }, {});
  const poleCount  = new Set(active.map(m => m.department || NO_POLE)).size;
  const levelCount = new Set(active.map(m => String(m.level))).size;
  const topLevel   = members.length ? Math.min(...members.map(m => Number(m.level) || 99)) : 1;

  const MemberCard = ({ member, featured = false }) => {
    const isSel     = selected === member.id;
    const inactive  = !isActive(member);
    const expertise = parseExpertise(member);
    const account   = member.account || (users && member.user_id ? users.find(u => String(u.id) === String(member.user_id)) : null);
    return (
      <div onClick={() => setSelected(isSel ? null : member.id)}
        style={{ background:T.surface, border:`1px solid ${isSel?member.color:T.border}`, borderRadius:featured?14:12, padding:featured?'22px 24px':'16px 18px', cursor:'pointer', transition:'all 0.2s', marginBottom:10, opacity: inactive ? 0.5 : 1, boxShadow:isSel?`0 0 0 1px ${member.color}44, 0 8px 30px ${member.color}22`:'' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:featured?18:14 }}>
          <div style={{ flexShrink:0, width:featured?56:44, height:featured?56:44, borderRadius:'50%', background:`linear-gradient(135deg,${member.color}44,${member.color}22)`, border:`2px solid ${member.color}66`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontFamily:'DM Sans', fontWeight:700, fontSize:featured?18:14, color:member.color }}>{member.initials}</span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'EB Garamond', fontSize:featured?20:16, fontWeight:500, color:T.text, lineHeight:1.2 }}>
              {member.name}
              {inactive && <span style={{ fontFamily:'DM Sans', fontSize:9, fontWeight:700, color:T.textDim, background:T.surface2, borderRadius:4, padding:'1px 6px', marginLeft:8, verticalAlign:'middle' }}>INACTIF</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:2 }}>
              <span style={{ fontFamily:'DM Sans', fontSize:featured?12:11, color:member.color, fontWeight:600 }}>{member.role}</span>
              <AccessChip member={member} title={member.account ? `Compte : ${member.account.email}` : 'Aucun compte utilisateur lié à cette fiche'}/>
            </div>
            <div style={{ display:'flex', gap:5, marginTop:8, flexWrap:'wrap' }}>
              {expertise.slice(0, featured?4:2).map((e,i) => { const pg = programOf(e); return (
                <span key={i} title={pg ? `${pg.code} · ${pg.name}` : undefined} style={{ background:`${member.color}15`, color:member.color, fontFamily:'DM Sans', fontSize:10, padding:'2px 7px', borderRadius:4, cursor: pg ? 'help' : undefined }}>{e}</span>
              ); })}
            </div>
          </div>
          <div style={{ display:'flex', gap:2, alignItems:'center' }} onClick={e => e.stopPropagation()}>
            {canManageUsers && !member.account && !inactive && (
              <button onClick={e => openAccess(member, e)} style={{ background:'none', border:'none', color:T.teal, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Créer un accès à l'application"><UserPlus size={12}/></button>
            )}
            {canManage && <button onClick={e => { e.stopPropagation(); openEdit(member); }} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Modifier"><Pencil size={12}/></button>}
            {(inactive ? canManage : canDelete) && (inactive
              ? <button onClick={e => handleReactivate(member.id, e)} style={{ background:'none', border:'none', color:'#10b981', cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Réactiver"><RotateCcw size={12}/></button>
              : <button onClick={e => askDelete(member, e)} style={{ background:'none', border:'none', color:T.textMuted, cursor:'pointer', padding:'4px 6px', borderRadius:4 }} title="Désactiver"><Trash2 size={12}/></button>)}
            {isSel ? <ChevronUp size={14} color={T.textMuted}/> : <ChevronDown size={14} color={T.textMuted}/>}
          </div>
        </div>
        {isSel && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}` }} className="slide-in">
            {member.bio && <p style={{ fontFamily:'DM Sans', fontSize:12, color:T.textMuted, lineHeight:1.7, marginBottom:12 }}>{member.bio}</p>}
            {expertise.length > 0 && (
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
                {expertise.map((e,i) => { const pg = programOf(e); return (
                  <span key={i} style={{ background:`${pg?.color || member.color}15`, color:pg?.color || member.color, fontFamily:'DM Sans', fontSize:10, padding:'2px 7px', borderRadius:4 }}>{pg ? `${pg.code} · ${pg.name}` : e}</span>
                ); })}
              </div>
            )}
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              <span style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim }}>{levelLabel(member.level)}</span>
              {member.email && <a href={`mailto:${member.email}`} style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans', fontSize:11, color:T.teal, textDecoration:'none' }}><Mail size={12}/> {member.email}</a>}
              {member.phone && <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans', fontSize:11, color:T.textDim }}><Phone size={12}/> {member.phone}</div>}
              {account && <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans', fontSize:11, color:T.textDim }}><UserCheck size={12}/> Compte : {account.email || account.name}</div>}
              {!member.account && canManageUsers && !inactive && (
                <Btn size="sm" variant="ghost" color={T.teal} onClick={e => openAccess(member, e)}><UserPlus size={12}/> Créer un accès</Btn>
              )}
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

  const knownPoles = poleList.map(p => p.code);
  const orgName = ref.setting('org_name'), ministryShort = ref.setting('ministry_short');

  return (
    <div className="fade-in">
      <HeroBanner eyebrow={[orgName, ministryShort].filter(Boolean).join(' · ')} title="Équipe & Organisation"
        subtitle={ref.setting('ministry_name')}
        stats={[{ value:active.length, label:'Membres' }, { value:levelCount, label:'Niveaux' }, { value:poleCount, label:'Pôles actifs', color:'#10b981' }]} />
      <div style={{ padding:28 }}>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        {info && (
          <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'DM Sans', fontSize:12, color:T.success, marginBottom:14 }}>
            ✓ {info}
            <button onClick={() => setInfo('')} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', background:T.surface2, borderRadius:8, padding:3, border:`1px solid ${T.border}` }}>
            {[['hierarchy','Hiérarchie'],['pole','Pôles'],['grid','Grille']].map(([v,l]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:500, padding:'7px 16px', borderRadius:6, border:'none', background:viewMode===v?T.teal:'transparent', color:viewMode===v?'#fff':T.textMuted, cursor:'pointer', transition:'all 0.2s' }}>{l}</button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {canManage && (
              <label style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'DM Sans', fontSize:12, color:T.textMuted, cursor:'pointer' }}>
                <input type="checkbox" checked={showInactive} onChange={e => { setShowInactive(e.target.checked); setLoading(true); }} style={{ accentColor:T.teal, cursor:'pointer' }}/>
                Afficher les inactifs
              </label>
            )}
            {canManage && <Btn onClick={openCreate} color={T.teal}><Plus size={14}/> Nouveau membre</Btn>}
          </div>
        </div>

        {loading
          ? <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={36}/></div>
          : members.length === 0
          ? <EmptyState icon={Users} title="Aucun membre" subtitle={canManage ? "Ajoutez des membres à l'équipe en cliquant sur « Nouveau membre »." : undefined} />
          : viewMode === 'hierarchy'
          ? (() => {
              // Pôles triés selon le référentiel (position), pôles inconnus en fin
              const polesUsed = [...new Set(members.filter(m => m.level > topLevel).map(m => m.department || NO_POLE))].sort(byPoleOrder);
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
                  {/* Direction */}
                  <div>
                    <Divider label={levelLabel(topLevel)} color={T.teal}/>
                    <div style={{ maxWidth:480, margin:'0 auto' }}>
                      {(byLevel[topLevel]||[]).map(m => <MemberCard key={m.id} member={m} featured/>)}
                    </div>
                  </div>
                  {/* Connecteur */}
                  {polesUsed.length > 0 && (
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <div style={{ width:1, height:24, background:`linear-gradient(180deg,${T.teal}66,transparent)` }}/>
                    </div>
                  )}
                  {/* Pôles */}
                  {polesUsed.length > 0 && (
                    <div>
                      <Divider label="Pôles" color="#8b5cf6"/>
                      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(polesUsed.length, 3)},1fr)`, gap:16 }}>
                        {polesUsed.map(pole => {
                          const pColor = poleColor(pole);
                          const poleMembers = members.filter(m => (m.department || NO_POLE) === pole && m.level > topLevel)
                            .sort((a, b) => a.level - b.level);
                          if (poleMembers.length === 0) return null;
                          const secondLevel = Math.min(...poleMembers.map(m => m.level));
                          return (
                            <div key={pole} style={{ background:T.surface, border:`1px solid ${pColor}33`, borderRadius:12, padding:'16px 16px 12px', borderTop:`3px solid ${pColor}` }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                                <div style={{ width:8, height:8, borderRadius:'50%', background:pColor }}/>
                                <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:pColor }}>{ref.label('team_pole', pole)}</span>
                                <span style={{ fontFamily:'DM Sans', fontSize:10, color:T.textDim, marginLeft:'auto' }}>{poleMembers.length} membre{poleMembers.length > 1 ? 's' : ''}</span>
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {poleMembers.map(m => <MemberCard key={m.id} member={m} featured={m.level === secondLevel && secondLevel === topLevel + 1}/>)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          : viewMode === 'pole'
          ? <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
              {Object.entries(byPole).sort(([a],[b]) => byPoleOrder(a, b)).map(([pole, mems]) => {
                const pColor = poleColor(pole);
                return (
                  <div key={pole}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${T.border}` }}>
                      <div style={{ width:3, height:20, background:pColor, borderRadius:2 }}/>
                      <div style={{ fontFamily:'EB Garamond', fontSize:17, color:pColor, fontWeight:500 }}>{ref.label('team_pole', pole)}</div>
                      <div style={{ fontSize:11, color:T.textDim, fontFamily:'DM Sans', marginLeft:'auto' }}>{mems.length} membre{mems.length > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                      {mems.map(m => <MemberCard key={m.id} member={m}/>)}
                    </div>
                  </div>
                );
              })}
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
              <label style={lbl}>Nom complet *</label>
              <Input value={form.name} onChange={f('name')} placeholder="Prénom Nom" disabled={!!editing?.account} style={editing?.account ? { opacity:0.65 } : undefined}/>
            </div>
            <div>
              <label style={lbl}>Fonction / Rôle *</label>
              <Input value={form.role} onChange={f('role')} placeholder="Ex: Coordonnateur S&E"/>
            </div>
          </div>
          {editing?.account && (
            <div style={{ background:`${T.teal}12`, border:`1px solid ${T.teal}33`, borderRadius:8, padding:'9px 12px', fontFamily:'DM Sans', fontSize:11, color:T.textMuted, display:'flex', alignItems:'center', gap:7 }}>
              <UserCheck size={13} color={T.teal}/>
              Ces informations viennent du compte utilisateur (nom, email, téléphone). Modifiez-les dans Administration › Utilisateurs.
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Niveau hiérarchique *</label>
              <Select value={form.level} onChange={f('level')} style={{ width:'100%' }}>
                {!form.level && <option value="">-</option>}
                {levelList.map(l => <option key={l.code} value={String(l.code)}>Niveau {l.code} - {l.label}</option>)}
                {form.level && !levelList.some(l => String(l.code) === form.level) && <option value={form.level}>Niveau {form.level}</option>}
              </Select>
            </div>
            <div>
              <label style={lbl}>Pôle</label>
              <input list="poles-list" value={form.department} onChange={e => f('department')(e.target.value)} placeholder="Sélectionner ou saisir un pôle"
                style={{ width:'100%', background: T.field, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 14px', color:T.text, fontSize:13, fontFamily:'DM Sans', outline:'none' }}/>
              <datalist id="poles-list">
                {poleList.map(p => <option key={p.code} value={p.code}>{p.label !== p.code ? p.label : undefined}</option>)}
                {/* pôles déjà utilisés par l'équipe */}
                {[...new Set(members.map(m => m.department).filter(Boolean))].filter(d => !knownPoles.includes(d)).map(d => <option key={d} value={d}/>)}
              </datalist>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Initiales</label>
              <Input value={form.initials} onChange={f('initials')} placeholder="Ex: MD"/>
            </div>
            <div>
              <label style={lbl}>Couleur</label>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap', paddingTop:4 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => f('color')(c)} style={{ width:26, height:26, borderRadius:'50%', background:c, border:form.color===c?'3px solid white':'2px solid transparent', cursor:'pointer', transition:'all 0.15s', outline:'none' }}/>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label style={lbl}>Expertises (séparées par des virgules - les codes programme, ex. P08, sont reconnus)</label>
            <Input value={form.expertise} onChange={f('expertise')} placeholder="Ex: Suivi-Évaluation, Indicateurs, P05"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Email</label>
              <Input value={form.email} onChange={f('email')} placeholder={`prenom.nom@${ref.setting('email_domain')}`} type="email" disabled={!!editing?.account} style={editing?.account ? { opacity:0.65 } : undefined}/>
            </div>
            <div>
              <label style={lbl}>Téléphone</label>
              <Input value={form.phone} onChange={f('phone')} placeholder={`${ref.setting('phone_prefix')} 77 000 00 00`} disabled={!!editing?.account} style={editing?.account ? { opacity:0.65 } : undefined}/>
            </div>
          </div>
          {users !== null && (
            <div>
              <label style={lbl}>Compte utilisateur associé</label>
              <Select value={form.user_id} onChange={f('user_id')} style={{ width:'100%' }}>
                <option value="">- Aucun -</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.email ? ` · ${u.email}` : ''}</option>)}
              </Select>
            </div>
          )}
          <div>
            <label style={lbl}>Biographie / Description du rôle</label>
            <Textarea value={form.bio} onChange={f('bio')} placeholder="Responsabilités et expériences du membre..." rows={3}/>
          </div>
        </div>
        {formError && <div style={{ marginTop:14, padding:'9px 12px', borderRadius:8, background:'#ef444418', border:'1px solid #ef444440', color:'#ef4444', fontFamily:'DM Sans', fontSize:12 }}>{formError}</div>}
        <ModalFooter onCancel={() => setModal(false)} onConfirm={handleSave} loading={saving} confirmLabel={editing ? 'Mettre à jour' : 'Ajouter'}/>
      </Modal>

      {/* Création de l'accès applicatif d'un membre */}
      <Modal open={!!accessFor} onClose={() => setAccessFor(null)} title={`Créer un accès - ${accessFor?.name || ''}`} width={480}>
        <ErrorBanner error={accessError} onDismiss={() => setAccessError('')} />
        <div style={{ display:'grid', gap:14 }}>
          <div>
            <label style={lbl}>Email de connexion *</label>
            <Input value={accessForm.email} onChange={v => { setAccessError(''); setAccessForm(p => ({ ...p, email: v })); }}
              placeholder={`prenom.nom@${ref.setting('email_domain')}`} type="email"/>
          </div>
          <div>
            <label style={lbl}>Rôle</label>
            <Select value={accessForm.role} onChange={v => setAccessForm(p => ({ ...p, role: v }))} style={{ width:'100%' }}>
              {(ref.roles || []).length === 0 && <option value="">-</option>}
              {(ref.roles || []).map(r => <option key={r.code} value={r.code} title={r.description || ''}>{r.label}</option>)}
            </Select>
            {ref.role(accessForm.role)?.description && (
              <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:5 }}>{ref.role(accessForm.role).description}</div>
            )}
          </div>
          {mailEnabled ? (
            <div style={{ background:`${T.teal}12`, border:`1px solid ${T.teal}33`, borderRadius:8, padding:'10px 13px', fontFamily:'DM Sans', fontSize:11.5, color:T.textMuted, lineHeight:1.6 }}>
              Une invitation sera envoyée à cette adresse : la personne choisit elle-même son mot de passe.
              Aucun mot de passe n'est transmis par email. Le compte reprend le pôle et le téléphone de la fiche.
            </div>
          ) : (
            <div>
              <label style={lbl}>Mot de passe provisoire (à changer à la 1re connexion)</label>
              <Input type="password" value={accessForm.password} onChange={v => { setAccessError(''); setAccessForm(p => ({ ...p, password: v })); }}/>
              <PasswordChecklist password={accessForm.password} policy={policy} email={accessForm.email} name={accessFor?.name}/>
              <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:6 }}>
                L'envoi d'emails n'est pas configuré : l'invitation automatique est indisponible.
              </div>
            </div>
          )}
        </div>
        <ModalFooter onCancel={() => setAccessFor(null)} onConfirm={saveAccess} loading={accessSaving} confirmLabel={mailEnabled ? 'Créer et inviter' : 'Créer l\'accès'}/>
      </Modal>

      {/* Désactivation d'un membre disposant d'un accès */}
      <Modal open={!!delFor} onClose={() => setDelFor(null)} title="Désactiver le membre" width={460}>
        <p style={{ fontFamily:'DM Sans', fontSize:13, color:T.textMuted, lineHeight:1.6 }}>
          La fiche de <strong style={{ color:T.text }}>{delFor?.name}</strong> sera retirée de l'organigramme.
        </p>
        <label style={{ display:'flex', alignItems:'flex-start', gap:9, cursor:'pointer', marginTop:14 }}>
          <input type="checkbox" checked={delAccount} onChange={e => setDelAccount(e.target.checked)} style={{ marginTop:3, accentColor:T.teal }}/>
          <span>
            <span style={{ fontFamily:'DM Sans', fontSize:13, color:T.text }}>Désactiver aussi son accès à l'application</span>
            <span style={{ display:'block', fontFamily:'DM Sans', fontSize:11, color:T.textDim, marginTop:2 }}>
              Le compte {delFor?.account?.email} est conservé mais ne permet plus de se connecter, et ses sessions sont fermées.
            </span>
          </span>
        </label>
        <ModalFooter onCancel={() => setDelFor(null)} onConfirm={() => doDelete(delFor, delAccount)} loading={delSaving} confirmLabel="Désactiver" color={T.danger}/>
      </Modal>
    </div>
  );
}
