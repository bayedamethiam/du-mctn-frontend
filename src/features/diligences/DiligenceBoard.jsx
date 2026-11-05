import { useCallback, useMemo, useState } from 'react';
import { LayoutGroup } from 'motion/react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, pointerWithin, useSensor, useSensors,
} from '@dnd-kit/core';
import { BoardColumn } from './BoardColumn.jsx';
import { DiligenceCardOverlay } from './DiligenceCard.jsx';
import { LATE_COLUMN } from './board.js';

const COLLAPSE_KEY = 'du_diligences_colonnes_repliees';

/* Colonne visée = celle sous le pointeur ; à défaut (clavier, pointeur entre deux colonnes) la plus proche */
const collision = args => {
  const under = pointerWithin(args);
  return under.length ? under : closestCorners(args);
};
const readCollapsed = () => { try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch { return new Set(); } };

/* Tableau en colonnes. Déposer une carte sur une colonne de statut change son statut ; la colonne
 * « En retard » est calculée (on n'y dépose rien). Les colonnes repliées sont mémorisées par navigateur. */
export function DiligenceBoard({ columns, ctx, onAdd }) {
  const [activeId, setActiveId] = useState(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const sensors = useSensors(
    // 6 px de mouvement avant de saisir : un simple clic ouvre la carte
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    // Clavier : Espace saisit et dépose, flèches pour changer de colonne (Entrée reste « ouvrir »)
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  );

  const byId = useMemo(() => new Map(columns.flatMap(c => c.items).map(d => [String(d.id), d])), [columns]);
  const active = activeId ? byId.get(activeId) : null;

  const toggle = useCallback(id => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch { /* stockage indisponible */ }
      return next;
    });
  }, []);

  const onDragEnd = ({ active: a, over }) => {
    setActiveId(null);
    const d = byId.get(String(a.id));
    if (!d || !over || over.id === LATE_COLUMN || String(over.id) === String(d.status)) return;
    ctx.onMove(d, String(over.id));
  };

  return (
    <div className="tw relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--du-hero-from)_0%,var(--du-hero-via)_55%,var(--du-hero-to)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      {/* Halo décoratif, comme les fonds de tableau Trello */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--du-purple)_45%,transparent),transparent_70%)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 right-0 size-[28rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--du-teal)_40%,transparent),transparent_70%)] blur-2xl" />

      <DndContext sensors={sensors} collisionDetection={collision}
        onDragStart={({ active: a }) => setActiveId(String(a.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <LayoutGroup>
          <div className="scrollbar-thin relative flex snap-x snap-mandatory items-start gap-3 overflow-x-auto p-4 sm:snap-none sm:p-5">
            {columns.map((column, i) => (
              <BoardColumn key={column.id} index={i} column={column} ctx={ctx} dragActive={!!active}
                collapsed={collapsed.has(column.id)} onToggleCollapse={() => toggle(column.id)} onAdd={onAdd} />
            ))}
          </div>
        </LayoutGroup>
        <DragOverlay dropAnimation={null}>
          {active ? <DiligenceCardOverlay d={active} ctx={ctx} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
