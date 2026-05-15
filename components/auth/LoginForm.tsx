'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (res?.error) { setError('Email o contraseña incorrectos.'); return; }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('Ocurrió un error. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="w-full flex flex-col gap-5"
    >
      {/* Email */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-text-soft tracking-wide">
          Correo electrónico
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text placeholder:text-text-dim/50 text-sm focus:outline-none focus:border-accent/50 focus:bg-white/[0.06] transition-all"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-text-soft tracking-wide">
          Contraseña
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text placeholder:text-text-dim/50 text-sm focus:outline-none focus:border-accent/50 focus:bg-white/[0.06] transition-all"
        />
      </div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-danger bg-danger/[0.08] border border-danger/20 rounded-xl px-4 py-3"
        >
          {error}
        </motion.p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent hover:bg-accent-soft font-semibold text-white text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Ingresando…' : 'Ingresar'}
      </button>

      <p className="text-center text-xs text-text-dim">
        ¿No tenés cuenta?{' '}
        <Link href="/register" className="text-accent-soft hover:text-accent font-semibold transition-colors">
          Registrate gratis
        </Link>
      </p>
    </motion.form>
  );
}
