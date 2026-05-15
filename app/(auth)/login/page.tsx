import { Suspense } from 'react';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = { title: 'Ingresar · GastoFácil' };

export default function LoginPage() {
  return (
    <>
      {/* Panel izquierdo — marca */}
      <BrandPanel />

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Glow de fondo sutil */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.04] blur-[100px]" />
        </div>

        <div className="relative w-full max-w-[360px] flex flex-col gap-8">
          {/* Logo mobile (solo visible sin panel) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="h-9 w-9 rounded-xl border-2 border-accent/30 bg-accent/10 overflow-hidden shadow-[0_0_20px_-4px_rgba(108,99,255,0.5)]">
              <img src="/logo-icon.png" alt="GastoFácil" className="h-full w-full object-cover" />
            </div>
            <span className="font-extrabold text-text tracking-tight">
              Gasto<span className="text-accent-soft">Fácil</span>
            </span>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-text tracking-tight">Bienvenido de vuelta</h2>
            <p className="text-text-dim text-sm mt-1.5">Ingresá tus datos para continuar</p>
          </div>

          {/* Form */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </>
  );
}
