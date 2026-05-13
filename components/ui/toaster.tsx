'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info, AlertTriangle, Trash2, X } from 'lucide-react';

/* ─── types ─── */
type ToastType = 'success' | 'danger' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  description?: string;
  type: ToastType;
}

interface ToastOpts { type?: ToastType; description?: string; }

const COLORS: Record<ToastType, string> = {
  success: '#34D399',
  danger:  '#F87171',
  info:    '#38BDF8',
  warning: '#FBBF24',
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: Check,
  danger:  Trash2,
  info:    Info,
  warning: AlertTriangle,
};

const DURATION = 3800;

/* ─── context ─── */
const ToastCtx = createContext<{ toast: (msg: string, opts?: ToastOpts) => void }>({ toast: () => {} });

export function useToast() { return useContext(ToastCtx); }

/* ─── provider ─── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, opts?: ToastOpts) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, message, type: opts?.type ?? 'success', description: opts?.description }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), DURATION);
  }, []);

  const dismiss = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {/* toast stack — fixed top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
        <AnimatePresence mode="sync">
          {toasts.map(t => <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />)}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ─── single toast ─── */
function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const color = COLORS[item.type];
  const Icon = ICONS[item.type];

  useEffect(() => {
    const t = setTimeout(onDismiss, DURATION);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 56, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 56, scale: 0.94 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300, mass: 0.8 }}
      className="pointer-events-auto w-[300px] rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(20,23,31,0.98) 0%, rgba(15,17,23,0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: `0 8px 32px -8px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* top hairline accent */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${color}70, transparent)` }} />

      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        {/* icon */}
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${color}1A`, border: `1px solid ${color}35` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2.2} />
        </div>

        {/* text */}
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-[#E6E8EE] text-sm font-semibold leading-snug">{item.message}</p>
          {item.description && (
            <p className="text-[#6B7188] text-xs mt-0.5 leading-relaxed">{item.description}</p>
          )}
        </div>

        {/* dismiss */}
        <button
          onClick={onDismiss}
          className="text-[#424761] hover:text-[#6B7188] transition-colors mt-0.5 p-0.5 rounded-md hover:bg-white/[0.05]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* progress bar */}
      <div className="mx-4 mb-3 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, transformOrigin: 'left' }}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: DURATION / 1000, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}
