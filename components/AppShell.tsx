'use client';
import { ChatProvider } from './ChatProvider';
import { ChatShell } from './ChatShell';
import { ToastProvider } from './ui/toaster';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <ToastProvider>
        {/* ambient page blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="blob bg-accent/[0.06]" style={{ width: 720, height: 720, top: -200, left: '20%' }} />
          <div className="blob bg-info/[0.04]"   style={{ width: 520, height: 520, bottom: -180, right: -120 }} />
        </div>

        <TopBar />

        <div className="flex flex-1 min-h-0">
          <ChatShell />
          <main className="flex-1 overflow-hidden min-h-0 relative">{children}</main>
        </div>

        <Sidebar />
      </ToastProvider>
    </ChatProvider>
  );
}
