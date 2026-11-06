import { useEffect, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'react-day-picker/locale/fr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/* Calendrier shadcn/ui (react-day-picker), en français, semaine du lundi au dimanche.
 * Le changement de mois glisse (animations définies dans tailwind.css, classes rdp-weeks_*). */
export function Calendar({ className, classNames, ...props }) {
  return (
    <DayPicker
      locale={fr}
      weekStartsOn={1}
      showOutsideDays
      animate
      className={cn('relative select-none', className)}
      classNames={{
        months: 'relative flex flex-col',
        month: 'flex w-full flex-col gap-2',
        nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'aria-disabled:opacity-40'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'aria-disabled:opacity-40'),
        month_caption: 'flex h-8 items-center justify-center px-10',
        caption_label: 'text-[13.5px] font-semibold capitalize text-du-text',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'flex h-7 w-9 items-center justify-center text-[11px] font-semibold uppercase text-du-text-dim',
        week: 'mt-0.5 flex w-full',
        day: 'p-0 text-center',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) => (orientation === 'left'
          ? <ChevronLeft className={cn('size-4', c)} />
          : <ChevronRight className={cn('size-4', c)} />),
        DayButton,
      }}
      {...props}
    />
  );
}

function DayButton({ day, modifiers, className, ...props }) {
  const ref = useRef(null);
  useEffect(() => { if (modifiers.focused) ref.current?.focus(); }, [modifiers.focused]);
  return (
    <button ref={ref} type="button"
      data-selected={modifiers.selected || undefined}
      data-today={modifiers.today || undefined}
      data-outside={modifiers.outside || undefined}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg text-[13px] text-du-text outline-none transition-[background-color,color,transform] duration-150',
        'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-90 disabled:pointer-events-none disabled:opacity-40',
        'data-[outside]:text-du-text-dim/60',
        'data-[today]:font-bold data-[today]:not-data-[selected]:text-primary data-[today]:not-data-[selected]:bg-primary/10',
        'data-[selected]:bg-primary data-[selected]:font-semibold data-[selected]:text-primary-foreground data-[selected]:shadow-md data-[selected]:shadow-primary/30',
        className,
      )}
      {...props} />
  );
}
