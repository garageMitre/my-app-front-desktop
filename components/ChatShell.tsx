'use client';
import { useChatOpen } from './ChatProvider';
import AiChat from './AiChat';

// Wraps AiChat in a width-transitioning container.
// Using a CSS transition (not framer-motion layout) so the flex siblings
// expand smoothly without any DOM layout snap.
export function ChatShell() {
  const { open } = useChatOpen();
  return (
    <div
      className="flex-shrink-0 overflow-hidden h-full"
      style={{
        width: open ? 320 : 0,
        transition: 'width 320ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      aria-hidden={!open}
    >
      <AiChat />
    </div>
  );
}
