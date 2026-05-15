'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const PASSWORD_REGEX = /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function RegisterForm() {
  const router = useRouter();

  const [form, setForm]       = useState<FormState>({ firstName: '', lastName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const passwordValid = form.password.length >= 6 && PASSWORD_REGEX.test(form.password);

  function field(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordValid) {
      setError('La contraseña debe tener mínimo 6 caracteres, una mayúscula, una minúscula y un número o símbolo.');
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message[0] : (data?.message ?? 'Error al registrarse');
        setError(msg);
        return;
      }
      const login = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      if (login?.error) { router.push('/login'); return; }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Ocurrió un error. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-text placeholder:text-text-dim/50 text-sm focus:outline-none focus:border-accent/50 focus:bg-white/[0.06] transition-all";

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="w-full flex flex-col gap-5"
    >
      {/* Nombre + Apellido */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-text-soft tracking-wide">Nombre</label>
          <input type="text" required maxLength={120} autoComplete="given-name" placeholder="Juan" value={form.firstName} onChange={field('firstName')} className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-text-soft tracking-wide">Apellido</label>
          <input type="text" required maxLength={120} autoComplete="family-name" placeholder="Pérez" value={form.lastName} onChange={field('lastName')} className={inputClass} />
        </div>
      </div>

      {/* Email */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-text-soft tracking-wide">Correo electrónico</label>
        <input type="email" required autoComplete="email" placeholder="tu@email.com" value={form.email} onChange={field('email')} className={inputClass} />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-text-soft tracking-wide">Contraseña</label>
        <div className="relative">
          <input
            type="password"
            required
            minLength={6}
            maxLength={50}
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            value={form.password}
            onChange={field('password')}
            className={`${inputClass} pr-10`}
          />
          {form.password.length > 0 && passwordValid && (
            <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-success pointer-events-none" />
          )}
        </div>
        <p className="text-[11px] text-text-dim/60 leading-relaxed">
          Una mayúscula · una minúscula · un número o símbolo
        </p>
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
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="text-center text-xs text-text-dim">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-accent-soft hover:text-accent font-semibold transition-colors">
          Iniciá sesión
        </Link>
      </p>
    </motion.form>
  );
}
