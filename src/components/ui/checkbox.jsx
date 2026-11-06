import { forwardRef } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Case à cocher shadcn/ui (Radix) ; la coche apparaît avec un petit rebond */
export const Checkbox = forwardRef(function Checkbox({ className, checked, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root ref={ref} checked={checked}
      className={cn(
        'peer inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 border-du-text-dim/60 bg-du-field outline-none transition-colors',
        'hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}>
      <AnimatePresence initial={false}>
        {checked === true && (
          <motion.span key="check" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 700, damping: 24 }} className="flex">
            <Check className="size-3.5" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </CheckboxPrimitive.Root>
  );
});
