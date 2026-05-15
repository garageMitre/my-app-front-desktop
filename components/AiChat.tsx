'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp, Bell, Bot, CheckCircle, FileSpreadsheet,
  Loader2, Mic, MicOff, Paperclip, PieChart, Sparkles,
  TrendingUp, Volume2, VolumeX, Wallet, X, AlertTriangle,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useChatOpen } from './ChatProvider';
import { useSession } from 'next-auth/react';

const PYTHON_API = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? '/api/python';
const NESTJS_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/* ─── voice helpers ─── */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\$\s*([\d.,]+)/g, (_, n) => n.replace(/\./g, ' ') + ' pesos')
    .replace(/U\$D\s*([\d.,]+)/g, (_, n) => n.replace(/\./g, ' ') + ' dólares')
    .replace(/USD\s*([\d.,]+)/g, (_, n) => n.replace(/\./g, ' ') + ' dólares')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_~`#>|\\[\]]/g, '')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function toSpeechSummary(text: string, expense?: ExpenseCreated): string {
  if (expense) {
    const currency = expense.moneyType === 'USD' ? 'dólares' : 'pesos';
    const amount = Number(expense.amount).toLocaleString('es-AR').replace(/\./g, ' ');
    return `Registré ${expense.description} por ${amount} ${currency}.`;
  }
  const clean = cleanForSpeech(text);
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let summary = '';
  for (const s of sentences.slice(0, 3)) {
    summary += s;
    if (summary.length > 300) break;
  }
  return (summary || clean.slice(0, 300)).trim();
}

/* ─── markdown renderer ─── */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>
      : part
  );
}

function renderTable(tableLines: string[], key: string): ReactNode {
  const rows = tableLines
    .filter(l => !/^\|[-:| ]+\|$/.test(l))
    .map(l => l.split('|').slice(1, -1).map(c => c.trim()));
  if (rows.length < 2) return null;
  const [header, ...body] = rows;
  return (
    <div key={key} className="rounded-lg border border-line overflow-x-auto my-1">
      <table className="w-full text-[11px]">
        <thead className="bg-white/[0.05]">
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="px-2.5 py-1.5 text-left font-semibold text-text-muted border-b border-line whitespace-nowrap">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? 'bg-white/[0.02]' : ''}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-2.5 py-1.5 text-text-soft border-b border-line/30 last:border-0">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBotText(text: string): ReactNode {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let tableLines: string[] = [];

  const flushList = (key: string) => {
    if (!listItems.length) return;
    elements.push(
      <ul key={key} className="flex flex-col gap-1 my-0.5">
        {listItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-[5px] w-1 h-1 rounded-full bg-accent/70 flex-shrink-0" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushTable = (key: string) => {
    if (!tableLines.length) return;
    const node = renderTable(tableLines, key);
    if (node) elements.push(node);
    tableLines = [];
  };

  lines.forEach((line, i) => {
    const isTableRow = /^\|.+\|$/.test(line.trim());
    if (isTableRow) {
      flushList(`ul-${i}`);
      tableLines.push(line.trim());
    } else if (/^[-*•]\s+/.test(line)) {
      flushTable(`tbl-${i}`);
      listItems.push(line.replace(/^[-*•]\s+/, ''));
    } else {
      flushList(`ul-${i}`);
      flushTable(`tbl-${i}`);
      if (line.trim()) {
        elements.push(<p key={i}>{renderInline(line)}</p>);
      } else if (elements.length > 0) {
        elements.push(<div key={`sp-${i}`} className="h-1" />);
      }
    }
  });
  flushList('ul-end');
  flushTable('tbl-end');

  return <div className="flex flex-col gap-1">{elements}</div>;
}

/* ─── types ─── */
type ExpenseCreated = { description: string; amount: number; moneyType: string } | null | undefined;
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
type PendingReminder = {
  proposed: boolean;
  description: string;
  remindAt: string;
  notifyBeforeMinutes?: number;
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
  pendingReminder?: PendingReminder | null;
  importPreview?: ImportPreviewData | null;
};

/* ─── STT ─── */
function useWebSpeechInput(onFinal: (t: string) => void, onInterim: (t: string) => void) {
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
      let final = '', inter = '';
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else inter += r[0].transcript;
      }
      if (final) { onInterim(''); onFinal(final.trim()); }
      else { onInterim(inter); }
    };
    recRef.current = rec;
    rec.start();
  }, [supported, isRecording, onFinal, onInterim]);

  const stop = useCallback(() => { recRef.current?.stop(); }, []);
  return { isRecording, start, stop, supported };
}

/* ─── TTS ─── */
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
    utt.lang = 'es-AR';
    utt.rate = 1.0;
    utt.pitch = 1;
    const notSiri = (v: SpeechSynthesisVoice) => !v.name.toLowerCase().includes('siri');
    utt.voice =
      voices.find(v => v.lang === 'es-AR' && notSiri(v)) ??
      voices.find(v => v.lang === 'es-MX' && notSiri(v)) ??
      voices.find(v => v.lang === 'es-ES' && notSiri(v)) ??
      voices.find(v => v.lang.startsWith('es') && notSiri(v)) ??
      null;
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
  const { data: session } = useSession();

  const [messages,        setMessages]        = useState<Message[]>([]);
  const [history,         setHistory]         = useState<HistoryMessage[]>([]);
  const [messagesHistory, setMessagesHistory] = useState<unknown[]>([]);
  const [inputValue,      setInputValue]      = useState('');
  const [isTyping,        setIsTyping]        = useState(false);
  const [error,           setError]           = useState(false);
  const [autoSpeak,       setAutoSpeak]       = useState(true);
  const [voicePending,    setVoicePending]    = useState(false);
  const [confirmingId,    setConfirmingId]    = useState<number | null>(null);
  const [allCategories,   setAllCategories]   = useState<{ id: number; name: string }[]>([]);
  const [importCatId,     setImportCatId]     = useState<number | null>(null);

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

  const handleInterim = useCallback((text: string) => { setInputValue(text); }, []);

  const { isRecording, start: startRec, stop: stopRec, supported: sttSupported } =
    useWebSpeechInput(handleFinalVoice, handleInterim);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  function updateExpenseCategory(msgId: number, catId: number) {
    const cat = allCategories.find(c => c.id === catId);
    setMessages(prev => prev.map(m =>
      m.id === msgId && m.pendingExpense
        ? { ...m, pendingExpense: { ...m.pendingExpense, categoryId: catId, categoryName: cat?.name } }
        : m,
    ));
  }

  async function sendMessage(text: string) {
    cancelVoiceTimer();
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    setMessages(prev => [...prev, { id: Date.now(), text: trimmed, sender: 'user', timestamp: new Date() }]);
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
        expenseCreated:  data.expense_created  ?? null,
        pendingExpense:  data.pending_expense  ?? null,
        pendingReminder: data.pending_reminder ?? null,
      };
      setMessages(prev => [...prev, botMsg]);
      if (data.expense_created?.id) window.dispatchEvent(new CustomEvent('gf:expense-created'));
      if (autoSpeak && data.response) {
        setTimeout(() => speak(toSpeechSummary(data.response, data.expense_created)), 80);
      }
    } catch {
      setError(true);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: 'No pude conectarme. Verificá que el servidor esté activo.',
        sender: 'bot',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  async function uploadFile(file: File) {
    setMessages(prev => [...prev, { id: Date.now(), text: `📎 ${file.name}`, sender: 'user', timestamp: new Date() }]);
    setIsTyping(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${NESTJS_API}/import/preview`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const preview: ImportPreviewData = await res.json();
      const total    = preview.expenses.length + preview.incomes.length;
      const newCount = [...preview.expenses, ...preview.incomes].filter(i => i.status === 'new').length;
      const dupCount = [...preview.expenses, ...preview.incomes].filter(i => i.status === 'possible_duplicate').length;
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: `Encontré ${total} movimiento${total !== 1 ? 's' : ''}: ${newCount} nuevo${newCount !== 1 ? 's' : ''}${dupCount > 0 ? `, ${dupCount} posible${dupCount !== 1 ? 's' : ''} duplicado${dupCount !== 1 ? 's' : ''}` : ''}. ¿Los registro?`,
        sender: 'bot',
        timestamp: new Date(),
        importPreview: preview,
      }]);
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
        body: JSON.stringify({ expenses, incomes, defaultCategoryId: importCatId ?? 1, balanceAmount: preview.balanceAmount, balanceDate: preview.balanceDate }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      setMessages(prev => prev.map(m =>
        m.id === msgId
          ? { ...m, importPreview: null, text: `Se registraron ${result.createdExpenses} gasto${result.createdExpenses !== 1 ? 's' : ''} y ${result.createdIncomes} ingreso${result.createdIncomes !== 1 ? 's' : ''}.` }
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
        const amount   = Number(expense.amount).toLocaleString('es-AR').replace(/\./g, ' ');
        setTimeout(() => speak(`Registré ${expense.description} por ${amount} ${currency}.`), 80);
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingExpense: null } : m));
    } finally {
      setConfirmingId(null);
    }
  }

  function cancelExpense(msgId: number) {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingExpense: null } : m));
  }

  async function confirmReminder(msgId: number, reminder: PendingReminder) {
    setConfirmingId(msgId);
    try {
      const res = await fetch(`${PYTHON_API}/api/chat/confirm-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reminder, email: session?.user?.email }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, pendingReminder: null, text: m.text + '\n\nRecordatorio creado correctamente.' } : m,
      ));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingReminder: null } : m));
    } finally {
      setConfirmingId(null);
    }
  }

  function cancelReminder(msgId: number) {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingReminder: null } : m));
  }

  function handleSend(text?: string) { sendMessage(text ?? inputValue); }
  function toggleMic() { if (isRecording) stopRec(); else startRec(); }
  function handleClear() {
    setMessages([]); setHistory([]); setMessagesHistory([]); setError(false); cancel();
  }

  /* ── render ── */
  return (
    <aside
      className="w-[320px] h-full flex-shrink-0 flex flex-col border-r border-line relative overflow-hidden"
      style={{ background: 'rgba(9,10,17,0.95)', backdropFilter: 'blur(24px)' }}
    >
      {/* ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-accent/[0.07] blur-[70px] pointer-events-none" />

      {/* ── Header ── */}
      <div className="relative px-4 pt-4 pb-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 grid place-items-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-accent-soft" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text leading-none">Asistente IA</p>
          <div className="flex items-center gap-1.5 mt-[5px]">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isRecording ? 'bg-red-400 animate-pulse' : error ? 'bg-danger' : 'bg-emerald-400'
            }`} />
            <p className="text-[10px] text-text-dim truncate">
              {isRecording ? 'Escuchando…' : error ? 'Sin conexión' : 'GastoFácil AI · listo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {ttsSupported && (
            <button
              onClick={() => { setAutoSpeak(p => !p); if (isSpeaking) cancel(); }}
              title={autoSpeak ? 'Silenciar' : 'Activar voz'}
              className={`w-7 h-7 grid place-items-center rounded-lg transition-colors ${
                autoSpeak ? 'text-accent-soft bg-accent/10' : 'text-text-dim hover:text-text-muted hover:bg-white/[0.05]'
              }`}
            >
              {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="Limpiar conversación"
              className="w-7 h-7 grid place-items-center rounded-lg text-text-dim hover:text-text-muted hover:bg-white/[0.05] transition-colors text-[9px]"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M6 4V2h4v2M3 4l1 9h8l1-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={close}
            aria-label="Cerrar asistente"
            className="w-7 h-7 grid place-items-center rounded-lg text-text-dim hover:text-text-muted hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="hairline mx-4" />

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 scroll-smooth" role="log" aria-live="polite">
        {messages.length === 0 && !isTyping ? (
          /* ── Empty state ── */
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 pt-2">
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/25 grid place-items-center mb-1">
                <Sparkles className="w-7 h-7 text-accent-soft" />
              </div>
              <p className="text-[15px] font-semibold text-text">¿En qué te ayudo?</p>
              <p className="text-[12px] text-text-dim leading-relaxed max-w-[210px]">
                Consultá tus finanzas, registrá gastos o creá recordatorios con texto o voz.
              </p>
              {sttSupported && (
                <span className="flex items-center gap-1 text-[10px] text-text-dim/70 mt-1">
                  <Mic className="w-2.5 h-2.5" /> Podés usar el micrófono
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-text-dim/60 uppercase tracking-widest px-1">Sugerencias</p>
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <motion.button
                    key={s.text}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSend(s.text)}
                    className="group flex items-center gap-3 text-left px-3 py-3 rounded-xl bg-white/[0.03] border border-line hover:border-accent/30 hover:bg-accent/[0.05] transition-all"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-line grid place-items-center flex-shrink-0 group-hover:bg-accent/10 group-hover:border-accent/25 transition-all">
                      <Icon className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-soft transition-colors" />
                    </div>
                    <span className="text-[12px] text-text-soft group-hover:text-text transition-colors leading-snug">{s.text}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* ── Conversation ── */
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {/* Bot message */}
                  {msg.sender === 'bot' && (
                    <div className="flex items-start gap-2 w-full max-w-[95%]">
                      <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/25 grid place-items-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-accent-soft" />
                      </div>
                      <div className="group flex-1 min-w-0">
                        <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-white/[0.05] border border-white/[0.08] text-[13px] text-text-soft leading-relaxed">
                          {renderBotText(msg.text)}
                        </div>
                        <div className="flex items-center justify-between mt-1 px-0.5">
                          <span className="text-[9px] text-text-dim/60">
                            {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {ttsSupported && (
                            <button
                              onClick={() => isSpeaking ? cancel() : speak(toSpeechSummary(msg.text, msg.expenseCreated))}
                              className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-accent-soft transition-all"
                              title="Escuchar"
                            >
                              {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User message */}
                  {msg.sender === 'user' && (
                    <div className="max-w-[85%]">
                      <div className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 bg-accent text-white text-[13px] leading-relaxed shadow-[0_4px_20px_-6px_rgba(108,99,255,0.6)]">
                        {msg.text}
                      </div>
                      <p className="text-[9px] text-text-dim/60 mt-1 text-right">
                        {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}

                  {/* ── Import preview ── */}
                  {msg.importPreview && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 ml-8 w-[calc(100%-2rem)] flex flex-col gap-2">
                      <div className="rounded-xl border border-line bg-white/[0.03] overflow-hidden">
                        <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-text-muted" />
                          <span className="text-[11px] text-text-muted font-medium">
                            {msg.importPreview.expenses.length} gastos · {msg.importPreview.incomes.length} ingresos
                          </span>
                        </div>
                        <div className="max-h-36 overflow-y-auto">
                          {[...msg.importPreview.expenses.slice(0, 5), ...msg.importPreview.incomes.slice(0, 3)].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 border-b border-line/40 last:border-0">
                              {item.status === 'possible_duplicate'
                                ? <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                                : item.status === 'duplicate'
                                  ? <X className="w-3 h-3 text-text-dim flex-shrink-0" />
                                  : <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                              <span className="text-[11px] text-text-soft truncate flex-1">{item.data.description}</span>
                              <span className="text-[10px] text-text-muted flex-shrink-0">${Number(item.data.amount).toLocaleString('es-AR')}</span>
                            </div>
                          ))}
                          {(msg.importPreview.expenses.length + msg.importPreview.incomes.length) > 8 && (
                            <p className="text-[10px] text-text-dim px-3 py-1.5">
                              + {msg.importPreview.expenses.length + msg.importPreview.incomes.length - 8} más…
                            </p>
                          )}
                        </div>
                      </div>
                      {allCategories.length > 0 && msg.importPreview.expenses.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted whitespace-nowrap">Categoría</span>
                          <select
                            value={importCatId ?? ''}
                            onChange={e => setImportCatId(Number(e.target.value))}
                            className="flex-1 text-[11px] bg-surface border border-line rounded-lg px-2 py-1 text-text-soft focus:outline-none focus:border-accent/50"
                          >
                            {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => confirmImport(msg.id, msg.importPreview!)}
                          disabled={confirmingId === msg.id}
                          className="flex-1 h-8 rounded-xl text-[12px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                          {confirmingId === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Registrar todo
                        </button>
                        <button
                          onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, importPreview: null } : m))}
                          disabled={confirmingId === msg.id}
                          className="h-8 px-3 rounded-xl text-[12px] text-text-muted border border-line hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Pending expense ── */}
                  {msg.pendingExpense && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 ml-8 w-[calc(100%-2rem)]">
                      <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] overflow-hidden">
                        <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.06]">
                          <p className="text-[10px] font-semibold text-accent-soft/70 uppercase tracking-widest mb-2">Confirmar gasto</p>
                          <p className="text-text font-semibold text-[14px] leading-snug mb-0.5">{msg.pendingExpense.description}</p>
                          <p className="text-[20px] font-bold text-accent-soft tracking-tight">
                            {msg.pendingExpense.moneyType === 'USD' ? 'U$D' : '$'} {Number(msg.pendingExpense.amount).toLocaleString('es-AR')}
                          </p>
                          {msg.pendingExpense.date && (
                            <p className="text-text-dim text-[11px] mt-1">
                              {new Date(msg.pendingExpense.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                            </p>
                          )}
                        </div>
                        {allCategories.length > 0 && (
                          <div className="px-4 py-3 flex items-center gap-3">
                            <span className="text-[11px] text-text-muted font-medium whitespace-nowrap">Categoría</span>
                            <select
                              value={msg.pendingExpense.categoryId || ''}
                              onChange={e => updateExpenseCategory(msg.id, Number(e.target.value))}
                              className="flex-1 text-[12px] bg-bg border border-line rounded-lg px-2.5 py-1.5 text-text-soft focus:outline-none focus:border-accent/50 transition-colors"
                            >
                              {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => confirmExpense(msg.id, msg.pendingExpense!)}
                          disabled={confirmingId === msg.id}
                          className="flex-1 h-9 rounded-xl text-[13px] font-semibold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-[0_4px_20px_-6px_rgba(108,99,255,0.55)]"
                        >
                          {confirmingId === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Confirmar
                        </button>
                        <button
                          onClick={() => cancelExpense(msg.id)}
                          disabled={confirmingId === msg.id}
                          className="h-9 px-4 rounded-xl text-[13px] text-text-muted border border-line hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Pending reminder ── */}
                  {msg.pendingReminder && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 ml-8 w-[calc(100%-2rem)]">
                      <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <Bell className="w-3.5 h-3.5 text-accent-soft" />
                          <p className="text-[10px] font-semibold text-accent-soft/70 uppercase tracking-widest">Nuevo recordatorio</p>
                        </div>
                        <p className="text-text font-medium text-[13px] leading-snug">{msg.pendingReminder.description}</p>
                        <p className="text-text-muted text-[11px] mt-1.5">
                          {new Date(msg.pendingReminder.remindAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                          {msg.pendingReminder.notifyBeforeMinutes != null && (
                            <span className="text-text-dim"> · aviso {msg.pendingReminder.notifyBeforeMinutes} min antes</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => confirmReminder(msg.id, msg.pendingReminder!)}
                          disabled={confirmingId === msg.id}
                          className="flex-1 h-9 rounded-xl text-[13px] font-semibold bg-accent/15 text-accent-soft border border-accent/25 hover:bg-accent/25 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          {confirmingId === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                          Crear recordatorio
                        </button>
                        <button
                          onClick={() => cancelReminder(msg.id)}
                          disabled={confirmingId === msg.id}
                          className="h-9 px-4 rounded-xl text-[13px] text-text-muted border border-line hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Expense created badge ── */}
                  {msg.expenseCreated && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 ml-8 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium"
                    >
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      Gasto registrado ·{' '}
                      {msg.expenseCreated.moneyType === 'USD' ? 'U$D' : '$'}{' '}
                      {Number(msg.expenseCreated.amount).toLocaleString('es-AR')}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/25 grid place-items-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-accent-soft" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white/[0.05] border border-white/[0.08] px-4 py-3 flex items-center gap-1.5">
                    {[0, 0.15, 0.3].map((d) => (
                      <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-accent/60"
                        animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Recording indicator */}
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

      {/* ── Input ── */}
      <div className="px-3 pb-3 pt-2 flex-shrink-0">
        <AnimatePresence>
          {voicePending && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/[0.08] border border-accent/20"
            >
              <span className="text-accent-soft text-[10px] flex-1">Enviando… editá para cancelar</span>
              <div className="h-1 w-14 rounded-full bg-white/[0.06] overflow-hidden">
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

        <div className="flex items-center gap-1 rounded-2xl border border-line bg-white/[0.04] hover:border-white/[0.12] focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/10 transition-all p-1.5 pl-3.5">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              if (isRecording) return;
              cancelVoiceTimer();
              setInputValue(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && !isTyping && !isRecording && handleSend()}
            placeholder={isRecording ? 'Escuchando…' : 'Escribí o hablá…'}
            className={`flex-1 h-8 text-[13px] border-0 bg-transparent focus:bg-transparent focus:ring-0 px-0 ${isRecording ? 'text-text-muted italic' : ''}`}
            disabled={isTyping}
            readOnly={isRecording}
            aria-label="Mensaje"
          />

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            title="Subir archivo"
            className="h-8 w-8 rounded-xl grid place-items-center text-text-muted hover:text-text hover:bg-white/[0.06] transition-all disabled:opacity-40 flex-shrink-0"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          {sttSupported && (
            <button
              onClick={toggleMic}
              disabled={isTyping}
              title={isRecording ? 'Detener' : 'Hablar'}
              className={`h-8 w-8 rounded-xl grid place-items-center flex-shrink-0 transition-all ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-text-muted hover:text-text hover:bg-white/[0.06]'
              }`}
            >
              {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

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
        <p className="text-[9px] text-text-dim/40 mt-1.5 text-center">GastoFácil AI · Claude</p>
      </div>
    </aside>
  );
}
