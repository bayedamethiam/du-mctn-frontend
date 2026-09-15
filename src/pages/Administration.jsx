import { useState, useEffect, useCallback } from 'react';
import { Users, ListChecks, Settings, Plus, Pencil, Trash2, KeyRound, Eye, EyeOff, Save } from 'lucide-react';
import { usersApi, refApi, settingsApi } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRefData } from '../context/RefContext.jsx';
import { isAdmin } from '../permissions.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Card, Badge, Btn, Input, Select, Textarea, Modal, ModalFooter, Spinner, ErrorBanner, EmptyState } from '../components/UI.jsx';
import { T } from '../theme.js';

/* Libellés et regroupement des référentiels */
const DOMAINS = [
  { group: 'Général',            items: [['priority','Priorités'], ['user_role','Rôles utilisateurs']] },
  { group: 'Portefeuille',       items: [['program_status','Statuts des programmes'], ['meeting_type','Types de rendez-vous projet']] },
  { group: 'Suivi-Évaluation',   items: [['indicator_category','Catégories d\'indicateurs'], ['indicator_status','Statuts d\'indicateurs'], ['revue_type','Types de revue'], ['revue_status','Statuts de revue'], ['evaluation_status','Statuts d\'évaluation'], ['eval_criteria','Critères d\'évaluation'], ['doc_tag','Catégories de documents']] },
  { group: 'Diligences',         items: [['diligence_type','Types de diligence'], ['diligence_status','Statuts de diligence']] },
  { group: 'Audiences',          items: [['audience_status','Statuts d\'audience'], ['action_status','Statuts des actions de suivi']] },
  { group: 'Partenariats',       items: [['partnership_type','Types de partenaires'], ['partnership_status','Statuts de partenariat']] },
  { group: 'Instances',          items: [['instance_category','Catégories d\'instances'], ['instance_level','Niveaux de représentation'], ['contribution_status','Statuts des contributions'], ['contribution_impact','Impact des contributions']] },
  { group: 'Calendrier',         items: [['event_type','Types d\'événements'], ['event_level','Niveaux d\'événements']] },
  { group: 'Équipe',             items: [['team_level','Niveaux hiérarchiques'], ['team_pole','Pôles']] },
];

const KNOWN_DOMAINS = DOMAINS.flatMap(g => g.items.map(([d]) => d));
// Référentiels fixes : valeurs liées aux droits d'accès (libellés et couleurs modifiables uniquement)
const FIXED_DOMAINS = ['user_role'];

const SETTINGS_FORM = [
  { group: 'Organisation', fields: [
    ['org_short_name','Sigle affiché (logo)'], ['org_subtitle','Sous-titre du logo'], ['org_name','Nom de l\'unité'],
    ['ministry_short','Sigle du ministère'], ['ministry_name','Nom complet du ministère'], ['country','Pays'],
    ['email_domain','Domaine email'], ['phone_prefix','Indicatif téléphonique'],
  ]},
  { group: 'Plan stratégique', fields: [
    ['plan_name','Nom du plan'], ['plan_short','Sigle du plan'], ['plan_start','Année de début'], ['plan_end','Année de fin'],
    ['plan_ambition','Ambition stratégique', 'textarea'], ['currency_unit','Unité budgétaire'],
  ]},
  { group: 'Calculs & seuils', fields: [
    ['program_progress_mode','Avancement des programmes', 'select', [['manual','Saisi manuellement'], ['projects','Calculé depuis les projets']]],
    ['stats_excluded_programs','Programmes exclus des statistiques (codes, JSON)', 'json'],
    ['project_closed_statuses','Statuts de projet considérés comme clôturés (codes, JSON)', 'json'],
    ['currencies','Devises proposées (JSON)', 'json'],
    ['score_thresholds','Seuils de score vert / bleu / orange (JSON)', 'json'],
    ['alert_days','Seuil d\'alerte échéance (jours)'],
    ['instance_urgency_days','Seuils d\'urgence réunions internationales (jours, JSON)', 'json'],
    ['instance_pillars','Piliers du score de représentation (JSON)', 'json'],
    ['se_cycle','Cycle de pilotage S&E (JSON)', 'json'],
  ]},
];

const TABS = [
  { id: 'users',    label: 'Utilisateurs',  icon: Users,      adminOnly: true },
  { id: 'ref',      label: 'Référentiels',  icon: ListChecks },
  { id: 'settings', label: 'Paramètres',    icon: Settings },
];

