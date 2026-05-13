'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { format, parse, isValid } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<React.CSSProperties>({});

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function handleToggle() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const calH = 340;
    const top = spaceBelow > calH ? rect.bottom + 8 : rect.top - calH - 8;
    const left = Math.min(rect.left, window.innerWidth - 296);
    setPopoverPos({ position: 'fixed', top, left, zIndex: 999 });
    setOpen(o => !o);
  }

  const parsedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const selected = parsedDate && isValid(parsedDate) ? parsedDate : undefined;
  const displayValue = selected ? format(selected, "d 'de' MMMM, yyyy", { locale: es }) : '';

  const dayClassNames = {
    root: 'p-3 w-[280px]',
    months: '',
    month: '',
    caption: 'relative flex items-center justify-center h-9 px-8 mb-1',
    caption_label: 'text-sm font-bold text-[#E6E8EE] capitalize',
    nav: 'absolute inset-0 flex items-center justify-between px-1 pointer-events-none',
    nav_button: cn(
      'pointer-events-auto w-7 h-7 grid place-items-center rounded-lg transition-colors',
      'border border-[rgba(255,255,255,0.06)] text-[#6B7188]',
      'hover:text-[#E6E8EE] hover:bg-[rgba(255,255,255,0.06)]',
    ),
    nav_button_previous: '',
    nav_button_next: '',
    table: 'w-full border-collapse',
    head_row: 'flex',
    head_cell: 'w-9 h-8 flex items-center justify-center text-[10px] font-bold text-[#424761] uppercase',
    row: 'flex mt-1',
    cell: 'w-9 h-9 p-0 flex items-center justify-center',
    day: cn(
      'w-9 h-9 rounded-lg text-sm text-[#A8AEBE] font-normal transition-colors',
      'hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E6E8EE]',
      'focus:outline-none focus:ring-2 focus:ring-[rgba(108,99,255,0.4)]',
      'aria-selected:opacity-100',
    ),
    day_selected: '!bg-[#6C63FF] !text-white font-semibold !hover:bg-[#8B83FF]',
    day_today: 'text-[#8B83FF] font-bold',
    day_outside: 'opacity-25',
    day_disabled: 'opacity-20 cursor-not-allowed',
    day_hidden: 'invisible',
  };

  const popover = (
    <AnimatePresence>
      {open && (
        <>
          <div
            key="dp-backdrop"
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            key="dp-popover"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340, mass: 0.7 }}
            style={{
              ...popoverPos,
              background: 'linear-gradient(160deg, rgba(20,23,31,0.98) 0%, rgba(15,17,23,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 64px -12px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            className="rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* top hairline */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.35), transparent)' }} />
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected ?? new Date()}
              onSelect={(date) => {
                if (date) { onChange(format(date, 'yyyy-MM-dd')); setOpen(false); }
              }}
              locale={es}
              classNames={dayClassNames}
              components={{
                IconLeft: () => <ChevronLeft className="w-4 h-4" />,
                IconRight: () => <ChevronRight className="w-4 h-4" />,
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-2.5 h-10 w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(15,17,23,0.6)] px-3 text-sm text-left transition-all',
          'hover:border-[rgba(255,255,255,0.10)] focus:outline-none',
          open ? 'border-[rgba(108,99,255,0.5)] ring-2 ring-[rgba(108,99,255,0.15)]' : '',
          displayValue ? 'text-[#E6E8EE]' : 'text-[#424761]',
          className,
        )}
      >
        <CalendarDays className="w-4 h-4 text-[#6B7188] flex-shrink-0" />
        <span className="flex-1 truncate">{displayValue || placeholder}</span>
      </button>
      {mounted && createPortal(popover, document.body)}
    </>
  );
}
