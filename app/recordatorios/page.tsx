'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Search,
  Bell,
  Mail,
  Clock,
  Trash2,
  FilterX,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  Send,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDelete } from '@/components/ui/native-delete';
import { AnimatedCheckbox } from '@/components/ui/animated-checkbox';
import { useToast } from '@/components/ui/toaster';
import { remindersService } from '@/service';
import { cn } from '@/lib/utils';
import type { CreateReminderDto, Reminder, ReminderStatus } from '@/lib/types';
import { DateTimePicker } from '@/components/ui/date-time-picker';

function fmtDateTime(d: string) {
  if (!d) return '';

  const date = new Date(d);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const nowPlusOneHour = toDatetimeLocalValue(
  new Date(Date.now() + 60 * 60 * 1000),
);

type NotifyUnit = 'minutes' | 'hours' | 'days';

interface FormState {
  email: string;
  description: string;
  remindAt: string;
  notifyBeforeValue: string;
  notifyBeforeUnit: NotifyUnit;
}

const EMPTY_FORM: FormState = {
  email: '',
  description: '',
  remindAt: nowPlusOneHour,
  notifyBeforeValue: '30',
  notifyBeforeUnit: 'minutes',
};

const PAGE_SIZES = [5, 10, 20, 50];

export default function RecordatoriosPage() {
  const { toast } = useToast();
  const { data: session } = useSession();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (session?.user?.email) {
      setForm(f => f.email ? f : { ...f, email: session.user!.email! });
    }
  }, [session]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);

    try {
      const data = await remindersService.getAll();
      setReminders(data);
    } catch (err) {
      console.error(err);
      toast('No se pudieron cargar los recordatorios', { type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [query, filterStatus, page]);

  function notifyToMinutes(value: string, unit: NotifyUnit) {
    const n = Number(value);

    if (Number.isNaN(n) || n < 0) return 0;

    if (unit === 'minutes') return n;
    if (unit === 'hours') return n * 60;
    if (unit === 'days') return n * 1440;

    return n;
  }

  function getNotifyPreview(value: string, unit: NotifyUnit) {
    const n = Number(value);

    if (!n || n <= 0) return 'En el horario exacto';

    const unitLabel =
      unit === 'minutes'
        ? n === 1
          ? 'minuto'
          : 'minutos'
        : unit === 'hours'
          ? n === 1
            ? 'hora'
            : 'horas'
          : n === 1
            ? 'día'
            : 'días';

    return `${n} ${unitLabel} antes`;
  }

  function openNew() {
    setForm({
      ...EMPTY_FORM,
      email: session?.user?.email ?? '',
      remindAt: toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
    });
    setErrors({});
    setPanelOpen(true);
  }

  function setF<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  }

  function validate() {
    const e: Partial<Record<keyof FormState, string>> = {};

    if (!form.email.trim()) {
      e.email = 'Requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Ingresá un email válido';
    }

    if (!form.description.trim()) {
      e.description = 'Requerido';
    }

    if (!form.remindAt) {
      e.remindAt = 'Requerido';
    } else {
      const selectedDate = new Date(form.remindAt);

      if (Number.isNaN(selectedDate.getTime())) {
        e.remindAt = 'Fecha inválida';
      }

      if (selectedDate <= new Date()) {
        e.remindAt = 'La fecha debe ser futura';
      }
    }

    if (!form.notifyBeforeValue.trim()) {
      e.notifyBeforeValue = 'Requerido';
    }

    const notifyMinutes = notifyToMinutes(
      form.notifyBeforeValue,
      form.notifyBeforeUnit,
    );

    if (Number.isNaN(notifyMinutes) || notifyMinutes < 0) {
      e.notifyBeforeValue = 'Aviso inválido';
    }

    if (notifyMinutes > 10080) {
      e.notifyBeforeValue = 'El máximo permitido es 7 días antes';
    }

    if (form.remindAt) {
      const notifyAt = new Date(
        new Date(form.remindAt).getTime() - notifyMinutes * 60 * 1000,
      );

      if (notifyAt <= new Date()) {
        e.notifyBeforeValue = 'El aviso calculado ya pasó';
      }
    }

    return e;
  }

  async function handleSave() {
    const e = validate();

    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setSaving(true);

    const dto: CreateReminderDto = {
      email: form.email.trim(),
      description: form.description.trim(),
      remindAt: new Date(form.remindAt).toISOString(),
      notifyBeforeMinutes: notifyToMinutes(
        form.notifyBeforeValue,
        form.notifyBeforeUnit,
      ),
    };

    try {
      await remindersService.create(dto);
      toast('Recordatorio creado', { type: 'success' });
      await fetchAll();
      setPanelOpen(false);
    } catch (err) {
      console.error(err);
      toast('No se pudo crear el recordatorio', { type: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await remindersService.remove(id);
      toast('Recordatorio eliminado', { type: 'danger' });
      await fetchAll();
    } catch (err) {
      console.error(err);
      toast('No se pudo eliminar el recordatorio', { type: 'danger' });
    }
  }

  async function handleCancel(id: string) {
    try {
      await remindersService.cancel(id);
      toast('Recordatorio cancelado', { type: 'success' });
      await fetchAll();
    } catch (err) {
      console.error(err);
      toast('No se pudo cancelar el recordatorio', { type: 'danger' });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = paginated.filter(
      r => r.status === 'PENDING' || r.status === 'FAILED',
    );

    const allSelected =
      selectable.length > 0 && selectable.every(r => selectedIds.has(r.id));

    setSelectedIds(
      allSelected ? new Set() : new Set(selectable.map(r => r.id)),
    );
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];

    setDeletingBulk(true);

    for (const id of ids) {
      await remindersService.remove(id).catch(() => {});
    }

    setDeletingBulk(false);
    setSelectedIds(new Set());

    toast(
      `${ids.length} recordatorio${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`,
      { type: 'danger' },
    );

    fetchAll();
  }

  const hasActiveFilters = Boolean(filterStatus);

  function clearFilters() {
    setFilterStatus('');
    setPage(1);
  }

  const filtered = reminders
    .filter(r => {
      const q = query.trim().toLowerCase();

      if (!q) return true;

      return (
        r.description.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    })
    .filter(r => !filterStatus || r.status === filterStatus)
    .sort((a, b) => {
      const dateDiff =
        new Date(b.remindAt).getTime() - new Date(a.remindAt).getTime();

      if (dateDiff !== 0) return dateDiff;

      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });

  const totalPending = reminders.filter(r => r.status === 'PENDING').length;
  const totalSent = reminders.filter(r => r.status === 'SENT').length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 p-7 overflow-auto min-w-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between gap-4 flex-wrap mb-6"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-1.5">
              Alertas
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-text">
              Recordatorios
            </h1>
            <p className="text-text-muted text-sm mt-1">
              Programá avisos por email con fecha, hora y anticipación.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={openNew}>
              <Plus className="w-4 h-4" />
              Nuevo recordatorio
            </Button>
          </div>
        </motion.div>

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.06 }}
          className="flex items-center gap-3 mb-3 flex-wrap"
        >
          <div className="flex items-center gap-2 px-3 h-10 rounded-xl border border-line bg-surface/60">
            <Bell className="w-3.5 h-3.5 text-accent-soft" />
            <span className="text-text-dim text-xs num">
              {filtered.length} recordatorios
            </span>
            <span className="text-text-dim">·</span>
            <span className="text-text text-xs font-bold num">
              {totalPending} pendientes
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 h-10 rounded-xl border border-line bg-surface/60">
            <Send className="w-3.5 h-3.5 text-info" />
            <span className="text-text-dim text-xs num">
              {totalSent} enviados
            </span>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold transition-all',
              showFilters || hasActiveFilters
                ? 'border-accent/40 bg-accent/10 text-accent-soft'
                : 'border-line bg-surface/60 text-text-muted hover:text-text hover:border-line-2',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {hasActiveFilters && (
              <span className="w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold grid place-items-center">
                1
              </span>
            )}
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
            <Input
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar recordatorio…"
              className="pl-9 h-10 w-64"
            />
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
              className="overflow-hidden mb-3"
            >
              <div className="rounded-2xl border border-line bg-surface/50 backdrop-blur p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">
                    Estado
                  </span>

                  <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5">
                    {[
                      { value: '', label: 'Todos' },
                      { value: 'PENDING', label: 'Pendiente' },
                      { value: 'SENT', label: 'Enviado' },
                      { value: 'FAILED', label: 'Fallido' },
                      { value: 'CANCELLED', label: 'Cancelado' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setFilterStatus(opt.value);
                          setPage(1);
                        }}
                        className={cn(
                          'px-2.5 h-6 rounded-md text-xs font-semibold transition-all',
                          filterStatus === opt.value
                            ? 'bg-accent text-white'
                            : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs font-semibold hover:bg-danger/20 transition-colors"
                  >
                    <FilterX className="w-3 h-3" />
                    Limpiar
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
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-3 rounded-xl border border-danger/25 bg-danger/[0.06] px-4 py-2.5 mb-3"
            >
              <Trash2 className="w-3.5 h-3.5 text-danger flex-shrink-0" />
              <span className="text-danger text-sm font-semibold">
                {selectedIds.size} seleccionado
                {selectedIds.size !== 1 ? 's' : ''}
              </span>

              <div className="flex-1" />

              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Deseleccionar todo
              </button>

              <NativeDelete
                size="sm"
                showIcon
                buttonText={`Eliminar ${selectedIds.size}`}
                confirmText="¿Confirmar?"
                onDelete={handleBulkDelete}
                disabled={deletingBulk}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        {loading ? (
          <SkeletonTable />
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl glass p-16 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-line flex items-center justify-center mx-auto mb-4">
              <Bell className="w-5 h-5 text-text-dim" />
            </div>

            <p className="text-text-soft text-sm font-semibold mb-1">
              {query || hasActiveFilters
                ? 'Sin resultados'
                : 'No hay recordatorios'}
            </p>

            <p className="text-text-muted text-xs mb-5">
              {query || hasActiveFilters
                ? 'Probá con otra búsqueda o ajustá los filtros.'
                : 'Empezá creando tu primer recordatorio por email.'}
            </p>

            {!query && !hasActiveFilters && (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4" />
                Nuevo recordatorio
              </Button>
            )}

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-xs text-accent-soft hover:underline"
              >
                <FilterX className="w-3 h-3" />
                Limpiar filtros
              </button>
            )}
          </motion.div>
        ) : (
          <>
            <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="reminders-table-container rounded-2xl glass overflow-hidden"
            >
              <table className="w-full table-fixed">
<colgroup>
  <col className="w-[52px]" />
  <col className="w-[240px]" />
  <col className="w-[180px]" />
  <col className="w-[300px]" />
  <col className="w-[210px]" />
  <col className="w-[150px]" />
  <col className="w-[96px]" />
</colgroup>
                <thead>
                  <tr className="border-b border-line">
                    <th className="pl-5 pr-2 py-3.5 w-10">
                      {(() => {
                        const selectable = paginated.filter(
                          r => r.status === 'PENDING' || r.status === 'FAILED',
                        );

                        const allSelected =
                          selectable.length > 0 &&
                          selectable.every(r => selectedIds.has(r.id));

                        const someSelected = selectable.some(r =>
                          selectedIds.has(r.id),
                        );

                        return (
                          <AnimatedCheckbox
                            checked={allSelected}
                            indeterminate={someSelected && !allSelected}
                            onChange={toggleSelectAll}
                          />
                        );
                      })()}
                    </th>

                {['Fecha', 'Descripción', 'Email', 'Aviso', 'Estado', ''].map(h => (
                <th
                    key={h}
                    className={cn(
                    'text-[10px] font-bold text-text-dim uppercase tracking-[0.10em] px-4 py-3.5 text-left',
                    h === '' && 'px-2',
                    )}
                >
                    {h}
                </th>
                ))}
                  </tr>
                </thead>

                <tbody>
                  <AnimatePresence>
                    {paginated.map((r, i) => {
                      const selectable =
                        r.status === 'PENDING' || r.status === 'FAILED';

                      return (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.22, delay: i * 0.025 }}
                          className={cn(
                            'group border-b border-line last:border-0 hover:bg-white/[0.02] transition-colors',
                            selectedIds.has(r.id) && 'bg-accent/[0.05]',
                          )}
                        >
                          <td
                            className="pl-5 pr-2 py-4 w-10"
                            onClick={e => e.stopPropagation()}
                          >
                            {selectable ? (
                              <AnimatedCheckbox
                                checked={selectedIds.has(r.id)}
                                onChange={() => toggleSelect(r.id)}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className="flex justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5 text-text-dim" />
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-text-muted text-sm whitespace-nowrap num">
                            {fmtDateTime(r.remindAt)}
                          </td>

                            <td className="px-4 py-4 text-text text-sm font-semibold">
                            <span className="block truncate">
                                {r.description}
                            </span>
                            </td>

                            <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
                                <span className="w-7 h-7 rounded-lg bg-info/10 border border-info/20 grid place-items-center flex-shrink-0">
                                <Mail className="w-3.5 h-3.5 text-info" />
                                </span>

                                <span className="text-text-soft text-sm truncate min-w-0">
                                {r.email}
                                </span>
                            </span>
                            </td>

                            <td className="px-4 py-4">
                            <div className="reminder-notify-cell">
                                <span className="reminder-notify-short text-text-soft text-sm font-bold whitespace-nowrap">
                                {getNotifyShortLabel(r.notifyBeforeMinutes)}
                                </span>

                                <span className="reminder-notify-full text-text-soft text-sm font-semibold whitespace-nowrap">
                                {getNotifyLabel(r.notifyBeforeMinutes)}
                                </span>

                                <span className="reminder-notify-date text-text-muted text-xs num whitespace-nowrap">
                                {fmtDateTime(r.notifyAt)}
                                </span>
                            </div>
                            </td>

                            <td className="px-4 py-4">
                            <div className="flex justify-start">
                                <StatusBadge status={r.status} />
                            </div>
                            </td>

                          <td className="px-3 py-4 w-36">
                            <div
                              className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => e.stopPropagation()}
                            >
                              {r.status === 'PENDING' && (
                                <button
                                  onClick={() => handleCancel(r.id)}
                                  className="w-8 h-8 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors"
                                  aria-label="Cancelar"
                                  title="Cancelar"
                                >
                                  <PauseCircle className="cursor-pointer w-3.5 h-3.5" />
                                </button>
                              )}

                              {(r.status === 'PENDING' ||
                                r.status === 'FAILED' ||
                                r.status === 'CANCELLED') && (
                                <NativeDelete
                                  size="sm"
                                  showIcon
                                  compact
                                  onDelete={() => handleDelete(r.id)}
                                />
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
                  {PAGE_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                      }}
                      className={cn(
                        'px-2.5 h-6 rounded-md text-xs font-semibold transition-all',
                        pageSize === size
                          ? 'bg-accent text-white'
                          : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]',
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-text-dim text-xs num">
                  {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, filtered.length)} de{' '}
                  {filtered.length}
                </span>

                <div className="flex gap-0.5 rounded-lg border border-line bg-surface/60 p-0.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-6 h-6 grid place-items-center rounded-md text-text-muted hover:text-text hover:bg-white/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      p =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 1,
                    )
                    .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push('…');
                      }

                      acc.push(p);

                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '…' ? (
                        <span
                          key={`e${i}`}
                          className="w-6 h-6 grid place-items-center text-text-dim text-xs"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={cn(
                            'w-6 h-6 grid place-items-center rounded-md text-xs font-semibold transition-all',
                            safePage === p
                              ? 'bg-accent text-white'
                              : 'text-text-muted hover:text-text-soft hover:bg-white/[0.05]',
                          )}
                        >
                          {p}
                        </button>
                      ),
                    )}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-6 h-6 grid place-items-center rounded-md text-text-muted hover:text-text hover:bg-white/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
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
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
            className="w-[380px] flex-shrink-0 h-full border-l border-line bg-surface/90 backdrop-blur-xl flex flex-col relative z-20"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-line flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-0.5">
                  Crear
                </p>
                <h2 className="text-base font-bold text-text tracking-tight">
                  Nuevo recordatorio
                </h2>
              </div>

              <motion.button
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setPanelOpen(false)}
                className="w-9 h-9 grid place-items-center rounded-xl border border-line text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6 flex flex-col gap-6">
              {/* Highlight */}
              <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 grid place-items-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-accent-soft" />
                  </div>

                  <div>
                    <p className="text-text text-sm font-bold mb-1">
                      Aviso por email
                    </p>
                    <p className="text-text-muted text-xs leading-relaxed">
                      El sistema enviará el mail según la fecha elegida y la
                      anticipación configurada.
                    </p>
                  </div>
                </div>
              </div>

              {/* Email */}
              <Field label="Email" required error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setF('email', e.target.value)}
                  placeholder="cliente@gmail.com"
                  className={errors.email ? 'border-danger/60' : ''}
                  autoFocus
                />
              </Field>

              {/* Description */}
              <Field label="Descripción" required error={errors.description}>
                <textarea
                  value={form.description}
                  onChange={e => setF('description', e.target.value)}
                  placeholder="Ej: Pagar alquiler, renovar dominio, llamar al cliente…"
                  className={cn(
                    'w-full min-h-[110px] rounded-xl border bg-surface px-3 py-3 text-sm text-text outline-none placeholder:text-text-dim resize-none transition-all',
                    'focus:border-accent/60 focus:ring-2 focus:ring-accent/15',
                    errors.description ? 'border-danger/60' : 'border-line',
                  )}
                />
              </Field>

              {/* Date time */}
              <Field label="Fecha y hora" required error={errors.remindAt}>
                <DateTimePicker
                  value={form.remindAt}
                  onChange={v => setF('remindAt', v)}
                  placeholder="Seleccionar fecha y horario"
                  className={errors.remindAt ? 'border-danger/60' : ''}
                />
              </Field>

              {/* Notify before */}
              <Field label="Avisarme" error={errors.notifyBeforeValue}>
                <div className="rounded-2xl border border-line bg-surface/40 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        min={0}
                        value={form.notifyBeforeValue}
                        onChange={e =>
                          setF('notifyBeforeValue', e.target.value)
                        }
                        placeholder="30"
                        className={cn(
                          'h-11 text-sm font-bold num',
                          errors.notifyBeforeValue ? 'border-danger/60' : '',
                        )}
                      />
                    </div>

                    <div className="flex gap-1 rounded-xl border border-line bg-surface/60 p-1">
                      {[
                        { value: 'minutes', label: 'Min' },
                        { value: 'hours', label: 'Hs' },
                        { value: 'days', label: 'Días' },
                      ].map(opt => {
                        const selected = form.notifyBeforeUnit === opt.value;

                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setF(
                                'notifyBeforeUnit',
                                opt.value as NotifyUnit,
                              )
                            }
                            className={cn(
                              'h-8 px-3 rounded-lg text-xs font-bold transition-all',
                              selected
                                ? 'bg-accent text-white'
                                : 'text-text-muted hover:text-text hover:bg-white/[0.05]',
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mt-3">
                    {[
                      { value: '0', unit: 'minutes', label: 'Exacto' },
                      { value: '5', unit: 'minutes', label: '5 min' },
                      { value: '30', unit: 'minutes', label: '30 min' },
                      { value: '1', unit: 'hours', label: '1 hora' },
                    ].map(preset => (
                      <button
                        key={`${preset.value}-${preset.unit}`}
                        type="button"
                        onClick={() => {
                          setF('notifyBeforeValue', preset.value);
                          setF(
                            'notifyBeforeUnit',
                            preset.unit as NotifyUnit,
                          );
                        }}
                        className="h-8 rounded-lg border border-line bg-white/[0.02] text-text-muted text-xs font-semibold hover:text-text hover:bg-white/[0.05] transition-all"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {form.remindAt && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-accent-soft text-xs mt-3 flex items-center gap-1.5 leading-relaxed"
                    >
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>
                        {getNotifyPreview(
                          form.notifyBeforeValue,
                          form.notifyBeforeUnit,
                        )}
                        {' · '}
                        Se enviará aproximadamente el{' '}
                        {fmtDateTime(
                          new Date(
                            new Date(form.remindAt).getTime() -
                              notifyToMinutes(
                                form.notifyBeforeValue,
                                form.notifyBeforeUnit,
                              ) *
                                60 *
                                1000,
                          ).toISOString(),
                        )}
                      </span>
                    </motion.p>
                  )}
                </div>
              </Field>
            </div>

            <div className="px-6 py-4 border-t border-line flex flex-col gap-2 flex-shrink-0">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  'Crear recordatorio'
                )}
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── helpers ─── */

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">
        {label}
        {required && ' *'}
      </label>

      {children}

      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: ReminderStatus }) {
  const config = {
    PENDING: {
      label: 'Pendiente',
      icon: Clock,
      className: 'bg-accent/12 text-accent-soft border-accent/20',
      dot: '#6C63FF',
    },
    PROCESSING: {
      label: 'Procesando',
      icon: Loader2,
      className: 'bg-info/12 text-info border-info/20',
      dot: '#38BDF8',
    },
    SENT: {
      label: 'Enviado',
      icon: CheckCircle2,
      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      dot: '#34D399',
    },
    FAILED: {
      label: 'Fallido',
      icon: AlertTriangle,
      className: 'bg-danger/12 text-danger border-danger/20',
      dot: '#EF4444',
    },
    CANCELLED: {
      label: 'Cancelado',
      icon: PauseCircle,
      className: 'bg-white/[0.04] text-text-muted border-line',
      dot: '#6B7188',
    },
  } satisfies Record<
    ReminderStatus,
    {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      className: string;
      dot: string;
    }
  >;

  const item = config[status];
  const Icon = item.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border',
        item.className,
      )}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{ backgroundColor: item.dot }}
      />
      <Icon
        className={cn('w-3 h-3', status === 'PROCESSING' && 'animate-spin')}
      />
      {item.label}
    </span>
  );
}

function getNotifyLabel(minutes: number) {
  if (minutes === 0) return 'En horario exacto';
  if (minutes === 5) return '5 min antes';
  if (minutes === 15) return '15 min antes';
  if (minutes === 30) return '30 min antes';
  if (minutes === 60) return '1 hora antes';
  if (minutes === 1440) return '1 día antes';

  if (minutes < 60) return `${minutes} min antes`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} hs antes`;

  const days = Math.round(hours / 24);

  return `${days} día${days !== 1 ? 's' : ''} antes`;
}

function getNotifyShortLabel(minutes: number) {
  if (minutes === 0) return 'Exacto';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} h`;

  const days = Math.round(hours / 24);

  return `${days} d`;
}

function SkeletonTable() {
  return (
    <div className="rounded-2xl glass overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex gap-4">
        {[80, 180, 140, 100, 80].map((w, i) => (
          <div key={i} className="skeleton h-3" style={{ width: w }} />
        ))}
      </div>

      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="px-6 py-5 border-b border-line last:border-0 flex items-center gap-4"
        >
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-3 flex-1" />
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-7 rounded-lg" />
            <div className="skeleton h-3 w-32" />
          </div>
          <div className="skeleton h-6 w-20 rounded-md" />
          <div className="skeleton h-3 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}