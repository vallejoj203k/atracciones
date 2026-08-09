import { useCallback, useEffect, useState } from 'react';
import { del, get, patch, post } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  Alerta,
  Boton,
  Campo,
  Cargando,
  Entrada,
  Insignia,
  Selector,
  TablaContenedor,
  Tarjeta,
} from '../../components/ui.jsx';
import { etiquetaRol, fechaHora } from '../../lib/formato.js';

const VACIO = { nombre: '', username: '', password: '', rol: 'OPERADOR', atraccionId: '', activo: true };

/**
 * El backend solo acepta letras sin tildes, numeros, punto, guion y guion bajo.
 * En vez de dejar que el trabajador escriba "José Pérez" y reciba un error al
 * guardar, se corrige mientras teclea: "jose.perez".
 */
const normalizarUsername = (valor) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');

/**
 * Gestion de trabajadores. Cada operador se ata a una atraccion: su login solo
 * abre la estacion de esa atraccion, no puede registrar accesos en otra.
 */
export const Usuarios = () => {
  const { usuario: yo } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [atracciones, setAtracciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [respUsuarios, respAtracciones] = await Promise.all([get('/usuarios'), get('/atracciones')]);
      setUsuarios(respUsuarios.usuarios);
      setAtracciones(respAtracciones.atracciones);
      setError('');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setError('');

    const cuerpo = {
      nombre: formulario.nombre.trim(),
      username: formulario.username.trim().toLowerCase(),
      rol: formulario.rol,
      activo: formulario.activo,
      atraccionId: formulario.rol === 'OPERADOR' ? formulario.atraccionId || null : null,
    };
    // En edicion, la contrasena solo viaja si el admin escribio una nueva.
    if (formulario.password) cuerpo.password = formulario.password;

    try {
      if (formulario.id) await patch(`/usuarios/${formulario.id}`, cuerpo);
      else await post('/usuarios', cuerpo);
      setFormulario(null);
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (usuario) => {
    if (!window.confirm(`Desactivar a ${usuario.nombre}? No podra iniciar sesion.`)) return;
    setError('');
    try {
      await del(`/usuarios/${usuario.id}`);
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  };

  const reactivar = async (usuario) => {
    setError('');
    try {
      await patch(`/usuarios/${usuario.id}`, { activo: true });
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  };

  if (cargando) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Usuarios</h1>
          <p className="text-sm text-slate-500">{usuarios.length} trabajadores</p>
        </div>
        <Boton onClick={() => setFormulario({ ...VACIO })}>Nuevo usuario</Boton>
      </div>

      {error && <Alerta tono="peligro">{error}</Alerta>}

      {formulario && (
        <Tarjeta>
          <form onSubmit={guardar} className="space-y-3">
            <h2 className="font-semibold text-slate-200">
              {formulario.id ? `Editar ${formulario.nombre}` : 'Nuevo usuario'}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre" requerido>
                <Entrada
                  value={formulario.nombre}
                  onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
                  required
                  placeholder="Ej. Luis Perez"
                />
              </Campo>

              <Campo
                etiqueta="Usuario"
                requerido
                ayuda="Con el que inicia sesion. Las tildes y espacios se corrigen solos."
              >
                <Entrada
                  value={formulario.username}
                  onChange={(e) => setFormulario((f) => ({ ...f, username: normalizarUsername(e.target.value) }))}
                  required
                  minLength={3}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="operador1"
                />
              </Campo>
            </div>

            <Campo
              etiqueta={formulario.id ? 'Nueva contrasena' : 'Contrasena'}
              requerido={!formulario.id}
              ayuda={formulario.id ? 'Dejala vacia para no cambiarla' : 'Minimo 8 caracteres'}
            >
              <Entrada
                type="password"
                value={formulario.password}
                onChange={(e) => setFormulario((f) => ({ ...f, password: e.target.value }))}
                required={!formulario.id}
                minLength={formulario.password ? 8 : undefined}
                autoComplete="new-password"
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Rol" requerido>
                <Selector
                  value={formulario.rol}
                  onChange={(e) => setFormulario((f) => ({ ...f, rol: e.target.value }))}
                >
                  <option value="OPERADOR">Operador de atraccion</option>
                  <option value="RECEPCION">Recepcion</option>
                  <option value="ADMIN">Administrador</option>
                </Selector>
              </Campo>

              {formulario.rol === 'OPERADOR' && (
                <Campo etiqueta="Atraccion asignada" requerido ayuda="Solo podra escanear en esta atraccion">
                  <Selector
                    value={formulario.atraccionId ?? ''}
                    onChange={(e) => setFormulario((f) => ({ ...f, atraccionId: e.target.value }))}
                    required
                  >
                    <option value="">Selecciona una...</option>
                    {atracciones.map((atraccion) => (
                      <option key={atraccion.id} value={atraccion.id}>
                        {atraccion.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={formulario.activo}
                onChange={(e) => setFormulario((f) => ({ ...f, activo: e.target.checked }))}
                className="size-4 rounded border-slate-600 bg-slate-800"
              />
              Puede iniciar sesion
            </label>

            <div className="flex gap-2">
              <Boton variante="secundario" type="button" onClick={() => setFormulario(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" cargando={guardando}>
                Guardar
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      <Tarjeta className="p-0">
        <TablaContenedor>
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Atraccion</th>
                <th className="px-4 py-3 font-medium">Ultimo acceso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className={usuario.activo ? 'hover:bg-slate-800/40' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <span className="text-slate-200">{usuario.nombre}</span>
                    {usuario.id === yo?.id && (
                      <Insignia tono="marca" className="ml-2">
                        tu
                      </Insignia>
                    )}
                    {!usuario.activo && (
                      <Insignia tono="peligro" className="ml-2">
                        inactivo
                      </Insignia>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{usuario.username}</td>
                  <td className="px-4 py-3 text-slate-300">{etiquetaRol(usuario.rol)}</td>
                  <td className="px-4 py-3 text-slate-400">{usuario.atraccion?.nombre ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {usuario.ultimoAcceso ? fechaHora(usuario.ultimoAcceso) : 'nunca'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      onClick={() =>
                        setFormulario({
                          id: usuario.id,
                          nombre: usuario.nombre,
                          username: usuario.username,
                          password: '',
                          rol: usuario.rol,
                          atraccionId: usuario.atraccionId ?? '',
                          activo: usuario.activo,
                        })
                      }
                    >
                      Editar
                    </Boton>
                    {usuario.id !== yo?.id &&
                      (usuario.activo ? (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          className="text-rose-400"
                          onClick={() => desactivar(usuario)}
                        >
                          Desactivar
                        </Boton>
                      ) : (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          className="text-emerald-400"
                          onClick={() => reactivar(usuario)}
                        >
                          Activar
                        </Boton>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaContenedor>
      </Tarjeta>

      <p className="text-xs text-slate-600">
        Los usuarios no se borran: se desactivan. Sus recargas y accesos quedan en el historial para conservar la
        trazabilidad.
      </p>
    </div>
  );
};
