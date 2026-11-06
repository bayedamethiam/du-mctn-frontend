import { forwardRef } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

/* Fenêtre flottante shadcn/ui (Radix). Le contenu est rendu dans un portail : il porte la classe `tw`.
 * z-index au-dessus des modales (z-[1000]) pour s'ouvrir depuis un formulaire. */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = forwardRef(function PopoverContent({ className, align = 'start', sideOffset = 6, ...props }, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset}
        className={cn(
          'tw z-[1100] w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl shadow-black/20 outline-none',
          'origin-(--radix-popover-content-transform-origin) data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props} />
    </PopoverPrimitive.Portal>
  );
});

/* En-tête de popover façon Trello : titre centré */
export function PopoverHeader({ className, children }) {
  return <p className={cn('mb-2.5 text-center text-[13px] font-semibold text-du-text-muted', className)}>{children}</p>;
}
