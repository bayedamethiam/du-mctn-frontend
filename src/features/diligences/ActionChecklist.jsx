import { useRef, useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react';
import { CheckSquare, EyeOff, Eye, GripVertical, PartyPopper, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cleanLabel, newActionId, progress } from './actions.js';

/* Les champs marqués data-local-escape gèrent eux-mêmes la touche Échap (la fiche ne se ferme pas) */
const LOCAL_ESCAPE = { 'data-local-escape': '' };
const ITEM_SPRING = { type: 'spring', stiffness: 520, damping: 38 };

/* Actions d'une diligence, à la manière des listes de contrôle Trello :
 * barre d'avancement, case à cocher (le libellé est barré), modification au clic,
 * réorganisation par glisser (poignée), masquage des actions faites, ajout en chaîne. */
export function ActionChecklist({ actions, onChange }) {
  const [hideDone, setHideDone] = useState(false);
  const [composing, setComposing] = useState(false);
  const { done, total, percent } = progress(actions);
  const complete = total > 0 && done === total;
  const shown = hideDone ? actions.filter(a => !a.done) : actions;

  const update = (id, patch) => onChange(actions.map(a => (a.id === id ? { ...a, ...patch } : a)));
  const remove = id => onChange(actions.filter(a => a.id !== id));
  const add = label => onChange([...actions, { id: newActionId(), label, done: false }]);

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <CheckSquare className="size-5 text-du-text-muted" />
        <h4 className="flex-1 text-[15px] font-bold text-du-text">Actions</h4>
        {done > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setHideDone(h => !h)}>
            {hideDone ? <><Eye /> Afficher les actions cochées ({done})</> : <><EyeOff /> Masquer les actions cochées</>}
          </Button>
        )}
      </div>

      {/* Avancement */}
      {total > 0 && (
        <div className="mb-2 flex items-center gap-3">
          <motion.span key={percent} initial={{ y: -4, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }}
            className={cn('w-9 text-right text-[11.5px] font-bold tabular-nums', complete ? 'text-du-success' : 'text-du-text-muted')}>
            {percent} %
          </motion.span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-du-surface2">
            <motion.div className={cn('h-full rounded-full', complete ? 'bg-du-success' : 'bg-primary')}
              initial={false} animate={{ width: `${percent}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
          </div>
        </div>
      )}
      <AnimatePresence initial={false}>
        {complete && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 overflow-hidden pl-12 text-[12px] font-semibold text-du-success">
            <motion.span initial={{ rotate: -25, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }} className="flex">
              <PartyPopper className="size-4" />
            </motion.span>
            Toutes les actions sont faites
          </motion.p>
        )}
      </AnimatePresence>

      <Reorder.Group axis="y" values={shown} onReorder={next => !hideDone && onChange(next)} className="flex flex-col">
        <AnimatePresence initial={false}>
          {shown.map(a => (
            <ActionItem key={a.id} action={a} canReorder={!hideDone && actions.length > 1}
              onToggle={v => update(a.id, { done: v })} onRename={label => update(a.id, { label })} onRemove={() => remove(a.id)} />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      {hideDone && shown.length === 0 && (
        <p className="py-2 pl-12 text-[12.5px] text-du-text-dim">Toutes les actions sont cochées et masquées.</p>
      )}

      <div className="mt-1.5 pl-11">
        <AnimatePresence mode="wait" initial={false}>
          {composing
            ? <Composer key="composer" onAdd={add} onClose={() => setComposing(false)} />
            : (
              <motion.div key="bouton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.08 } }}>
                <Button type="button" variant="secondary" size="sm" onClick={() => setComposing(true)}>
                  <Plus /> Ajouter une action
                </Button>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function ActionItem({ action, canReorder, onToggle, onRename, onRemove }) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  return (
    <Reorder.Item value={action} dragListener={false} dragControls={controls}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      transition={ITEM_SPRING}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 28px -10px rgba(9,30,66,0.45)', zIndex: 10 }}
      className="relative rounded-lg bg-card">
      <div className="group flex items-start gap-1 rounded-lg py-1 pr-1 transition-colors hover:bg-du-surface2/60">
        <span onPointerDown={e => canReorder && controls.start(e)} aria-hidden
          className={cn('mt-1.5 flex w-5 shrink-0 justify-center text-du-text-dim opacity-0 transition-opacity', canReorder && 'cursor-grab group-hover:opacity-100 active:cursor-grabbing')}>
          <GripVertical className="size-4" />
        </span>
        <span className="flex w-6 shrink-0 justify-center pt-[7px]">
          <Checkbox checked={action.done} onCheckedChange={v => onToggle(v === true)} aria-label={`Action faite : ${action.label}`} />
        </span>
        <div className="min-w-0 flex-1">
          {editing
            ? <LabelEditor initial={action.label} onSave={l => { setEditing(false); if (l) onRename(l); else onRemove(); }} onCancel={() => setEditing(false)} />
            : (
              <button type="button" onClick={() => setEditing(true)} title="Cliquer pour modifier"
                className={cn('relative w-full rounded-md px-2 py-1.5 text-left text-[13.5px] leading-snug transition-colors duration-300',
                  action.done ? 'text-du-text-dim' : 'text-du-text')}>
                <span className="relative">
                  {action.label}
                  {/* Trait qui barre le libellé, tracé de gauche à droite */}
                  <motion.span aria-hidden className="pointer-events-none absolute left-0 right-0 top-1/2 h-[1.5px] origin-left rounded bg-du-text-dim"
                    initial={false} animate={{ scaleX: action.done ? 1 : 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} />
                </span>
              </button>
            )}
        </div>
        {!editing && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Supprimer l'action : ${action.label}`}
            className="mt-0.5 text-du-text-dim opacity-0 transition-opacity hover:text-du-danger focus-visible:opacity-100 group-hover:opacity-100">
            <Trash2 />
          </Button>
        )}
      </div>
    </Reorder.Item>
  );
}

