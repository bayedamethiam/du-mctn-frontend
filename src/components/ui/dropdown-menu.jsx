import { forwardRef } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Menu déroulant shadcn/ui (Radix). Le contenu est rendu dans un portail : il porte la classe `tw`. */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const panel = 'tw z-[1100] min-w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl shadow-black/20 '
  + 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 '
  + 'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2';

export const DropdownMenuContent = forwardRef(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn(panel, className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  );
});

const item = 'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors '
  + 'focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

export const DropdownMenuItem = forwardRef(function DropdownMenuItem({ className, destructive, ...props }, ref) {
  return <DropdownMenuPrimitive.Item ref={ref} className={cn(item, destructive && 'text-du-danger focus:bg-du-danger/10 [&_svg]:text-du-danger', className)} {...props} />;
});

export const DropdownMenuCheckboxItem = forwardRef(function DropdownMenuCheckboxItem({ className, children, checked, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem ref={ref} checked={checked} className={cn(item, 'pr-8', className)} {...props}>
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="absolute right-2.5 flex items-center"><Check /></DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.CheckboxItem>
  );
});

export const DropdownMenuSubTrigger = forwardRef(function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubTrigger ref={ref} className={cn(item, 'data-[state=open]:bg-accent', className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  );
});

export const DropdownMenuSubContent = forwardRef(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent ref={ref} className={cn(panel, className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  );
});

export function DropdownMenuLabel({ className, ...props }) {
  return <DropdownMenuPrimitive.Label className={cn('px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
