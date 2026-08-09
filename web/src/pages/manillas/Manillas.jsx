import { useCallback, useEffect, useState } from 'react';
import { get, patch, post } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { CodigoQr } from '../../components/CodigoQr.jsx';
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
  Vacio,
} from '../../components/ui.jsx';
import { fechaHora, numero } from '../../lib/formato.js';
import { HojaImpresion } from './HojaImpresion.jsx';

const TAMANO_PAGINA = 25;

/**
 * Gestion de manillas: buscar, ver saldo e historial, activar/desactivar y
 * generar lotes de codigos para imprimir stickers.
 */
export const Manillas = () => {
  const { esAdmin } = useAuth();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [estado, setEstado] = useState('');
  const [conSaldo, setConSaldo] = useState('');
  const [pagina, setPagina] = useState(1);

  const [cantidadLote, setCantidadLote] = useState(10);
  const [generando, setGenerando] = useState(false);
  const [loteGenerado, setLoteGenerado] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await get('/manillas', {
        busqueda: busquedaAplicada || undefined,
        estado: estado || undefined,
        conSaldo: conSaldo || undefined,
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
  }, [busquedaAplicada, estado, conSaldo, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const generarLote = async () => {
    setGenerando(true);
    setError('');
    try {
      const respuesta = await post('/manillas/lote', { cantidad: cantidadLote });
      setLoteGenerado(respuesta.manillas);
      cargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGenerando(false);
    }
  };

  const cambiarEstado = async (manilla) => {
    const nuevo = manilla.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA';
    try {
      await patch(`/manillas/${manilla.id}`, { estado: nuevo });
      cargar();
      if (detalle?.id === manilla.id) abrirDetalle(manilla.codigo);
    } catch (fallo) {
      setError(fallo.message);
    }
  };

  const abrirDetalle = async (codigo) => {
    try {
      const respuesta = await get(`/manillas/${encodeURIComponent(codigo)}`);
      setDetalle(respuesta.manilla);
    } catch (fallo) {
      setError(fallo.message);
    }
  };

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / TAMANO_PAGINA)) : 1;

  if (loteGenerado) {
    return (
      <HojaImpresion
        manillas={loteGenerado}
        onVolver={() => setLoteGenerado(null)}
        titulo={`Lote de ${loteGenerado.length} manillas`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Manillas</h1>
          <p className="text-sm text-slate-500">
            {datos ? `${numero(datos.total)} registradas` : 'Cargando...'}
          </p>
        </div>
      </div>

      <Tarjeta className="space-y-3">
        <p className="text-sm font-medium text-slate-300">Generar codigos para imprimir</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <Campo etiqueta="Cantidad">
              <Entrada
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={cantidadLote}
                onChange={(e) => setCantidadLote(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
              />
            </Campo>
          </div>
          <Boton onClick={generarLote} cargando={generando}>
            Generar lote e imprimir
          </Boton>
        </div>
        <p className="text-xs text-slate-500">
          Genera manillas vacias con su QR listo para pegar. Si tus manillas ya vienen con un QR impreso de fabrica,
          no uses esto: registralas al momento de la primera recarga.
        </p>
      </Tarjeta>

      <Tarjeta className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPagina(1);
            setBusquedaAplicada(busqueda.trim());
          }}
          className="flex flex-wrap gap-2"
        >
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por codigo o nombre"
            className="min-w-40 flex-1"
          />
          <Selector
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setPagina(1);
            }}
            className="w-36"
          >
            <option value="">Todo estado</option>
            <option value="ACTIVA">Activas</option>
            <option value="INACTIVA">Inactivas</option>
          </Selector>
          <Selector
            value={conSaldo}
            onChange={(e) => {
              setConSaldo(e.target.value);
              setPagina(1);
            }}
            className="w-36"
          >
            <option value="">Todo saldo</option>
            <option value="true">Con saldo</option>
            <option value="false">Sin saldo</option>
          </Selector>
          <Boton type="submit" variante="secundario">
            Buscar
          </Boton>
        </form>
      </Tarjeta>

      {error && <Alerta tono="peligro">{error}</Alerta>}

      {cargando && !datos ? (
        <Cargando />
      ) : datos?.items.length === 0 ? (
        <Vacio titulo="No hay manillas que coincidan" descripcion="Ajusta los filtros o genera un lote nuevo." />
      ) : (
        <Tarjeta className="p-0">
          <TablaContenedor>
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Codigo</th>
                  <th className="px-4 py-3 font-medium">Saldo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Visitante</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {datos?.items.map((manilla) => (
                  <tr key={manilla.id} className="hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-200">{manilla.codigo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-bold tabular-nums ${
                          manilla.saldoPuntos > 0 ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {manilla.saldoPuntos}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Insignia tono={manilla.estado === 'ACTIVA' ? 'exito' : 'peligro'}>
                        {manilla.estado === 'ACTIVA' ? 'Activa' : 'Inactiva'}
                      </Insignia>
                    </td>
                    <td className="max-w-40 truncate px-4 py-3 text-slate-400">{manilla.nombreVisitante || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaHora(manilla.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Boton variante="fantasma" tamano="sm" onClick={() => abrirDetalle(manilla.codigo)}>
                        Ver
                      </Boton>
                      {esAdmin && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          onClick={() => cambiarEstado(manilla)}
                          className={manilla.estado === 'ACTIVA' ? 'text-rose-400' : 'text-emerald-400'}
                        >
                          {manilla.estado === 'ACTIVA' ? 'Desactivar' : 'Activar'}
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

      {detalle && <PanelDetalle manilla={detalle} onCerrar={() => setDetalle(null)} />}
    </div>
  );
};

const PanelDetalle = ({ manilla, onCerrar }) => (
  <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4">
    <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 p-5 sm:rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-bold text-slate-100">{manilla.codigo}</p>
          <p className="text-sm text-slate-500">
            {manilla.origen === 'GENERADO' ? 'Codigo generado por el sistema' : 'Manilla preimpresa registrada'}
          </p>
        </div>
        <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <CodigoQr valor={manilla.codigo} tamano={120} />
        <div>
          <p className="text-4xl font-black tabular-nums text-marca-300">{manilla.saldoPuntos}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">puntos disponibles</p>
          {manilla.nombreVisitante && <p className="mt-2 text-sm text-slate-300">{manilla.nombreVisitante}</p>}
        </div>
      </div>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Recargas</h3>
        {manilla.recargas?.length ? (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 text-sm">
            {manilla.recargas.map((recarga) => (
              <li key={recarga.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-slate-200">
                    +{recarga.puntos} puntos
                    {recarga.estado !== 'CONFIRMADA' && (
                      <Insignia tono={recarga.estado === 'PENDIENTE' ? 'aviso' : 'peligro'} className="ml-2">
                        {recarga.estado === 'PENDIENTE' ? 'Pendiente' : 'Anulada'}
                      </Insignia>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{recarga.usuario?.nombre}</p>
                </div>
                <span className="text-xs text-slate-500">{fechaHora(recarga.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">Sin recargas.</p>
        )}
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Usos</h3>
        {manilla.usos?.length ? (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 text-sm">
            {manilla.usos.map((uso) => (
              <li key={uso.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-slate-200">{uso.atraccion?.nombre}</p>
                  <p className="text-xs text-slate-500">
                    −{uso.puntosDescontados} · {uso.operador?.nombre}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{fechaHora(uso.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">Sin usos registrados.</p>
        )}
      </section>
    </div>
  </div>
);
