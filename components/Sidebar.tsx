'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import { LayoutDashboard, ArrowLeftRight, Tag, TrendingUp, Calendar1Icon } from 'lucide-react';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, color: '#A78BFA' },
  { href: '/gastos',     label: 'Gastos',     icon: ArrowLeftRight,  color: '#38BDF8' },
  { href: '/ingresos',   label: 'Ingresos',   icon: TrendingUp,      color: '#34D399' },
  { href: '/categorias', label: 'Categorías', icon: Tag,             color: '#F59E0B' },
  { href: '/recordatorios', label: 'Recordatorios', icon: Calendar1Icon,             color: '#910000' },
];

export default function Sidebar() {
  const path = usePathname() || '/';

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <LayoutGroup id="mac-dock">
        <nav className="pointer-events-auto flex items-center gap-1 rounded-2xl px-2 py-1.5 border border-white/[0.09] bg-white/[0.04] backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {NAV.map((item) => {
            const active = path === item.href || path.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href} className="group relative">
                {/* Tooltip */}
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)] opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 whitespace-nowrap rounded-lg border border-white/[0.10] bg-[rgba(20,22,30,0.95)] px-2.5 py-1 text-[11px] font-medium text-white/90 shadow-lg">
                  {item.label}
                  {/* arrow */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/[0.10]" />
                </div>

                <motion.div
                  whileHover={{ y: -6, scale: 1.14 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl"
                >
                  {active && (
                    <motion.div
                      layoutId="dock-active"
                      className="absolute inset-0 rounded-xl border border-white/[0.10]"
                      style={{ backgroundColor: item.color + '18', boxShadow: `0 0 16px ${item.color}22` }}
                      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                    />
                  )}

                  <Icon
                    className="relative z-10 transition-opacity duration-200"
                    style={{
                      width: 20,
                      height: 20,
                      color: active ? item.color : 'rgba(168,170,190,0.7)',
                      opacity: active ? 1 : undefined,
                    }}
                    strokeWidth={active ? 2.2 : 1.9}
                  />

                  {/* active dot */}
                  {active && (
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>
    </div>
  );
}
