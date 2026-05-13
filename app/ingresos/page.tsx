'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ChevronLeft, ChevronRight, X, Lock, Loader2, Pencil,
  Search, FileSpreadsheet, Printer, SlidersHorizontal, FilterX, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeDelete } from '@/components/ui/native-delete';
import { AnimatedCheckbox } from '@/components/ui/animated-checkbox';
import { useToast } from '@/components/ui/toaster';
import { incomesService } from '@/service';
import { fmtARS, cn } from '@/lib/utils';
import type { Income, CreateIncomeDto, IncomeSource, MoneyType } from '@/lib/types';

function fmtDate(d: string) {
  if (!d) return '';
  const raw = d.split('T')[0];
  const [y, m, day] = raw.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${Number(day)} ${meses[Number(m) - 1]} ${y}`;
}

const SOURCE_LABELS: Record<IncomeSource, string> = {
  SALARY:    'Sueldo',
  FREELANCE: 'Freelance',
  TRANSFER:  'Transferencia',
  REFUND:    'Reembolso',
  OTHER:     'Otro',
};

const today = new Date().toISOString().split('T')[0];

interface FormState {
  description: string;
  amount: string;
  date: string;
  source: IncomeSource;
  moneyType: MoneyType;
}

const EMPTY_FORM: FormState = {
  description: '', amount: '', date: today, source: 'OTHER', moneyType: 'ARS',
};

function exportCSV(rows: Income[], month: string) {
  const header = ['Fecha', 'Descripción', 'Fuente', 'Cuenta', 'Moneda', 'Monto'];
  const data = rows.map(i => [
    i.date.split('T')[0],
    i.description,
    SOURCE_LABELS[i.source] ?? i.source,
    i.fromAccount === 'efectivo' ? 'Efectivo' : 'Banco',
    i.moneyType,
    Number(i.amount),
  ]);
  const csv = [header, ...data]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ingresos-${month || 'todos'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printPDF(rows: Income[], monthLabel: string, totalFiltered: number) {
  const rowsHTML = rows.map(i => {
    const amtStr = i.moneyType === 'USD'
      ? `USD ${Number(i.amount).toFixed(2)}`
      : fmtARS(Number(i.amount));
    return `<tr>
      <td>${fmtDate(i.date)}</td>
      <td>${i.description.replace(/</g, '&lt;')}</td>
      <td>${(SOURCE_LABELS[i.source] ?? i.source).replace(/</g, '&lt;')}</td>
      <td>${i.fromAccount === 'efectivo' ? 'Efectivo' : 'Banco'}</td>
      <td><span class="badge ${i.moneyType === 'ARS' ? 'ars' : 'usd'}">${i.moneyType}</span></td>
      <td class="amt">${amtStr}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ingresos — ${monthLabel}</title>
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
    .badge.ars{background:#ede9fe;color:#6d28d9}
    .badge.usd{background:#d1fae5;color:#065f46}
    .amt{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
    .footer{margin-top:16px;font-size:11px;color:#9ca3af;text-align:right}
    @media print{body{padding:16px}@page{margin:1.5cm}}
  </style>
</head>
<body>
  <h1>Ingresos — ${monthLabel}</h1>
  <p class="meta">${rows.length} registros &nbsp;·&nbsp; Total: ${fmtARS(totalFiltered)}</p>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Descripción</th><th>Fuente</th><th>Cuenta</th><th>Moneda</th>
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

export default function IngresosPage() {
  const { toast } = useToast();
  const [incomes,      setIncomes]      = useState<Income[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Income | null>(null);
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [errors,       setErrors]       = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving,       setSaving]       = useState(false);
  const [month,        setMonth]        = useState(today.slice(0, 7));
  const [query,        setQuery]        = useState('');
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(10);
  const [selectedIds,  setSelectedIds]  = useState<Set<number>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);

  const [showFilters,     setShowFilters]     = useState(false);
  const [filterSource,    setFilterSource]    = useState('');
  const [filterMoneyType, setFilterMoneyType] = useState('');
  const [filterAccount,   setFilterAccount]   = useState('');

  const PAGE_SIZES = [5, 10, 20, 50];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await incomesService.getAll();
      setIncomes(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('gf:expense-created', handler);
    return () => window.removeEventListener('gf:expense-created', handler);
  }, [fetchAll]);

  useEffect(() => { setSelectedIds(new Set()); }, [month, query, filterSource, filterMoneyType, filterAccount, page]);

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  }

  function validate() {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.description.trim()) e.description = 'Requerido';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Ingresá un monto válido';
    if (!form.date) e.date = 'Requerido';
    return e;
  }

  function openEdit(inc: Income) {
    setEditing(inc);
    setForm({
      description: inc.description,
      amount: String(inc.amount),
      date: inc.date.split('T')[0],
      source: inc.source,
      moneyType: inc.moneyType,
    });
    setErrors({});
    setPanelOpen(true);
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    const dto: CreateIncomeDto = {
      description: form.description.trim(),
      amount: Number(form.amount),
      date: form.date,
      source: form.source,
      moneyType: form.moneyType,
      fromAccount: 'efectivo',
    };
    try {
      if (editing) {
        await incomesService.update(editing.id, dto);
        toast('Ingreso actualizado', { type: 'success' });
      } else {
        await incomesService.create(dto);
        toast('Ingreso registrado', { type: 'success' });
      }
      await fetchAll();
      window.dispatchEvent(new CustomEvent('gf:expense-created'));
      setEditing(null);
      setPanelOpen(false);
    } catch (err) { console.error(err); toast('Error al guardar', { type: 'danger' }); }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await incomesService.remove(id);
    toast('Ingreso eliminado', { type: 'danger' });
    fetchAll();
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const isImported = (i: Income) => i.importSource === 'bbva_import';

  function toggleSelectAll() {
    const selectable = paginated.filter(i => !isImported(i));
    const allSel = selectable.length > 0 && selectable.every(i => selectedIds.has(i.id));
    setSelectedIds(allSel ? new Set() : new Set(selectable.map(i => i.id)));
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    setDeletingBulk(true);
    for (const id of ids) await incomesService.remove(id).catch(() => {});
    setDeletingBulk(false);
    setSelectedIds(new Set());
    toast(`${ids.length} ingreso${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`, { type: 'danger' });
    fetchAll();
  }

  function clearFilters() {
    setFilterSource('');
    setFilterMoneyType('');
    setFilterAccount('');
    setPage(1);
  }

  const hasActiveFilters = filterSource || filterMoneyType || filterAccount;

  const filtered = incomes
    .filter(i => !month || i.date?.split('T')[0].startsWith(month))
    .filter(i => !query.trim() || i.description.toLowerCase().includes(query.toLowerCase()))
    .filter(i => !filterSource || i.source === filterSource)
    .filter(i => !filterMoneyType || i.moneyType === filterMoneyType)
    .filter(i => !filterAccount || i.fromAccount === filterAccount)
    .sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (diff !== 0) return diff;
      }
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });

  const totalFiltered = filtered.reduce((s, i) => s + Number(i.amount), 0);
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

  const selectableOnPage = paginated.filter(i => !isImported(i));
  const allPageSelected  = selectableOnPage.length > 0 && selectableOnPage.every(i => selectedIds.has(i.id));
  const somePageSelected = selectableOnPage.some(i => selectedIds.has(i.id));

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 p-7 overflow-auto min-w-0">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-1.5">Movimientos</p>
            <h1 className="text-3xl font-bold tracking-tight text-text">Ingresos</h1>
            <p className="text-text-muted text-sm mt-1">Todas tus entradas del mes seleccionado.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportCSV(filtered, month)}
              title="Exportar a Excel/CSV"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2 text-xs font-semibold transition-all">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={() => printPDF(filtered, monthLabel, totalFiltered)}
              title="Imprimir / Guardar PDF"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2 text-xs font-semibold transition-all">
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>
            <Button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setPanelOpen(true); }}>
              <Plus className="w-4 h-4" /> Nuevo ingreso
            </Button>
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
              <span className="text-text-dim text-xs num">{filtered.length} ingreso{filtered.length !== 1 ? 's' : ''}</span>
              <span className="text-text-dim">·</span>
              <span className="text-emerald-400 text-xs font-bold num">{fmtARS(totalFiltered)}</span>
            </motion.div>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold transition-all',
              showFilters || hasActiveFilters
                ? 'border-accent/40 bg-accent/10 text-accent-soft'
                : 'border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2',
            )}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {hasActiveFilters && (
              <span className="w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold grid place-items-center">
                {[filterSource, filterMoneyType, filterAccount].filter(Boolean).length}
              </span>
            )}
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
            <Input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar ingreso…" className="pl-9 h-10 w-64" />
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

                {/* Fuente */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Fuente</span>
                  <select
                    value={filterSource}
                    onChange={e => { setFilterSource(e.target.value); setPage(1); }}
                    className="h-7 rounded-lg border border-line bg-surface/80 text-text text-xs px-2 outline-none focus:border-accent/50 transition-colors cursor-pointer">
                    <option value="">Todas</option>
                    {(Object.entries(SOURCE_LABELS) as [IncomeSource, string][]).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
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

                {/* Cuenta */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Cuenta</span>
                  <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5">
                    {[{ v: '', label: 'Todas' }, { v: 'banco', label: 'Banco' }, { v: 'efectivo', label: 'Efectivo' }].map(opt => (
                      <button key={opt.v} onClick={() => { setFilterAccount(opt.v); setPage(1); }}
                        className={cn('px-2.5 h-6 rounded-md text-xs font-semibold transition-all',
                          filterAccount === opt.v ? 'bg-accent text-white' : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
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
              <span className="text-2xl">💸</span>
            </div>
            <p className="text-text-soft text-sm font-semibold mb-1">{query || hasActiveFilters ? 'Sin resultados' : 'No hay ingresos en este mes'}</p>
            <p className="text-text-muted text-xs mb-5">
              {query || hasActiveFilters ? 'Probá con otra búsqueda o ajustá los filtros.' : 'Empezá agregando tu primer ingreso del mes.'}
            </p>
            {!query && !hasActiveFilters && (
              <Button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setPanelOpen(true); }}>
                <Plus className="w-4 h-4" /> Nuevo ingreso
              </Button>
            )}
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
                      <AnimatedCheckbox
                        checked={allPageSelected}
                        indeterminate={somePageSelected && !allPageSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    {['Fecha', 'Descripción', 'Fuente', 'Cuenta', 'Moneda', 'Monto', ''].map(h => (
                      <th key={h} className={cn('text-[10px] font-bold text-text-dim uppercase tracking-[0.18em] px-6 py-3.5', h === 'Monto' ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginated.map((inc, i) => (
                      <motion.tr key={inc.id}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.22, delay: i * 0.025 }}
                        className={cn('group border-b border-line last:border-0 hover:bg-white/[0.02] cursor-default transition-colors', selectedIds.has(inc.id) && 'bg-accent/[0.05]')}>
                        <td className="pl-5 pr-2 py-4 w-10" onClick={e => e.stopPropagation()}>
                          {isImported(inc)
                            ? <span title="Registro del resumen BBVA" className="flex justify-center"><Lock className="w-3.5 h-3.5 text-text-dim" /></span>
                            : <AnimatedCheckbox checked={selectedIds.has(inc.id)} onChange={() => toggleSelect(inc.id)} onClick={e => e.stopPropagation()} />
                          }
                        </td>
                        <td className="px-6 py-4 text-text-muted text-sm whitespace-nowrap num">{fmtDate(inc.date)}</td>
                        <td className="px-6 py-4 text-text text-sm font-semibold max-w-[280px] truncate">{inc.description}</td>
                        <td className="px-6 py-4"><SourceBadge source={inc.source} /></td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-text-muted">
                            {inc.fromAccount === 'efectivo' ? 'Efectivo' : 'Banco'}
                          </span>
                        </td>
                        <td className="px-6 py-4"><MoneyBadge moneyType={inc.moneyType} /></td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {inc.moneyType === 'USD' ? (
                            <span className="text-emerald-400 text-sm font-bold num">
                              USD {Number(inc.amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-sm font-bold num">{fmtARS(Number(inc.amount))}</span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            {!isImported(inc) && (
                              <>
                                <button onClick={() => openEdit(inc)} className="w-8 h-8 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors" aria-label="Editar">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <NativeDelete size="sm" showIcon compact onDelete={() => handleDelete(inc.id)} />
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
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
                <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-0.5">Crear</p>
                <h2 className="text-base font-bold text-text tracking-tight">{editing ? 'Editar ingreso' : 'Nuevo ingreso'}</h2>
              </div>
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => { setPanelOpen(false); setEditing(null); }}
                className="w-9 h-9 grid place-items-center rounded-xl border border-line text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors">
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6 flex flex-col gap-6">
              {/* Amount */}
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">Monto *</label>
                <div className={cn('flex items-end gap-2 rounded-2xl px-4 py-4 transition-all border-2',
                  errors.amount ? 'border-danger/50 bg-danger/[0.04]' : 'border-line-2 bg-surface focus-within:border-emerald-500/60 focus-within:bg-emerald-500/[0.04] focus-within:ring-2 focus-within:ring-emerald-500/15')}>
                  <span className="text-text-muted text-2xl font-bold leading-none pb-1">$</span>
                  <input type="number" value={form.amount} onChange={e => setF('amount', e.target.value)} placeholder="0" autoFocus
                    className="flex-1 bg-transparent text-emerald-400 text-3xl font-bold leading-none outline-none placeholder-text-dim num min-w-0" />
                </div>
                {errors.amount && <p className="text-danger text-xs mt-1.5">{errors.amount}</p>}
              </div>

              {/* Description */}
              <PanelField label="Descripción" required error={errors.description}>
                <Input value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Ej: Sueldo mayo, Freelance…" className={errors.description ? 'border-danger/60' : ''} />
              </PanelField>

              {/* Date */}
              <PanelField label="Fecha" required error={errors.date}>
                <DatePicker value={form.date} onChange={v => setF('date', v)} className={errors.date ? 'border-danger/60' : ''} />
              </PanelField>

              {/* Moneda */}
              <PanelField label="Moneda">
                <div className="flex gap-2">
                  {(['ARS', 'USD'] as MoneyType[]).map(mt => {
                    const sel = form.moneyType === mt;
                    return (
                      <motion.button key={mt} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setF('moneyType', mt)}
                        className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center',
                          sel ? (mt === 'ARS' ? 'bg-accent/15 text-accent-soft border-accent/40 ring-1 ring-accent/20' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/20')
                            : 'bg-surface text-text-muted border-line hover:border-line-2 hover:text-text-soft')}>
                        {mt}
                      </motion.button>
                    );
                  })}
                </div>
              </PanelField>

              {/* Fuente */}
              <PanelField label="Fuente">
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(SOURCE_LABELS) as [IncomeSource, string][]).map(([val, label]) => (
                    <motion.button key={val} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setF('source', val)}
                      className={cn('px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left',
                        form.source === val
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'border-line bg-surface text-text-muted hover:text-text-soft hover:border-line-2')}>
                      {label}
                    </motion.button>
                  ))}
                </div>
              </PanelField>

            </div>

            <div className="px-6 py-4 border-t border-line flex flex-col gap-2 flex-shrink-0">
              <Button onClick={handleSave} disabled={saving} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : editing ? 'Guardar cambios' : 'Agregar ingreso'}
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── helpers ─── */
function PanelField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">{label}{required && ' *'}</label>
      {children}
      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
  );
}

function SourceBadge({ source }: { source: IncomeSource }) {
  const label = SOURCE_LABELS[source] ?? source;
  const colorMap: Record<IncomeSource, string> = {
    SALARY:    'bg-emerald-500/12 text-emerald-400 border-emerald-500/20',
    FREELANCE: 'bg-blue-500/12 text-blue-400 border-blue-500/20',
    TRANSFER:  'bg-violet-500/12 text-violet-400 border-violet-500/20',
    REFUND:    'bg-amber-500/12 text-amber-400 border-amber-500/20',
    OTHER:     'bg-white/[0.06] text-text-muted border-line',
  };
  return (
    <span className={cn('inline-flex items-center h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border', colorMap[source])}>
      {label}
    </span>
  );
}

function MoneyBadge({ moneyType }: { moneyType: 'ARS' | 'USD' }) {
  const isARS = moneyType === 'ARS';
  return (
    <span className={cn('inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border',
      isARS ? 'bg-accent/12 text-accent-soft border-accent/20' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30')}>
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: isARS ? '#6C63FF' : '#34D399' }} />
      {isARS ? 'ARS' : 'USD'}
    </span>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-2xl glass overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex gap-4">
        {[80, 160, 100, 80, 60, 80].map((w, i) => <div key={i} className="skeleton h-3" style={{ width: w }} />)}
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="px-6 py-5 border-b border-line last:border-0 flex items-center gap-4">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-3 flex-1" />
          <div className="skeleton h-6 w-24 rounded-md" />
          <div className="skeleton h-6 w-20 rounded-md" />
          <div className="skeleton h-6 w-16 rounded-md" />
          <div className="skeleton h-3 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}
