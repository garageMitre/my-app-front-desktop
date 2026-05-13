'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import {
  Wallet, Lock, Activity, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  ArrowUpRight, MoreHorizontal, Landmark, Clock, Pencil, Check, X as XIcon, Loader2, Trash2,
} from 'lucide-react';
import { dashboardService } from '@/service';
import type { DashboardSummary, DayPoint, Expense } from '@/lib/types';
import { cn, fmtARS } from '@/lib/utils';
import { CategoryGlyph } from '@/components/CategoryGlyph';

/* ─── helpers ─── */
function fmtDate(d: string) {
  if (!d) return '';
  const [, m, day] = d.split('T')[0].split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${Number(day)} ${meses[Number(m) - 1]}`;
}
function num(v: unknown): number { return Number(v) || 0; }
function getCatColor(g: Expense) { return g.category?.color ?? '#6C63FF'; }
function getCatName(g: Expense)  { return g.category?.name  ?? 'Sin categoría'; }

function fmtUSD(v: number): string {
  return `U$D ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MESES_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESES_LONG  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type BalanceSnapshot = { id: number; amount: number; date: string; source: string; account: string; updatedAt: string };
type ImportBatch = { batchId: string | null; minDate: string; maxDate: string; snapshotAmount: number | null; expenseCount: number; incomeCount: number; totalExpenses: number; totalIncomes: number };
type BatchTx = { key: string; id: number; date: string; description: string; amount: number; kind: 'expense' | 'income'; runningBalance: number };

function useBalance() {
  const [banco,    setBanco]    = useState<BalanceSnapshot | null>(null);
  const [efectivo, setEfectivo] = useState<BalanceSnapshot | null>(null);
  const [history,  setHistory]  = useState<BalanceSnapshot[]>([]);

  const refresh = useCallback(() => {
    fetch(`${API}/balance`)
      .then(r => r.json())
      .then((d: { banco: BalanceSnapshot | null; efectivo: BalanceSnapshot | null }) => {
        setBanco(d?.banco ?? null);
        setEfectivo(d?.efectivo ?? null);
      }).catch(() => {});
    fetch(`${API}/balance/history`)
      .then(r => r.json()).then(setHistory).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh whenever an expense/income is created or imported
  useEffect(() => {
    window.addEventListener('gf:expense-created', refresh);
    return () => window.removeEventListener('gf:expense-created', refresh);
  }, [refresh]);

  return { banco, efectivo, history, refresh };
}

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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.32, 0.72, 0, 1] } },
};

type ChartView = 'categories' | 'dates' | 'records';
type Currency = 'ARS' | 'USD';
interface BarItem {
  id: string | number;
  label: string;
  value: number;
  color: string;
  tooltipTitle: string;
  tooltipRows: { label: string; value: string; color?: string }[];
}

/* MonthFilter */
function MonthFilter({ year, month, onYear, onMonth }: {
  year: number; month: number;
  onYear: (y: number) => void; onMonth: (m: number) => void;
}) {
  const now = new Date();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-0.5 rounded-xl border border-line bg-surface/60 backdrop-blur p-1">
        <button onClick={() => onYear(year - 1)}
          className="w-7 h-7 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="num text-text font-semibold text-sm w-12 text-center select-none">{year}</span>
        <button onClick={() => onYear(year + 1)}
          disabled={year >= now.getFullYear()}
          className="w-7 h-7 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.05] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-0.5 rounded-xl border border-line bg-surface/60 backdrop-blur p-1">
        {MESES_SHORT.map((mes, i) => {
          const selected = month === i + 1;
          const future = year === now.getFullYear() && i + 1 > now.getMonth() + 1;
          return (
            <button key={i} disabled={future} onClick={() => onMonth(i + 1)}
              className={cn(
                'relative px-2.5 h-7 rounded-lg text-xs font-semibold capitalize transition-all duration-200',
                selected ? 'bg-accent text-white shadow-[0_4px_16px_-6px_rgba(108,99,255,0.7)]'
                : future ? 'text-text-dim cursor-not-allowed'
                         : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]'
              )}>
              {mes}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* MetricCard */
function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const basePoints = values.map((v, i) => ({
    x: (i / (values.length - 1)) * 100,
    y: 82 - ((v - min) / range) * 58,
  }));

  // genera micro-picos naturales
const points = basePoints.flatMap((point, i) => {
  if (i === basePoints.length - 1) return [point];

  const next = basePoints[i + 1];

  const dx = next.x - point.x;
  const dy = next.y - point.y;

  // intensidad real del movimiento
  const strength = Math.abs(dy);

  // amplitud variable en cada segmento
  const amp1 = 2 + strength * 0.18 + (i % 2) * 1.5;
  const amp2 = 4 + strength * 0.30 + (i % 3) * 2.2;
  const amp3 = 2.5 + strength * 0.22 + (i % 4) * 1.2;

  return [
    point,

    // micro pico inicial
    {
      x: point.x + dx * 0.16,
      y: point.y - amp1,
    },

    // pico grande central
    {
      x: point.x + dx * 0.42,
      y: point.y + amp2,
    },

    // pico opuesto
    {
      x: point.x + dx * 0.68,
      y: point.y - amp3,
    },

    // cierre suave distinto
    {
      x: point.x + dx * 0.88,
      y: next.y + amp1 * 0.4,
    },
  ];
});

  function createLine() {
    let d = `M ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x},${points[i].y}`;
    }

    return d;
  }

  const line = createLine();

  const area = `
    ${line}
    L 100,100
    L 0,100
    Z
  `;

  const id = `spark-${color.replace('#', '')}`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-full"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${id})`} />

<path
  d={line}
  fill="none"
  stroke={color}
  strokeWidth="0.42"
  strokeLinecap="round"
  strokeLinejoin="round"
/>
    </svg>
  );
}

function MetricCard({ label, value, sub, icon, trend, accent = '#6C63FF', spark }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; trend?: number; accent?: string; spark?: number[];
}) {
  const up = (trend ?? 0) >= 0;
  const TI = trend !== undefined ? (up ? TrendingUp : TrendingDown) : null;
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-2xl glass p-6 hover:border-line-2 transition-all">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 0%, ${accent}1f, transparent 60%)` }} />
      <div className="relative flex items-start justify-between mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
          style={{ backgroundColor: accent + '18', boxShadow: `inset 0 0 0 1px ${accent}30` }}>
          <div className="absolute inset-0 opacity-50"
            style={{ background: `radial-gradient(circle at 30% 20%, ${accent}66, transparent 70%)` }} />
          <span className="relative z-10 [&>svg]:w-[18px] [&>svg]:h-[18px]" style={{ color: accent }}>{icon}</span>
        </div>
        {TI && trend !== undefined && (
          <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full border text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
              color: up ? '#34D399' : '#F87171',
              borderColor: up ? 'rgba(52,211,153,0.20)' : 'rgba(248,113,113,0.20)',
            }}>
            <TI className="w-3 h-3" /> {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="relative space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-text num">{value}</p>
        {sub && <p className="text-text-muted text-xs">{sub}</p>}
      </div>
      {spark && spark.length > 1 && (
        <div className="relative mt-5 h-16 -mx-3"><Sparkline values={spark} color={accent} /></div>
      )}
    </motion.div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl glass p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="skeleton w-14 h-6 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-24 rounded" />
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-2.5 w-36 rounded" />
      </div>
      <div className="mt-4 h-10 skeleton rounded" />
    </div>
  );
}

