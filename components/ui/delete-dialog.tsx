'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeleteDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function DeleteDialog({
  open, title, description, onConfirm, onClose, loading,
}: DeleteDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* sheet */}
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340, mass: 0.8 }}
            className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, rgba(28,14,14,0.97) 0%, rgba(18,10,10,0.97) 100%)',
              border: '1px solid rgba(248,113,113,0.12)',
              boxShadow: '0 32px 80px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* top hairline */}
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.3), transparent)' }} />

            <div className="p-6 pt-7 flex flex-col items-center text-center gap-4">
              {/* icon */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-danger/20 blur-xl scale-150" />
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle at 30% 20%, rgba(248,113,113,0.25), rgba(248,113,113,0.08))',
                    boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.25), 0 8px 24px -8px rgba(248,113,113,0.4)',
                  }}>
                  <Trash2 className="w-6 h-6 text-danger" strokeWidth={1.8} />
                </div>
              </div>

              {/* text */}
              <div>
                <h3 className="text-text font-bold text-base tracking-tight leading-snug">{title}</h3>
                {description && (
                  <p className="text-text-muted text-[13px] mt-1.5 leading-relaxed">{description}</p>
                )}
              </div>

              {/* actions */}
              <div className="flex flex-col gap-2 w-full mt-1">
                <button
                  onClick={async () => { await onConfirm(); }}
                  disabled={loading}
                  className="w-full h-12 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(180deg, #f87171, #ef4444)',
                    boxShadow: '0 4px 24px -6px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  {loading ? 'Eliminando…' : 'Eliminar'}
                </button>
                <Button variant="ghost" onClick={onClose} disabled={loading} className="w-full h-12 text-text-muted hover:text-text">
                  Cancelar
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
