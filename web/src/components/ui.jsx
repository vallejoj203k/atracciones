import { forwardRef } from 'react';

const unir = (...clases) => clases.filter(Boolean).join(' ');

const VARIANTES = {
  primario: 'bg-marca-500 text-slate-950 hover:bg-marca-400 active:bg-marca-600 disabled:bg-slate-700 disabled:text-slate-400',
  secundario:
    'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 disabled:text-slate-500',
  peligro: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 disabled:bg-slate-700 disabled:text-slate-400',
  exito: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-700',
  fantasma: 'bg-transparent text-slate-300 hover:bg-slate-800 active:bg-slate-700',
};

const TAMANOS = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-base rounded-xl',
  // Los botones de recepcion y estacion se pulsan a toda velocidad: 56px de alto.
  lg: 'px-6 py-4 text-lg rounded-2xl min-h-14',
};

export const Boton = forwardRef(
  ({ variante = 'primario', tamano = 'md', className, cargando, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || cargando}
      className={unir(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
        'disabled:cursor-not-allowed',
        VARIANTES[variante],
        TAMANOS[tamano],
        className
      )}
      {...props}
    >
      {cargando && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  )
);
Boton.displayName = 'Boton';

export const Tarjeta = ({ className, children, ...props }) => (
  <div
    className={unir('rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm', className)}
    {...props}
  >
    {children}
  </div>
);

export const Campo = ({ etiqueta, ayuda, error, children, requerido }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-slate-300">
      {etiqueta}
      {requerido && <span className="ml-0.5 text-rose-400">*</span>}
    </span>
    {children}
    {ayuda && !error && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
  </label>
);

const CLASES_ENTRADA =
  'w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-base text-slate-100 ' +
  'placeholder:text-slate-600 focus:border-marca-500 focus:outline-none focus:ring-1 focus:ring-marca-500 ' +
  'disabled:opacity-60';

export const Entrada = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={unir(CLASES_ENTRADA, className)} {...props} />
));
Entrada.displayName = 'Entrada';

export const Selector = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={unir(CLASES_ENTRADA, 'appearance-none', className)} {...props}>
    {children}
  </select>
));
Selector.displayName = 'Selector';

export const AreaTexto = forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={unir(CLASES_ENTRADA, 'min-h-24', className)} {...props} />
));
AreaTexto.displayName = 'AreaTexto';

const TONOS_ETIQUETA = {
  neutro: 'bg-slate-800 text-slate-300 border-slate-700',
  exito: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  aviso: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  peligro: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  marca: 'bg-marca-500/15 text-marca-300 border-marca-500/30',
};

export const Insignia = ({ tono = 'neutro', className, children }) => (
  <span
    className={unir(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      TONOS_ETIQUETA[tono],
      className
    )}
  >
    {children}
  </span>
);

export const Alerta = ({ tono = 'peligro', titulo, children, className }) => (
  <div
    className={unir(
      'rounded-xl border px-4 py-3 text-sm',
      {
        peligro: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
        aviso: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        exito: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        info: 'border-marca-500/40 bg-marca-500/10 text-marca-200',
      }[tono],
      className
    )}
    role={tono === 'peligro' ? 'alert' : 'status'}
  >
    {titulo && <p className="mb-0.5 font-semibold">{titulo}</p>}
    {children}
  </div>
);

export const Cargando = ({ texto = 'Cargando...' }) => (
  <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
    <span className="size-5 animate-spin rounded-full border-2 border-slate-600 border-t-marca-400" aria-hidden />
    {texto}
  </div>
);

export const Vacio = ({ titulo, descripcion, children }) => (
  <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center">
    <p className="font-medium text-slate-300">{titulo}</p>
    {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
    {children && <div className="mt-4 flex justify-center">{children}</div>}
  </div>
);

/** Contenedor con scroll horizontal propio: las tablas no rompen el layout. */
export const TablaContenedor = ({ children }) => (
  <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <div className="inline-block min-w-full align-middle">{children}</div>
  </div>
);
