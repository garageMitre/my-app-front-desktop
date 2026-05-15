import { BrandPanel } from '@/components/auth/BrandPanel';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata = { title: 'Crear cuenta · GastoFácil' };

export default function RegisterPage() {
  return (
    <>
      {/* Panel izquierdo — marca */}
      <BrandPanel />

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.04] blur-[100px]" />
        </div>

        <div className="relative w-full max-w-[380px] flex flex-col gap-8">
          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="h-8 w-8 rounded-xl border border-indigo-400/20 bg-[#080914] overflow-hidden">
              <img src="/logo-icon.png" alt="GastoFácil" className="h-full w-full object-cover" />
            </div>
            <span className="font-extrabold text-text tracking-tight">
              Gasto<span className="text-accent-soft">Fácil</span>
            </span>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-text tracking-tight">Creá tu cuenta</h2>
            <p className="text-text-dim text-sm mt-1.5">Completá los datos para empezar</p>
          </div>

          {/* Form */}
          <RegisterForm />
        </div>
      </div>
    </>
  );
}
