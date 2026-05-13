import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtARS(n: unknown, opts?: { maxFrac?: number }) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: opts?.maxFrac ?? 0,
  }).format(Number(n) || 0);
}

export function fmtNum(n: unknown) {
  return new Intl.NumberFormat('es-AR').format(Number(n) || 0);
}