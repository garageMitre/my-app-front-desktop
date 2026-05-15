'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Sparkles, LogOut, ChevronDown, User } from 'lucide-react';
import { useChatOpen } from './ChatProvider';
import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';

/* ── Download URLs ─────────────────────────────────────────── */
const WINDOWS_URL = 'https://github.com/garageMitre/my-app-front-desktop/releases/download/v0.1.1/gastofacil.exe';
const MAC_URL     = 'https://github.com/garageMitre/my-app-front-desktop/releases/download/v0.1.1/GastoFacil-0.1.1.dmg';

function getDownloadInfo() {
  if (typeof window === 'undefined') return { url: WINDOWS_URL, label: 'Windows' };
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes('mac os')) return { url: MAC_URL, label: 'Mac' };
  return { url: WINDOWS_URL, label: 'Windows' };
}

function useDownloadInfo() {
  const [info, setInfo] = useState({ url: WINDOWS_URL, label: 'Windows' });
  useEffect(() => { setInfo(getDownloadInfo()); }, []);
  return info;
}

/* ── USD rate ──────────────────────────────────────────────── */
function useOfficialUsdRate() {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    async function fetch_() {
      try {
        const res  = await fetch('https://dolarapi.com/v1/dolares/oficial');
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

/* ── Page titles ───────────────────────────────────────────── */
const PAGE_TITLES: Record<string, { eyebrow: string; title: string }> = {
  '/dashboard':     { eyebrow: 'Resumen',       title: 'Dashboard'      },
  '/gastos':        { eyebrow: 'Movimientos',   title: 'Gastos'         },
  '/ingresos':      { eyebrow: 'Movimientos',   title: 'Ingresos'       },
  '/categorias':    { eyebrow: 'Configuración', title: 'Categorías'     },
  '/importar':      { eyebrow: 'Importar',      title: 'Datos'          },
  '/recordatorios': { eyebrow: 'Agenda',        title: 'Recordatorios'  },
};

/* ── User menu ─────────────────────────────────────────────── */
function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (!session?.user) return null;

  const name     = session.user.name ?? 'Usuario';
  const email    = session.user.email ?? '';
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const firstName= name.split(' ')[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-xl border transition-all',
          open
            ? 'border-accent/30 bg-accent/[0.08] text-text'
            : 'border-line bg-white/[0.03] text-text-soft hover:bg-white/[0.05] hover:border-line-2',
        )}
      >
        {/* Avatar */}
        <div className="w-6 h-6 rounded-lg bg-accent/15 border border-accent/25 grid place-items-center flex-shrink-0">
          <span className="text-[10px] font-bold text-accent-soft leading-none">{initials}</span>
        </div>

        <span className="text-xs font-medium hidden md:block max-w-[90px] truncate">
          {firstName}
        </span>

        <ChevronDown className={cn('w-3 h-3 text-text-dim transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-line bg-[#0c0e14] shadow-2xl shadow-black/70 overflow-hidden z-50"
          >
            {/* User info */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 grid place-items-center flex-shrink-0">
                <span className="text-sm font-bold text-accent-soft">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text truncate">{name}</p>
                <p className="text-[10px] text-text-dim truncate mt-0.5">{email}</p>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-text-soft hover:text-danger hover:bg-danger/[0.07] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── TopBar ────────────────────────────────────────────────── */
export default function TopBar() {
  const path         = usePathname() || '/dashboard';
  const meta         = PAGE_TITLES[path] ?? { eyebrow: 'App', title: 'GastoFácil' };
  const { open, toggle } = useChatOpen();
  const usdRate      = useOfficialUsdRate();
  const downloadInfo = useDownloadInfo();

  return (
    <header
      className="flex-shrink-0 h-14 flex items-center px-5 gap-3 border-b border-line relative z-30"
      style={{ background: 'rgba(8,9,14,0.75)', backdropFilter: 'blur(20px)' }}
    >
      {/* hairline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
        <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-indigo-400/20 bg-[#080914] shadow-[0_0_18px_-6px_rgba(99,102,241,0.7)]">
          <img src="/logo-icon.png" alt="GastoFácil" className="h-full w-full object-cover" />
        </div>
        <div className="leading-none hidden sm:block">
          <p className="text-text font-extrabold text-[15px] tracking-tight">
            Gasto<span className="text-accent-soft">Fácil</span>
          </p>
        </div>
      </Link>

      {/* divider */}
      <div className="w-px h-5 bg-line shrink-0" />

      {/* Breadcrumb */}
      <motion.div
        key={path}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22 }}
        className="flex items-center gap-1.5 min-w-0"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-semibold shrink-0">
          {meta.eyebrow}
        </span>
        <span className="text-text-dim/50 text-xs">/</span>
        <span className="text-text-soft text-sm font-semibold truncate">{meta.title}</span>
      </motion.div>

      <div className="flex-1" />

      {/* Download */}
      <a
        href={downloadInfo.url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:flex h-8 items-center gap-1.5 rounded-xl border border-line bg-white/[0.03] px-2.5 text-[11px] font-semibold text-text-dim transition-all hover:border-accent/30 hover:bg-accent/[0.07] hover:text-text-soft"
        title={`Descargar para ${downloadInfo.label}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden lg:block">{downloadInfo.label}</span>
      </a>

      {/* AI chat toggle */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={toggle}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        className={cn(
          'w-8 h-8 rounded-xl border flex items-center justify-center transition-all',
          open
            ? 'border-accent/40 bg-accent/15 text-accent-soft shadow-[0_0_14px_-4px_rgba(108,99,255,0.45)]'
            : 'border-line text-text-muted hover:text-text hover:bg-white/[0.05] hover:border-line-2',
        )}
      >
        <Sparkles className="w-4 h-4" />
      </motion.button>

      {/* USD rate */}
      {usdRate !== null && (
        <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-xl border border-line bg-surface/60 text-xs select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-text-dim font-semibold">USD</span>
          <span className="text-text font-bold num">${usdRate.toLocaleString('es-AR')}</span>
        </div>
      )}

      {/* User menu */}
      <UserMenu />
    </header>
  );
}
