import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { AlertTriangle, AlignLeft, CalendarDays, Check, Landmark, Loader2, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { ActionChecklist } from './ActionChecklist.jsx';
import { FieldLabel, LabelPicker, PrioritySegment, ResponsiblePicker, SourcePicker, StatusPicker, chipClass } from './DiligenceFields.jsx';
import { parseNotes, serializeNotes } from './actions.js';
import { deadlineInfo, memberFor } from './board.js';

const TONE = {
  danger: 'bg-du-danger/12 text-du-danger',
  warning: 'bg-du-warning/14 text-du-warning',
  success: 'bg-du-success/12 text-du-success',
  neutral: 'bg-du-surface2 text-du-text-muted',
};

const SECTION = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } } };
const STAGGER = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } } };

const fmtDateTime = v => {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

/* Zone de texte qui grandit avec son contenu */
function AutoTextarea({ value, className, minRows = 1, inputRef, ...props }) {
  const own = useRef(null);
  const ref = inputRef || own;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={minRows} value={value} className={cn('block w-full resize-none overflow-hidden outline-none', className)} {...props} />;
}

/* Fiche de création et de modification d'une diligence, inspirée de la carte Trello.
 *
 * Le parent la monte avec une clé nouvelle à chaque ouverture : l'état du formulaire part
 * des valeurs reçues (`initial`). `onSubmit(valeurs)` renvoie une promesse ; en cas d'erreur
 * le message s'affiche dans la fiche, qui reste ouverte. */
export function DiligenceDialog({ open, onClose, initial, diligence, onSubmit, refData: ref, options, sources, team, today, alertDays }) {
  const start = useMemo(() => {
    const { text, actions } = parseNotes(initial.notes);
    return { ...initial, text, actions };
  }, [initial]);
  const [form, setForm] = useState(start);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);   // « Fermer sans enregistrer ? » affiché dans le pied
  const shake = useAnimationControls();
  const previousOpen = useRef(null);
  const titleRef = useRef(null);

  const isEdit = !!diligence;
  const set = patch => { setForm(f => ({ ...f, ...patch })); setError(''); setConfirmClose(false); };
  const notes = serializeNotes(form.text, form.actions);
  const values = { title: form.title.trim(), source: form.source.trim(), deadline: form.deadline, responsible: form.responsible.trim(), priority: form.priority, type: form.type, status: form.status, notes };
  const dirty = JSON.stringify(values) !== JSON.stringify({
    title: start.title.trim(), source: start.source.trim(), deadline: start.deadline, responsible: start.responsible.trim(),
    priority: start.priority, type: start.type, status: start.status, notes: serializeNotes(start.text, start.actions),
  });

  const closed = ref.has('diligence_status', form.status, 'closed');
  const done = ref.has('diligence_status', form.status, 'done');
  const doneStatus = options.statuses.find(s => ref.has('diligence_status', s.code, 'done'));
  const deadline = deadlineInfo(form.deadline, { today, alertDays, closed, done });
  const member = memberFor(team, form.responsible);
  const missing = { title: !values.title, source: !values.source };

  /* Le rond devant le titre marque la diligence comme faite (et revient au statut précédent) */
  const toggleDone = () => {
    if (!doneStatus) return;
    if (done) {
      const back = previousOpen.current
        || (!ref.has('diligence_status', start.status, 'closed') && start.status)
        || options.statuses.find(s => !ref.has('diligence_status', s.code, 'closed'))?.code;
      if (back) set({ status: String(back) });
    } else {
      previousOpen.current = form.status;
      set({ status: String(doneStatus.code) });
    }
  };

  /* Fiche modifiée : la confirmation s'affiche dans la fiche elle-même. Pas de window.confirm :
   * certains navigateurs intégrés bloquent les fenêtres natives, qui répondent alors « non »
   * sans rien afficher (la fiche ne se fermait plus). */
  const requestClose = () => {
    if (saving) return;
    if (dirty) { setConfirmClose(true); return; }
    onClose();
  };

  const submit = async () => {
    setTried(true);
    if (missing.title || missing.source) {
      setError(missing.title && missing.source ? 'L\'intitulé et la source sont obligatoires.' : missing.title ? 'L\'intitulé est obligatoire.' : 'La source est obligatoire.');
      shake.start({ x: [0, -9, 9, -6, 6, 0], transition: { duration: 0.4 } });
      return;
    }
    setSaving(true); setError('');
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e.message || 'Enregistrement impossible');
      shake.start({ x: [0, -9, 9, -6, 6, 0], transition: { duration: 0.4 } });
    } finally { setSaving(false); }
  };

  const created = isEdit && fmtDateTime(diligence.created_at);
  const updated = isEdit && fmtDateTime(diligence.updated_at);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) requestClose(); }}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Le fond porte la fiche ; en-tête et pied restent visibles, seul le corps défile */}
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div className="tw fixed inset-0 z-[1000] flex items-start justify-center bg-[var(--du-overlay)] p-3 backdrop-blur-[3px] sm:p-6 sm:pt-[5vh]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}>
                <DialogPrimitive.Content forceMount asChild aria-describedby={undefined}
                  onOpenAutoFocus={e => { e.preventDefault(); if (!isEdit) titleRef.current?.focus(); }}
                  onEscapeKeyDown={e => {
                    if (e.target?.closest?.('[data-local-escape]')) e.preventDefault();
                    else if (confirmClose) { e.preventDefault(); setConfirmClose(false); }   // Échap : reprendre la saisie
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}>
                  <motion.div
                    className="relative flex max-h-full w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-card sm:max-h-[90vh] text-du-text shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/5 outline-none dark:ring-white/10"
                    initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.16 } }}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
                    <motion.div animate={shake} className="flex min-h-0 flex-1 flex-col">

                      {/* Barre du haut : statut et fermeture */}
                      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
                        <StatusPicker value={form.status} options={options.statuses} onChange={status => set({ status })} />
                        <AnimatePresence>
                          {deadline?.tone === 'danger' && (
                            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                              className="inline-flex h-7 items-center gap-1 rounded-lg bg-du-danger/12 px-2 text-[12px] font-bold text-du-danger">
                              <AlertTriangle className="size-3.5" /> En retard
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <span className="flex-1" />
                        <Button type="button" variant="ghost" size="icon" aria-label="Fermer" className="rounded-full" onClick={requestClose}>
                          <X className="size-5" />
                        </Button>
                      </div>

                      {/* Corps : seule partie qui défile */}
                      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-4">
                        <motion.div variants={STAGGER} initial="hidden" animate="show" className="flex flex-col gap-6 px-4 pb-2 pt-5 sm:px-7">

                          {/* Titre, précédé du rond « fait » */}
                          <motion.div variants={SECTION} className="flex items-start gap-3">
                            <button type="button" onClick={toggleDone} disabled={!doneStatus}
                              aria-label={done ? 'Marquer comme non faite' : 'Marquer comme faite'} title={done ? 'Marquer comme non faite' : 'Marquer comme faite'}
                              className={cn('mt-2 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                done ? 'border-du-success bg-du-success text-white' : 'border-du-text-dim/60 text-transparent hover:border-du-success hover:text-du-success/60')}>
                              <motion.span key={String(done)} initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }} className="flex">
                                <Check className="size-3.5" strokeWidth={3.5} />
                              </motion.span>
                            </button>
                            <div className="min-w-0 flex-1">
                              <DialogPrimitive.Title className="sr-only">{isEdit ? 'Modifier la diligence' : 'Nouvelle diligence'}</DialogPrimitive.Title>
                              <AutoTextarea inputRef={titleRef} value={form.title} onChange={e => set({ title: e.target.value.replace(/\n/g, ' ') })}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) e.preventDefault(); }}
                                placeholder={isEdit ? 'Intitulé de la diligence' : 'Nouvelle diligence : quel est l\'intitulé ?'} aria-label="Intitulé de la diligence"
                                className={cn('-mx-2 rounded-lg bg-transparent px-2 py-1 font-serif text-[26px] font-semibold leading-tight text-du-text transition-shadow placeholder:text-du-text-dim/70',
                                  'hover:bg-du-surface2/50 focus:bg-du-field focus:shadow-[inset_0_0_0_2px_var(--du-teal)]',
                                  tried && missing.title && 'shadow-[inset_0_0_0_2px_var(--du-danger)]')} />
                            </div>
                          </motion.div>

                          {/* Champs principaux, en pastilles */}
                          <motion.div variants={SECTION} className="grid grid-cols-1 gap-x-6 gap-y-4 pl-0 sm:grid-cols-2 sm:pl-9">
                            <div className="min-w-0">
                              <FieldLabel required>Source</FieldLabel>
                              <SourcePicker value={form.source} onChange={source => set({ source })} sources={sources} invalid={tried && missing.source} icon={Landmark} />
                            </div>
                            <div className="min-w-0">
                              <FieldLabel>Responsable</FieldLabel>
                              <ResponsiblePicker value={form.responsible} onChange={responsible => set({ responsible })} team={team} member={member} />
                            </div>
                            <div className="min-w-0">
                              <FieldLabel>Échéance</FieldLabel>
                              <DatePicker value={form.deadline} onChange={deadline => set({ deadline })}>
                                <button type="button" className={chipClass()} aria-label="Échéance">
                                  <CalendarDays className="size-4 text-du-text-dim" />
                                  {deadline
                                    ? <>
                                      <span>{deadline.full.charAt(0).toUpperCase() + deadline.full.slice(1)}</span>
                                      {deadline.tone !== 'neutral' && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', TONE[deadline.tone])}>{deadline.label}</span>}
                                    </>
                                    : <span className="font-medium text-du-text-dim">Ajouter une échéance</span>}
                                </button>
                              </DatePicker>
                            </div>
                            <div className="min-w-0">
                              <FieldLabel>Type</FieldLabel>
                              <div className="flex items-center gap-2">
                                <Tag className="size-4 text-du-text-dim" />
                                <LabelPicker value={form.type} options={options.types} onChange={type => set({ type })} />
                              </div>
                            </div>
                            <div className="min-w-0 sm:col-span-2">
                              <FieldLabel>Priorité</FieldLabel>
                              <PrioritySegment value={form.priority} options={options.priorities} onChange={priority => set({ priority })}
                                isCritical={code => ref.has('priority', code, 'critical')} />
                            </div>
                          </motion.div>

                          {/* Description */}
                          <motion.section variants={SECTION}>
                            <div className="mb-2 flex items-center gap-2">
                              <AlignLeft className="size-5 text-du-text-muted" />
                              <h4 className="text-[15px] font-bold text-du-text">Description</h4>
                            </div>
                            <div className="pl-0 sm:pl-7">
                              <AutoTextarea value={form.text} onChange={e => set({ text: e.target.value })} minRows={3}
                                placeholder="Contexte, suites données, commentaires…" aria-label="Description"
                                className="min-h-[84px] rounded-xl bg-du-surface2/70 px-3.5 py-3 text-[13.5px] leading-relaxed text-du-text transition-shadow placeholder:text-du-text-dim hover:bg-du-surface2 focus:bg-du-field focus:shadow-[inset_0_0_0_2px_var(--du-teal)]" />
                            </div>
                          </motion.section>

                          {/* Actions (sous-tâches) */}
                          <motion.div variants={SECTION} className="-ml-1 sm:ml-0">
                            <ActionChecklist actions={form.actions} onChange={actions => set({ actions })} />
                          </motion.div>
                        </motion.div>

                      </div>

                      {/* Erreur */}
                      <AnimatePresence>
                        {error && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="shrink-0 overflow-hidden px-4 sm:px-7">
                            <p role="alert" className="my-2.5 flex items-center gap-2 rounded-lg bg-du-danger/10 px-3 py-2 text-[13px] font-semibold text-du-danger">
                              <AlertTriangle className="size-4 shrink-0" /> {error}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Pied : dates techniques et boutons, toujours visibles ;
                          remplacé par la confirmation quand on ferme une fiche modifiée */}
                      <div className="shrink-0 overflow-hidden border-t border-border bg-card">
                        <AnimatePresence mode="wait" initial={false}>
                          {confirmClose
                            ? (
                              <motion.div key="confirmer" role="alertdialog" aria-label="Fermer sans enregistrer"
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }}
                                transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                                className="flex flex-wrap items-center gap-3 bg-du-warning/10 px-4 py-3.5 sm:px-7">
                                <AlertTriangle className="size-5 shrink-0 text-du-warning" />
                                <p className="min-w-0 flex-1 text-[13px] font-semibold text-du-text">
                                  Les modifications ne sont pas enregistrées.
                                  <span className="block text-[12px] font-normal text-du-text-muted">Fermer quand même la fiche ?</span>
                                </p>
                                <Button type="button" variant="outline" className="h-10 px-4" autoFocus onClick={() => setConfirmClose(false)}>Continuer la saisie</Button>
                                <Button type="button" variant="destructive" className="h-10 px-4" onClick={onClose}>Fermer sans enregistrer</Button>
                              </motion.div>
                            )
                            : (
                              <motion.div key="boutons" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.1 } }}
                                className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-7">
                                <div className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-du-text-dim">
                                  {created && <p>Créée le {created}</p>}
                                  {updated && updated !== created && <p>Modifiée le {updated}</p>}
                                  {!isEdit && <p className="hidden sm:block">Ctrl + Entrée pour créer</p>}
                                </div>
                                <Button type="button" variant="outline" className="h-10 px-5" onClick={requestClose} disabled={saving}>Annuler</Button>
                                <Button type="button" className="h-10 min-w-28 px-5 shadow-md shadow-primary/25" onClick={submit} disabled={saving}>
                                  {saving ? <Loader2 className="animate-spin" /> : isEdit ? 'Enregistrer' : 'Créer'}
                                </Button>
                              </motion.div>
                            )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  </motion.div>
                </DialogPrimitive.Content>
              </motion.div>
            </DialogPrimitive.Overlay>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
