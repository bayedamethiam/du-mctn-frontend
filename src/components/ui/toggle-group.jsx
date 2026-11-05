import { forwardRef } from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

/* Sélecteur segmenté (shadcn/ui, Radix) */
export const ToggleGroup = forwardRef(function ToggleGroup({ className, ...props }, ref) {
  return <ToggleGroupPrimitive.Root ref={ref} className={cn('inline-flex items-center gap-0.5 rounded-xl border border-border bg-du-surface p-1', className)} {...props} />;
});

export const ToggleGroupItem = forwardRef(function ToggleGroupItem({ className, ...props }, ref) {
  return (
    <ToggleGroupPrimitive.Item ref={ref}
      className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-all outline-none '
        + 'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm [&_svg]:size-4', className)}
      {...props} />
  );
});
