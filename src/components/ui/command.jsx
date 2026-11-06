import { forwardRef } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Liste de choix filtrable au clavier (shadcn/ui, sur cmdk) */
export const Command = forwardRef(function Command({ className, ...props }, ref) {
  return <CommandPrimitive ref={ref} className={cn('flex w-full flex-col overflow-hidden text-popover-foreground', className)} {...props} />;
});

export const CommandInput = forwardRef(function CommandInput({ className, ...props }, ref) {
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-border bg-du-field px-2.5 focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/15">
      <Search className="size-4 shrink-0 text-du-text-dim" />
      <CommandPrimitive.Input ref={ref} className={cn('h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-du-text-dim', className)} {...props} />
    </div>
  );
});

export const CommandList = forwardRef(function CommandList({ className, ...props }, ref) {
  return <CommandPrimitive.List ref={ref} className={cn('scrollbar-thin max-h-64 overflow-y-auto overflow-x-hidden', className)} {...props} />;
});

export const CommandEmpty = forwardRef(function CommandEmpty(props, ref) {
  return <CommandPrimitive.Empty ref={ref} className="py-5 text-center text-[13px] text-du-text-dim" {...props} />;
});

export const CommandGroup = forwardRef(function CommandGroup({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Group ref={ref}
      className={cn('[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-du-text-dim', className)}
      {...props} />
  );
});

export const CommandSeparator = forwardRef(function CommandSeparator({ className, ...props }, ref) {
  return <CommandPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
});

export const CommandItem = forwardRef(function CommandItem({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Item ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] outline-none transition-colors',
        'data-[selected=true]:bg-accent data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props} />
  );
});
