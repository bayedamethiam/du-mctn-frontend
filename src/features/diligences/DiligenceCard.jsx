import { forwardRef, memo, useCallback } from 'react';
import { motion } from 'motion/react';
import { useDraggable } from '@dnd-kit/core';
import { AlignLeft, ArrowRightLeft, CalendarDays, CheckCircle2, Flame, Landmark, MoreHorizontal, Pencil, Trash2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { avatarColor, deadlineInfo, initials, memberFor } from './board.js';

const TONE = {
  danger: 'bg-du-danger/12 text-du-danger ring-du-danger/25',
  warning: 'bg-du-warning/12 text-du-warning ring-du-warning/25',
  success: 'bg-du-success/12 text-du-success ring-du-success/25',
  neutral: 'bg-du-surface2 text-du-text-muted ring-transparent',
};

export const CARD_SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 };

/* Carte d'une diligence. Toute la carte se saisit pour la déplacer (si l'utilisateur a le droit) ;
 * un clic l'ouvre ; le menu « … » offre les mêmes actions au clavier et à la souris. */
function DiligenceCardView({ d, ctx, inLateColumn = false, overlay = false, dragging = false, dragHandle = {} }) {
  const { ref, team, statuses, today, alertDays, canEdit, canDelete, onOpen, onMove, onDelete } = ctx;
  const closed = ref.has('diligence_status', d.status, 'closed');
  const done = ref.has('diligence_status', d.status, 'done');
  const cancelled = closed && !done;
  const priorityColor = ref.color('priority', d.priority, 'var(--du-teal)');
  const critical = ref.has('priority', d.priority, 'critical');
  const deadline = deadlineInfo(d.deadline, { today, alertDays, closed, done });
  const member = memberFor(team, d.responsible);
  const who = member?.name || d.responsible;
  const statusColor = ref.color('diligence_status', d.status, 'var(--du-text-muted)');

  return (
    <div
      {...dragHandle}
      role="button"
      tabIndex={0}
      aria-label={`Diligence : ${d.title}`}
      onClick={() => !overlay && onOpen(d)}
      onKeyDown={e => { if (e.key === 'Enter' && !overlay) onOpen(d); }}
      className={cn(
        'group relative rounded-xl bg-white p-3 text-left shadow-[0_1px_2px_rgba(9,30,66,0.18)] ring-1 ring-black/[0.06] outline-none transition-[box-shadow,transform,opacity] duration-200',
        'dark:bg-[#11264a] dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)] dark:ring-white/[0.07]',
        'hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(9,30,66,0.35)] focus-visible:ring-2 focus-visible:ring-primary',
        canEdit && !overlay && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-35 saturate-50',
        overlay && 'cursor-grabbing shadow-[0_24px_48px_-12px_rgba(9,30,66,0.55)] ring-2 ring-primary/60',
        cancelled && 'opacity-70',
      )}
    >
      {/* Étiquettes : priorité (couleur du référentiel) et type */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-7">
        <span className="inline-flex h-5 items-center gap-1 rounded-md px-2 text-[10.5px] font-bold uppercase tracking-wide text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${priorityColor}, color-mix(in srgb, ${priorityColor} 75%, #000))` }}>
          {critical && <Flame className="size-3" />}
          {ref.label('priority', d.priority)}
        </span>
        {d.type && <span className="inline-flex h-5 items-center rounded-md bg-du-surface2 px-2 text-[10.5px] font-semibold text-du-text-muted">{ref.label('diligence_type', d.type)}</span>}
      </div>

      <p className={cn('line-clamp-3 text-[13.5px] font-semibold leading-snug text-du-text', cancelled && 'line-through decoration-du-text-dim/60')}>
        {done && <CheckCircle2 className="mr-1 inline size-4 -translate-y-px text-du-success" />}
        {cancelled && <XCircle className="mr-1 inline size-4 -translate-y-px text-du-text-dim" />}
        {d.title}
      </p>

      {d.source && (
        <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11.5px] text-du-text-dim">
          <Landmark className="size-3.5 shrink-0" /> <span className="truncate">{d.source}</span>
        </p>
      )}

      {/* Pied de carte : échéance, notes, statut (colonne « En retard »), responsable */}
      <div className="mt-3 flex items-center gap-1.5">
        {deadline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold ring-1', TONE[deadline.tone])}>
                <CalendarDays className="size-3.5" /> {deadline.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>Échéance : {deadline.full}</TooltipContent>
          </Tooltip>
        )}
        {d.notes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex size-6 items-center justify-center rounded-md text-du-text-dim hover:bg-du-surface2" aria-label="Notes">
                <AlignLeft className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="whitespace-pre-line">{d.notes}</TooltipContent>
          </Tooltip>
        )}
        {inLateColumn && <Badge color={statusColor}>{ref.label('diligence_status', d.status)}</Badge>}
        <span className="flex-1" />
        {who && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex size-7 items-center justify-center rounded-full text-[10.5px] font-bold text-white ring-2 ring-white shadow-sm dark:ring-[#11264a]"
                style={{ background: member?.color || avatarColor(who) }}>
                {member?.initials || initials(who)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{who}{member?.role ? ` · ${member.role}` : ''}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Menu d'actions : visible au survol, toujours accessible au clavier */}
      {!overlay && (canEdit || canDelete) && (
        <div className="absolute right-1.5 top-1.5" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Actions"
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-accent">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canEdit && <DropdownMenuItem onSelect={() => onOpen(d)}><Pencil /> Modifier</DropdownMenuItem>}
              {canEdit && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><ArrowRightLeft /> Changer le statut</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuLabel>Statut</DropdownMenuLabel>
                    {statuses.map(s => (
                      <DropdownMenuItem key={s.code} disabled={String(s.code) === String(d.status)} onSelect={() => onMove(d, String(s.code))}>
                        <span className="size-2.5 rounded-full" style={{ background: s.color || 'var(--du-text-dim)' }} /> {s.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => onDelete(d)}><Trash2 /> Supprimer</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

/* Carte posée dans une colonne : déplaçable, animée à l'entrée, à la sortie et lorsqu'elle change de colonne.
 * forwardRef : AnimatePresence (mode popLayout) mesure la carte qui sort ; sa référence s'ajoute à celle du glisser-déposer. */
export const DiligenceCard = memo(forwardRef(function DiligenceCard({ d, ctx, inLateColumn }, outerRef) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(d.id), data: { diligence: d }, disabled: !ctx.canEdit });
  const setRefs = useCallback(node => {
    setNodeRef(node);
    if (typeof outerRef === 'function') outerRef(node);
    else if (outerRef) outerRef.current = node;
  }, [setNodeRef, outerRef]);
  return (
    <motion.li
      ref={setRefs}
      layout="position"
      layoutId={`diligence-${d.id}`}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      transition={CARD_SPRING}
    >
      <DiligenceCardView d={d} ctx={ctx} inLateColumn={inLateColumn} dragging={isDragging} dragHandle={{ ...attributes, ...listeners }} />
    </motion.li>
  );
}));

/* Copie de la carte qui suit le pointeur pendant le glisser-déposer */
export function DiligenceCardOverlay({ d, ctx }) {
  return (
    <motion.div initial={{ scale: 1, rotate: 0 }} animate={{ scale: 1.03, rotate: 2.5 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }} className="tw">
      <DiligenceCardView d={d} ctx={ctx} overlay />
    </motion.div>
  );
}
