import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary',
        secondary: 'bg-secondary text-muted-foreground',
        outline: 'border border-border text-muted-foreground',
        danger: 'bg-du-danger/15 text-du-danger',
        warning: 'bg-du-warning/15 text-du-warning',
        success: 'bg-du-success/15 text-du-success',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

/* `color` : couleur libre (couleur d'un référentiel), appliquée en teinte de fond et en texte */
export function Badge({ className, variant, color, style, ...props }) {
  const custom = color ? { color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, ...style } : style;
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} style={custom} {...props} />;
}