/* Modification d'un libellé : Entrée enregistre, Échap annule, perte du focus enregistre ; vide = suppression */
function LabelEditor({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);
  const finish = fn => { if (finished.current) return; finished.current = true; fn(); };
  return (
    <div className="py-0.5">
      <textarea {...LOCAL_ESCAPE} autoFocus rows={1} value={value}
        onFocus={e => e.currentTarget.select()}
        onChange={e => setValue(e.target.value.replace(/\n/g, ''))}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); finish(() => onSave(cleanLabel(value))); }
          if (e.key === 'Escape') { e.preventDefault(); finish(onCancel); }
        }}
        onBlur={() => finish(() => onSave(cleanLabel(value)))}
        className="block w-full resize-none rounded-md bg-du-field px-2 py-1.5 text-[13.5px] leading-snug text-du-text shadow-[inset_0_0_0_2px_var(--du-teal)] outline-none" />
    </div>
  );
}

/* Ajout : le champ reste ouvert après chaque ajout pour saisir plusieurs actions d'affilée */
function Composer({ onAdd, onClose }) {
  const [value, setValue] = useState('');
  const input = useRef(null);
  const submit = () => {
    const label = cleanLabel(value);
    if (!label) return;
    onAdd(label); setValue(''); input.current?.focus();
  };
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
      className="-ml-0.5 flex flex-col gap-2">
      <input {...LOCAL_ESCAPE} ref={input} autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Ajouter une action…"
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
        className="h-9 w-full rounded-lg bg-du-field px-3 text-[13.5px] text-du-text shadow-[inset_0_0_0_2px_var(--du-teal)] outline-none placeholder:text-du-text-dim" />
      <div className="flex items-center gap-1.5">
        <Button type="button" size="sm" onClick={submit} disabled={!cleanLabel(value)}>Ajouter</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}><X /> Annuler</Button>
        <span className="ml-auto hidden text-[11px] text-du-text-dim sm:inline">Entrée pour ajouter, Échap pour fermer</span>
      </div>
    </motion.div>
  );
}

export { LOCAL_ESCAPE };
