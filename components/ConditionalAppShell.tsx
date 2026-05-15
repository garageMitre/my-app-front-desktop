'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

const AUTH_ROUTES = ['/login', '/register'];

export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (AUTH_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
