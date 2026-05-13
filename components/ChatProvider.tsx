'use client';
import { createContext, useCallback, useContext, useState } from 'react';

interface ChatCtxValue { open: boolean; toggle: () => void; close: () => void; }

const ChatCtx = createContext<ChatCtxValue>({ open: true, toggle: () => {}, close: () => {} });

export function useChatOpen() { return useContext(ChatCtx); }

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(o => !o), []);
  const close  = useCallback(() => setOpen(false), []);
  return <ChatCtx.Provider value={{ open, toggle, close }}>{children}</ChatCtx.Provider>;
}
