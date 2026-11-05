import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* Bouton shadcn/ui (forme compatible React 18 : forwardRef, pour que `asChild` des menus Radix fonctionne) */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:brightness-110 active:brightness-95',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent text-foreground/80 hover:text-foreground',
        destructive: 'bg-destructive text-white hover:brightness-110',
        glass: 'border border-white/25 bg-white/15 text-white backdrop-blur-md hover:bg-white/25',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-5',
        icon: 'size-8',
        'icon-sm': 'size-7 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const Button = forwardRef(function Button({ className, variant, size, asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
