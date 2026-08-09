import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { alPerderSesion, borrarToken, get, guardarToken, leerToken, post } from '../api/client.js';

const AuthContext = createContext(null);

/** Ruta inicial segun el rol: cada trabajador entra directo a lo suyo. */
export const rutaInicial = (usuario) => {
  if (!usuario) return '/login';
  if (usuario.rol === 'ADMIN') return '/admin';
  if (usuario.rol === 'RECEPCION') return '/recepcion';
  return '/estacion';
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cerrarSesion = useCallback(() => {
    borrarToken();
    setUsuario(null);
  }, []);

  // Si el backend responde 401 en cualquier punto, se limpia la sesion local.
  useEffect(() => alPerderSesion(() => setUsuario(null)), []);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      // Sin token guardado no hay nada que validar: preguntarle al servidor
      // solo produciria un 401 seguro en cada visita a la pantalla de login.
      if (!leerToken()) {
        setCargando(false);
        return;
      }

      try {
        const datos = await get('/auth/me');
        if (!cancelado) setUsuario(datos.usuario);
      } catch {
        if (!cancelado) setUsuario(null);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const iniciarSesion = useCallback(async (username, password) => {
    const datos = await post('/auth/login', { username, password });
    guardarToken(datos.token);
    setUsuario(datos.usuario);
    return datos.usuario;
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      refrescar: async () => {
        const datos = await get('/auth/me');
        setUsuario(datos.usuario);
        return datos.usuario;
      },
      esAdmin: usuario?.rol === 'ADMIN',
      esRecepcion: usuario?.rol === 'RECEPCION',
      esOperador: usuario?.rol === 'OPERADOR',
    }),
    [usuario, cargando, iniciarSesion, cerrarSesion]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return contexto;
};
