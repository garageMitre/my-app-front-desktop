'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ChevronLeft, ChevronRight, X, Lock, Activity, Loader2,
  Search, Pencil, FileSpreadsheet, Printer, SlidersHorizontal, FilterX, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeDelete } from '@/components/ui/native-delete';
import { AnimatedCheckbox } from '@/components/ui/animated-checkbox';
import { useToast } from '@/components/ui/toaster';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { expensesService, categoriesService } from '@/service';
import { fmtARS, cn } from '@/lib/utils';
import type { Category, Expense, CreateExpenseDto } from '@/lib/types';

function fmtDate(d: string) {
  if (!d) return '';
  const raw = d.split('T')[0];
  const [y, m, day] = raw.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${Number(day)} ${meses[Number(m) - 1]} ${y}`;
}

const today = new Date().toISOString().split('T')[0];

interface FormState {
  description: string;
  amount: string;
  date: string;
  categoryId: string;
  type: 'FIXED' | 'VARIABLE';
  moneyType: 'ARS' | 'USD';
}

const EMPTY_FORM: FormState = {
  description: '', amount: '', date: today, categoryId: '', type: 'VARIABLE', moneyType: 'ARS',
};

function exportCSV(rows: Expense[], getCat: (g: Expense) => Category, month: string) {
  const header = ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Moneda', 'Monto'];
  const data = rows.map(g => {
    const cat = getCat(g);
    return [
      g.date.split('T')[0],
      g.description,
      cat.name,
      g.type === 'FIXED' ? 'Fijo' : 'Variable',
      g.moneyType,
      Number(g.amount),
    ];
  });
  const csv = [header, ...data]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gastos-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printPDF(
  rows: Expense[],
  getCat: (g: Expense) => Category,
  monthLabel: string,
  totalFiltered: number,
) {
  const rowsHTML = rows.map(g => {
    const cat = getCat(g);
    const amtStr = g.moneyType === 'USD' && g.usdToArsRate
      ? `USD ${Number(g.amount).toFixed(2)}<br/><small>≈ ${fmtARS(Number(g.amount) * Number(g.usdToArsRate))}</small>`
      : g.moneyType === 'USD'
        ? `USD ${Number(g.amount).toFixed(2)}`
        : fmtARS(Number(g.amount));
    return `<tr>
      <td>${fmtDate(g.date)}</td>
      <td>${g.description.replace(/</g, '&lt;')}</td>
      <td>${cat.name.replace(/</g, '&lt;')}</td>
      <td><span class="badge ${g.type === 'FIXED' ? 'fixed' : 'var'}">${g.type === 'FIXED' ? 'Fijo' : 'Variable'}</span></td>
      <td><span class="badge ${g.moneyType === 'ARS' ? 'ars' : 'usd'}">${g.moneyType}</span></td>
      <td class="amt">${amtStr}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Gastos — ${monthLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#fff;padding:32px}
    h1{font-size:22px;font-weight:700;margin-bottom:4px}
    .meta{font-size:12px;color:#666;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f3f4f6;font-weight:700;text-align:left;padding:9px 12px;border:1px solid #d1d5db;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#374151}
    td{padding:8px 12px;border:1px solid #e5e7eb;vertical-align:middle}
    tr:nth-child(even) td{background:#fafafa}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
    .badge.fixed{background:#ede9fe;color:#6d28d9}
    .badge.var{background:#e0f2fe;color:#0369a1}
    .badge.ars{background:#ede9fe;color:#6d28d9}
    .badge.usd{background:#d1fae5;color:#065f46}
    .amt{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
    .amt small{display:block;color:#888;font-weight:400;font-size:10px}
    .footer{margin-top:16px;font-size:11px;color:#9ca3af;text-align:right}
    @media print{body{padding:16px}@page{margin:1.5cm}}
  </style>
</head>
<body>
  <h1>Gastos — ${monthLabel}</h1>
  <p class="meta">${rows.length} registros &nbsp;·&nbsp; Total: ${fmtARS(totalFiltered)}</p>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th>Moneda</th>
      <th style="text-align:right">Monto</th>
    </tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <p class="footer">Generado el ${new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}</p>
  <script>window.onload=()=>{window.print()}<\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=960,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function GastosPage() {
  const { toast } = useToast();
  const [gastos, setGastos] = useState<Expense[]>([]);
  const [cats, setCats]     = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing]     = useState<Expense | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]       = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving]       = useState(false);
  const [month, setMonth]         = useState(today.slice(0, 7));
  const [query, setQuery]         = useState('');
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterCat, setFilterCat]             = useState('');
  const [filterType, setFilterType]           = useState('');
  const [filterMoneyType, setFilterMoneyType] = useState('');

  const PAGE_SIZES = [5, 10, 20, 50];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [g, c] = await Promise.allSettled([
      expensesService.getAll(),
      categoriesService.getAll(),
    ]);
    if (g.status === 'fulfilled') setGastos(g.value);
    if (c.status === 'fulfilled') setCats(c.value);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('gf:expense-created', handler);
    return () => window.removeEventListener('gf:expense-created', handler);
  }, [fetchAll]);

  useEffect(() => { setSelectedIds(new Set()); }, [month, query, filterCat, filterType, filterMoneyType, page]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('new') === '1') {
      const t = setTimeout(() => openNew(), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.length]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, categoryId: cats[0] ? String(cats[0].id) : '' });
    setErrors({});
    setPanelOpen(true);
  }

  function openEdit(g: Expense) {
    setEditing(g);
    setForm({
      description: g.description,
      amount: String(g.amount),
      date: g.date.split('T')[0],
      categoryId: String(g.category?.id ?? g.categoryId ?? ''),
      type: g.type,
      moneyType: g.moneyType,
    });
    setErrors({});
    setPanelOpen(true);
  }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  }

  function validate() {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.description.trim()) e.description = 'Requerido';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Ingresá un monto válido';
    if (!form.categoryId) e.categoryId = 'Seleccioná una categoría';
    if (!form.date) e.date = 'Requerido';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    const day = Number(form.date.split('-')[2]) || 1;
    const dto: CreateExpenseDto = {
      description: form.description.trim(),
      amount: Number(form.amount),
      date: form.date,
      type: form.type,
      moneyType: form.moneyType,
      isRecurring: form.type === 'FIXED',
      recurringDay: form.type === 'FIXED' ? day : 1,
      categoryId: Number(form.categoryId),
      fromAccount: 'efectivo',
    };
    try {
      if (editing) {
        await expensesService.update(editing.id, dto);
        toast('Gasto actualizado', { type: 'success' });
      } else {
        await expensesService.create(dto);
        toast('Gasto creado', { type: 'success' });
      }
      await fetchAll();
      window.dispatchEvent(new CustomEvent('gf:expense-created'));
      setPanelOpen(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  async function handleDelete(id: number, closePanel = false) {
    await expensesService.remove(id);
    toast('Gasto eliminado', { type: 'danger' });
    if (closePanel) setPanelOpen(false);
    fetchAll();
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const isImported = (g: Expense) => g.importSource === 'bbva_import';

  function toggleSelectAll() {
    const selectable = paginated.filter(g => !isImported(g));
    const allSel = selectable.length > 0 && selectable.every(g => selectedIds.has(g.id));
    setSelectedIds(allSel ? new Set() : new Set(selectable.map(g => g.id)));
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    setDeletingBulk(true);
    for (const id of ids) await expensesService.remove(id).catch(() => {});
    setDeletingBulk(false);
    setSelectedIds(new Set());
    toast(`${ids.length} gasto${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`, { type: 'danger' });
    fetchAll();
  }

  function getCat(g: Expense): Category {
    const id = g.category?.id ?? g.categoryId;
    return cats.find(c => String(c.id) === String(id)) ??
      { id: 0, name: 'Sin cat.', icon: '💰', color: '#6B7188' };
  }

  const hasActiveFilters = filterCat || filterType || filterMoneyType;

  function clearFilters() {
    setFilterCat('');
    setFilterType('');
    setFilterMoneyType('');
    setPage(1);
  }

  const filtered = gastos
    .filter(g => !month || g.date?.split('T')[0].startsWith(month))
    .filter(g => !query.trim() || g.description.toLowerCase().includes(query.toLowerCase()))
    .filter(g => !filterCat || String(g.category?.id ?? g.categoryId) === filterCat)
    .filter(g => !filterType || g.type === filterType)
    .filter(g => !filterMoneyType || g.moneyType === filterMoneyType)
    .sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (diff !== 0) return diff;
      }
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });

  const totalFiltered = filtered.reduce((s, g) => s + Number(g.amount), 0);
  const totalPages    = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage      = Math.min(page, totalPages);
  const paginated     = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function shiftMonth(delta: number) {
    const base = month ? month.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
    const [y, m] = base;
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setPage(1);
  }

  const monthLabel = month
    ? new Date(Number(month.split('-')[0]), Number(month.split('-')[1]) - 1, 1)
        .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    : 'Todos los meses';

  return (
    <div className="flex h-full overflow-hidden">
        <div className="flex-1 p-7 overflow-auto min-w-0">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-1.5">Movimientos</p>
              <h1 className="text-3xl font-bold tracking-tight text-text">Gastos</h1>
              <p className="text-text-muted text-sm mt-1">Todas tus transacciones del mes seleccionado.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => exportCSV(filtered, getCat, month)}
                title="Exportar a Excel/CSV"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2 text-xs font-semibold transition-all">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button
                onClick={() => printPDF(filtered, getCat, monthLabel, totalFiltered)}
                title="Imprimir / Guardar PDF"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2 text-xs font-semibold transition-all">
                <Printer className="w-3.5 h-3.5" /> PDF
              </button>
              <Button onClick={openNew}><Plus className="w-4 h-4" /> Nuevo gasto</Button>
            </div>
          </motion.div>

          {/* Toolbar */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.06 }} className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-xl border border-line bg-surface/60 backdrop-blur p-1">
              <button onClick={() => shiftMonth(-1)} className="w-8 h-8 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-text text-sm font-semibold capitalize w-40 text-center select-none">{monthLabel}</span>
              <button onClick={() => shiftMonth(1)} className="w-8 h-8 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => { setMonth(''); setPage(1); }}
              className={`h-10 px-3 rounded-xl border text-xs font-semibold transition-all ${!month ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2'}`}
            >
              Todos
            </button>
            {filtered.length > 0 && (
              <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 h-10 rounded-xl border border-line bg-surface/60">
                <span className="text-text-dim text-xs num">{filtered.length} gastos</span>
                <span className="text-text-dim">·</span>
                <span className="text-text text-xs font-bold num">{fmtARS(totalFiltered)}</span>
              </motion.div>
            )}
            <div className="flex-1" />
            <button
              onClick={() => { setShowFilters(v => !v); }}
              className={cn(
                'inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold transition-all',
                showFilters || hasActiveFilters
                  ? 'border-accent/40 bg-accent/10 text-accent-soft'
                  : 'border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2'
              )}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold grid place-items-center">
                  {[filterCat, filterType, filterMoneyType].filter(Boolean).length}
                </span>
              )}
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
              <Input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar gasto…" className="pl-9 h-10 w-64" />
            </div>
          </motion.div>

          {/* Filters panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden mb-3">
                <div className="rounded-2xl border border-line bg-surface/50 backdrop-blur p-4 flex flex-wrap items-center gap-4">

                  {/* Tipo */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Tipo</span>
                    <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5">
                      {[{ v: '', label: 'Todos' }, { v: 'FIXED', label: 'Fijo' }, { v: 'VARIABLE', label: 'Variable' }].map(opt => (
                        <button key={opt.v} onClick={() => { setFilterType(opt.v); setPage(1); }}
                          className={cn('px-2.5 h-6 rounded-md text-xs font-semibold transition-all',
                            filterType === opt.v ? 'bg-accent text-white' : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]')}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Moneda */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Moneda</span>
                    <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5">
                      {[{ v: '', label: 'Todas' }, { v: 'ARS', label: 'ARS' }, { v: 'USD', label: 'USD' }].map(opt => (
                        <button key={opt.v} onClick={() => { setFilterMoneyType(opt.v); setPage(1); }}
                          className={cn('px-2.5 h-6 rounded-md text-xs font-semibold transition-all',
                            filterMoneyType === opt.v
                              ? opt.v === 'USD' ? 'bg-emerald-600 text-white' : 'bg-accent text-white'
                              : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]')}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categoría */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Categoría</span>
                    <select
                      value={filterCat}
                      onChange={e => { setFilterCat(e.target.value); setPage(1); }}
                      className="h-7 rounded-lg border border-line bg-surface/80 text-text text-xs px-2 outline-none focus:border-accent/50 transition-colors cursor-pointer">
                      <option value="">Todas</option>
                      {cats.map(c => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {hasActiveFilters && (
                    <button onClick={clearFilters}
                      className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs font-semibold hover:bg-danger/20 transition-colors">
                      <FilterX className="w-3 h-3" /> Limpiar
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bulk action bar */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-3 rounded-xl border border-danger/25 bg-danger/[0.06] px-4 py-2.5 mb-3"
              >
                <Trash2 className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                <span className="text-danger text-sm font-semibold">
                  {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <div className="flex-1" />
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-text-muted hover:text-text transition-colors">
                  Deseleccionar todo
                </button>
                <NativeDelete size="sm" showIcon buttonText={`Eliminar ${selectedIds.size}`} confirmText="¿Confirmar?" onDelete={handleBulkDelete} disabled={deletingBulk} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table */}
          {loading ? (
            <SkeletonTable />
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl glass p-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-line flex items-center justify-center mx-auto mb-4">
                <Activity className="w-5 h-5 text-text-dim" />
              </div>
              <p className="text-text-soft text-sm font-semibold mb-1">{query || hasActiveFilters ? 'Sin resultados' : 'No hay gastos en este mes'}</p>
              <p className="text-text-muted text-xs mb-5">
                {query || hasActiveFilters ? 'Probá con otra búsqueda o ajustá los filtros.' : 'Empezá agregando tu primer movimiento del mes.'}
              </p>
              {!query && !hasActiveFilters && <Button onClick={openNew}><Plus className="w-4 h-4" /> Nuevo gasto</Button>}
              {hasActiveFilters && (
                <button onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs text-accent-soft hover:underline">
                  <FilterX className="w-3 h-3" /> Limpiar filtros
                </button>
              )}
            </motion.div>
          ) : (
            <>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="pl-5 pr-2 py-3.5 w-10">
                        {(() => {
                          const sel = paginated.filter(g => !isImported(g));
                          const allSel = sel.length > 0 && sel.every(g => selectedIds.has(g.id));
                          const someSel = sel.some(g => selectedIds.has(g.id));
                          return (
                            <AnimatedCheckbox
                              checked={allSel}
                              indeterminate={someSel && !allSel}
                              onChange={toggleSelectAll}
                            />
                          );
                        })()}
                      </th>
                      {['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Tipo Moneda', 'Monto', ''].map(h => (
                        <th key={h} className={cn('text-[10px] font-bold text-text-dim uppercase tracking-[0.10em] px-0 py-3.5', h === 'Monto' ? 'text-right' : 'text-left', h === '' ? 'w-36' : '')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {paginated.map((g, i) => {
                        const cat = getCat(g);
                        return (
                          <motion.tr key={g.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, delay: i * 0.025 }} onClick={() => { if (!isImported(g)) openEdit(g); }} className={cn('group border-b border-line last:border-0 hover:bg-white/[0.02] transition-colors', isImported(g) ? 'cursor-default' : 'cursor-pointer', selectedIds.has(g.id) && 'bg-accent/[0.05]')}>
                            <td className="pl-5 pr-2 py-4 w-10" onClick={e => e.stopPropagation()}>
                              {isImported(g)
                                ? <span title="Registro del resumen BBVA" className="flex justify-center"><Lock className="w-3.5 h-3.5 text-text-dim" /></span>
                                : <AnimatedCheckbox checked={selectedIds.has(g.id)} onChange={() => toggleSelect(g.id)} onClick={e => e.stopPropagation()} />
                              }
                            </td>
                            <td className="px-6 py-4 text-text-muted text-sm whitespace-nowrap num">{fmtDate(g.date)}</td>
                            <td className="px-6 py-4 text-text text-sm font-semibold max-w-[280px] truncate">{g.description}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-2 max-w-full">
                                <CategoryGlyph name={cat.name} color={cat.color} size="sm" />
                                <span className="text-text-soft text-sm truncate">{cat.name}</span>
                              </span>
                            </td>
                            <td className="px-6 py-4"><TypeBadge type={g.type} /></td>
                            <td className="px-6 py-4"><MoneyTypeBadge moneyType={g.moneyType} /></td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              {g.moneyType === 'USD' && g.usdToArsRate ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-emerald-400 text-sm font-bold num">USD {Number(g.amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="text-text-muted text-xs num">≈ {fmtARS(Number(g.amount) * Number(g.usdToArsRate))}</span>
                                </div>
                              ) : (
                                <span className="text-text text-sm font-bold num">{fmtARS(Number(g.amount))}</span>
                              )}
                            </td>
                            <td className="px-3 py-4 w-36">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                {!isImported(g) && (
                                  <>
                                    <button onClick={() => openEdit(g)} className="w-8 h-8 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors" aria-label="Editar">
                                      <Pencil className="cursor-pointer w-3.5 h-3.5" />
                                    </button>
                                    <NativeDelete size="sm" showIcon compact onDelete={() => handleDelete(g.id)} />
                                  </>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </motion.div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-dim text-xs">Filas por página</span>
                  <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5">
                    {PAGE_SIZES.map(s => (
                      <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                        className={cn('px-2.5 h-6 rounded-md text-xs font-semibold transition-all',
                          pageSize === s ? 'bg-accent text-white' : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-dim text-xs num">
                    {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                      className="w-6 h-6 grid place-items-center rounded-md text-text-muted hover:text-text hover:bg-white/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                      .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) => p === '…'
                        ? <span key={`e${i}`} className="w-6 h-6 grid place-items-center text-text-dim text-xs">…</span>
                        : <button key={p} onClick={() => setPage(p as number)}
                            className={cn('w-6 h-6 grid place-items-center rounded-md text-xs font-semibold transition-all',
                              safePage === p ? 'bg-accent text-white' : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]')}>
                            {p}
                          </button>
                      )}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                      className="w-6 h-6 grid place-items-center rounded-md text-text-muted hover:text-text hover:bg-white/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer */}
        <AnimatePresence mode="popLayout">
          {panelOpen && (
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
              className="w-[380px] flex-shrink-0 h-full border-l border-line bg-surface/90 backdrop-blur-xl flex flex-col relative z-20">
              <div className="flex items-center justify-between px-6 py-4 border-b border-line flex-shrink-0">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-0.5">{editing ? 'Editar' : 'Crear'}</p>
                  <h2 className="text-base font-bold text-text tracking-tight">{editing ? 'Editar gasto' : 'Nuevo gasto'}</h2>
                </div>
                <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setPanelOpen(false)}
                  className="w-9 h-9 grid place-items-center rounded-xl border border-line text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors">
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="flex-1 overflow-auto px-6 py-6 flex flex-col gap-6">
                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">Monto *</label>
                  <div className={cn('flex items-end gap-2 rounded-2xl px-4 py-4 transition-all border-2', errors.amount ? 'border-danger/50 bg-danger/[0.04]' : 'border-line-2 bg-surface focus-within:border-accent/60 focus-within:bg-accent/[0.04] focus-within:ring-2 focus-within:ring-accent/15')}>
                    <span className="text-text-muted text-2xl font-bold leading-none pb-1">$</span>
                    <input type="number" value={form.amount} onChange={e => setF('amount', e.target.value)} placeholder="0" autoFocus
                      className="flex-1 bg-transparent text-text text-3xl font-bold leading-none outline-none placeholder-text-dim num min-w-0" />
                  </div>
                  {errors.amount && <p className="text-danger text-xs mt-1.5">{errors.amount}</p>}
                </div>

                {/* Description */}
                <Field label="Descripción" required error={errors.description}>
                  <Input value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Ej: Almuerzo, Netflix, Expensas…" className={errors.description ? 'border-danger/60' : ''} />
                </Field>

                {/* Date */}
                <Field label="Fecha" required error={errors.date}>
                  <DatePicker value={form.date} onChange={v => setF('date', v)} className={errors.date ? 'border-danger/60' : ''} />
                </Field>

                {/* Type toggle */}
                <Field label="Tipo">
                  <div className="flex gap-2">
                    {(['FIXED', 'VARIABLE'] as const).map(t => {
                      const sel = form.type === t;
                      const isFixed = t === 'FIXED';
                      return (
                        <motion.button key={t} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setF('type', t)}
                          className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2',
                            sel ? (isFixed ? 'bg-accent/15 text-accent-soft border-accent/40 ring-1 ring-accent/20' : 'bg-info/15 text-info border-info/40 ring-1 ring-info/20')
                              : 'bg-surface text-text-muted border-line hover:border-line-2 hover:text-text-soft')}>
                          {isFixed ? <Lock className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                          {isFixed ? 'Fijo' : 'Variable'}
                        </motion.button>
                      );
                    })}
                  </div>
                  {form.type === 'FIXED' && form.date && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-accent-soft text-xs mt-2 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      Se repetirá el día {Number(form.date.split('-')[2])} de cada mes.
                    </motion.p>
                  )}
                </Field>

                {/* Money Type */}
                <Field label="Moneda">
                  <div className="flex gap-2">
                    {(['ARS', 'USD'] as const).map(mt => {
                      const sel = form.moneyType === mt;
                      const isARS = mt === 'ARS';
                      return (
                        <motion.button key={mt} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setF('moneyType', mt)}
                          className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-2',
                            sel ? (isARS ? 'bg-accent/15 text-accent-soft border-accent/40 ring-1 ring-accent/20' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/20')
                              : 'bg-surface text-text-muted border-line hover:border-line-2 hover:text-text-soft')}>
                          {isARS ? '$' : '$'}
                          {mt}
                        </motion.button>
                      );
                    })}
                  </div>
                </Field>

                {/* Category */}
                <Field label="Categoría" required error={errors.categoryId}>
                  {cats.length === 0 ? (
                    <p className="text-text-muted text-xs italic">Creá una categoría primero.</p>
                  ) : (
                    <div className={cn('grid grid-cols-3 gap-1.5 p-2 rounded-2xl border bg-surface/40', errors.categoryId ? 'border-danger/40' : 'border-line')}>
                      {cats.map(c => {
                        const sel = String(form.categoryId) === String(c.id);
                        return (
                          <motion.button key={c.id} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={() => setF('categoryId', String(c.id))}
                            className={cn('flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-semibold transition-all border', sel ? 'border-transparent ring-1' : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05]')}
                            style={sel ? { backgroundColor: c.color + '22', color: c.color, boxShadow: `0 0 0 1px ${c.color}66` } : { color: '#A8AEBE' }}>
                            <CategoryGlyph name={c.name} color={c.color} size="sm" />
                            <span className="truncate max-w-full">{c.name}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </Field>
              </div>

              <div className="px-6 py-4 border-t border-line flex flex-col gap-2 flex-shrink-0">
                <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : editing ? 'Guardar cambios' : 'Agregar gasto'}
                </Button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
  );
}

/* ─── helpers ─── */
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">{label}{required && ' *'}</label>
      {children}
      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
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

function MoneyTypeBadge({ moneyType }: { moneyType: 'ARS' | 'USD' }) {
  const isARS = moneyType === 'ARS';
  return (
    <span className={cn('inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border', isARS ? 'bg-accent/12 text-accent-soft border-accent/20' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30')}>
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: isARS ? '#6C63FF' : '#34D399' }} />
      {isARS ? 'ARS' : 'USD'}
    </span>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-2xl glass overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex gap-4">
        {[80, 120, 100, 70, 80].map((w, i) => <div key={i} className="skeleton h-3" style={{ width: w }} />)}
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="px-6 py-5 border-b border-line last:border-0 flex items-center gap-4">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-3 flex-1" />
          <div className="flex items-center gap-2"><div className="skeleton h-7 w-7 rounded-lg" /><div className="skeleton h-3 w-20" /></div>
          <div className="skeleton h-6 w-16 rounded-md" />
          <div className="skeleton h-3 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}
