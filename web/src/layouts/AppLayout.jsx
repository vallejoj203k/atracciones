import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Boton } from '../components/ui.jsx';
import { etiquetaRol } from '../lib/formato.js';

const ENLACES = {
  RECEPCION: [
    { a: '/recepcion', texto: 'Recargar' },
    { a: '/recepcion/manillas', texto: 'Manillas' },
    { a: '/recepcion/recargas', texto: 'Recargas' },
  ],
  ADMIN: [
    { a: '/admin', texto: 'Resumen', exacto: true },
    { a: '/recepcion', texto: 'Recargar' },
    { a: '/admin/recargas', texto: 'Recargas' },
    { a: '/admin/manillas', texto: 'Manillas' },
    { a: '/admin/usos', texto: 'Usos' },
    { a: '/admin/atracciones', texto: 'Atracciones' },
    { a: '/admin/usuarios', texto: 'Usuarios' },
    { a: '/admin/configuracion', texto: 'Ajustes' },
  ],
  OPERADOR: [{ a: '/estacion', texto: 'Estacion' }],
};

export const AppLayout = () => {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  const enlaces = ENLACES[usuario?.rol] ?? [];

  const salir = () => {
    cerrarSesion();
    navegar('/login', { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">{usuario?.nombre}</p>
            <p className="truncate text-xs text-slate-500">
              {etiquetaRol(usuario?.rol)}
              {usuario?.atraccion ? ` · ${usuario.atraccion.nombre}` : ''}
            </p>
          </div>
          <Boton variante="secundario" tamano="sm" onClick={salir}>
            Salir
          </Boton>
        </div>

        {enlaces.length > 1 && (
          <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2">
            <div className="flex gap-1">
              {enlaces.map((enlace) => (
                <NavLink
                  key={enlace.a}
                  to={enlace.a}
                  end={enlace.exacto}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-marca-500/15 text-marca-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`
                  }
                >
                  {enlace.texto}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
};