/* ConfigurableBarChart */
function ConfigurableBarChart({ byCat, byDate, monthExpenses, mesLabel, fmt, toAmt }: {
  byCat: { id: number; name: string; icon: string; color: string; total: number }[];
  byDate: DayPoint[]; monthExpenses: Expense[]; mesLabel: string;
  fmt: (v: number) => string; toAmt: (e: Expense) => number;
}) {
  const [view, setView] = useState<ChartView>('categories');
  const [hoveredBar, setHovered] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; bar: BarItem } | null>(null);
  const shouldAnimate = !useReducedMotion();
  const VIEWS = [
    { key: 'categories' as ChartView, label: 'Categorías' },
    { key: 'dates' as ChartView,      label: 'Fechas'      },
    { key: 'records' as ChartView,    label: 'Registros'   },
  ];
  const bars: BarItem[] = useMemo(() => {
    if (view === 'categories') return byCat.map(c => ({ id: c.id, label: c.name?.slice(0, 3) || '?', value: c.total, color: c.color, tooltipTitle: c.name, tooltipRows: [{ label: 'Total', value: fmt(c.total) }] }));
    if (view === 'dates') return byDate.map(d => ({ id: d.date, label: String(d.day), value: d.total, color: '#6C63FF', tooltipTitle: d.label, tooltipRows: [{ label: 'Total', value: fmt(d.total) }, { label: 'Fijos', value: fmt(d.fijos), color: '#6C63FF' }, { label: 'Variables', value: fmt(d.variables), color: '#38BDF8' }] }));
    return monthExpenses.slice(0, 22).map(e => { const amt = toAmt(e); return { id: e.id, label: fmtDate(e.date), value: amt, color: getCatColor(e), tooltipTitle: e.description, tooltipRows: [{ label: 'Monto', value: fmt(amt) }, { label: 'Categoría', value: getCatName(e) }, { label: 'Tipo', value: e.type === 'FIXED' ? 'Fijo' : 'Variable' }] }; });
  }, [view, byCat, byDate, monthExpenses, fmt, toAmt]);
  const maxValue = Math.max(...bars.map(b => b.value), 1);
  const CHART_H = 220;
  const total = bars.reduce((s, b) => s + b.value, 0);
  return (
    <motion.div variants={itemVariants} className="col-span-2 group relative overflow-hidden rounded-2xl glass p-6 flex flex-col hover:border-line-2 transition-all">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle at 0% 0%, rgba(108,99,255,0.06), transparent 60%)' }} />
      <div className="relative flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted mb-1.5">Gastos del mes</p>
          <p className="text-text text-xl font-bold capitalize tracking-tight">{mesLabel}</p>
          <p className="text-text-muted text-xs mt-1.5 num">Total <span className="text-text-soft font-semibold">{fmt(total)}</span></p>
        </div>
        <div className="flex gap-0.5 rounded-xl border border-line bg-surface/60 p-1">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => { setView(v.key); setHovered(null); }}
              className={cn('px-3 h-7 rounded-lg text-xs font-semibold transition-all duration-200', view === v.key ? 'bg-accent text-white shadow-[0_4px_16px_-6px_rgba(108,99,255,0.7)]' : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]')}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {bars.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[220px]"><EmptyState message="Sin datos para este período" /></div>
      ) : (
        <div className="overflow-x-auto flex-1 -mx-2 px-2">
          <div className="relative" style={{ height: CHART_H + 28, minWidth: Math.max(bars.length * 38, 200) }}>
            <div className="absolute inset-0 flex flex-col justify-between pb-7 pointer-events-none">
              {[0,1,2,3].map(i => <div key={i} className="border-t border-white/[0.04]" />)}
            </div>
            <div className="relative flex items-end gap-2 h-full">
              {bars.map((bar, i) => {
                const barH = Math.max((bar.value / maxValue) * (CHART_H - 4), 3);
                const isHov = hoveredBar === i;
                return (
                  <div key={`${view}-${bar.id}`} style={{ width: 36 }} className="relative flex flex-col items-center justify-end h-full flex-shrink-0 cursor-default"
                    onMouseEnter={(e) => { setHovered(i); const rect = e.currentTarget.getBoundingClientRect(); setTooltipData({ x: rect.left + rect.width / 2, y: rect.top, bar }); }}
                    onMouseLeave={() => { setHovered(null); setTooltipData(null); }}>
                    <motion.div key={`bar-${view}-${bar.id}`} initial={shouldAnimate ? { height: 0 } : false} animate={{ height: barH }} transition={{ duration: 0.6, delay: i * 0.025, ease: [0.32, 0.72, 0, 1] }} className="w-full rounded-t-md relative overflow-hidden"
                      style={{ backgroundColor: bar.color, opacity: hoveredBar === null ? 0.7 : isHov ? 1 : 0.35, transition: 'opacity 150ms' }}>
                      <div className="absolute inset-0 opacity-50" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent 60%)' }} />
                    </motion.div>
                    <div className="h-7 w-full flex items-start justify-center pt-2">
                      <span className="text-[9px] text-text-dim truncate text-center leading-none">{bar.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {tooltipData && (
            <motion.div key="bar-tooltip" initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }} transition={{ duration: 0.12 }}
              className="fixed z-[9999] rounded-xl p-3 shadow-2xl pointer-events-none min-w-[160px] glass-strong"
              style={{ left: tooltipData.x, top: tooltipData.y - 10, transform: 'translate(-50%, -100%)', background: 'rgba(15,17,23,0.96)' }}>
              <p className="text-[10px] text-text-muted mb-2 font-bold uppercase tracking-wider truncate max-w-[200px]">{tooltipData.bar.tooltipTitle}</p>
              <div className="space-y-1.5">
                {tooltipData.bar.tooltipRows.map((r, ri) => (
                  <div key={ri} className="flex justify-between gap-3">
                    <span className="text-[11px] text-text-muted">{r.label}</span>
                    <span className="text-[11px] font-bold text-text num" style={r.color ? { color: r.color } : {}}>{r.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

/* CategoryBreakdown */
function CategoryBreakdown({ byCat, fmt }: {
  byCat: { id: number; name: string; icon: string; color: string; total: number }[];
  fmt: (v: number) => string;
}) {
  const max = byCat[0]?.total ?? 1;
  const total = byCat.reduce((s, c) => s + c.total, 0);
  return (
    <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-2xl glass p-6 flex flex-col hover:border-line-2 transition-all">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(108,99,255,0.06), transparent 60%)' }} />
      <div className="relative flex items-center justify-between mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">Por categoría</p>
        <button className="text-text-dim hover:text-text-soft transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
      </div>
      {byCat.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[220px]"><EmptyState message="Sin datos este mes" /></div>
      ) : (
        <div className="relative flex flex-col gap-4 overflow-auto flex-1 min-h-0">
          {byCat.slice(0, 7).map((c, i) => {
            const pct = Math.max((c.total / max) * 100, 3);
            const share = total > 0 ? Math.round((c.total / total) * 100) : 0;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <CategoryGlyph name={c.name} color={c.color} size="sm" />
                    <span className="text-text-soft text-xs font-medium truncate">{c.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-text text-xs font-bold num">{fmt(c.total)}</span>
                    <span className="text-text-dim text-[10px] ml-2 num">{share}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: 0.25 + i * 0.06, ease: [0.32, 0.72, 0, 1] }} className="h-full rounded-full relative overflow-hidden" style={{ backgroundColor: c.color }}>
                    <div className="absolute inset-0 opacity-50" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* RecentTransactions */
function RecentTransactions({ recientes, fmt, toAmt }: {
  recientes: Expense[];
  fmt: (v: number) => string;
  toAmt: (e: Expense) => number;
}) {
  return (
    <motion.div variants={itemVariants} className="rounded-2xl glass overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-text-muted" />
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">Últimas transacciones</p>
          <span className="text-[10px] text-text-dim">·</span>
          <span className="text-[10px] text-text-muted num">{recientes.length} registros</span>
        </div>
        <Link href="/gastos" className="text-text-muted hover:text-accent-soft text-xs font-semibold transition-colors flex items-center gap-1">
          Ver todas <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
      {recientes.length === 0 ? (
        <div className="py-16 text-center"><EmptyState message="Sin gastos en este período" /></div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              {['Descripción','Categoría','Fecha','Tipo','Monto'].map(h => (
                <th key={h} className={cn('py-3 px-6 text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim', h === 'Monto' ? 'text-right' : 'text-left')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recientes.map((g, i) => (
              <motion.tr key={g.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.26, delay: i * 0.04 }} className="border-b border-line last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <CategoryGlyph name={getCatName(g)} color={getCatColor(g)} size="sm" />
                    <span className="text-text text-sm font-semibold truncate max-w-[220px]">{g.description}</span>
                  </div>
                </td>
                <td className="py-4 px-6"><span className="text-text-soft text-sm">{getCatName(g)}</span></td>
                <td className="py-4 px-6"><span className="text-text-muted text-sm num">{fmtDate(g.date)}</span></td>
                <td className="py-4 px-6"><TypeBadge type={g.type} /></td>
                <td className="py-4 px-6 text-right">
                  <span className="text-sm font-bold num text-text">−{fmt(toAmt(g))}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
    </motion.div>
  );
}

function TypeBadge({ type }: { type: 'FIXED' | 'VARIABLE' }) {
  const fixed = type === 'FIXED';
  return (
    <span className={cn('inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border', fixed ? 'bg-accent/12 text-accent-soft border-accent/20' : 'bg-info/12 text-info border-info/20')}>
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: fixed ? '#6C63FF' : '#38BDF8' }} />
      {fixed ? 'Fijo' : 'Variable'}
    </span>
  );
}

/* ─── BancoModal ─── */
function fmtDateFull(d: string) {
  if (!d) return '';
  return new Date(d.split('T')[0] + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' });
}

function batchMonthLabel(b: ImportBatch): string {
  if (!b.minDate) return 'Importación';
  const toMonthYear = (d: string) => {
    const [y, m] = d.split('-');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${meses[Number(m) - 1]} ${y}`;
  };
  const from = toMonthYear(b.minDate);
  const to   = toMonthYear(b.maxDate);
  return from === to ? from : `${from} – ${to}`;
}

function BancoModal({ open, onClose, snap, batchList, loadingBatches, selectedBatch, batchTxList, loadingBatchTx, onOpenBatch, onBack, onDeleteBatch }: {
  open: boolean;
  onClose: () => void;
  snap: BalanceSnapshot | null;
  batchList: ImportBatch[];
  loadingBatches: boolean;
  selectedBatch: ImportBatch | null;
  batchTxList: BatchTx[];
  loadingBatchTx: boolean;
  onOpenBatch: (b: ImportBatch) => void;
  onBack: () => void;
  onDeleteBatch: (batchId: string) => Promise<void>;
}) {
  const [confirmBatchId, setConfirmBatchId] = useState<string | null>(null);
  const [deletingBatch,  setDeletingBatch]  = useState<string | null>(null);

  async function handleDeleteBatch(batchId: string) {
    setDeletingBatch(batchId);
    await onDeleteBatch(batchId);
    setDeletingBatch(null);
    setConfirmBatchId(null);
  }

  // Previous batch snapshot for each batch (the one immediately before in date order)
  // batchList is sorted DESC, so previous = next item in array
  function prevSnapshot(idx: number): number | null {
    return batchList[idx + 1]?.snapshotAmount ?? null;
  }

  if (typeof window === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-emerald-500/20 bg-[#0c0e14] shadow-2xl shadow-black/60 pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-line flex-shrink-0">
                <div className="flex items-center gap-3">
                  {selectedBatch && (
                    <button onClick={onBack} className="w-7 h-7 grid place-items-center rounded-lg border border-line text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors flex-shrink-0">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-dim">
                      {selectedBatch ? batchMonthLabel(selectedBatch) : 'Resumenes bancarios'}
                    </p>
                    {selectedBatch && selectedBatch.snapshotAmount !== null && (
                      <p className="text-xl font-bold text-emerald-300 num mt-0.5">{fmtARS(selectedBatch.snapshotAmount)}</p>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-xl border border-line text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors flex-shrink-0">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <AnimatePresence mode="wait">

                  {/* ── Vista lista de batches ── */}
                  {!selectedBatch && (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                      {loadingBatches ? (
                        <div className="flex items-center justify-center py-20">
                          <Loader2 className="w-6 h-6 animate-spin text-text-dim" />
                        </div>
                      ) : batchList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-dim">
                          <Landmark className="w-8 h-8 opacity-25" />
                          <p className="text-sm">Sin resumenes importados</p>
                          <p className="text-xs opacity-60">Subí un resumen BBVA desde el chat de IA</p>
                        </div>
                      ) : (
                        <div className="p-4 flex flex-col gap-2">
                          {batchList.map((b, idx) => {
                            const bId = b.batchId ?? 'legacy';
                            const isConfirming = confirmBatchId === bId;
                            const isDeleting   = deletingBatch  === bId;
                            const prev = prevSnapshot(idx);
                            return (
                              <motion.div
                                key={bId}
                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="group relative rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] transition-all cursor-pointer"
                                onClick={() => !isConfirming && onOpenBatch(b)}
                              >
                                <div className="flex items-center gap-4 px-5 py-4">
                                  {/* Left: date label + counts */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-text font-semibold text-sm">{batchMonthLabel(b)}</p>
                                    <p className="text-text-dim text-xs mt-0.5">
                                      {b.expenseCount + b.incomeCount} movimientos
                                      <span className="mx-1 opacity-40">·</span>
                                      <span className="text-red-400/70">{b.expenseCount} gastos</span>
                                      <span className="mx-1 opacity-40">·</span>
                                      <span className="text-emerald-400/70">{b.incomeCount} ingresos</span>
                                    </p>
                                  </div>

                                  {/* Right: snapshot amount + prev */}
                                  <div className="text-right flex-shrink-0">
                                    {b.snapshotAmount !== null ? (
                                      <>
                                        <p className="text-emerald-300 font-bold num text-base">{fmtARS(b.snapshotAmount)}</p>
                                        {prev !== null && (
                                          <p className="text-emerald-500/50 text-[10px] num mt-0.5">ant: {fmtARS(prev)}</p>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-text-dim text-xs">Sin snapshot</p>
                                    )}
                                  </div>

                                  {/* Trash / confirm */}
                                  <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                                    {!isConfirming ? (
                                      <button
                                        onClick={() => setConfirmBatchId(bId)}
                                        className="w-8 h-8 grid place-items-center rounded-lg text-text-dim opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-red-300 whitespace-nowrap">¿Borrar?</span>
                                        <button
                                          onClick={() => handleDeleteBatch(bId)}
                                          disabled={isDeleting}
                                          className="h-7 px-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-50 transition-colors"
                                        >
                                          {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                          Sí
                                        </button>
                                        <button
                                          onClick={() => setConfirmBatchId(null)}
                                          className="h-7 px-2 rounded-lg border border-line text-text-muted hover:text-text text-[10px] transition-colors"
                                        >
                                          No
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <ChevronRight className="w-4 h-4 text-text-dim flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── Vista detalle de un batch ── */}
                  {selectedBatch && (
                    <motion.div key="detail" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                      {loadingBatchTx ? (
                        <div className="flex items-center justify-center py-20">
                          <Loader2 className="w-6 h-6 animate-spin text-text-dim" />
                        </div>
                      ) : batchTxList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-2 text-text-dim">
                          <p className="text-sm">Sin movimientos en este resumen</p>
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10" style={{ background: '#0c0e14' }}>
                            <tr className="border-b border-line">
                              <th className="py-3 px-5 text-[10px] font-bold text-text-dim uppercase tracking-[0.18em] text-left w-28">Fecha</th>
                              <th className="py-3 px-5 text-[10px] font-bold text-text-dim uppercase tracking-[0.18em] text-left">Descripción</th>
                              <th className="py-3 px-5 text-[10px] font-bold text-text-dim uppercase tracking-[0.18em] text-right w-32">Movimiento</th>
                              <th className="py-3 px-5 text-[10px] font-bold text-text-dim uppercase tracking-[0.18em] text-right w-32">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Anchor row: snapshot final */}
                            {selectedBatch.snapshotAmount !== null && (
                              <tr className="border-b border-emerald-500/20 bg-emerald-500/[0.04]">
                                <td className="py-3 px-5 text-emerald-500/60 text-xs num whitespace-nowrap">{fmtDateFull(selectedBatch.maxDate)}</td>
                                <td className="py-3 px-5" colSpan={2}>
                                  <span className="inline-flex items-center gap-2 text-emerald-400/70 text-xs font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                    Saldo de cierre
                                  </span>
                                </td>
                                <td className="py-3 px-5 text-right text-emerald-300 font-bold num">{fmtARS(selectedBatch.snapshotAmount)}</td>
                              </tr>
                            )}
                            {batchTxList.map((tx, i) => (
                              <motion.tr
                                key={tx.key}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.012 }}
                                className="border-b border-line/40 last:border-0 hover:bg-white/[0.02] transition-colors"
                              >
                                <td className="py-3 px-5 text-text-muted text-xs num whitespace-nowrap">{fmtDateFull(tx.date)}</td>
                                <td className="py-3 px-5 max-w-[220px]">
                                  <span className="text-text-soft truncate block">{tx.description}</span>
                                </td>
                                <td className={cn('py-3 px-5 text-right font-bold num', tx.kind === 'income' ? 'text-emerald-400' : 'text-red-400')}>
                                  {tx.kind === 'income' ? '+' : '−'}{fmtARS(tx.amount)}
                                </td>
                                <td className="py-3 px-5 text-right num text-text-soft">{fmtARS(tx.runningBalance)}</td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              {selectedBatch && !loadingBatchTx && batchTxList.length > 0 && (
                <div className="px-6 py-3 border-t border-line flex items-center justify-between flex-shrink-0">
                  <span className="text-[10px] text-text-dim">
                    <span className="text-emerald-400 font-bold">+</span> ingreso &nbsp;·&nbsp;
                    <span className="text-red-400 font-bold">−</span> gasto &nbsp;·&nbsp;
                    Saldo reconstruido desde el cierre
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-line flex items-center justify-center">
        <Activity className="w-4 h-4 text-text-dim" />
      </div>
      <p className="text-text-muted text-xs italic">{message}</p>
    </div>
  );
}

/* ════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════ */
export default function DashboardPage() {
  const now = new Date();
  const [selectedYear,  setYear]  = useState(now.getFullYear());
  const [selectedMonth, setMonth] = useState(now.getMonth() + 1);
  const [data,     setData]    = useState<DashboardSummary | null>(null);
  const [loading,  setLoading] = useState(true);
  const [currency, setCurrency] = useState<Currency>('ARS');
  const usdRate = useOfficialUsdRate();
  const { banco: balanceBanco, efectivo: balanceEfectivo, history: balanceHistory, refresh: refreshBalance } = useBalance();
  const [editingAccount, setEditingAccount] = useState<'banco' | 'efectivo' | null>(null);
  const [balanceForm, setBalanceForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0] });
  const [savingBalance, setSavingBalance] = useState(false);
  const [bancoModalOpen,   setBancoModalOpen]   = useState(false);
  const [loadingBatches,   setLoadingBatches]   = useState(false);
  const [batchList,        setBatchList]        = useState<ImportBatch[]>([]);
  const [selectedBatch,    setSelectedBatch]    = useState<ImportBatch | null>(null);
  const [batchTxList,      setBatchTxList]      = useState<BatchTx[]>([]);
  const [loadingBatchTx,   setLoadingBatchTx]   = useState(false);

  useEffect(() => {
    setLoading(true);
    dashboardService.getSummary(selectedYear, selectedMonth)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedYear, selectedMonth]);

  // Converts any expense amount to the selected display currency
  const toAmt = useCallback((e: Expense): number => {
    if (currency === 'USD') {
      if (e.moneyType === 'USD') return num(e.amount);
      return usdRate ? num(e.amount) / usdRate : 0;
    }
    // ARS: convert USD expenses using their stored rate at creation time
    if (e.moneyType === 'USD' && e.usdToArsRate) return num(e.amount) * num(e.usdToArsRate);
    return num(e.amount);
  }, [currency, usdRate]);

  const fmt = useCallback((v: number): string => {
    return currency === 'USD' ? fmtUSD(v) : fmtARS(v);
  }, [currency]);

  // Recompute all derived figures when currency or raw data changes
  const displayData = useMemo(() => {
    if (!data) return null;
    const expenses = data.monthExpenses;

    const total     = expenses.reduce((s, e) => s + toAmt(e), 0);
    const fijos     = expenses.filter(e => e.type === 'FIXED').reduce((s, e) => s + toAmt(e), 0);
    const variables = expenses.filter(e => e.type === 'VARIABLE').reduce((s, e) => s + toAmt(e), 0);
    // Last month approximation: divide by current rate when showing USD
    const lastTotal = currency === 'USD' && usdRate ? data.lastMonth.total / usdRate : data.lastMonth.total;

    // byCat: recompute from raw expenses with converted amounts
    const catMap: Record<string, { id: number; name: string; icon: string; color: string; total: number }> = {};
    for (const e of expenses) {
      const cat = e.category;
      if (!cat) continue;
      const key = String(cat.id);
      if (!catMap[key]) catMap[key] = { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, total: 0 };
      catMap[key].total += toAmt(e);
    }
    const byCat = Object.values(catMap).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

    // byDate: recompute from raw expenses
    const dayMap: Record<string, DayPoint> = {};
    for (const e of expenses) {
      const date = e.date.split('T')[0];
      const day = Number(date.split('-')[2]);
      const mes = MESES_SHORT[Number(date.split('-')[1]) - 1];
      if (!dayMap[date]) dayMap[date] = { date, day, label: `${day} ${mes}`, total: 0, fijos: 0, variables: 0 };
      const amt = toAmt(e);
      dayMap[date].total += amt;
      if (e.type === 'FIXED') dayMap[date].fijos += amt;
      else dayMap[date].variables += amt;
    }
    const byDate = Object.values(dayMap).sort((a, b) => a.day - b.day);

    return {
      thisMonth: { total, fijos, variables },
      lastMonth: { total: lastTotal },
      byCat,
      byDate,
      monthExpenses: expenses,
      recientes: expenses.slice(0, 5),
    };
  }, [data, currency, usdRate, toAmt]);

  const { total, fijos, variables } = displayData?.thisMonth ?? { total: 0, fijos: 0, variables: 0 };
  const lastTotal = displayData?.lastMonth.total ?? 0;
  const trendPct  = lastTotal > 0 ? Math.round(((total - lastTotal) / lastTotal) * 100) : undefined;
  const mesLabel  = `${MESES_LONG[selectedMonth - 1]} ${selectedYear}`;
  // Build full-month daily arrays (zeros for days without expenses) so sparklines show real peaks
  const sparkDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const lastDay = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1
      ? now.getDate()
      : daysInMonth;
    const pad = (n: number) => String(n).padStart(2, '0');
    const byDateMap = Object.fromEntries(
      (displayData?.byDate ?? []).map(d => [d.date, d])
    );
    return Array.from({ length: lastDay }, (_, i) => {
      const dateStr = `${selectedYear}-${pad(selectedMonth)}-${pad(i + 1)}`;
      return byDateMap[dateStr] ?? { total: 0, fijos: 0, variables: 0 };
    });
  }, [displayData, selectedYear, selectedMonth]);
  const smoothSpark = (values: number[]) => {
    const filtered = values.filter(v => v > 0);

    if (filtered.length <= 1) {
      return filtered.length ? [filtered[0], filtered[0]] : [0, 0];
    }

    return filtered;
  };

const sparkTotal = sparkDays.slice(-14).map(d => d.total);
const sparkFijos = sparkDays.slice(-14).map(d => d.fijos);
const sparkVar   = sparkDays.slice(-14).map(d => d.variables);

  async function openBancoModal() {
    setBancoModalOpen(true);
    setSelectedBatch(null);
    setLoadingBatches(true);
    try {
      const batches: ImportBatch[] = await fetch(`${API}/import/batches`).then(r => r.json());
      setBatchList(batches);
    } catch { /* ignore */ }
    setLoadingBatches(false);
  }

  async function openBatchDetail(batch: ImportBatch) {
    setSelectedBatch(batch);
    setLoadingBatchTx(true);
    try {
      const batchId = batch.batchId ?? 'legacy';
      const { expenses, incomes } = await fetch(`${API}/import/batches/${batchId}/transactions`).then(r => r.json());
      const all = [
        ...(expenses as any[]).map(e => ({ key: `exp-${e.id}`, id: e.id, date: e.date, description: e.description, amount: Number(e.amount), kind: 'expense' as const })),
        ...(incomes as any[]).map(i => ({ key: `inc-${i.id}`, id: i.id, date: i.date, description: i.description, amount: Number(i.amount), kind: 'income' as const })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Walk backwards from snapshot reconstructing running balance per transaction
      let running = batch.snapshotAmount ?? 0;
      const withBal: BatchTx[] = all.map(tx => {
        const entry = { ...tx, runningBalance: running };
        running = tx.kind === 'expense' ? running + tx.amount : running - tx.amount;
        return entry;
      });
      setBatchTxList(withBal);
    } catch { /* ignore */ }
    setLoadingBatchTx(false);
  }

  async function handleDeleteBatch(batchId: string) {
    await fetch(`${API}/import/batches/${batchId}`, { method: 'DELETE' });
    setBatchList(prev => prev.filter(b => (b.batchId ?? 'legacy') !== batchId));
    setSelectedBatch(null);
    refreshBalance();
    window.dispatchEvent(new CustomEvent('gf:expense-created'));
  }

  async function saveBalance() {
    if (!balanceForm.amount || Number(balanceForm.amount) <= 0 || !editingAccount) return;
    setSavingBalance(true);
    try {
      await fetch(`${API}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(balanceForm.amount), date: balanceForm.date, source: 'manual', account: editingAccount }),
      });
      refreshBalance();
      setEditingAccount(null);
    } catch { /* ignore */ }
    setSavingBalance(false);
  }

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden">
      <div className="p-7 flex flex-col gap-6 w-full">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }} className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-1.5">Resumen financiero</p>
            <h1 className="text-3xl font-bold tracking-tight text-text capitalize">{mesLabel}</h1>
            <p className="text-text-muted text-sm mt-1">Una vista rápida de tus gastos y movimientos del mes.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Currency toggle */}
            <div className="flex gap-0.5 rounded-xl border border-line bg-surface/60 backdrop-blur p-1">
              {(['ARS', 'USD'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={cn(
                    'px-3 h-7 rounded-lg text-xs font-bold tracking-wide transition-all duration-200',
                    currency === c
                      ? c === 'ARS'
                        ? 'bg-accent text-white shadow-[0_4px_16px_-6px_rgba(108,99,255,0.7)]'
                        : 'bg-emerald-600 text-white shadow-[0_4px_16px_-6px_rgba(16,185,129,0.5)]'
                      : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]'
                  )}>
                  {c}
                </button>
              ))}
            </div>

            <MonthFilter year={selectedYear} month={selectedMonth} onYear={setYear} onMonth={setMonth} />
          </div>
        </motion.div>

        {/* Saldos: Banco + Efectivo */}
        <div className="grid grid-cols-2 gap-4">
          {/* Banco — solo lectura, abre modal de movimientos */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            onClick={openBancoModal}
            className="relative overflow-hidden rounded-2xl glass p-5 border border-emerald-500/20 bg-emerald-500/[0.04] cursor-pointer hover:border-emerald-500/35 group transition-all">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 0% 50%, #10B98114, transparent 60%)' }} />
            <div className="relative flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 bg-emerald-500/15 border-emerald-500/25">
                <Landmark className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">Banco (BBVA)</p>
                {balanceBanco ? (
                  <>
                    <p className="text-2xl font-bold tracking-tight num mt-0.5 text-emerald-300">
                      {fmt(currency === 'USD' && usdRate ? num(balanceBanco.amount) / usdRate : num(balanceBanco.amount))}
                    </p>
                    <div className="flex items-center gap-1 text-text-dim text-[10px] mt-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(balanceBanco.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      {' · '}{balanceBanco.source === 'bbva_import' ? 'BBVA import' : 'Manual'}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-text-dim mt-0.5">Sin configurar · subí un resumen BBVA</p>
                )}
              </div>
              <div className="w-7 h-7 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] flex items-center justify-center flex-shrink-0 text-emerald-500/40 group-hover:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors mt-0.5 flex-shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </motion.div>

          {/* Efectivo — editable */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="relative overflow-hidden rounded-2xl glass p-5 border border-amber-500/20 bg-amber-500/[0.04]">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 0% 50%, #F59E0B14, transparent 60%)' }} />
            {editingAccount === 'efectivo' ? (
              <div className="relative flex flex-col gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">Efectivo</p>
                <input type="number" min={0} placeholder="Monto" value={balanceForm.amount}
                  onChange={e => setBalanceForm(f => ({ ...f, amount: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-amber-500/30 bg-amber-500/[0.06] text-amber-200 px-3 text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/60"
                  autoFocus />
                <input type="date" value={balanceForm.date}
                  onChange={e => setBalanceForm(f => ({ ...f, date: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-line bg-white/[0.04] px-3 text-sm text-text-soft focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={saveBalance} disabled={savingBalance}
                    className="flex-1 h-8 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50 transition-colors">
                    <Check className="w-3.5 h-3.5" /> Guardar
                  </button>
                  <button onClick={() => setEditingAccount(null)}
                    className="h-8 px-3 rounded-xl border border-line text-text-muted hover:text-text-soft transition-colors">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 bg-amber-500/15 border-amber-500/25">
                    <Wallet className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">Efectivo</p>
                    {balanceEfectivo ? (
                      <>
                        <p className="text-2xl font-bold tracking-tight num mt-0.5 text-amber-300">
                          {fmt(currency === 'USD' && usdRate ? num(balanceEfectivo.amount) / usdRate : num(balanceEfectivo.amount))}
                        </p>
                        <div className="flex items-center gap-1 text-text-dim text-[10px] mt-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(balanceEfectivo.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          {' · Manual'}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-text-dim mt-0.5">Sin configurar</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setBalanceForm({ amount: balanceEfectivo ? String(num(balanceEfectivo.amount)) : '', date: new Date().toISOString().split('T')[0] });
                    setEditingAccount('efectivo');
                  }}
                  className="w-7 h-7 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] flex items-center justify-center flex-shrink-0 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  title="Editar saldo efectivo"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-5">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-3 gap-5">
            <MetricCard label="Total gastado" value={fmt(total)} sub={`vs ${fmt(lastTotal)} el mes anterior`} icon={<Wallet className="w-5 h-5" />} trend={trendPct} accent="#6C63FF" spark={sparkTotal} />
            <MetricCard label="Gastos fijos" value={fmt(fijos)} sub={total > 0 ? `${Math.round(fijos / total * 100)}% del total` : 'Sin movimientos'} icon={<Lock className="w-5 h-5" />} accent="#A78BFA" spark={sparkFijos} />
            <MetricCard label="Gastos variables" value={fmt(variables)} sub={total > 0 ? `${Math.round(variables / total * 100)}% del total` : 'Sin movimientos'} icon={<Activity className="w-5 h-5" />} accent="#38BDF8" spark={sparkVar} />
          </motion.div>
        )}

        {/* Historial de saldo */}
        {balanceHistory.length > 1 && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible"
            className="relative overflow-hidden rounded-2xl glass p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted mb-4">Historial de saldos</p>
            <div className="flex flex-col gap-0">
              {[...balanceHistory].reverse().map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.account === 'banco' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <div>
                      <p className="text-text-soft text-sm font-semibold num">{fmtARS(num(s.amount))}</p>
                      <p className="text-text-dim text-xs">
                        {s.account === 'banco' ? 'Banco' : 'Efectivo'}
                        {' · '}
                        {s.source === 'bbva_import' ? 'BBVA import' : 'Manual'}
                      </p>
                    </div>
                  </div>
                  <p className="text-text-muted text-xs num">
                    {new Date(s.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-3 gap-5" style={{ minHeight: 340 }}>
          <ConfigurableBarChart byCat={displayData?.byCat ?? []} byDate={displayData?.byDate ?? []} monthExpenses={displayData?.monthExpenses ?? []} mesLabel={mesLabel} fmt={fmt} toAmt={toAmt} />
          <CategoryBreakdown byCat={displayData?.byCat ?? []} fmt={fmt} />
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <RecentTransactions recientes={displayData?.recientes ?? []} fmt={fmt} toAmt={toAmt} />
        </motion.div>
      </div>

      <BancoModal
        open={bancoModalOpen}
        onClose={() => { setBancoModalOpen(false); setSelectedBatch(null); }}
        snap={balanceBanco}
        batchList={batchList}
        loadingBatches={loadingBatches}
        selectedBatch={selectedBatch}
        batchTxList={batchTxList}
        loadingBatchTx={loadingBatchTx}
        onOpenBatch={openBatchDetail}
        onBack={() => setSelectedBatch(null)}
        onDeleteBatch={handleDeleteBatch}
      />
    </div>
  );
}
