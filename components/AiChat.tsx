'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp, CheckCircle, Loader2, Mic, MicOff, Paperclip,
  PieChart, Sparkles, TrendingUp, Volume2, VolumeX, Wallet, X,
  AlertTriangle, FileSpreadsheet,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatOpen } from './ChatProvider';

const PYTHON_API  = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? '/api/python';
const NESTJS_API  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// Clean text and return 2 sentences for TTS, or a custom phrase for expense creation
type ExpenseCreated = { description: string; amount: number; moneyType: string } | null | undefined;
function toSpeechSummary(text: string, expense?: ExpenseCreated): string {
  if (expense) {
    const currency = expense.moneyType === 'USD' ? 'dólares' : 'pesos';
    return `Listo, se registró ${expense.description} por ${Number(expense.amount).toLocaleString('es-AR')} ${currency}.`;
  }
  const clean = text
    .replace(/[*_~`#>-]/g, '')
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let summary = '';
  for (const s of sentences.slice(0, 4)) {
    summary += s;
    if (summary.length > 320) break;
  }
  return (summary || clean.slice(0, 320)).trim();
}

/* ─── types ─── */
type HistoryMessage = { role: string; content: string };
type PendingExpense = {
  description: string;
  amount: number;
  moneyType: string;
  categoryId: number;
  categoryName?: string;
  date: string;
  type: string;
  isRecurring?: boolean;
  recurringDay?: number;
};
type ImportStatus = 'new' | 'duplicate' | 'possible_duplicate';
type ParsedRow = { date: string; description: string; amount: number; kind: 'expense' | 'income'; externalId?: string };
type ImportPreviewItem = { status: ImportStatus; data: ParsedRow; existingDescription?: string };
type ImportPreviewData = { expenses: ImportPreviewItem[]; incomes: ImportPreviewItem[]; balanceAmount?: number; balanceDate?: string };

type Message = {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  expenseCreated?: ExpenseCreated;
  pendingExpense?: PendingExpense | null;
  importPreview?: ImportPreviewData | null;
};

/* ─── STT — Web Speech API con interim en el input ─── */
function useWebSpeechInput(
  onFinalResult: (text: string) => void,
  onInterim: (text: string) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const supported =
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported || isRecording) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.lang = 'es-AR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart  = () => setIsRecording(true);
    rec.onend    = () => { setIsRecording(false); onInterim(''); };
    rec.onerror  = () => { setIsRecording(false); onInterim(''); };
    rec.onresult = (e: { results: { isFinal: boolean; [k: number]: { transcript: string } }[] }) => {
      let final = '';
      let inter = '';
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else inter += r[0].transcript;
      }
      if (final) { onInterim(''); onFinalResult(final.trim()); }
      else        { onInterim(inter); }
    };
    recRef.current = rec;
    rec.start();
  }, [supported, isRecording, onFinalResult, onInterim]);

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  return { isRecording, start, stop, supported };
}

/* ─── TTS — browser SpeechSynthesis sin Siri ─── */
function useBrowserSpeaker() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    // prefer es-MX or es-ES — wider system availability than es-AR
    utt.lang = 'es-MX';
    utt.rate = 1.1;
    utt.pitch = 1;
    const spanish = voices.find(
      v => v.lang.startsWith('es') && !v.name.toLowerCase().includes('siri'),
    );
    if (spanish) utt.voice = spanish;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend   = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [supported, voices]);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, cancel, isSpeaking, supported };
}

/* ─── suggestions ─── */
const SUGGESTIONS = [
  { icon: TrendingUp, text: '¿Cuánto gasté este mes?' },
  { icon: PieChart,   text: '¿En qué categoría gasto más?' },
  { icon: Wallet,     text: 'Registrá un gasto por mí' },
];

/* ════════════════════════════════════════════
   AiChat
═══════════════════════════════════════════ */
export default function AiChat() {
  const { close } = useChatOpen();
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [history,         setHistory]         = useState<HistoryMessage[]>([]);
  const [messagesHistory, setMessagesHistory] = useState<unknown[]>([]);
  const [inputValue,      setInputValue]      = useState('');
  const [isTyping,   setIsTyping]   = useState(false);
  const [error,      setError]      = useState(false);
  const [autoSpeak,    setAutoSpeak]    = useState(true);
  const [voicePending, setVoicePending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [allCategories, setAllCategories] = useState<{ id: number; name: string }[]>([]);
  const [importCatId,   setImportCatId]   = useState<number | null>(null);

  useEffect(() => {
    fetch(`${NESTJS_API}/categories`)
      .then(r => r.json())
      .then((cats: { id: number; name: string }[]) => {
        setAllCategories(cats);
        if (cats.length && importCatId === null) setImportCatId(cats[0].id);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelVoiceTimer = useCallback(() => {
    if (voiceTimer.current) { clearTimeout(voiceTimer.current); voiceTimer.current = null; }
    setVoicePending(false);
  }, []);

  /* voice */
  const { speak, cancel, isSpeaking, supported: ttsSupported } = useBrowserSpeaker();

  const handleFinalVoice = useCallback((text: string) => {
    setInputValue(text);
    setVoicePending(true);
    voiceTimer.current = setTimeout(() => {
      setVoicePending(false);
      voiceTimer.current = null;
      sendMessage(text);
    }, 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInterim = useCallback((text: string) => {
    setInputValue(text);
  }, []);

  const { isRecording, start: startRec, stop: stopRec, supported: sttSupported } =
    useWebSpeechInput(handleFinalVoice, handleInterim);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);


  async function sendMessage(text: string) {
    cancelVoiceTimer();
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = { id: Date.now(), text: trimmed, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setError(false);

    try {
      const res = await fetch(`${PYTHON_API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, messages_history: messagesHistory }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setHistory(data.history ?? []);
      setMessagesHistory(data.messages_history ?? []);
      const botMsg: Message = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'bot',
        timestamp: new Date(),
        expenseCreated: data.expense_created ?? null,
        pendingExpense: data.pending_expense ?? null,
      };
      setMessages(prev => [...prev, botMsg]);

      if (data.expense_created?.id) {
        window.dispatchEvent(new CustomEvent('gf:expense-created'));
      }

      if (autoSpeak && data.response) {
        const summary = toSpeechSummary(data.response, data.expense_created);
        setTimeout(() => speak(summary), 80);
      }
    } catch {
      setError(true);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: 'No pude conectarme. Verificá que el servidor Python esté corriendo.',
        sender: 'bot',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  async function uploadFile(file: File) {
    const userMsg: Message = { id: Date.now(), text: `📎 ${file.name}`, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${NESTJS_API}/import/preview`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const preview: ImportPreviewData = await res.json();
      const total = preview.expenses.length + preview.incomes.length;
      const newCount = [...preview.expenses, ...preview.incomes].filter(i => i.status === 'new').length;
      const dupCount = [...preview.expenses, ...preview.incomes].filter(i => i.status === 'possible_duplicate').length;
      const botMsg: Message = {
        id: Date.now() + 1,
        text: `Encontré ${total} movimiento${total !== 1 ? 's' : ''}: ${newCount} nuevo${newCount !== 1 ? 's' : ''}${dupCount > 0 ? `, ${dupCount} posible${dupCount !== 1 ? 's' : ''} duplicado${dupCount !== 1 ? 's' : ''}` : ''}. ¿Los registro?`,
        sender: 'bot',
        timestamp: new Date(),
        importPreview: preview,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e: unknown) {
      setMessages(prev => [...prev, { id: Date.now() + 1, text: `No pude leer el archivo: ${(e as Error).message}`, sender: 'bot', timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function confirmImport(msgId: number, preview: ImportPreviewData) {
    setConfirmingId(msgId);
    try {
      const expenses = preview.expenses.filter(i => i.status !== 'duplicate').map(i => i.data);
      const incomes  = preview.incomes.filter(i => i.status !== 'duplicate').map(i => i.data);
      const res = await fetch(`${NESTJS_API}/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses,
          incomes,
          defaultCategoryId: importCatId ?? 1,
          balanceAmount: preview.balanceAmount,
          balanceDate: preview.balanceDate,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      setMessages(prev => prev.map(m =>
        m.id === msgId
          ? { ...m, importPreview: null, text: `✅ Listo. Se registraron ${result.createdExpenses} gasto${result.createdExpenses !== 1 ? 's' : ''} y ${result.createdIncomes} ingreso${result.createdIncomes !== 1 ? 's' : ''}.` }
          : m,
      ));
      window.dispatchEvent(new CustomEvent('gf:expense-created'));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, importPreview: null } : m));
    } finally {
      setConfirmingId(null);
    }
  }

  async function confirmExpense(msgId: number, expense: PendingExpense) {
    setConfirmingId(msgId);
    try {
      const res = await fetch(`${PYTHON_API}/api/chat/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, pendingExpense: null, expenseCreated: created } : m,
      ));
      window.dispatchEvent(new CustomEvent('gf:expense-created'));
      if (autoSpeak) {
        const currency = expense.moneyType === 'USD' ? 'dólares' : 'pesos';
        setTimeout(() => speak(`Listo, se registró ${expense.description} por ${Number(expense.amount).toLocaleString('es-AR')} ${currency}.`), 80);
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, pendingExpense: null } : m,
      ));
    } finally {
      setConfirmingId(null);
    }
  }

  function cancelExpense(msgId: number) {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, pendingExpense: null } : m,
    ));
  }

  function handleSend(text?: string) {
    sendMessage(text ?? inputValue);
  }

  function toggleMic() {
    if (isRecording) stopRec();
    else startRec();
  }

  function handleClear() {
    setMessages([]);
    setHistory([]);
    setMessagesHistory([]);
    setError(false);
    cancel();
  }

  const displayValue = inputValue;

  return (
    <aside
      className="w-[280px] h-full flex-shrink-0 flex flex-col border-r border-line relative"
      style={{ background: 'rgba(15,17,23,0.5)', backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 flex-shrink-0 relative">
        {/* orb */}
        <div className="relative w-9 h-9 flex-shrink-0">
          <motion.div
            className="absolute inset-0 rounded-full bg-accent/30"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
          />
          <div
            className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-white/15"
            style={{ background: 'radial-gradient(circle at 30% 25%, #B7B0FF 0%, #6C63FF 38%, #3B2FBE 100%)' }}
          >
            <motion.div
              className="absolute inset-0 opacity-60"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              style={{ background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.4), transparent 30%)' }}
            />
            <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-white/70 blur-[1px]" />
          </div>
        </div>

        <div className="leading-tight min-w-0 flex-1">
          <p className="text-text font-semibold text-[13px]">Asistente</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-400 animate-pulse' : error ? 'bg-danger' : 'bg-success breathe'}`} />
            <p className="text-text-muted text-[10px]">
              {isRecording ? 'escuchando…' : error ? 'sin conexión' : 'IA financiera · listo'}
            </p>
          </div>
        </div>

        {/* TTS auto-speak toggle */}
        {ttsSupported && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => { setAutoSpeak(p => !p); if (isSpeaking) cancel(); }}
            title={autoSpeak ? 'Desactivar voz' : 'Activar respuesta por voz'}
            className={`w-7 h-7 grid place-items-center rounded-lg transition-colors ${
              autoSpeak
                ? 'bg-accent/20 text-accent-soft border border-accent/30'
                : 'text-text-dim hover:text-text-muted hover:bg-white/[0.06]'
            }`}
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </motion.button>
        )}

        {messages.length > 0 && (
          <button onClick={handleClear} className="text-[10px] text-text-dim hover:text-text-muted transition-colors">
            limpiar
          </button>
        )}

        <motion.button
          whileHover={{ rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={close}
          aria-label="Cerrar asistente"
          className="w-7 h-7 grid place-items-center rounded-lg text-text-dim hover:text-text-muted hover:bg-white/[0.06] transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      <div className="hairline mx-4" />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3" role="log" aria-live="polite">
        {messages.length === 0 && !isTyping ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 px-1 pt-3">
            <div className="flex flex-col items-center text-center px-2 pb-2">
              <Sparkles className="w-5 h-5 text-accent-soft mb-2" />
              <p className="text-text-soft text-[12px] font-semibold">Hola, ¿en qué te ayudo?</p>
              <p className="text-text-muted text-[10px] leading-relaxed mt-1">
                Escribí o hablá para consultar tus gastos o registrar uno nuevo.
              </p>
              {sttSupported && (
                <p className="text-text-dim text-[9px] mt-2 flex items-center gap-1">
                  <Mic className="w-2.5 h-2.5" /> Podés usar el micrófono
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <motion.button
                    key={s.text}
                    whileHover={{ x: 2, borderColor: 'rgba(108,99,255,0.4)' }}
                    onClick={() => handleSend(s.text)}
                    className="group flex items-center gap-2.5 text-left text-[11px] text-text-soft px-3 py-2.5 rounded-xl bg-white/[0.025] border border-line hover:bg-white/[0.05] hover:text-text transition-all"
                  >
                    <Icon className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-soft transition-colors flex-shrink-0" />
                    <span className="leading-snug">{s.text}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.22 }}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`group relative max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-accent text-white rounded-br-md shadow-[0_4px_16px_-4px_rgba(108,99,255,0.55)]'
                      : 'bg-white/[0.05] text-text-soft rounded-bl-md border border-line'
                  }`}>
                    {msg.text}
                    {/* per-message TTS button */}
                    {msg.sender === 'bot' && ttsSupported && (
                      <button
                        onClick={() => isSpeaking ? cancel() : speak(toSpeechSummary(msg.text, msg.expenseCreated))}
                        className="absolute -right-7 top-1 w-5 h-5 grid place-items-center rounded-md text-text-dim hover:text-accent-soft opacity-0 group-hover:opacity-100 transition-all"
                        title="Escuchar"
                      >
                        {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {msg.importPreview && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 w-full flex flex-col gap-2">
                      {/* Preview list */}
                      <div className="rounded-xl border border-line bg-white/[0.03] overflow-hidden">
                        <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-text-muted" />
                          <span className="text-[11px] text-text-muted font-medium">
                            {msg.importPreview.expenses.length} gastos · {msg.importPreview.incomes.length} ingresos
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {[...msg.importPreview.expenses.slice(0, 6), ...msg.importPreview.incomes.slice(0, 4)].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 border-b border-line/50 last:border-0">
                              {item.status === 'possible_duplicate'
                                ? <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                                : item.status === 'duplicate'
                                  ? <X className="w-3 h-3 text-text-dim flex-shrink-0" />
                                  : <CheckCircle className="w-3 h-3 text-success flex-shrink-0" />}
                              <span className="text-[11px] text-text-soft truncate flex-1">{item.data.description}</span>
                              <span className="text-[10px] text-text-muted flex-shrink-0">
                                ${Number(item.data.amount).toLocaleString('es-AR')}
                              </span>
                            </div>
                          ))}
                          {(msg.importPreview.expenses.length + msg.importPreview.incomes.length) > 10 && (
                            <p className="text-[10px] text-text-dim px-3 py-1.5">
                              + {msg.importPreview.expenses.length + msg.importPreview.incomes.length - 10} más…
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Category picker for expenses */}
                      {allCategories.length > 0 && msg.importPreview!.expenses.length > 0 && (
                        <div className="flex items-center gap-2 px-1 py-1">
                          <span className="text-[10px] text-text-muted whitespace-nowrap">Cat. gastos:</span>
                          <select
                            value={importCatId ?? ''}
                            onChange={e => setImportCatId(Number(e.target.value))}
                            className="flex-1 text-[11px] bg-surface border border-line rounded-lg px-2 py-1 text-text-soft focus:outline-none focus:border-accent/50"
                          >
                            {allCategories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => confirmImport(msg.id, msg.importPreview!)}
                          disabled={confirmingId === msg.id}
                          className="flex-1 h-7 rounded-xl text-[11px] font-semibold bg-success/15 text-success border border-success/25 hover:bg-success/25 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                        >
                          {confirmingId === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Registrar todo
                        </button>
                        <button
                          onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, importPreview: null } : m))}
                          disabled={confirmingId === msg.id}
                          className="flex-1 h-7 rounded-xl text-[11px] text-text-muted border border-line hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {msg.pendingExpense && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 w-full"
                    >
                      <div className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-line mb-2">
                        <p className="text-text text-[12px] font-semibold leading-snug">{msg.pendingExpense.description}</p>
                        <p className="text-text-muted text-[11px] mt-0.5">
                          {msg.pendingExpense.moneyType === 'USD' ? 'U$D' : '$'}{' '}
                          {Number(msg.pendingExpense.amount).toLocaleString('es-AR')}
                          {msg.pendingExpense.categoryName && (
                            <span className="text-text-dim"> · {msg.pendingExpense.categoryName}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => confirmExpense(msg.id, msg.pendingExpense!)}
                          disabled={confirmingId === msg.id}
                          className="flex-1 h-7 rounded-xl text-[11px] font-semibold bg-success/15 text-success border border-success/25 hover:bg-success/25 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                        >
                          {confirmingId === msg.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle className="w-3 h-3" />}
                          Confirmar
                        </button>
                        <button
                          onClick={() => cancelExpense(msg.id)}
                          disabled={confirmingId === msg.id}
                          className="flex-1 h-7 rounded-xl text-[11px] text-text-muted border border-line hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {msg.expenseCreated && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-success/10 border border-success/20 text-success text-[10px] font-semibold"
                    >
                      <CheckCircle className="w-3 h-3 flex-shrink-0" />
                      Gasto registrado ·{' '}
                      {msg.expenseCreated.moneyType === 'USD' ? 'U$D' : '$'}{' '}
                      {Number(msg.expenseCreated.amount).toLocaleString('es-AR')}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-white/[0.05] border border-line px-3 py-2.5 flex items-center gap-1">
                    {[0, 0.15, 0.3].map((d) => (
                      <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-accent-soft"
                        animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Recording / processing indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border bg-red-500/10 border-red-500/20"
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <p className="text-red-400 text-[11px] flex-1 min-w-0">Escuchando… hablá ahora</p>
            <button onClick={stopRec} className="text-red-400/60 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 pt-0 flex-shrink-0">
        {/* Voice-pending progress bar */}
        <AnimatePresence>
          {voicePending && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/8 border border-accent/20"
            >
              <span className="text-accent-soft text-[10px] flex-1">Enviando en un momento… editá para cancelar</span>
              <div className="h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent/60"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.5, ease: 'linear' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-1 rounded-2xl border border-line-2 bg-surface/80 hover:border-white/15 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15 transition-all p-1.5 pl-3.5">
          <Input
            ref={inputRef}
            value={displayValue}
            onChange={(e) => {
              if (isRecording) return;
              cancelVoiceTimer();         // editing cancels the auto-send
              setInputValue(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && !isTyping && !isRecording && handleSend()}
            placeholder="Escribí o usá el micrófono…"
            className={`flex-1 h-8 text-[12px] border-0 bg-transparent focus:bg-transparent focus:ring-0 px-0 ${isRecording ? 'text-text-muted italic' : ''}`}
            disabled={isTyping}
            readOnly={isRecording}
            aria-label="Mensaje"
          />

          {/* File upload */}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            title="Subir Excel o PDF del banco"
            className="h-8 w-8 rounded-xl grid place-items-center flex-shrink-0 text-text-muted hover:text-text hover:bg-white/[0.06] transition-all disabled:opacity-40"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </motion.button>

          {/* Mic button */}
          {sttSupported && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={toggleMic}
              disabled={isTyping}
              title={isRecording ? 'Detener grabación' : 'Hablar'}
              className={`h-8 w-8 rounded-xl grid place-items-center flex-shrink-0 transition-all ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_12px_-2px_rgba(239,68,68,0.4)]'
                  : 'text-text-muted hover:text-text hover:bg-white/[0.06]'
              }`}
            >
              {isRecording
                ? <MicOff className="w-3.5 h-3.5" />
                : <Mic className="w-3.5 h-3.5" />
              }
            </motion.button>
          )}

          {/* Send button */}
          <Button
            onClick={() => handleSend()}
            size="icon"
            disabled={!inputValue.trim() || isTyping || isRecording}
            aria-label="Enviar"
            type="button"
            className="h-8 w-8 rounded-xl flex-shrink-0"
          >
            {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-text-dim text-[9px] mt-2 text-center">Powered by Claude · GastoFácil AI</p>
      </div>
    </aside>
  );
}
