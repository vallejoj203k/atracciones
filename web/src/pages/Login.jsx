import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { rutaInicial, useAuth } from '../auth/AuthContext.jsx';
import { Alerta, Boton, Campo, Entrada, Tarjeta } from '../components/ui.jsx';

export const Login = () => {
  const { usuario, cargando, iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!cargando && usuario) return <Navigate to={rutaInicial(usuario)} replace />;

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const autenticado = await iniciarSesion(username.trim(), password);
      // Cada rol aterriza en su pantalla: recepcion no ve el panel y el
      // operador entra directo a escanear.
      navegar(ubicacion.state?.desde || rutaInicial(autenticado), { replace: true });
    } catch (fallo) {
      setError(fallo.message || 'No se pudo iniciar sesion');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/icono.svg" alt="" className="mx-auto mb-3 size-16 rounded-2xl" />
          <h1 className="text-2xl font-bold text-slate-100">Mirador</h1>
          <p className="mt-1 text-sm text-slate-500">Control de atracciones</p>
        </div>

        <Tarjeta className="p-5">
          <form onSubmit={enviar} className="space-y-4">
            <Campo etiqueta="Usuario" requerido>
              <Entrada
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="recepcion"
              />
            </Campo>

            <Campo etiqueta="Contrasena" requerido>
              <Entrada
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Campo>

            {error && <Alerta tono="peligro">{error}</Alerta>}

            <Boton type="submit" tamano="lg" className="w-full" cargando={enviando}>
              Entrar
            </Boton>
          </form>
        </Tarjeta>

        <p className="mt-6 text-center text-xs text-slate-600">
          Tu rol define la pantalla a la que entras: recepcion recarga puntos, el operador escanea manillas y el
          administrador ve los reportes.
        </p>
      </div>
    </div>
  );
};
