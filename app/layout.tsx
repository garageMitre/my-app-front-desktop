import type { Metadata } from 'next';
import './globals.css';
import { ConditionalAppShell } from '@/components/ConditionalAppShell';
import { SessionWrapper } from '@/components/SessionWrapper';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'GastoFácil',
  description: 'Control de gastos personal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn("h-full", "font-sans", geist.variable)}>
      <body className="flex flex-col h-screen overflow-hidden bg-bg text-text antialiased relative">
        <SessionWrapper>
          <ConditionalAppShell>{children}</ConditionalAppShell>
        </SessionWrapper>
      </body>
    </html>
  );
}
