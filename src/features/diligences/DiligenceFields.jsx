import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, Flame, Plus, UserRoundX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { avatarColor, initials } from './board.js';

/* Sélecteurs de la fiche diligence, à la manière de Trello : des boutons « pastilles » qui ouvrent
 * une petite fenêtre (liste colorée, recherche) au lieu de listes déroulantes natives. */

/* Petit titre au-dessus d'un champ (« Responsable », « Échéance »…) */
export function FieldLabel({ children, required }) {
  return (
    <p className="mb-1.5 text-[11.5px] font-semibold text-du-text-muted">
      {children}{required && <span className="ml-0.5 text-du-danger">*</span>}
    </p>
  );
}

/* Bouton-pastille : déclencheur commun des sélecteurs */
export const chipClass = (invalid = false) => cn(
  'inline-flex h-9 max-w-full items-center gap-2 rounded-lg bg-du-surface2 px-3 text-[13px] font-semibold text-du-text outline-none transition-all',
  'hover:bg-du-surface2/70 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.98] data-[state=open]:ring-2 data-[state=open]:ring-primary/50',
  invalid && 'ring-2 ring-du-danger/70',
);

export function Avatar({ name, member, size = 'md' }) {
  const who = member?.name || name;
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm', size === 'sm' ? 'size-6 text-[9.5px]' : 'size-7 text-[10.5px]')}
      style={{ background: member?.color || avatarColor(who) }}>
      {member?.initials || initials(who)}
    </span>
  );
}

