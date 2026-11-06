import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MotionConfig, motion } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { Filter, KanbanSquare, List, Plus, Search, X } from 'lucide-react';
import { diligencesApi, teamApi } from '../api.js';
import HeroBanner from '../components/HeroBanner.jsx';
import { Input, Spinner, ErrorBanner } from '../components/UI.jsx';
import { T } from '../theme.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRefData } from '../context/RefContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { hasPerm } from '../permissions.js';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DiligenceBoard } from '../features/diligences/DiligenceBoard.jsx';
import { DiligenceTable } from '../features/diligences/DiligenceTable.jsx';
import { DiligenceDialog } from '../features/diligences/DiligenceDialog.jsx';
import { buildColumns, isLate as isLateRule, matchesSearch, todayYmd } from '../features/diligences/board.js';

const EMPTY = { title: '', source: '', deadline: '', responsible: '', priority: '', type: '', status: '', notes: '' };
const VIEW_KEY = 'du_diligences_vue';
let dialogSeq = 0;
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board'; } catch { return 'board'; } };

export default function Diligences() {
  const { user } = useAuth();
  const ref = useRefData();
  const { isDark } = useTheme();
  const [items, setItems]       = useState([]);
  const [team, setTeam]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [view, setView]         = useState(readView);
  const [priorities, setPriorityFilter] = useState([]);   // codes de priorité retenus (vide = toutes)
  const [listFilter, setListFilter] = useState('active');   // vue liste : terminées masquées par défaut
  const [showModal, setShowModal] = useState(false);
  const [toDelete, setToDelete] = useState({ d: null, open: false });   // diligence à supprimer (gardée pendant l'animation de fermeture)
  const [dialog, setDialog]     = useState(null);   // { key, initial, diligence } : fiche ouverte (clé nouvelle à chaque ouverture)
  const canDelete = hasPerm(user, 'diligences.delete');
  const canEdit   = hasPerm(user, 'diligences.manage');

  const statuses     = useMemo(() => ref.list('diligence_status'), [ref]);
  const priorityList = useMemo(() => ref.list('priority'), [ref]);
  const types        = useMemo(() => ref.list('diligence_type'), [ref]);
  const closedCodes  = useMemo(() => ref.codes('diligence_status', 'closed'), [ref]);
  const alertDays    = Number(ref.setting('alert_days')) || 3;
  const today        = todayYmd();
  const isLate       = useCallback(d => isLateRule(d, today, closedCodes), [today, closedCodes]);

  const load = useCallback(() => {
    diligencesApi.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
    teamApi.list().then(t => setTeam(Array.isArray(t) ? t : [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const chooseView = v => {
    if (!v) return;
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* stockage indisponible */ }
  };

  /* Filtres communs aux deux vues : recherche et priorités */
  const visible = useMemo(() => items.filter(d =>
    matchesSearch(d, search, ref.label('diligence_type', d.type))
    && (priorities.length === 0 || priorities.includes(String(d.priority)))), [items, search, priorities, ref]);

  const columns = useMemo(() => buildColumns({ items: visible, statuses, closedCodes, today, lateColor: 'var(--du-danger)' }),
    [visible, statuses, closedCodes, today]);

  const listRows = visible.filter(d =>
    listFilter === 'all' ? true
      : listFilter === 'active' ? !ref.has('diligence_status', d.status, 'done')
        : listFilter === 'late' ? isLate(d)
          : String(d.status) === listFilter);

  /* Sources existantes triées par fréquence (suggestions + sous-titre) */
  const sourceCounts = items.reduce((m, d) => { const s = (d.source || '').trim(); if (s) m[s] = (m[s] || 0) + 1; return m; }, {});
  const sources      = Object.keys(sourceCounts).sort((a, b) => sourceCounts[b] - sourceCounts[a]);
  const subtitle     = sources.length ? `${sources.slice(0, 3).join(' · ')} · Traçabilité complète` : 'Traçabilité complète des instructions et demandes';

  const openCreate = (status = null) => {
    /* Priorité par défaut : première non critique / non haute du référentiel */
    const defPriority = priorityList.find(p => !ref.has('priority', p.code, 'critical') && !ref.has('priority', p.code, 'high')) || priorityList[0];
    const initial = { ...EMPTY, status: String(status || statuses[0]?.code || ''), type: String(types[0]?.code || ''), priority: String(defPriority?.code || '') };
    setDialog({ key: ++dialogSeq, initial, diligence: null }); setShowModal(true);
  };
  const openEdit = useCallback(d => {
    if (!canEdit) return;
    const initial = { title: d.title || '', source: d.source || '', deadline: d.deadline || '', responsible: d.responsible || '', priority: String(d.priority || priorityList[0]?.code || ''), type: String(d.type || ''), status: String(d.status || ''), notes: d.notes || '' };
    setDialog({ key: ++dialogSeq, initial, diligence: d }); setShowModal(true);
  }, [canEdit, priorityList]);

  /* Enregistrement depuis la fiche : une erreur est renvoyée à la fiche, qui l'affiche et reste ouverte */
  const save = async values => {
    const editId = dialog?.diligence?.id;
    if (editId) {
      const u = await diligencesApi.update(editId, values);
      setItems(prev => prev.map(d => d.id === editId ? u : d));
      toast.success('Diligence enregistrée', { description: u.title });
    } else {
      const n = await diligencesApi.create(values);
      setItems(prev => [n, ...prev]);
      toast.success('Diligence créée', { description: n.title });
    }
    setShowModal(false);
  };

  /* Changement de statut (glisser-déposer, menu, bascule de la liste) : affiché tout de suite,
   * annulé si le serveur refuse ; « Annuler » dans la notification remet l'ancien statut. */
  const move = useCallback(async (d, status, { quiet = false } = {}) => {
    const previous = d.status;
    setItems(prev => prev.map(i => i.id === d.id ? { ...i, status } : i));
    try {
      const u = await diligencesApi.updateStatus(d.id, status);
      setItems(prev => prev.map(i => i.id === d.id ? u : i));
      if (quiet) return;
      const stillLate = isLateRule(u, today, closedCodes);
      toast.success(`${ref.label('diligence_status', status)} : ${d.title}`, {
        description: stillLate ? 'L\'échéance est dépassée : la diligence reste dans « En retard ».' : undefined,
        action: { label: 'Annuler', onClick: () => move(u, previous, { quiet: true }) },
      });
    } catch (e) {
      setItems(prev => prev.map(i => i.id === d.id ? { ...i, status: previous } : i));
      toast.error('Statut non modifié', { description: e.message });
    }
  }, [ref, today, closedCodes]);

  /* Suppression : demande de confirmation (fenêtre de l'application, pas window.confirm), puis appel à l'API */
  const remove = useCallback(d => setToDelete({ d, open: true }), []);
  const confirmRemove = async () => {
    const d = toDelete.d;
    try {
      await diligencesApi.delete(d.id);
      setItems(prev => prev.filter(i => i.id !== d.id));
      toast.success('Diligence supprimée', { description: d.title });
    } catch (e) { toast.error('Suppression impossible', { description: e.message }); }
  };

  /* Bascule rapide de la vue liste : non terminé → premier statut « done » ; terminé → dernier statut ouvert */
  const nextStatus = d => {
    if (!statuses.length) return null;
    if (ref.has('diligence_status', d.status, 'done')) {
      const open = statuses.filter(s => !closedCodes.includes(String(s.code)));
      return open[open.length - 1] || null;
    }
    return statuses.find(s => ref.has('diligence_status', s.code, 'done')) || null;
  };
  const cycleStatus = d => { const next = nextStatus(d); if (next) move(d, String(next.code)); };

  const ctx = useMemo(() => ({ ref, team, statuses, today, alertDays, canEdit, canDelete, onOpen: openEdit, onMove: move, onDelete: remove }),
    [ref, team, statuses, today, alertDays, canEdit, canDelete, openEdit, move, remove]);

  const late = items.filter(isLate).length;
  const withCurrent = (list, value) => value && !list.some(i => i.code === value) ? [...list, { code: value, label: value }] : list;
  const filtersOn = priorities.length > 0 || search.trim() !== '';

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={250}>
        <div className="fade-in">
          <HeroBanner eyebrow="Diligences" title="Suivi des instructions ministérielles"
            subtitle={subtitle}
            stats={[
              { value: items.length, label: 'Total' },
              ...statuses.map(s => ({ value: items.filter(d => d.status === s.code).length, label: s.label, color: s.color || T.teal })),
              { value: late, label: 'En retard', color: '#ef4444' },
            ]} />

          <div className="tw px-4 pb-8 pt-5 sm:px-7">
            <ErrorBanner error={error} onDismiss={() => setError('')} />

            {/* Barre d'outils */}
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex flex-wrap items-center gap-2.5">
              <div className="min-w-56 flex-1">
                <Input placeholder="Rechercher une diligence, une source, un responsable…" value={search} onChange={setSearch} icon={Search} />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 bg-du-field">
                    <Filter /> Priorité{priorities.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{priorities.length}</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Afficher les priorités</DropdownMenuLabel>
                  {priorityList.map(p => (
                    <DropdownMenuCheckboxItem key={p.code} checked={priorities.includes(String(p.code))} onSelect={e => e.preventDefault()}
                      onCheckedChange={on => setPriorityFilter(prev => on ? [...prev, String(p.code)] : prev.filter(c => c !== String(p.code)))}>
                      <span className="size-2.5 rounded-full" style={{ background: p.color }} /> {p.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {priorities.length > 0 && (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setPriorityFilter([])}><X /> Toutes les priorités</DropdownMenuItem></>)}
                </DropdownMenuContent>
              </DropdownMenu>

              {filtersOn && (
                <Button variant="ghost" className="h-10" onClick={() => { setSearch(''); setPriorityFilter([]); }}><X /> Effacer</Button>
              )}

              <ToggleGroup type="single" value={view} onValueChange={chooseView} aria-label="Affichage">
                <ToggleGroupItem value="board" aria-label="Tableau"><KanbanSquare /> Tableau</ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Liste"><List /> Liste</ToggleGroupItem>
              </ToggleGroup>

              {canEdit && <Button className="h-10 px-4 shadow-md shadow-primary/25" onClick={() => openCreate()}><Plus /> Nouvelle diligence</Button>}
            </motion.div>

            {loading
              ? <div className="flex justify-center py-16"><Spinner size={36} /></div>
              : view === 'board'
                ? <DiligenceBoard columns={columns} ctx={ctx} onAdd={openCreate} />
                : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {[['active', 'Actives'], ['all', 'Toutes'], ...statuses.map(s => [String(s.code), s.label]), ['late', `En retard${late ? ` (${late})` : ''}`]].map(([v, l]) => (
                        <Button key={v} size="sm" variant={listFilter === v ? 'default' : 'outline'} onClick={() => setListFilter(v)}
                          className={listFilter === v && v === 'late' ? 'bg-du-danger' : undefined}>{l}</Button>
                      ))}
                    </div>
                    <div style={{ fontFamily: 'DM Sans' }}>
                      <DiligenceTable rows={listRows} refData={ref} isLate={isLate} search={search} canEdit={canEdit} canDelete={canDelete}
                        nextStatus={nextStatus} cycleStatus={cycleStatus} openEdit={openEdit} remove={remove} />
                    </div>
                  </>
                )}
          </div>

          {dialog && (
            <DiligenceDialog key={dialog.key} open={showModal} onClose={() => setShowModal(false)} onSubmit={save}
              initial={dialog.initial} diligence={dialog.diligence} refData={ref} team={team} sources={sources} today={today} alertDays={alertDays}
              options={{
                statuses: withCurrent(statuses, dialog.initial.status),
                priorities: withCurrent(priorityList, dialog.initial.priority),
                types: withCurrent(types, dialog.initial.type),
              }} />
          )}

          <ConfirmDialog open={toDelete.open} onOpenChange={open => setToDelete(t => ({ ...t, open }))}
            title="Supprimer la diligence ?" confirmLabel="Supprimer" onConfirm={confirmRemove}
            description={<>« <span className="font-semibold text-du-text">{toDelete.d?.title}</span> » sera supprimée définitivement, avec sa description et ses actions.</>} />

          {/* Portail vers <body> : un parent transformé fausserait la position fixe des notifications */}
          {createPortal(<Toaster theme={isDark ? 'dark' : 'light'} position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: 'DM Sans' } }} />, document.body)}
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
