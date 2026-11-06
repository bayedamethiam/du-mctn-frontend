import { useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from '@/components/ui/popover';

/* Conversions entre la valeur de l'API (« AAAA-MM-JJ ») et une date locale (midi : pas de décalage de fuseau) */
export const ymdToDate = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : undefined;
};
export const dateToYmd = d => (d
  ? [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
  : '');

const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };

/* Raccourcis proposés sous le calendrier */
export function datePresets(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const nextMonday = addDays(today, ((8 - today.getDay()) % 7) || 7);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  return [
    { label: 'Aujourd\'hui', date: today },
    { label: 'Demain', date: addDays(today, 1) },
    { label: 'Lundi prochain', date: nextMonday },
    { label: 'Dans 2 semaines', date: addDays(today, 14) },
    { label: 'Fin du mois', date: endOfMonth },
  ];
}

/* Sélecteur de date : `children` est le déclencheur (bouton) ; valeur au format « AAAA-MM-JJ » */
export function DatePicker({ value, onChange, children, title = 'Échéance', align = 'start' }) {
  const [open, setOpen] = useState(false);
  const selected = ymdToDate(value);
  const pick = d => { onChange(dateToYmd(d)); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-3">
        <PopoverHeader>{title}</PopoverHeader>
        <Calendar mode="single" selected={selected} defaultMonth={selected} onSelect={d => d && pick(d)} />
        <div className="mt-2 flex max-w-[252px] flex-wrap gap-1.5 border-t border-border pt-2.5">
          {datePresets().map(p => (
            <button key={p.label} type="button" onClick={() => pick(p.date)}
              className={cn('rounded-full bg-du-surface2 px-2.5 py-1 text-[11.5px] font-semibold text-du-text-muted transition-colors hover:bg-primary/15 hover:text-primary',
                dateToYmd(p.date) === value && 'bg-primary/15 text-primary')}>
              {p.label}
            </button>
          ))}
        </div>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="mt-2 w-full text-du-danger hover:bg-du-danger/10 hover:text-du-danger" onClick={() => pick(undefined)}>
            <CalendarX2 /> Retirer l'échéance
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