const lbl = { fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, display: 'block', marginBottom: 5 };
const Field = ({ label, children }) => <div><label style={lbl}>{label}</label>{children}</div>;

/* ── Utilisateurs ─────────────────────────────────────────────── */
function UsersTab() {
  const ref = useRefData();
  const { user: me } = useAuth();
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [modal, setModal]   = useState(null);   // null | 'create' | user
  const [pwdFor, setPwdFor] = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const load = useCallback(() => {
    usersApi.list().then(setUsers).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const roles = ref.list('user_role');

  const openCreate = () => { setForm({ name: '', email: '', role: 'analyst', department: '', phone: '', password: '' }); setModal('create'); };
  const openEdit   = u => { setForm({ name: u.name, email: u.email, role: u.role, department: u.department || '', phone: u.phone || '' }); setModal(u); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'create') await usersApi.create(form);
      else await usersApi.update(modal.id, form);
      setModal(null); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async u => {
    try { await usersApi.update(u.id, { is_active: u.is_active ? 0 : 1 }); load(); }
    catch (e) { setError(e.message); }
  };

  const resetPwd = async () => {
    setSaving(true); setError('');
    try { await usersApi.resetPassword(pwdFor.id, form.password); setPwdFor(null); load(); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textMuted }}>{users.filter(u => u.is_active).length} comptes actifs · {users.length} au total</div>
        <Btn onClick={openCreate}><Plus size={14} /> Nouveau compte</Btn>
      </div>
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Sans', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: T.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                {['Nom', 'Email', 'Rôle', 'Pôle', 'Statut', ''].map(h => <th key={h} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}`, opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '12px 16px', color: T.text, fontWeight: 600 }}>{u.name}{u.must_change_password ? <span style={{ marginLeft: 8, fontSize: 10, color: T.warning }}>mot de passe provisoire</span> : null}</td>
                  <td style={{ padding: '12px 16px', color: T.textMuted }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}><Badge status={u.role} domain="user_role" /></td>
                  <td style={{ padding: '12px 16px', color: T.textMuted }}>{u.department || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => toggleActive(u)} disabled={u.id === me?.id}
                      style={{ background: 'none', border: 'none', cursor: u.id === me?.id ? 'default' : 'pointer', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, color: u.is_active ? T.success : T.textDim }}>
                      {u.is_active ? '● Actif' : '○ Désactivé'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <Btn size="sm" variant="ghost" onClick={() => openEdit(u)}><Pencil size={12} /></Btn>{' '}
                    <Btn size="sm" variant="ghost" color={T.warning} onClick={() => { setForm({ password: '' }); setPwdFor(u); }}><KeyRound size={12} /></Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Nouveau compte' : 'Modifier le compte'}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nom complet"><Input value={form.name || ''} onChange={f('name')} /></Field>
          <Field label="Email"><Input value={form.email || ''} onChange={f('email')} placeholder={`prenom.nom@${ref.setting('email_domain')}`} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Rôle">
              <Select value={form.role || ''} onChange={f('role')}>
                {roles.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </Select>
            </Field>
            <Field label="Pôle / département">
              <Select value={form.department || ''} onChange={f('department')}>
                <option value="">—</option>
                {ref.list('team_pole').map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Téléphone"><Input value={form.phone || ''} onChange={f('phone')} placeholder={ref.setting('phone_prefix')} /></Field>
          {modal === 'create' && (
            <Field label="Mot de passe provisoire (8 caractères min., à changer à la 1re connexion)">
              <Input type="password" value={form.password || ''} onChange={f('password')} />
            </Field>
          )}
        </div>
        <ModalFooter onCancel={() => setModal(null)} onConfirm={save} loading={saving} />
      </Modal>

      <Modal open={!!pwdFor} onClose={() => setPwdFor(null)} title={`Réinitialiser le mot de passe — ${pwdFor?.name || ''}`}>
        <Field label="Nouveau mot de passe provisoire (8 caractères min.)">
          <div style={{ position: 'relative' }}>
            <Input type={showPwd ? 'text' : 'password'} value={form.password || ''} onChange={f('password')} />
            <button onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.textDim, cursor: 'pointer' }}>
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>
        <p style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textDim, marginTop: 10 }}>L'utilisateur sera déconnecté et devra choisir un nouveau mot de passe à sa prochaine connexion.</p>
        <ModalFooter onCancel={() => setPwdFor(null)} onConfirm={resetPwd} loading={saving} confirmLabel="Réinitialiser" color={T.warning} />
      </Modal>
    </div>
  );
}

