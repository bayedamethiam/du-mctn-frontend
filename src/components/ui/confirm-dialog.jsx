import { useState } from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/* Fenêtre de confirmation (shadcn/ui « alert-dialog », Radix + Motion), à la place de window.confirm :
 * les fenêtres natives sont laides et certains navigateurs intégrés les bloquent (réponse « non »
 * immédiate, sans rien afficher). Échap ou « Annuler » ferment ; le focus part sur « Annuler ».
 * `onConfirm` peut renvoyer une promesse : le bouton affiche un chargement, puis la fenêtre se ferme. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', tone = 'danger', onConfirm }) {
  const [busy, setBusy] = useState(false);
  const Icon = tone === 'danger' ? Trash2 : AlertTriangle;

  const confirm = async e => {
    e.preventDefault();   // la fenêtre ne se ferme qu'une fois l'action terminée
    setBusy(true);
    try { await onConfirm?.(); onOpenChange(false); }
    finally { setBusy(false); }
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <AnimatePresence>
        {open && (
          <AlertDialogPrimitive.Portal forceMount>
            <AlertDialogPrimitive.Overlay forceMount asChild>
              <motion.div className="tw fixed inset-0 z-[1200] grid place-items-center bg-[var(--du-overlay)] p-4 backdrop-blur-[3px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                <AlertDialogPrimitive.Content forceMount asChild>
                  <motion.div
                    className="w-full max-w-[420px] rounded-2xl bg-card p-6 text-du-text shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/5 outline-none dark:ring-white/10"
                    initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.13 } }}
                    transition={{ type: 'spring', stiffness: 480, damping: 32 }}>
                    <div className="flex items-start gap-4">
                      <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.05 }}
                        className={cn('flex size-11 shrink-0 items-center justify-center rounded-full',
                          tone === 'danger' ? 'bg-du-danger/12 text-du-danger' : 'bg-du-warning/14 text-du-warning')}>
                        <Icon className="size-5" />
                      </motion.span>
                      <div className="min-w-0 flex-1">
                        <AlertDialogPrimitive.Title className="font-serif text-[21px] font-semibold leading-tight text-du-text">{title}</AlertDialogPrimitive.Title>
                        <AlertDialogPrimitive.Description className="mt-1.5 text-[13.5px] leading-relaxed text-du-text-muted">{description}</AlertDialogPrimitive.Description>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                      <AlertDialogPrimitive.Cancel asChild>
                        <Button type="button" variant="outline" className="h-10 px-5" disabled={busy}>{cancelLabel}</Button>
                      </AlertDialogPrimitive.Cancel>
                      <AlertDialogPrimitive.Action asChild>
                        <Button type="button" variant={tone === 'danger' ? 'destructive' : 'default'} className="h-10 min-w-28 px-5 shadow-md" disabled={busy} onClick={confirm}>
                          {busy ? <Loader2 className="animate-spin" /> : confirmLabel}
                        </Button>
                      </AlertDialogPrimitive.Action>
                    </div>
                  </motion.div>
                </AlertDialogPrimitive.Content>
              </motion.div>
            </AlertDialogPrimitive.Overlay>
          </AlertDialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </AlertDialogPrimitive.Root>
  );
}
