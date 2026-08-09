import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi, get, post } from '../../api/client.js';
import { CodigoQr } from '../../components/CodigoQr.jsx';
import { LectorQr } from '../../components/LectorQr.jsx';
import { Alerta, Boton, Campo, Entrada, Insignia, Tarjeta } from '../../components/ui.jsx';
import { useConfiguracion } from '../../hooks/useConfiguracion.js';
import { dinero, etiquetaMetodoPago, fechaHora } from '../../lib/formato.js';

const ATAJOS_PUNTOS = [1, 2, 3, 5, 10];

/**
 * Pantalla principal de recepcion.
 *
 * Tres pasos, uno por pantalla, porque quien la usa esta atendiendo una fila:
 *  1. identificar la manilla (escanear, escribir o generar una nueva)
 *  2. cuantos puntos y como paga
 *  3. confirmacion con el saldo resultante
 */
export const Recarga = () => {
  const { configuracion, cargando: cargandoConfig } = useConfiguracion();

  const [paso, setPaso] = useState('manilla'); // manilla | recargar | listo
  const [manilla, setManilla] = useState(null);
  const [codigoBuscado, setCodigoBuscado] = useState('');
  const [codigoManual, setCodigoManual] = useState('');
  const [usarCamara, setUsarCamara] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const [puntos, setPuntos] = useState(1);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [nombreVisitante, setNombreVisitante] = useState('');

  const [resultado, setResultado] = useState(null);
  const entradaPuntosRef = useRef(null);

  const precioPunto = configuracion?.precioPunto ?? 0;
  const moneda = configuracion?.moneda ?? 'COP';
  const total = precioPunto * puntos;

  const reiniciar = useCallback(() => {
    setPaso('manilla');
    setManilla(null);
    setCodigoBuscado('');
    setCodigoManual('');
    setNoEncontrada(false);
    setError('');
    setPuntos(1);
    setMetodoPago('EFECTIVO');
    setReferenciaPago('');
    setNombreVisitante('');
    setResultado(null);
    setUsarCamara(true);
  }, []);

  const buscarManilla = useCallback(async (codigo) => {
    const limpio = String(codigo || '').trim().toUpperCase();
    if (!limpio) return;

    setOcupado(true);
    setError('');
    setNoEncontrada(false);
    setCodigoBuscado(limpio);

    try {
      const datos = await get(`/manillas/${encodeURIComponent(limpio)}`);
      setManilla(datos.manilla);
      setNombreVisitante(datos.manilla.nombreVisitante ?? '');
      setPaso('recargar');
    } catch (fallo) {
      if (fallo instanceof ErrorApi && fallo.status === 404) {
        // Puede ser una manilla preimpresa que aun no esta en el sistema.
        setManilla(null);
        setNoEncontrada(true);
      } else {
        setError(fallo.message);
      }
    } finally {
      setOcupado(false);
    }
  }, []);

  const generarManillaNueva = async () => {
    setOcupado(true);
    setError('');
    try {
      const datos = await post('/manillas', {});
      setManilla(datos.manilla);
      setCodigoBuscado(datos.manilla.codigo);
      setNoEncontrada(false);
      setPaso('recargar');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  };

  const registrarPreimpresa = () => {
    // No se crea todavia: se crea junto con la recarga, en una sola operacion.
    setManilla({ codigo: codigoBuscado, saldoPuntos: 0, estado: 'ACTIVA', esNueva: true });
    setNoEncontrada(false);
    setPaso('recargar');
  };

  useEffect(() => {
    if (paso === 'recargar') entradaPuntosRef.current?.focus();
  }, [paso]);

  const confirmarRecarga = async () => {
    setOcupado(true);
    setError('');
    try {
      const datos = await post('/recargas', {
        codigoManilla: manilla.codigo,
        crearSiNoExiste: Boolean(manilla.esNueva),
        nombreVisitante: nombreVisitante.trim() || undefined,
        puntos,
        metodoPago,
        referenciaPago: referenciaPago.trim() || undefined,
      });
      setResultado(datos);
      setPaso('listo');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  };

  const confirmarPagoDigital = async () => {
    setOcupado(true);
    setError('');
    try {
      const datos = await post(`/recargas/${resultado.recarga.id}/confirmar`, {});
      const saldo = await get(`/manillas/${encodeURIComponent(manilla.codigo)}`);
      setResultado((previo) => ({ ...previo, recarga: datos.recarga, manilla: saldo.manilla }));
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  };

  if (cargandoConfig) {
    return <div className="py-12 text-center text-slate-500">Cargando configuracion...</div>;
  }

  // ---------------------------------------------------------------- paso 3
  if (paso === 'listo' && resultado) {
    const pendiente = resultado.recarga.estado === 'PENDIENTE';

    return (
      <div className="mx-auto max-w-md space-y-4">
        <Tarjeta className={pendiente ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}>
          <div className="text-center">
            <p className="text-5xl" aria-hidden>
              {pendiente ? '⏳' : '✅'}
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-100">
              {pendiente ? 'Esperando el pago' : 'Recarga confirmada'}
            </h2>
            <p className="mt-1 font-mono text-sm text-slate-400">{resultado.recarga.manilla.codigo}</p>

            {!pendiente && (
              <div className="mt-4 rounded-2xl bg-slate-900 px-6 py-4">
                <p className="text-5xl font-black tabular-nums text-emerald-400">
                  {resultado.manilla?.saldoPuntos ?? resultado.recarga.manilla.saldoPuntos}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-500">puntos disponibles</p>
              </div>
            )}

            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Puntos recargados</dt>
                <dd className="font-semibold text-slate-200">+{resultado.recarga.puntos}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Cobrado</dt>
                <dd className="font-semibold text-slate-200">
                  {dinero(resultado.recarga.montoTotal, resultado.recarga.moneda)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Metodo</dt>
                <dd className="text-slate-200">{etiquetaMetodoPago(resultado.recarga.metodoPago)}</dd>
              </div>
            </dl>
          </div>
        </Tarjeta>

        {pendiente && (
          <Tarjeta>
            <p className="mb-3 text-sm font-medium text-slate-300">Muestrale este QR al visitante para que transfiera</p>
            <div className="flex flex-col items-center gap-3">
              {resultado.pago?.contenidoQr ? (
                <CodigoQr valor={resultado.pago.contenidoQr} tamano={200} />
              ) : (
                <Alerta tono="aviso">
                  No hay datos de pago digital configurados. Pideselos al administrador en Ajustes.
                </Alerta>
              )}

              <div className="w-full space-y-1 text-sm">
                {resultado.pago?.instrucciones?.entidad && (
                  <p className="flex justify-between">
                    <span className="text-slate-500">Entidad</span>
                    <span className="text-slate-200">{resultado.pago.instrucciones.entidad}</span>
                  </p>
                )}
                {resultado.pago?.instrucciones?.numero && (
                  <p className="flex justify-between">
                    <span className="text-slate-500">Numero</span>
                    <span className="font-mono text-slate-200">{resultado.pago.instrucciones.numero}</span>
                  </p>
                )}
                {resultado.pago?.instrucciones?.titular && (
                  <p className="flex justify-between">
                    <span className="text-slate-500">Titular</span>
                    <span className="text-slate-200">{resultado.pago.instrucciones.titular}</span>
                  </p>
                )}
                <p className="flex justify-between">
                  <span className="text-slate-500">Referencia</span>
                  <span className="font-mono text-slate-200">{resultado.recarga.referenciaPago}</span>
                </p>
              </div>

              <Alerta tono="aviso" className="w-full">
                Los puntos <strong>no se acreditan</strong> hasta que confirmes. Verifica el comprobante antes de
                pulsar el boton.
              </Alerta>

              <Boton variante="exito" tamano="lg" className="w-full" onClick={confirmarPagoDigital} cargando={ocupado}>
                Ya recibi el pago · acreditar {resultado.recarga.puntos} puntos
              </Boton>
            </div>
          </Tarjeta>
        )}

        {error && <Alerta tono="peligro">{error}</Alerta>}

        <Boton tamano="lg" className="w-full" onClick={reiniciar}>
          Atender al siguiente
        </Boton>
      </div>
    );
  }

  // ---------------------------------------------------------------- paso 2
  if (paso === 'recargar' && manilla) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Tarjeta>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">Manilla</p>
              <p className="truncate font-mono text-lg font-bold text-slate-100">{manilla.codigo}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {manilla.esNueva ? (
                  <Insignia tono="marca">Nueva · preimpresa</Insignia>
                ) : (
                  <Insignia tono={manilla.estado === 'ACTIVA' ? 'exito' : 'peligro'}>
                    {manilla.estado === 'ACTIVA' ? 'Activa' : 'Inactiva'}
                  </Insignia>
                )}
                {manilla.createdAt && (
                  <span className="text-xs text-slate-500">creada {fechaHora(manilla.createdAt)}</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-black tabular-nums text-marca-300">{manilla.saldoPuntos}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">saldo actual</p>
            </div>
          </div>

          {manilla.estado === 'INACTIVA' && (
            <Alerta tono="peligro" className="mt-3">
              Esta manilla esta inactiva. Reactivala desde la pantalla de Manillas antes de recargar.
            </Alerta>
          )}
        </Tarjeta>

        <Tarjeta className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-300">Puntos a recargar</p>
            <div className="grid grid-cols-5 gap-2">
              {ATAJOS_PUNTOS.map((cantidad) => (
                <button
                  key={cantidad}
                  type="button"
                  onClick={() => setPuntos(cantidad)}
                  className={`rounded-xl border py-3 text-lg font-bold tabular-nums transition-colors ${
                    puntos === cantidad
                      ? 'border-marca-400 bg-marca-500/20 text-marca-200'
                      : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {cantidad}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Boton
                variante="secundario"
                onClick={() => setPuntos((n) => Math.max(1, n - 1))}
                aria-label="Quitar un punto"
              >
                −
              </Boton>
              <Entrada
                ref={entradaPuntosRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={puntos}
                onChange={(e) => {
                  const valor = Number.parseInt(e.target.value, 10);
                  setPuntos(Number.isFinite(valor) ? Math.min(500, Math.max(1, valor)) : 1);
                }}
                className="text-center text-xl font-bold"
              />
              <Boton
                variante="secundario"
                onClick={() => setPuntos((n) => Math.min(500, n + 1))}
                aria-label="Agregar un punto"
              >
                +
              </Boton>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/60 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">
                {puntos} × {dinero(precioPunto, moneda)}
              </span>
              <span className="text-2xl font-black text-slate-100">{dinero(total, moneda)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Saldo tras la recarga: {manilla.saldoPuntos + puntos} puntos</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-300">Metodo de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {['EFECTIVO', 'DIGITAL'].map((metodo) => (
                <button
                  key={metodo}
                  type="button"
                  onClick={() => setMetodoPago(metodo)}
                  className={`rounded-xl border py-4 text-base font-semibold transition-colors ${
                    metodoPago === metodo
                      ? 'border-marca-400 bg-marca-500/20 text-marca-200'
                      : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {metodo === 'EFECTIVO' ? '💵 Efectivo' : '📱 Digital'}
                </button>
              ))}
            </div>
          </div>

          {metodoPago === 'DIGITAL' && (
            <>
              <Campo etiqueta="Referencia del pago" ayuda="Opcional: numero de comprobante de la transferencia">
                <Entrada
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  placeholder="Ej. M12345678"
                />
              </Campo>
              <Alerta tono="info">
                Se generara un QR de pago. Los puntos se acreditan cuando confirmes que el dinero llego.
              </Alerta>
            </>
          )}

          <Campo etiqueta="Nombre del visitante" ayuda="Opcional: sirve para devolver una manilla extraviada">
            <Entrada
              value={nombreVisitante}
              onChange={(e) => setNombreVisitante(e.target.value)}
              placeholder="Ej. Maria Gomez"
            />
          </Campo>

          {error && <Alerta tono="peligro">{error}</Alerta>}

          <div className="flex gap-2">
            <Boton variante="secundario" tamano="lg" onClick={reiniciar} className="flex-1">
              Cancelar
            </Boton>
            <Boton
              tamano="lg"
              className="flex-[2]"
              onClick={confirmarRecarga}
              cargando={ocupado}
              disabled={manilla.estado === 'INACTIVA'}
            >
              Cobrar {dinero(total, moneda)}
            </Boton>
          </div>
        </Tarjeta>
      </div>
    );
  }

  // ---------------------------------------------------------------- paso 1
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-100">Recargar manilla</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escanea la manilla del visitante o escribe su codigo. Precio actual: {dinero(precioPunto, moneda)} por punto.
        </p>
      </div>

      {usarCamara ? (
        <LectorQr onDetectar={buscarManilla} pausado={ocupado} />
      ) : (
        <Tarjeta className="py-8 text-center text-sm text-slate-500">Camara apagada</Tarjeta>
      )}

      <Boton variante="fantasma" className="w-full" onClick={() => setUsarCamara((v) => !v)}>
        {usarCamara ? 'Apagar camara' : 'Encender camara'}
      </Boton>

      <Tarjeta className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscarManilla(codigoManual);
          }}
          className="flex gap-2"
        >
          <Entrada
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value.toUpperCase())}
            placeholder="MIR-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono"
          />
          <Boton type="submit" cargando={ocupado} disabled={!codigoManual.trim()}>
            Buscar
          </Boton>
        </form>

        <Boton variante="secundario" className="w-full" onClick={generarManillaNueva} cargando={ocupado}>
          Generar manilla nueva
        </Boton>
      </Tarjeta>

      {noEncontrada && (
        <Alerta tono="aviso" titulo="Esa manilla no esta en el sistema">
          <p className="font-mono">{codigoBuscado}</p>
          <p className="mt-1">
            Si es una manilla preimpresa que se usa por primera vez, registrala ahora. Si escaneaste otra cosa, vuelve
            a intentarlo.
          </p>
          <Boton variante="secundario" tamano="sm" className="mt-3" onClick={registrarPreimpresa}>
            Registrar esta manilla y recargar
          </Boton>
        </Alerta>
      )}

      {error && <Alerta tono="peligro">{error}</Alerta>}
    </div>
  );
};