/* ── Référentiels ─────────────────────────────────────────────── */
function RefTab() {
  const ref = useRefData();
  const [domain, setDomain] = useState('priority');
  const [error, setError]   = useState('');
  const [modal, setModal]   = useState(null);   // null | 'create' | item
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);

  const items = ref.list(domain, { includeInactive: true });
  const domainLabel = DOMAINS.flatMap(g => g.items).find(([d]) => d === domain)?.[1] || domain;
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const openCreate = () => { setForm({ code: '', label: '', color: '#06b6d4', meta: '' }); setModal('create'); };
  const openEdit   = it => { setForm({ code: it.code, label: it.label, color: it.color || '#06b6d4', meta: Object.keys(it.meta || {}).length ? JSON.stringify(it.meta) : '' }); setModal(it); };

  const run = async fn => {
    setError('');
    try { await fn(); await ref.reload(); } catch (e) { setError(e.message); }
  };

  const save = async () => {
    let meta = null;
    if (form.meta?.trim()) {
      try { meta = JSON.parse(form.meta); } catch { setError('Métadonnées : JSON invalide'); return; }
    }
    setSaving(true);
    await run(async () => {
      if (modal === 'create') await refApi.create({ domain, code: form.code || form.label, label: form.label, color: form.color, meta });
      else await refApi.update(modal.id, { label: form.label, color: form.color, meta });
      setModal(null);
    });
    setSaving(false);
  };

  const move = (it, dir) => run(async () => {
    const i = items.findIndex(x => x.id === it.id), j = i + dir;
    if (j < 0 || j >= items.length) return;
    const other = items[j];
    await Promise.all([refApi.update(it.id, { position: j }), refApi.update(other.id, { position: i })]);
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,260px) 1fr', gap: 20, alignItems: 'start' }}>
      <Card style={{ padding: 10 }}>
        {[...DOMAINS, { group: 'Autres', items: [...new Set(ref.items.map(i => i.domain))].filter(d => !KNOWN_DOMAINS.includes(d)).map(d => [d, d]) }]
          .filter(g => g.items.length).map(g => (
          <div key={g.group} style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.textDim, padding: '8px 10px 4px' }}>{g.group}</div>
            {g.items.map(([d, l]) => (
              <button key={d} onClick={() => setDomain(d)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, background: domain === d ? `${T.teal}20` : 'transparent', color: domain === d ? T.teal : T.textMuted }}>
                {l}
              </button>
            ))}
          </div>
        ))}
      </Card>
      <div>
        <ErrorBanner error={error} onDismiss={() => setError('')} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontFamily: 'EB Garamond', fontSize: 22, color: T.text }}>{domainLabel}</h3>
          {!FIXED_DOMAINS.includes(domain) && <Btn onClick={openCreate}><Plus size={14} /> Ajouter</Btn>}
        </div>
        <Card>
          {items.length === 0 ? <EmptyState icon={ListChecks} title="Aucune valeur" /> : items.map((it, idx) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: idx < items.length - 1 ? `1px solid ${T.border}` : 'none', opacity: it.is_active ? 1 : 0.45 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={() => move(it, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>▲</button>
                <button onClick={() => move(it, 1)} disabled={idx === items.length - 1} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>▼</button>
              </div>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: it.color || T.textDim, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.text, fontWeight: 600 }}>{it.label}</div>
                <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim }}>code : {it.code}{it.is_system ? ' · valeur système' : ''}{it.is_active ? '' : ' · désactivée'}</div>
              </div>
              {(!it.is_system || !it.is_active) && (
                <Btn size="sm" variant="ghost" color={it.is_active ? T.textMuted : T.success} onClick={() => run(() => refApi.update(it.id, { is_active: it.is_active ? 0 : 1 }))}>
                  {it.is_active ? 'Désactiver' : 'Activer'}
                </Btn>
              )}
              <Btn size="sm" variant="ghost" onClick={() => openEdit(it)}><Pencil size={12} /></Btn>
              {!it.is_system && (
                <Btn size="sm" variant="ghost" color={T.danger} onClick={() => window.confirm(`Supprimer « ${it.label} » ? Les données qui l'utilisent afficheront le code brut.`) && run(() => refApi.delete(it.id))}><Trash2 size={12} /></Btn>
              )}
            </div>
          ))}
        </Card>
        <p style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.textDim, marginTop: 10 }}>
          Le code est enregistré dans les données : il ne change pas quand on renomme une valeur. Préférez « Désactiver » à la suppression pour une valeur déjà utilisée.
        </p>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? `Ajouter — ${domainLabel}` : 'Modifier la valeur'}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Libellé"><Input value={form.label || ''} onChange={f('label')} /></Field>
          <Field label={modal === 'create' ? 'Code (laisser vide = libellé)' : 'Code (non modifiable)'}>
            <Input value={form.code || ''} onChange={f('code')} disabled={modal !== 'create'} />
          </Field>
          <Field label="Couleur">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="color" value={form.color || '#06b6d4'} onChange={e => f('color')(e.target.value)} style={{ width: 44, height: 36, background: 'none', border: 'none', cursor: 'pointer' }} />
              <Input value={form.color || ''} onChange={f('color')} style={{ flex: 1 }} />
            </div>
          </Field>
          <Field label="Métadonnées (JSON, optionnel — ex. {&quot;desc&quot;:&quot;…&quot;} ou {&quot;strong&quot;:true})">
            <Textarea value={form.meta || ''} onChange={f('meta')} rows={2} />
          </Field>
        </div>
        <ModalFooter onCancel={() => setModal(null)} onConfirm={save} loading={saving} />
      </Modal>
    </div>
  );
}

