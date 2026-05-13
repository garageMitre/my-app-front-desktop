'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Sparkles } from 'lucide-react';
import { useChatOpen } from './ChatProvider';
import { cn } from '@/lib/utils';

function useOfficialUsdRate() {
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        setRate(data.venta);
      } catch {}
    }
    fetch_();
    const id = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return rate;
}

function Logo({ className = 'w-15 h-15' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <img
        src="/logo-gastofacil.png"
        alt="GastoFácil"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

const PAGE_TITLES: Record<string, { eyebrow: string; title: string }> = {
  '/dashboard': { eyebrow: 'Resumen', title: 'Dashboard' },
  '/gastos': { eyebrow: 'Movimientos', title: 'Gastos' },
  '/categorias': { eyebrow: 'Configuración', title: 'Categorías' },
};

export default function TopBar() {
  const path = usePathname() || '/dashboard';
  const meta = PAGE_TITLES[path] ?? PAGE_TITLES['/dashboard'];
  const { open, toggle } = useChatOpen();
  const usdRate = useOfficialUsdRate();

  return (
    <header
      className="flex-shrink-0 h-14 flex items-center px-5 gap-4 border-b border-line relative z-30"
      style={{ background: 'rgba(8,9,14,0.7)', backdropFilter: 'blur(20px)' }}
    >
      {/* hairline accent on top */}
      <div className="absolute inset-x-0 top-0 hairline" />

      {/* Logo block */}
      {/* Logo block */}
      <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
        <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#080914] shadow-[0_0_22px_-8px_rgba(99,102,241,0.8)]">
          <img
            src="/logo-icon.png"
            alt="GastoFácil"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="leading-none">
          <p className="text-text font-extrabold text-[17px] tracking-tight">
            Gasto<span className="text-accent-soft">Fácil</span>
          </p>
          <p className="text-text-dim text-[10px] mt-1 tracking-wide">
            Control de gastos
          </p>
        </div>
</Link>

      {/* divider */}
      <div className="w-px h-6 bg-line ml-1" />

      {/* breadcrumb / current section */}
      <motion.div
        key={path}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-2 min-w-0"
      >
        <span className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-semibold">
          {meta.eyebrow}
        </span>
        <span className="text-text-dim">/</span>
        <span className="text-text-soft text-sm font-semibold">{meta.title}</span>
      </motion.div>

      <div className="flex-1" />

      {/* Download desktop app */}
      <a
        href="/downloads/gastofacil.exe"
        download
        className="hidden sm:flex h-9 items-center gap-2 rounded-xl border border-line bg-white/[0.04] px-3 text-xs font-semibold text-text-soft transition-all hover:border-accent/40 hover:bg-accent/10 hover:text-accent-soft"
      >
        <Download className="w-4 h-4" />
        <span>Descargar app</span>
      </a>

      {/* AI chat toggle */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={toggle}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        className={cn(
          'w-9 h-9 rounded-xl border flex items-center justify-center transition-all',
          open
            ? 'border-accent/40 bg-accent/15 text-accent-soft shadow-[0_0_16px_-4px_rgba(108,99,255,0.4)]'
            : 'border-line text-text-muted hover:text-text hover:bg-white/[0.05] hover:border-line-2',
        )}
      >
        <Sparkles className="w-4 h-4" />
      </motion.button>

      {/* USD official rate */}
      {usdRate !== null && (
        <div className="flex items-center gap-2 px-3 h-8 rounded-lg border border-line bg-surface/60 text-xs select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-text-dim font-semibold tracking-wide">USD OF.</span>
          <span className="text-text font-bold num">${usdRate.toLocaleString('es-AR')}</span>
        </div>
      )}
    </header>
  );
}