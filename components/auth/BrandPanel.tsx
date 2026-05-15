const FEATURES = [
  'Seguí ingresos, gastos y categorías',
  'Gestión en ARS y USD con cotización oficial',
  'Asistente IA para analizar tus finanzas',
];

export function BrandPanel() {
  return (
    <div className="hidden lg:flex w-[460px] flex-shrink-0 flex-col relative overflow-hidden" style={{ background: '#07080d' }}>
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[480px] h-[480px] -top-32 -left-24 rounded-full bg-accent/[0.12] blur-[110px]" />
        <div className="absolute w-[320px] h-[320px] bottom-0 right-0 rounded-full bg-indigo-400/[0.08] blur-[90px]" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative flex flex-col flex-1 p-10 z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl border border-indigo-400/20 bg-[#080914] shadow-[0_0_20px_-6px_rgba(99,102,241,0.7)] overflow-hidden flex-shrink-0">
            <img src="/logo-icon.png" alt="GastoFácil" className="h-full w-full object-cover" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-text">
            Gasto<span className="text-accent-soft">Fácil</span>
          </span>
        </div>

        {/* Main copy */}
        <div className="flex-1 flex flex-col justify-center gap-6">
          <div>
            <h1 className="text-[38px] font-bold text-text leading-[1.15] tracking-tight">
              Controlá tus<br />
              <span className="text-accent-soft">finanzas</span>,<br />
              tomá el control.
            </h1>
            <p className="text-text-dim text-sm mt-4 leading-relaxed max-w-[300px]">
              Una herramienta simple y poderosa para llevar tus gastos al día, en pesos y dólares.
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-soft mt-1.5 flex-shrink-0" />
                <span className="text-sm text-text-soft leading-snug">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-text-dim/30 tracking-wide">© 2026 GastoFácil</p>
      </div>
    </div>
  );
}
