import { useCallback, useEffect, useState } from 'react';
import { get } from '../../api/client.js';
import {
  Alerta,
  Boton,
  Cargando,
  Entrada,
  Selector,
  TablaContenedor,
  Tarjeta,
  Vacio,
} from '../../components/ui.jsx';
import { aInputDate, fechaHora, finDelDia, inicioDelDia, numero } from '../../lib/formato.js';

const TAMANO_PAGINA = 50;

/** Trazabilidad: cada acceso con su manilla, atraccion, operador y hora. */
export const Usos = () => {
  const [datos, setDatos] = useState(null);
  const [atracciones, setAtracciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [desde, setDesde] = useState(aInputDate(new Date()));
  const [hasta, setHasta] = useState(aInputDate(new Date()));
  const [atraccionId, setAtraccionId] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    get('/atracciones')
      .then((respuesta) => setAtracciones(respuesta.atracciones))
      .catch(() => setAtracciones([]));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await get('/reportes/usos', {
        desde: inicioDelDia(new Date(`${desde}T00:00:00`)),
        hasta: finDelDia(new Date(`${hasta}T00:00:00`)),
        atraccionId: atraccionId || undefined,
        page: pagina,
        pageSize: TAMANO_PAGINA,
      });
      setDatos(respuesta);
      setError('');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, atraccionId, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / TAMANO_PAGINA)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Accesos registrados</h1>
        <p className="text-sm text-slate-500">{datos ? `${numero(datos.total)} en el rango` : 'Cargando...'}</p>
      </div>

      <Tarjeta>
        <div className="flex flex-wrap gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Desde</span>
            <Entrada
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Hasta</span>
            <Entrada
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Atraccion</span>
            <Selector
              value={atraccionId}
              onChange={(e) => {
                setAtraccionId(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todas</option>
              {atracciones.map((atraccion) => (
                <option key={atraccion.id} value={atraccion.id}>
                  {atraccion.nombre}
                </option>
              ))}
            </Selector>
          </label>
        </div>
      </Tarjeta>

      {error && <Alerta tono="peligro">{error}</Alerta>}

      {cargando && !datos ? (
        <Cargando />
      ) : datos?.items.length === 0 ? (
        <Vacio titulo="Sin accesos en este rango" descripcion="Prueba con otras fechas o con otra atraccion." />
      ) : (
        <Tarjeta className="p-0">
          <TablaContenedor>
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Manilla</th>
                  <th className="px-4 py-3 font-medium">Atraccion</th>
                  <th className="px-4 py-3 font-medium">Operador</th>
                  <th className="px-4 py-3 font-medium">Puntos</th>
                  <th className="px-4 py-3 font-medium">Saldo restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {datos?.items.map((uso) => (
                  <tr key={uso.id} className="hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{fechaHora(uso.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-200">{uso.manilla.codigo}</td>
                    <td className="px-4 py-3 text-slate-300">{uso.atraccion.nombre}</td>
                    <td className="px-4 py-3 text-slate-400">{uso.operador.nombre}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-400">−{uso.puntosDescontados}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{uso.saldoDespues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaContenedor>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-sm">
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Boton>
              <span className="text-slate-500">
                Pagina {pagina} de {totalPaginas}
              </span>
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </Boton>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
};