/* Statut : pastille colorée en haut de la fiche (comme la liste d'une carte Trello) */
export function StatusPicker({ value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => String(o.code) === String(value));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" aria-label="Statut"
          className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] font-bold outline-none transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.97]"
          style={{ background: `color-mix(in srgb, ${current?.color || 'var(--du-text-dim)'} 16%, transparent)`, color: current?.color || 'var(--du-text-muted)' }}>
          <motion.span key={value} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            className="size-2.5 rounded-full" style={{ background: current?.color || 'var(--du-text-dim)' }} />
          {current?.label || value || 'Statut'}
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2">
        <PopoverHeader className="mt-1">Déplacer vers</PopoverHeader>
        <ul className="flex flex-col gap-0.5">
          {options.map(o => {
            const active = String(o.code) === String(value);
            return (
              <li key={o.code}>
                <button type="button" onClick={() => { onChange(String(o.code)); setOpen(false); }}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-accent', active && 'bg-accent font-semibold')}>
                  <span className="size-2.5 rounded-full" style={{ background: o.color || 'var(--du-text-dim)' }} />
                  <span className="flex-1">{o.label}</span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* Choix libre avec suggestions (source, responsable) : recherche au clavier, et
 * « Utiliser « … » » pour une valeur qui n'est pas encore dans la liste. */
function FreeCombobox({ value, onChange, suggestions, title, placeholder, renderItem, trigger, emptyLabel, clearLabel, clearIcon: ClearIcon }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const exists = suggestions.some(s => s.value.toLowerCase() === typed.toLowerCase());
  const pick = v => { onChange(v); setOpen(false); setQuery(''); };
  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-2.5">
        <PopoverHeader>{title}</PopoverHeader>
        <Command loop>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {typed && !exists && (
              <CommandGroup forceMount>
                <CommandItem value={`__libre__ ${typed}`} onSelect={() => pick(typed)} forceMount>
                  <Plus className="text-primary" /> Utiliser « <span className="truncate font-semibold">{typed}</span> »
                </CommandItem>
              </CommandGroup>
            )}
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {suggestions.length > 0 && (
              <CommandGroup heading="Suggestions">
                {suggestions.map(s => (
                  <CommandItem key={s.value} value={`${s.value} ${s.hint || ''}`} onSelect={() => pick(s.value)}>
                    {renderItem(s)}
                    <span className="flex-1" />
                    {s.value === value && <Check className="text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {value && clearLabel && (
              <>
                <CommandSeparator />
                <CommandItem value="__retirer__" onSelect={() => pick('')} className="text-du-danger">
                  <ClearIcon /> {clearLabel}
                </CommandItem>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SourcePicker({ value, onChange, sources, invalid, icon: Icon }) {
  return (
    <FreeCombobox value={value} onChange={onChange} title="Source de la diligence" placeholder="Rechercher ou saisir une source…"
      emptyLabel="Aucune source connue"
      suggestions={sources.map(s => ({ value: s }))}
      renderItem={s => <><Icon className="text-du-text-dim" /> <span className="truncate">{s.value}</span></>}
      trigger={(
        <button type="button" className={chipClass(invalid)} aria-label="Source">
          <Icon className="size-4 shrink-0 text-du-text-dim" />
          <span className={cn('truncate', !value && 'font-medium text-du-text-dim')}>{value || 'Choisir une source'}</span>
        </button>
      )} />
  );
}

export function ResponsiblePicker({ value, onChange, team, member }) {
  const people = team.filter(m => m.name).map(m => ({ value: m.name, hint: m.role, member: m }));
  return (
    <FreeCombobox value={value} onChange={onChange} title="Responsable" placeholder="Rechercher un membre ou saisir un nom…"
      emptyLabel="Aucun membre trouvé" clearLabel="Retirer le responsable" clearIcon={UserRoundX}
      suggestions={people}
      renderItem={s => (
        <>
          <Avatar member={s.member} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{s.value}</span>
            {s.hint && <span className="block truncate text-[11px] text-du-text-dim">{s.hint}</span>}
          </span>
        </>
      )}
      trigger={(
        <button type="button" className={cn(chipClass(), value && 'pl-1.5')} aria-label="Responsable">
          {value ? <Avatar name={value} member={member} size="sm" /> : <Plus className="size-4 text-du-text-dim" />}
          <span className={cn('truncate', !value && 'font-medium text-du-text-dim')}>{value || 'Attribuer'}</span>
        </button>
      )} />
  );
}

/* Priorité : boutons côte à côte, un clic suffit ; la pastille active glisse d'une option à l'autre */
export function PrioritySegment({ value, options, onChange, isCritical }) {
  return (
    <div role="radiogroup" aria-label="Priorité" className="inline-flex flex-wrap gap-1 rounded-xl bg-du-surface2 p-1">
      {options.map(o => {
        const active = String(o.code) === String(value);
        return (
          <button key={o.code} type="button" role="radio" aria-checked={active} onClick={() => onChange(String(o.code))}
            className={cn('relative inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60',
              active ? 'text-white' : 'text-du-text-muted hover:text-du-text')}>
            {active && (
              <motion.span layoutId="priorite-active" className="absolute inset-0 rounded-lg shadow-md"
                style={{ background: `linear-gradient(135deg, ${o.color || 'var(--du-teal)'}, color-mix(in srgb, ${o.color || 'var(--du-teal)'} 75%, #000))` }}
                transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {isCritical(o.code) ? <Flame className="size-3.5" /> : <span className="size-2 rounded-full" style={{ background: active ? '#fff' : o.color }} />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Type : étiquette colorée ; la fenêtre affiche les types en barres de couleur, comme les étiquettes Trello */
export function LabelPicker({ value, options, onChange, title = 'Type de livrable' }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => String(o.code) === String(value));
  const color = current?.color || 'var(--du-text-dim)';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={title}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-white shadow-sm outline-none transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.97] data-[state=open]:ring-2 data-[state=open]:ring-primary/50"
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 78%, #000))` }}>
          {current?.label || value || 'Choisir'} <ChevronDown className="size-3.5 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2.5">
        <PopoverHeader>{title}</PopoverHeader>
        <ul className="flex flex-col gap-1.5">
          {options.map((o, i) => {
            const active = String(o.code) === String(value);
            return (
              <motion.li key={o.code} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}>
                <button type="button" onClick={() => { onChange(String(o.code)); setOpen(false); }}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] font-bold text-white shadow-sm transition-all hover:translate-x-0.5 hover:brightness-110"
                  style={{ background: `linear-gradient(135deg, ${o.color || 'var(--du-text-dim)'}, color-mix(in srgb, ${o.color || 'var(--du-text-dim)'} 78%, #000))` }}>
                  <span className="flex-1">{o.label}</span>
                  {active && <Check className="size-4" strokeWidth={3} />}
                </button>
              </motion.li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
