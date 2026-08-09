import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { rutaInicial, useAuth } from './auth/AuthContext.jsx';
import { RutaProtegida } from './auth/RutaProtegida.jsx';
import { Cargando } from './components/ui.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import { Login } from './pages/Login.jsx';

// Carga diferida por pantalla. Importa: la tablet de una atraccion solo baja
// el lector de QR, nunca las librerias de graficas del panel de administracion,
// que pesan mas que todo lo demas junto.
const Estacion = lazy(() => import('./pages/estacion/Estacion.jsx').then((m) => ({ default: m.Estacion })));
const Recarga = lazy(() => import('./pages/recepcion/Recarga.jsx').then((m) => ({ default: m.Recarga })));
const Manillas = lazy(() => import('./pages/manillas/Manillas.jsx').then((m) => ({ default: m.Manillas })));
const Recargas = lazy(() => import('./pages/recargas/Recargas.jsx').then((m) => ({ default: m.Recargas })));
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx').then((m) => ({ default: m.Dashboard })));
const Atracciones = lazy(() => import('./pages/admin/Atracciones.jsx').then((m) => ({ default: m.Atracciones })));
const Usuarios = lazy(() => import('./pages/admin/Usuarios.jsx').then((m) => ({ default: m.Usuarios })));
const Usos = lazy(() => import('./pages/admin/Usos.jsx').then((m) => ({ default: m.Usos })));
const Configuracion = lazy(() =>
  import('./pages/admin/Configuracion.jsx').then((m) => ({ default: m.Configuracion }))
);

const TODOS = ['ADMIN', 'RECEPCION', 'OPERADOR'];
const CAJA = ['ADMIN', 'RECEPCION'];
const SOLO_ADMIN = ['ADMIN'];

/** Ruta privada con su propio Suspense, para no parpadear toda la app. */
const Privada = ({ roles, children }) => (
  <RutaProtegida roles={roles}>
    <Suspense fallback={<Cargando />}>{children}</Suspense>
  </RutaProtegida>
);

export const App = () => {
  const { usuario, cargando } = useAuth();

  if (cargando) return <Cargando texto="Abriendo el sistema..." />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* La estacion vive fuera del layout: es pantalla completa, sin menus. */}
      <Route
        path="/estacion"
        element={
          <Privada roles={TODOS}>
            <Estacion />
          </Privada>
        }
      />

      <Route
        element={
          <RutaProtegida>
            <AppLayout />
          </RutaProtegida>
        }
      >
        <Route
          path="/recepcion"
          element={
            <Privada roles={CAJA}>
              <Recarga />
            </Privada>
          }
        />
        <Route
          path="/recepcion/manillas"
          element={
            <Privada roles={CAJA}>
              <Manillas />
            </Privada>
          }
        />
        <Route
          path="/recepcion/recargas"
          element={
            <Privada roles={CAJA}>
              <Recargas />
            </Privada>
          }
        />

        <Route
          path="/admin"
          element={
            <Privada roles={SOLO_ADMIN}>
              <Dashboard />
            </Privada>
          }
        />
        <Route
          path="/admin/manillas"
          element={
            <Privada roles={SOLO_ADMIN}>
              <Manillas />
            </Privada>
          }
        />
        <Route
          path="/admin/recargas"
          element={
            <Privada roles={SOLO_ADMIN}>
              <Recargas />
            </Privada>
          }
        />
        <Route
          path="/admin/usos"
          element={
            <Privada roles={SOLO_ADMIN}>
              <Usos />
            </Privada>
          }
        />
        <Route
          path="/admin/atracciones"
          element={
            <Privada roles={SOLO_ADMIN}>
              <Atracciones />
            </Privada>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <Privada roles={SOLO_ADMIN}>
              <Usuarios />
            </Privada>
          }
        />
        <Route
          path="/admin/configuracion"
          element={
            <Privada roles={SOLO_ADMIN}>
              <Configuracion />
            </Privada>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to={rutaInicial(usuario)} replace />} />
      <Route path="*" element={<Navigate to={rutaInicial(usuario)} replace />} />
    </Routes>
  );
};