/* ── Paramètres ───────────────────────────────────────────────── */
function SettingsTab() {
  const ref = useRefData();
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    const pretty = {};
    for (const g of SETTINGS_FORM) for (const [k, , type] of g.fields) {
      const v = ref.settings[k] ?? '';
      pretty[k] = type === 'json' && v ? (() => { try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; } })() : v;
    }
    setForm(pretty);
  }, [ref.settings]);

  const save = async () => {
    setError(''); setSaved(false);
    const payload = {};
    for (const g of SETTINGS_FORM) for (const [k, l, type] of g.fields) {
      if (type === 'json') {
        try { payload[k] = JSON.stringify(JSON.parse(form[k] || 'null')); }
        catch { setError(`« ${l} » : JSON invalide`); return; }
      } else payload[k] = form[k] ?? '';
    }
    setSaving(true);
    try { await settingsApi.update(payload); await ref.reload(); setSaved(true); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError('')} />
      {SETTINGS_FORM.map(g => (
        <Card key={g.group} style={{ padding: '20px 24px', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'EB Garamond', fontSize: 20, color: T.text, marginBottom: 14 }}>{g.group}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {g.fields.map(([k, l, type, opts]) => (
              <div key={k} style={{ gridColumn: type === 'json' || type === 'textarea' ? '1 / -1' : undefined }}>
                <Field label={l}>
                  {type === 'select'
                    ? <Select value={form[k] || ''} onChange={v => setForm(p => ({ ...p, [k]: v }))}>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Select>
                    : type === 'json' || type === 'textarea'
                      ? <Textarea value={form[k] || ''} onChange={v => setForm(p => ({ ...p, [k]: v }))} rows={type === 'json' ? Math.min(10, (form[k] || '').split('\n').length + 1) : 2} style={type === 'json' ? { fontFamily: 'monospace', fontSize: 12 } : {}} />
                      : <Input value={form[k] || ''} onChange={v => setForm(p => ({ ...p, [k]: v }))} />}
                </Field>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {saved && <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: T.success }}>✓ Paramètres enregistrés</span>}
        <Btn onClick={save} disabled={saving}>{saving ? <Spinner size={14} color="#fff" /> : <><Save size={14} /> Enregistrer</>}</Btn>
      </div>
    </div>
  );
}

export default function Administration() {
  const { user } = useAuth();
  const ref = useRefData();
  const tabs = TABS.filter(t => !t.adminOnly || isAdmin(user));
  const [tab, setTab] = useState(tabs[0].id);

  return (
    <div>
      <HeroBanner eyebrow={`${ref.setting('org_name')} · ${ref.setting('ministry_short')}`} title="Administration"
        subtitle="Comptes utilisateurs, listes de référence et paramètres de l'organisation" />
      <div style={{ padding: '24px 36px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${tab === t.id ? T.teal : T.border}`, background: tab === t.id ? `${T.teal}18` : 'transparent', color: tab === t.id ? T.teal : T.textMuted }}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>
        {tab === 'users' && <UsersTab />}
        {tab === 'ref' && <RefTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}
