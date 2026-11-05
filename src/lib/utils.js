import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/* Assemble des classes Tailwind en résolvant les conflits (convention shadcn/ui) */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
