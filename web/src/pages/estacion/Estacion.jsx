import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorApi, get, post } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { LectorQr } from '../../components/LectorQr.jsx';
import { Alerta, Boton, Entrada } from '../../components/ui.jsx';
import { desbloquearAudio, sonarAviso, sonarError, sonarExito } from '../../lib/feedback.js';
import { hora } from '../../lib/formato.js';

/** Cuanto tiempo se queda el resultado en pantalla antes de volver a escanear. */
const MS_RESULTADO = { PERMITIDO: 2600, COOLDOWN: 2600, ERROR: 4200 };

const ESTILOS_RESULTADO = {
  PERMITIDO: {
    fondo: 'bg-emerald-600',
    icono: '✓',
    animacion: 'animar-exito',
  },
  COOLDOWN: {
    fondo: 'bg-sky-600',
    icono: '↺',
    animacion: '',
  },
  SALDO_INSUFICIENTE: {
    fondo: 'bg-rose-700',
    icono: '✕',
    animacion: 'animar-error',
  },
  MANILLA_NO_ENCONTRADA: {
    fondo: 'bg-rose-700',
    icono: '?',
    animacion: 'animar-error',
  },
  MANILLA_INACTIVA: {
    fondo: 'bg-amber-600',
    icono: '!',
    animacion: 'animar-error',
  },
  ATRACCION_INACTIVA: {
    fondo: 'bg-amber-600',
    icono: '!',
    animacion: 'animar-error',
  },
  ERROR: {
    fondo: 'bg-slate-700',
    icono: '!',
    animacion: 'animar-error',
  },
};

/**
 * Estacion de atraccion: pantalla completa de escaneo.
 *
 * Es la pantalla que el operador tiene abierta todo el dia en un celular o
 * tablet fijo, por eso: sin menus, texto enorme, y el resultado ocupa toda la
 * pantalla para que se lea a un metro de distancia.
 */
