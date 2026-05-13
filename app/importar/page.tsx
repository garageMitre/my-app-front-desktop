'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, AlertTriangle, XCircle, Loader2, FileSpreadsheet, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type ParsedRow = {
  date: string;
  description: string;
  amount: number;
  kind: 'expense' | 'income';
  externalId?: string;
};

type ImportStatus = 'new' | 'duplicate' | 'possible_duplicate';

type PreviewItem = {
  status: ImportStatus;
  data: ParsedRow;
  existingId?: number;
  existingDescription?: string;
};

type Preview = {
  expenses: PreviewItem[];
  incomes: PreviewItem[];
};

const STATUS_CONFIG = {
  new:               { label: 'Nuevo',              color: 'text-success',     bg: 'bg-success/10 border-success/20',     icon: CheckCircle  },
  possible_duplicate:{ label: 'Posible duplicado',  color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/20', icon: AlertTriangle },
  duplicate:         { label: 'Duplicado (se omite)',color: 'text-text-dim',    bg: 'bg-white/[0.03] border-line',         icon: XCircle      },
};

export default function ImportarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging,    setDragging]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [confirming,  setConfirming]  = useState(false);
  const [preview,     setPreview]     = useState<Preview | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [done,        setDone]        = useState<{ expenses: number; incomes: number } | null>(null);

  // Selected items (user can deselect possible_duplicates)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const upload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setDone(null);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${API}/import/preview`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      const data: Preview = await res.json();
      setPreview(data);

      // Pre-select all 'new' and 'possible_duplicate' items
      const initial = new Set<string>();
      data.expenses.forEach((it, i) => { if (it.status !== 'duplicate') initial.add(`e-${i}`); });
      data.incomes.forEach((it, i)  => { if (it.status !== 'duplicate') initial.add(`i-${i}`); });
      setSelected(initial);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onFile = (f: File | undefined) => { if (f) upload(f); };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files[0]);
  };

  function toggleItem(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function confirm() {
    if (!preview) return;
    setConfirming(true);
    try {
      const expenses = preview.expenses
        .filter((_, i) => selected.has(`e-${i}`) && preview.expenses[i].status !== 'duplicate')
        .map(it => it.data);
      const incomes = preview.incomes
        .filter((_, i) => selected.has(`i-${i}`) && preview.incomes[i].status !== 'duplicate')
        .map(it => it.data);

      const res = await fetch(`${API}/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses, incomes, defaultCategoryId: 1 }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      setDone(result);
      setPreview(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  const totalNew      = preview ? [...preview.expenses, ...preview.incomes].filter(i => i.status === 'new').length : 0;
  const totalPossible = preview ? [...preview.expenses, ...preview.incomes].filter(i => i.status === 'possible_duplicate').length : 0;
  const totalSkip     = preview ? [...preview.expenses, ...preview.incomes].filter(i => i.status === 'duplicate').length : 0;
  const totalSelected = selected.size;

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-text text-xl font-semibold">Importar movimientos</h1>
        <p className="text-text-muted text-sm mt-1">Subí el Excel o PDF de tu banco. Se detectan duplicados automáticamente.</p>
      </div>

      {/* Upload zone */}
      {!preview && !done && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-14 cursor-pointer transition-all ${
            dragging ? 'border-accent bg-accent/10' : 'border-line hover:border-white/20 hover:bg-white/[0.02]'
          }`}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
            onChange={e => onFile(e.target.files?.[0])} />

          {loading
            ? <Loader2 className="w-8 h-8 text-accent-soft animate-spin" />
            : <FileSpreadsheet className="w-8 h-8 text-text-muted" />
          }
          <div className="text-center">
            <p className="text-text-soft font-medium">{loading ? 'Analizando archivo…' : 'Arrastrá o hacé click para subir'}</p>
            <p className="text-text-dim text-sm mt-1">Excel (.xlsx, .xls), CSV o PDF del banco</p>
          </div>
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-4 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Done */}
      {done && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle className="w-12 h-12 text-success" />
          <div>
            <p className="text-text font-semibold text-lg">Importación completada</p>
            <p className="text-text-muted text-sm mt-1">
              {done.expenses} gasto{done.expenses !== 1 ? 's' : ''} y {done.incomes} ingreso{done.incomes !== 1 ? 's' : ''} registrados
            </p>
          </div>
          <Button onClick={() => { setDone(null); setError(null); }} variant="outline" className="gap-2">
            <RotateCcw className="w-4 h-4" /> Importar otro archivo
          </Button>
        </motion.div>
      )}

      {/* Preview */}
      {preview && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-col gap-4">

          {/* Summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium">{totalNew} nuevos</span>
            {totalPossible > 0 && <span className="px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-medium">{totalPossible} posibles duplicados</span>}
            {totalSkip > 0 && <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-line text-text-dim text-xs font-medium">{totalSkip} duplicados omitidos</span>}
            <span className="ml-auto text-text-dim text-xs">{totalSelected} seleccionados</span>
          </div>

          {/* Sections */}
          {[
            { title: 'Gastos', items: preview.expenses, prefix: 'e' },
            { title: 'Ingresos', items: preview.incomes, prefix: 'i' },
          ].map(({ title, items, prefix }) => items.length > 0 && (
            <div key={title}>
              <p className="text-text-soft font-semibold text-sm mb-2">{title} <span className="text-text-dim font-normal">({items.length})</span></p>
              <div className="flex flex-col gap-1.5">
                {items.map((item, idx) => {
                  const key    = `${prefix}-${idx}`;
                  const cfg    = STATUS_CONFIG[item.status];
                  const Icon   = cfg.icon;
                  const isDup  = item.status === 'duplicate';
                  const isSel  = selected.has(key);

                  return (
                    <motion.div key={key} layout
                      onClick={() => !isDup && toggleItem(key)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${cfg.bg} ${!isDup ? 'cursor-pointer' : 'opacity-50'} ${isSel && !isDup ? 'ring-1 ring-accent/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                        isDup ? 'border-line' : isSel ? 'bg-accent border-accent' : 'border-white/20'
                      }`}>
                        {isSel && !isDup && <div className="w-2 h-2 rounded-sm bg-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-text-soft text-sm truncate">{item.data.description}</p>
                        {item.existingDescription && item.status === 'possible_duplicate' && (
                          <p className="text-text-dim text-xs truncate">Similar a: {item.existingDescription}</p>
                        )}
                        <p className="text-text-dim text-xs">{item.data.date}</p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-text font-semibold text-sm">${Number(item.data.amount).toLocaleString('es-AR')}</p>
                        <div className={`flex items-center gap-1 justify-end ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          <span className="text-xs">{cfg.label}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-line">
            <Button variant="outline" onClick={() => { setPreview(null); setError(null); }} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Otro archivo
            </Button>
            <Button onClick={confirm} disabled={confirming || totalSelected === 0} className="flex-1 gap-2">
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Registrar {totalSelected} movimiento{totalSelected !== 1 ? 's' : ''}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
