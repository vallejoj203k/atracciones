import { Navigate, useLocation } from 'react-router-dom';
import { Cargando } from '../components/ui.jsx';
import { rutaInicial, useAuth } from './AuthContext.jsx';

/**
 * Envuelve las rutas privadas. Si el usuario no tiene el rol requerido no se
 * le muestra un 403: se le manda a su pantalla, que es lo unico que le sirve.
 */
export const RutaProtegida = ({ roles, children }) => {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) return <Cargando texto="Verificando sesion..." />;

  if (!usuario) return <Navigate to="/login" state={{ desde: ubicacion.pathname }} replace />;

  if (roles && !roles.includes(usuario.rol)) return <Navigate to={rutaInicial(usuario)} replace />;

  return children;
};