export const Estacion = () => {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  const [resumen, setResumen] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [resultado, setResultado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [mostrarManual, setMostrarManual] = useState(false);
  const [audioListo, setAudioListo] = useState(false);

  const temporizadorRef = useRef(null);
  const procesandoRef = useRef(false);

  const cargarResumen = useCallback(async () => {
    try {
      const datos = await get('/escaneos/resumen');
      setResumen(datos);
      setErrorCarga('');
    } catch (error) {
      setErrorCarga(error.message);
    }
  }, []);

  useEffect(() => {
    cargarResumen();
    // El contador del dia se refresca solo: si un supervisor abre la misma
    // estacion en otro dispositivo, ambos ven el mismo numero.
    const intervalo = setInterval(cargarResumen, 60_000);
    return () => clearInterval(intervalo);
  }, [cargarResumen]);

  useEffect(() => () => clearTimeout(temporizadorRef.current), []);

  const limpiarResultado = useCallback(() => {
    clearTimeout(temporizadorRef.current);
    setResultado(null);
  }, []);

  const registrar = useCallback(
    async (codigo) => {
      if (procesandoRef.current) return;
      procesandoRef.current = true;
      setProcesando(true);
      clearTimeout(temporizadorRef.current);

      try {
        const respuesta = await post('/escaneos', { codigo });
        setResultado({ ...respuesta, en: new Date() });

        if (respuesta.resultado === 'PERMITIDO') {
          sonarExito();
          setResumen((previo) =>
            previo ? { ...previo, usosHoy: previo.usosHoy + 1, usosOperador: (previo.usosOperador ?? 0) + 1 } : previo
          );
        } else if (respuesta.resultado === 'COOLDOWN') {
          sonarAviso();
        } else {
          sonarError();
        }

        const espera =
          MS_RESULTADO[respuesta.resultado] ?? (respuesta.permitido ? MS_RESULTADO.PERMITIDO : MS_RESULTADO.ERROR);
        temporizadorRef.current = setTimeout(() => setResultado(null), espera);
      } catch (error) {
        sonarError();
        const esSinConexion = error instanceof ErrorApi && error.code === 'SIN_CONEXION';
        setResultado({
          resultado: 'ERROR',
          permitido: false,
          mensaje: esSinConexion ? 'Sin conexion con el servidor' : error.message,
          detalleExtra: esSinConexion
            ? 'Revisa el wifi o los datos del dispositivo y vuelve a escanear.'
            : 'Intenta de nuevo. Si persiste, avisa a recepcion.',
          en: new Date(),
        });
        temporizadorRef.current = setTimeout(() => setResultado(null), MS_RESULTADO.ERROR);
      } finally {
        procesandoRef.current = false;
        setProcesando(false);
        setCodigoManual('');
      }
    },
    []
  );

  const primerToque = () => {
    if (audioListo) return;
    desbloquearAudio();
    setAudioListo(true);
  };

  const salir = () => {
    cerrarSesion();
    navegar('/login', { replace: true });
  };

  const pantallaCompleta = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* algunos navegadores moviles lo bloquean; no es critico */
    }
  };

  const atraccion = resumen?.atraccion ?? usuario?.atraccion;
  const estilo = resultado ? (ESTILOS_RESULTADO[resultado.resultado] ?? ESTILOS_RESULTADO.ERROR) : null;

  return (
    <div className="flex min-h-full flex-col bg-slate-950" onPointerDown={primerToque}>
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-100">{atraccion?.nombre ?? 'Estacion'}</p>
          <p className="truncate text-xs text-slate-500">{usuario?.nombre}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-marca-300">{resumen?.usosHoy ?? '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">accesos hoy</p>
        </div>
        <Boton variante="fantasma" tamano="sm" onClick={pantallaCompleta} title="Pantalla completa">
          ⛶
        </Boton>
        <Boton variante="secundario" tamano="sm" onClick={salir}>
          Salir
        </Boton>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        {errorCarga && (
          <Alerta tono="peligro" className="mb-3" titulo="No se pudo cargar la estacion">
            {errorCarga}
          </Alerta>
        )}

        {atraccion && atraccion.activa === false && (
          <Alerta tono="aviso" className="mb-3" titulo="Atraccion desactivada">
            El administrador la marco como fuera de servicio. Los escaneos no descontaran puntos.
          </Alerta>
        )}

        <LectorQr onDetectar={registrar} pausado={Boolean(resultado) || procesando} />

        <div className="mt-4">
          {mostrarManual ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (codigoManual.trim()) registrar(codigoManual.trim());
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
              <Boton type="submit" cargando={procesando} disabled={!codigoManual.trim()}>
                Validar
              </Boton>
            </form>
          ) : (
            <Boton variante="fantasma" className="w-full" onClick={() => setMostrarManual(true)}>
              El QR no lee: escribir codigo
            </Boton>
          )}
        </div>

        {resumen?.ultimos?.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Ultimos accesos</p>
            <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
              {resumen.ultimos.slice(0, 5).map((uso) => (
                <li key={uso.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono text-slate-300">{uso.manilla.codigo}</span>
                  <span className="text-xs text-slate-500">{hora(uso.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Flotante y fuera del flujo: al desaparecer con el primer toque no
          puede desplazar los botones justo debajo del dedo del operador. */}
      {!audioListo && (
        <p className="pointer-events-none fixed inset-x-0 bottom-3 z-30 mx-auto w-fit rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-center text-xs text-slate-400 shadow-lg">
          Toca la pantalla una vez para activar el sonido
        </p>
      )}

      {/* Resultado a pantalla completa: se ve desde lejos y se cierra al tocar. */}
      {resultado && (
        <button
          type="button"
          onClick={limpiarResultado}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6 text-center text-white ${estilo.fondo} ${estilo.animacion}`}
        >
          <span className="text-8xl leading-none" aria-hidden>
            {estilo.icono}
          </span>

          <p className="text-4xl font-black uppercase tracking-tight">
            {resultado.resultado === 'PERMITIDO' && 'Acceso permitido'}
            {resultado.resultado === 'COOLDOWN' && 'Ya registrado'}
            {resultado.resultado === 'SALDO_INSUFICIENTE' && 'Saldo insuficiente'}
            {resultado.resultado === 'MANILLA_NO_ENCONTRADA' && 'Manilla no valida'}
            {resultado.resultado === 'MANILLA_INACTIVA' && 'Manilla inactiva'}
            {resultado.resultado === 'ATRACCION_INACTIVA' && 'Fuera de servicio'}
            {resultado.resultado === 'ERROR' && 'Error'}
          </p>

          {resultado.resultado === 'SALDO_INSUFICIENTE' && (
            <p className="text-2xl font-semibold">Debe recargar en recepcion</p>
          )}

          {resultado.resultado === 'COOLDOWN' && (
            <p className="text-xl font-medium opacity-90">Este acceso ya se cobro hace un momento. Puede pasar.</p>
          )}

          {resultado.detalleExtra && <p className="text-lg opacity-90">{resultado.detalleExtra}</p>}
          {!resultado.detalleExtra && resultado.mensaje && resultado.resultado === 'ERROR' && (
            <p className="text-lg opacity-90">{resultado.mensaje}</p>
          )}

          {resultado.manilla && (
            <div className="mt-2 rounded-2xl bg-black/25 px-6 py-4">
              <p className="font-mono text-lg opacity-90">{resultado.manilla.codigo}</p>
              <p className="mt-1 text-5xl font-black tabular-nums">
                {resultado.saldoDespues ?? resultado.manilla.saldoPuntos}
              </p>
              <p className="text-sm uppercase tracking-wide opacity-80">puntos restantes</p>
            </div>
          )}

          <p className="absolute bottom-8 text-sm opacity-70">Toca para continuar</p>
        </button>
      )}
    </div>
  );
};
