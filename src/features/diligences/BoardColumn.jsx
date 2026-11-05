import { AnimatePresence, motion } from 'motion/react';
import { useDroppable } from '@dnd-kit/core';
import { AlarmClock, ChevronsLeftRight, ChevronsRightLeft, Inbox, MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DiligenceCard } from './DiligenceCard.jsx';

/* Compteur animé : le chiffre glisse quand il change */
function Count({ value, color }) {
  return (
    <span className="relative inline-flex h-5 min-w-5 items-center justify-center overflow-hidden rounded-full px-1.5 text-[11px] font-bold tabular-nums"
      style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.2 }}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* Colonne du tableau : en-tête (couleur, libellé, compteur, menu), cartes, ajout rapide.
 * « En retard » est calculée : on ne peut pas y déposer une carte ni y en créer une. */
export function BoardColumn({ column, ctx, collapsed, onToggleCollapse, onAdd, dragActive, index }) {
  const isLate = column.kind === 'late';
  const color = column.color || (isLate ? 'var(--du-danger)' : 'var(--du-text-muted)');
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: isLate || !ctx.canEdit });
  const canAdd = ctx.canEdit && !isLate;

  if (collapsed) {
    return (
      <motion.button layout="position" type="button" onClick={onToggleCollapse}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="group flex w-12 shrink-0 flex-col items-center gap-3 self-start rounded-2xl bg-white/85 py-4 shadow-lg ring-1 ring-black/5 backdrop-blur-xl transition hover:bg-white dark:bg-[#0b1a33]/85 dark:ring-white/10 dark:hover:bg-[#0b1a33]"
        aria-label={`Déplier la colonne ${column.label}`}>
        <ChevronsLeftRight className="size-4 text-du-text-dim group-hover:text-du-text" />
        <Count value={column.items.length} color={color} />
        <span className="text-[13px] font-bold text-du-text [writing-mode:vertical-rl]">{column.label}</span>
      </motion.button>
    );
  }

  return (
    <motion.section
      ref={setNodeRef}
      layout="position"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: index * 0.05 }}
      className={cn(
        'flex max-h-[calc(100vh-220px)] min-h-[220px] w-[84vw] max-w-[320px] shrink-0 snap-start flex-col rounded-2xl sm:w-[300px]',
        'bg-[#f1f3f7]/90 shadow-[0_10px_30px_-12px_rgba(9,30,66,0.45)] ring-1 ring-black/5 backdrop-blur-xl',
        'dark:bg-[#0b1a33]/88 dark:ring-white/10',
        'transition-[box-shadow,outline-color] duration-200',
        isOver && 'outline-2 outline-offset-2 outline-primary',
        dragActive && isLate && 'opacity-60',
      )}
    >
      {/* Liseré de couleur du statut */}
      <div className="h-1 shrink-0 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 35%, transparent))` }} />

      <header className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        {isLate
          ? <AlarmClock className="size-4 shrink-0" style={{ color }} />
          : <span className="size-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_18%,transparent)]" style={{ background: color, color }} />}
        <h3 className="truncate text-[13.5px] font-bold text-du-text">{column.label}</h3>
        <Count value={column.items.length} color={color} />
        <span className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions de la colonne ${column.label}`}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canAdd && <DropdownMenuItem onSelect={() => onAdd(column.id)}><Plus /> Ajouter une diligence</DropdownMenuItem>}
            <DropdownMenuItem onSelect={onToggleCollapse}><ChevronsRightLeft /> Replier la colonne</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {column.hint && isLate && <p className="-mt-1 px-3 pb-2 text-[11px] text-du-text-dim">{column.hint}</p>}

      <ul className="scrollbar-thin flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-0.5">
        <AnimatePresence initial={false} mode="popLayout">
          {column.items.map(d => <DiligenceCard key={d.id} d={d} ctx={ctx} inLateColumn={isLate} />)}
        </AnimatePresence>
        {column.items.length === 0 && (
          <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={cn('flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/10 px-3 py-6 text-center text-[12px] text-du-text-dim dark:border-white/10',
              isOver && 'border-primary/60 bg-primary/5 text-primary')}>
            <Inbox className="size-5 opacity-60" />
            {dragActive && !isLate ? 'Déposez la diligence ici' : isLate ? 'Aucun retard, bravo' : 'Aucune diligence'}
          </motion.li>
        )}
      </ul>

      {canAdd && (
        <div className="shrink-0 px-2 pb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => onAdd(column.id)}
                className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-[13px] font-semibold text-du-text-muted transition-colors hover:bg-black/[0.06] hover:text-du-text dark:hover:bg-white/[0.07]">
                <Plus className="size-4" /> Ajouter une diligence
              </button>
            </TooltipTrigger>
            <TooltipContent>Nouvelle diligence au statut « {column.label} »</TooltipContent>
          </Tooltip>
        </div>
      )}
    </motion.section>
  );
}
