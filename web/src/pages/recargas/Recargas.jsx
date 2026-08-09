import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  Alerta,
  Boton,
  Cargando,
  Entrada,
  Insignia,
  Selector,
  TablaContenedor,
  Tarjeta,
  Vacio,
} from '../../components/ui.jsx';
import {
  aInputDate,
  dinero,
  etiquetaEstadoRecarga,
  etiquetaMetodoPago,
  fechaHora,
  finDelDia,
  inicioDelDia,
  numero,
} from '../../lib/formato.js';

const TAMANO_PAGINA = 25;

const TONO_ESTADO = { CONFIRMADA: 'exito', PENDIENTE: 'aviso', ANULADA: 'peligro' };

/** Historial de recargas, con confirmacion de pagos digitales pendientes. */
export const Recargas = () => {
  const { esAdmin } = useAuth();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [accionando, setAccionando] = useState(null);

  const [desde, setDesde] = useState(aInputDate(new Date()));
  const [hasta, setHasta] = useState(aInputDate(new Date()));
  const [estado, setEstado] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await get('/recargas', {
        desde: inicioDelDia(new Date(`${desde}T00:00:00`)),
        hasta: finDelDia(new Date(`${hasta}T00:00:00`)),
        estado: estado || undefined,
        metodoPago: metodoPago || undefined,
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
  }, [desde, hasta, estado, metodoPago, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const confirmar = async (recarga) => {
    setAccionando(recarga.id);
    setError('');
    try {
      await post(`/recargas/${recarga.id}/confirmar`, {});
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setAccionando(null);
    }
  };

  const anular = async (recarga) => {
    const motivo = window.prompt(
      `Anular la recarga de ${recarga.puntos} puntos de la manilla ${recarga.manilla.codigo}.\n\nMotivo:`
    );
    if (motivo === null) return;

    setAccionando(recarga.id);
    setError('');
    try {
      await post(`/recargas/${recarga.id}/anular`, { motivo });
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setAccionando(null);
    }
  };

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / TAMANO_PAGINA)) : 1;
  const totalConfirmado = (datos?.items ?? [])
    .filter((r) => r.estado === 'CONFIRMADA')
    .reduce((suma, r) => suma + r.montoTotal, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Recargas</h1>
        <p className="text-sm text-slate-500">
          {datos ? `${numero(datos.total)} en el rango` : 'Cargando...'}
          {datos?.items.length ? ` · ${dinero(totalConfirmado)} confirmados en esta pagina` : ''}
        </p>
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
            <span className="mb-1 block text-xs text-slate-500">Estado</span>
            <Selector
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todos</option>
              <option value="CONFIRMADA">Confirmadas</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="ANULADA">Anuladas</option>
            </Selector>
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Metodo</span>
            <Selector
              value={metodoPago}
              onChange={(e) => {
                setMetodoPago(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todos</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="DIGITAL">Digital</option>
            </Selector>
          </label>
        </div>
      </Tarjeta>

      {error && <Alerta tono="peligro">{error}</Alerta>}

      {cargando && !datos ? (
        <Cargando />
      ) : datos?.items.length === 0 ? (
        <Vacio titulo="Sin recargas en este rango" descripcion="Prueba con otras fechas." />
      ) : (
        <Tarjeta className="p-0">
          <TablaContenedor>
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Manilla</th>
                  <th className="px-4 py-3 font-medium">Puntos</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Metodo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Registro</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {datos?.items.map((recarga) => (
                  <tr key={recarga.id} className="hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{fechaHora(recarga.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-200">{recarga.manilla.codigo}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-200">+{recarga.puntos}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-200">
                      {dinero(recarga.montoTotal, recarga.moneda)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{etiquetaMetodoPago(recarga.metodoPago)}</td>
                    <td className="px-4 py-3">
                      <Insignia tono={TONO_ESTADO[recarga.estado]}>{etiquetaEstadoRecarga(recarga.estado)}</Insignia>
                    </td>
                    <td className="max-w-32 truncate px-4 py-3 text-slate-500">{recarga.usuario?.nombre}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {recarga.estado === 'PENDIENTE' && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          className="text-emerald-400"
                          cargando={accionando === recarga.id}
                          onClick={() => confirmar(recarga)}
                        >
                          Confirmar
                        </Boton>
                      )}
                      {esAdmin && recarga.estado !== 'ANULADA' && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          className="text-rose-400"
                          cargando={accionando === recarga.id}
                          onClick={() => anular(recarga)}
                        >
                          Anular
                        </Boton>
                      )}
                    </td>
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
