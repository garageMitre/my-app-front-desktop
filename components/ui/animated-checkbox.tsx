'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
}

export function AnimatedCheckbox({
  checked, indeterminate, onChange, onClick, disabled, className,
}: AnimatedCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      onClick={e => { onClick?.(e); if (!disabled) onChange?.(); }}
      className={cn(
        'relative w-4 h-4 rounded-[4px] flex items-center justify-center flex-shrink-0',
        'border backdrop-blur-sm transition-all duration-150',
        checked || indeterminate
          ? 'border-accent/70 bg-accent/15 shadow-[0_0_0_1px_rgba(108,99,255,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'border-white/15 bg-white/[0.04] hover:border-accent/50 hover:bg-accent/[0.08]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <AnimatePresence mode="wait">
        {checked && !indeterminate && (
          <motion.svg
            key="check"
            viewBox="0 0 12 10"
            fill="none"
            className="w-2.5 h-2"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.14, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <motion.path
              d="M1 5L4.5 8.5L11 1.5"
              stroke="#A5A0FF"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            />
          </motion.svg>
        )}
        {indeterminate && (
          <motion.div
            key="dash"
            className="w-2 h-[1.5px] rounded-full bg-accent-soft"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>
    </button>
  );
}
