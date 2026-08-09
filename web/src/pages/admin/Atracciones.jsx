import { useCallback, useEffect, useState } from 'react';
import { del, get, patch, post } from '../../api/client.js';
import {
  Alerta,
  AreaTexto,
  Boton,
  Campo,
  Cargando,
  Entrada,
  Insignia,
  Tarjeta,
  Vacio,
} from '../../components/ui.jsx';

const VACIO = { nombre: '', descripcion: '', costoPuntos: 1, cooldownSegundos: 60, activa: true, orden: 0 };

/**
 * Gestion de atracciones. El sistema no asume que sean tres: agregar una
 * cuarta es crear un registro aqui y un usuario operador para su estacion.
 */
export const Atracciones = () => {
  const [atracciones, setAtracciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await get('/atracciones');
      setAtracciones(respuesta.atracciones);
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
      descripcion: formulario.descripcion?.trim() || undefined,
      costoPuntos: Number(formulario.costoPuntos),
      cooldownSegundos: Number(formulario.cooldownSegundos),
      activa: formulario.activa,
      orden: Number(formulario.orden),
    };

    try {
      if (formulario.id) await patch(`/atracciones/${formulario.id}`, cuerpo);
      else await post('/atracciones', cuerpo);
      setFormulario(null);
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  const alternarActiva = async (atraccion) => {
    setError('');
    try {
      await patch(`/atracciones/${atraccion.id}`, { activa: !atraccion.activa });
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  };

  const eliminar = async (atraccion) => {
    if (!window.confirm(`Eliminar "${atraccion.nombre}"? Solo es posible si no tiene usos registrados.`)) return;
    setError('');
    try {
      await del(`/atracciones/${atraccion.id}`);
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
          <h1 className="text-xl font-bold text-slate-100">Atracciones</h1>
          <p className="text-sm text-slate-500">{atracciones.length} registradas</p>
        </div>
        <Boton onClick={() => setFormulario({ ...VACIO, orden: atracciones.length + 1 })}>Nueva atraccion</Boton>
      </div>

      {error && <Alerta tono="peligro">{error}</Alerta>}

      {formulario && (
        <Tarjeta>
          <form onSubmit={guardar} className="space-y-3">
            <h2 className="font-semibold text-slate-200">
              {formulario.id ? `Editar ${formulario.nombre}` : 'Nueva atraccion'}
            </h2>

            <Campo etiqueta="Nombre" requerido>
              <Entrada
                value={formulario.nombre}
                onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
                required
                minLength={2}
                placeholder="Ej. Columpio Extremo"
              />
            </Campo>

            <Campo etiqueta="Descripcion">
              <AreaTexto
                value={formulario.descripcion ?? ''}
                onChange={(e) => setFormulario((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Que incluye el acceso"
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-3">
              <Campo etiqueta="Puntos por acceso" ayuda="Normalmente 1">
                <Entrada
                  type="number"
                  min={1}
                  max={50}
                  value={formulario.costoPuntos}
                  onChange={(e) => setFormulario((f) => ({ ...f, costoPuntos: e.target.value }))}
                />
              </Campo>

              <Campo etiqueta="Cortesia (segundos)" ayuda="Re-escaneo sin cobrar. 0 lo desactiva.">
                <Entrada
                  type="number"
                  min={0}
                  max={3600}
                  value={formulario.cooldownSegundos}
                  onChange={(e) => setFormulario((f) => ({ ...f, cooldownSegundos: e.target.value }))}
                />
              </Campo>

              <Campo etiqueta="Orden">
                <Entrada
                  type="number"
                  min={0}
                  value={formulario.orden}
                  onChange={(e) => setFormulario((f) => ({ ...f, orden: e.target.value }))}
                />
              </Campo>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={formulario.activa}
                onChange={(e) => setFormulario((f) => ({ ...f, activa: e.target.checked }))}
                className="size-4 rounded border-slate-600 bg-slate-800"
              />
              Atraccion activa (acepta escaneos)
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

      {atracciones.length === 0 ? (
        <Vacio titulo="Aun no hay atracciones" descripcion="Crea la primera para poder registrar accesos." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {atracciones.map((atraccion) => (
            <Tarjeta key={atraccion.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-100">{atraccion.nombre}</p>
                  {atraccion.descripcion && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{atraccion.descripcion}</p>
                  )}
                </div>
                <Insignia tono={atraccion.activa ? 'exito' : 'peligro'}>
                  {atraccion.activa ? 'Activa' : 'Inactiva'}
                </Insignia>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                <div>
                  <dt className="inline">Costo: </dt>
                  <dd className="inline font-medium text-slate-300">
                    {atraccion.costoPuntos} {atraccion.costoPuntos === 1 ? 'punto' : 'puntos'}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Cortesia: </dt>
                  <dd className="inline font-medium text-slate-300">
                    {atraccion.cooldownSegundos === 0 ? 'sin cortesia' : `${atraccion.cooldownSegundos}s`}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-1">
                <Boton variante="secundario" tamano="sm" onClick={() => setFormulario({ ...atraccion })}>
                  Editar
                </Boton>
                <Boton variante="fantasma" tamano="sm" onClick={() => alternarActiva(atraccion)}>
                  {atraccion.activa ? 'Desactivar' : 'Activar'}
                </Boton>
                <Boton variante="fantasma" tamano="sm" className="text-rose-400" onClick={() => eliminar(atraccion)}>
                  Eliminar
                </Boton>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
};
