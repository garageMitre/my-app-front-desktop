'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, X, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDelete } from '@/components/ui/native-delete';
import { useToast } from '@/components/ui/toaster';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { categoriesService } from '@/service';
import { cn } from '@/lib/utils';
import type { Category } from '@/lib/types';

const PRESET_CATEGORIES = [
  'Alimentación', 'Restaurantes', 'Café', 'Bar',
  'Transporte', 'Nafta', 'Colectivo',
  'Hogar', 'Expensas', 'Servicios', 'Internet',
  'Salud', 'Farmacia',
  'Entretenimiento', 'Streaming', 'Juegos', 'Música',
  'Ropa', 'Compras', 'Supermercado', 'Regalos',
  'Tecnología', 'Celular',
  'Educación', 'Cursos',
  'Viajes', 'Mascotas', 'Belleza', 'Gym', 'Trabajo', 'Bancos',
];
const PRESET_COLORS = [
  '#FF6B6B', '#FFB347', '#FBBF24', '#34D399',
  '#10B981', '#38BDF8', '#6C63FF', '#A78BFA',
  '#F472B6', '#EC4899', '#14B8A6', '#F97316',
];

export default function CategoriasPage() {
  const { toast } = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [presetName, setPresetName] = useState('');
  const [color, setColor] = useState('#6C63FF');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCats(); }, []);

  async function fetchCats() {
    setLoading(true);
    try {
      const data = await categoriesService.getAll();
      setCats(Array.isArray(data) ? data : []);
    } catch (err) { console.error('[categorias] fetchCats error:', err); }
    setLoading(false);
  }

  function openForm() {
    setEditing(null);
    const firstFree = PRESET_COLORS.find(c => !cats.some(cat => cat.color === c)) ?? PRESET_COLORS[0];
    setName(''); setPresetName(''); setColor(firstFree); setNameError('');
    setPanelOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setPresetName('');
    setColor(c.color ?? '#6C63FF');
    setNameError('');
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
  }

  async function handleSave() {
    const finalName = (name.trim() || presetName).trim();
    if (!finalName) { setNameError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) {
        await categoriesService.update(editing.id, { name: finalName, icon: finalName, color });
        toast('Categoría actualizada', { type: 'success' });
      } else {
        await categoriesService.create({ name: finalName, icon: finalName, color });
        toast('Categoría creada', { type: 'success' });
      }
      closePanel();
      fetchCats();
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await categoriesService.remove(id);
    toast('Categoría eliminada', { type: 'danger' });
    fetchCats();
  }

  // When editing, don't count that category's color as "used" so it remains selectable
  const usedColors = cats
    .filter(c => c.id !== editing?.id)
    .map(c => c.color);

  const previewName = (name.trim() || presetName) || 'Nombre de categoría';

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 p-7 overflow-auto min-w-0">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-text-dim font-bold mb-1.5">Configuración</p>
            <h1 className="text-3xl font-bold tracking-tight text-text">Categorías</h1>
            <p className="text-text-muted text-sm mt-1">Organizá tus gastos en grupos para verlos por tipo.</p>
          </div>
          <Button onClick={openForm}><Plus className="w-4 h-4" /> Nueva categoría</Button>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="rounded-2xl glass h-44 skeleton" />)}
          </div>
        ) : cats.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl glass p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-line flex items-center justify-center mx-auto mb-4">
              <Plus className="w-5 h-5 text-text-dim" />
            </div>
            <p className="text-text-soft text-sm font-semibold mb-1">No hay categorías todavía</p>
            <p className="text-text-muted text-xs mb-5">Creá una para empezar a clasificar tus gastos.</p>
            <Button onClick={openForm}><Plus className="w-4 h-4" /> Crear primera categoría</Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {cats.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.28, delay: i * 0.04 }} whileHover={{ y: -4 }} layout
                  className="group relative rounded-2xl glass overflow-hidden cursor-default transition-colors hover:border-line-2">
                  <div className="relative h-32 flex items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.color}10, ${c.color}28)` }}>
                    <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 70%, ${c.color}3a, transparent 65%)` }} />
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${c.color}, transparent 70%)` }} />
                    <div className="relative z-10"><CategoryGlyph name={c.name} color={c.color} size="xl" /></div>
                  </div>
                  <div className="px-3 py-2.5 border-t border-line">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <p className="text-text font-semibold text-sm flex-1 leading-snug break-words">{c.name}</p>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex items-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="w-7 h-7 grid place-items-center rounded-lg text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <NativeDelete size="sm" showIcon={false} compact onDelete={() => handleDelete(c.id)} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
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
                <h2 className="text-base font-bold text-text tracking-tight">{editing ? 'Editar categoría' : 'Nueva categoría'}</h2>
              </div>
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={closePanel}
                className="w-9 h-9 grid place-items-center rounded-xl border border-line text-text-muted hover:text-text hover:bg-white/[0.05] transition-colors">
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6 flex flex-col gap-6">
              {/* Live preview */}
              <div className="rounded-2xl border border-line bg-surface/40 p-6 flex flex-col items-center justify-center text-center min-h-[160px] relative overflow-hidden">
                <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 50% 30%, ${color}22, transparent 65%)` }} />
                <motion.div key={`${previewName}-${color}`} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 280 }} className="relative z-10">
                  <CategoryGlyph name={previewName} color={color} size="xl" className="mx-auto mb-3" />
                  <p className="text-text font-bold text-base tracking-tight">{previewName}</p>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-text-muted text-[11px] font-mono">{color.toUpperCase()}</span>
                  </div>
                </motion.div>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">Nombre *</label>
                <Input value={name} onChange={e => { setName(e.target.value); setPresetName(''); setNameError(''); }} placeholder="Ej: Restaurantes, Ropa, Gym…" autoFocus className={nameError ? 'border-danger/60' : ''} />
                {nameError && <p className="text-danger text-xs mt-1.5">{nameError}</p>}
              </div>

              {/* Presets */}
              {!editing && (
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">Presets (auto-icono)</label>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto p-2 rounded-xl border border-line bg-surface/40">
                    {PRESET_CATEGORIES.map(p => {
                      const sel = presetName === p && !name.trim();
                      return (
                        <button key={p} onClick={() => { setPresetName(p); setName(''); setNameError(''); }}
                          className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all border',
                            sel ? 'bg-accent/15 text-accent-soft border-accent/40' : 'bg-white/[0.02] text-text-muted border-transparent hover:bg-white/[0.05] hover:text-text-soft')}>
                          <CategoryGlyph name={p} color={sel ? '#8B83FF' : '#6B7188'} size="sm" className="!w-5 !h-5 !rounded-md" />
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color */}
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] block mb-2">Color</label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map(c => {
                    const used = usedColors.includes(c); const sel = color === c;
                    return (
                      <motion.button key={c} whileHover={!used ? { scale: 1.12 } : {}} whileTap={!used ? { scale: 0.92 } : {}} onClick={() => !used && setColor(c)} disabled={used}
                        className={cn('w-full aspect-square rounded-xl flex items-center justify-center transition-all relative', sel ? 'ring-2 ring-white ring-offset-2 ring-offset-bg' : '', used ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer')}
                        style={{ backgroundColor: c }}>
                        {sel && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        {used && !sel && (
                          <span className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white/60" strokeWidth={3} />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-line flex flex-col gap-2 flex-shrink-0">
              <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : editing ? 'Guardar cambios' : 'Crear categoría'}
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
