import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alerta, Boton } from './ui.jsx';

const ID_CONTENEDOR = 'lector-qr';

/**
 * Lector de QR por camara del dispositivo.
 *
 * Elegimos la camara del navegador (html5-qrcode) en lugar de un lector fisico
 * o una app nativa: funciona en cualquier celular o tablet con navegador
 * moderno, no requiere instalacion y se despliega abriendo una URL.
 *
 * Requiere HTTPS (o localhost). En Railway el dominio ya viene con TLS.
 *
 * @param {(codigo: string) => void} onDetectar
 * @param {boolean} pausado  Congela la lectura mientras se muestra un resultado.
 */
export const LectorQr = ({ onDetectar, pausado = false, className = '' }) => {
  const lectorRef = useRef(null);
  const onDetectarRef = useRef(onDetectar);
  const ultimoRef = useRef({ codigo: null, en: 0 });
  const montadoRef = useRef(true);
  // html5-qrcode es imperativo y asincrono: si un stop() se solapa con el
  // start() o el resume() que aun no terminan, el navegador se queda con un
  // video.play() huerfano y lo reporta como error. Todas las operaciones
  // sobre el lector pasan por esta cola para que nunca se pisen.
  const colaRef = useRef(Promise.resolve());

  const encolar = useCallback((operacion) => {
    colaRef.current = colaRef.current.then(operacion).catch(() => {});
    return colaRef.current;
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const [estado, setEstado] = useState('iniciando'); // iniciando | activo | error | sin-camara
  const [mensajeError, setMensajeError] = useState('');
  const [camaras, setCamaras] = useState([]);
  const [camaraActual, setCamaraActual] = useState(null);
  const [intento, setIntento] = useState(0);

  onDetectarRef.current = onDetectar;

  const manejarLectura = useCallback((textoDecodificado) => {
    const codigo = String(textoDecodificado || '').trim();
    if (!codigo) return;

    // La camara dispara varias lecturas por segundo sobre el mismo QR:
    // se ignoran las repeticiones inmediatas del mismo codigo.
    const ahora = Date.now();
    if (ultimoRef.current.codigo === codigo && ahora - ultimoRef.current.en < 2500) return;
    ultimoRef.current = { codigo, en: ahora };

    onDetectarRef.current?.(codigo);
  }, []);

  useEffect(() => {
    let cancelado = false;
    let instancia = null;

    const iniciar = async () => {
      setEstado('iniciando');
      setMensajeError('');

      try {
        const dispositivos = await Html5Qrcode.getCameras();
        if (cancelado) return;

        if (!dispositivos?.length) {
          setEstado('sin-camara');
          setMensajeError('No se detecto ninguna camara en este dispositivo.');
          return;
        }
        setCamaras(dispositivos);

        // Preferimos la camara trasera: es la que apunta a la manilla.
        const trasera = dispositivos.find((d) => /back|rear|trasera|environment/i.test(d.label));
        const elegida = camaraActual ?? trasera?.id ?? dispositivos[dispositivos.length - 1].id;
        if (!camaraActual) setCamaraActual(elegida);

        instancia = new Html5Qrcode(ID_CONTENEDOR, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        lectorRef.current = instancia;

        await instancia.start(
          elegida,
          {
            fps: 12,
            // Recuadro cuadrado proporcional: funciona igual en celular y tablet.
            qrbox: (anchoVista, altoVista) => {
              const lado = Math.floor(Math.min(anchoVista, altoVista) * 0.7);
              return { width: lado, height: lado };
            },
            aspectRatio: 1,
          },
          manejarLectura,
          () => {
            // Cada frame sin QR entra por aqui; no es un error que reportar.
          }
        );

        if (cancelado) {
          await instancia.stop().catch(() => {});
          return;
        }
        setEstado('activo');
      } catch (error) {
        if (cancelado) return;
        setEstado('error');
        const texto = String(error?.message || error);
        if (/permission|denied|NotAllowed/i.test(texto)) {
          setMensajeError('Permiso de camara denegado. Habilitalo en los ajustes del navegador y recarga.');
        } else if (/secure|https/i.test(texto)) {
          setMensajeError('La camara solo funciona sobre HTTPS. Abre la app con https:// o desde localhost.');
        } else if (/NotReadable|in use/i.test(texto)) {
          setMensajeError('La camara esta siendo usada por otra aplicacion. Cierrala e intenta de nuevo.');
        } else {
          setMensajeError(texto);
        }
      }
    };

    encolar(iniciar);

    return () => {
      cancelado = true;
      lectorRef.current = null;

      // El apagado se encola detras del arranque: asi stop() nunca corre
      // mientras start() sigue negociando la camara.
      encolar(async () => {
        if (!instancia) return;
        // Un respiro para que el play() que resume() acaba de disparar
        // alcance a resolverse antes de que stop() retire el <video>.
        await new Promise((resolver) => setTimeout(resolver, 80));
        try {
          const estadoLector = instancia.getState();
          if (estadoLector !== Html5QrcodeScannerState.NOT_STARTED) await instancia.stop();
        } catch {
          /* el lector nunca llego a arrancar */
        }
        try {
          instancia.clear();
        } catch {
          /* el contenedor ya no esta en el DOM */
        }
      });
    };
  }, [camaraActual, intento, manejarLectura, encolar]);

  // Pausar en vez de detener: reanudar es instantaneo y no reabre la camara.
  useEffect(() => {
    if (estado !== 'activo') return;

    encolar(async () => {
      const lector = lectorRef.current;
      // resume() vuelve a llamar a video.play(). Si el componente ya se
      // desmonto (recepcion pasa al paso 2 en cuanto encuentra la manilla),
      // ese play() quedaria huerfano.
      if (!lector || !montadoRef.current) return;

      try {
        const estadoLector = lector.getState();
        if (pausado && estadoLector === Html5QrcodeScannerState.SCANNING) {
          lector.pause(true);
        } else if (!pausado && estadoLector === Html5QrcodeScannerState.PAUSED) {
          lector.resume();
          ultimoRef.current = { codigo: null, en: 0 };
        }
      } catch {
        /* el lector cambio de estado en paralelo; el proximo render lo corrige */
      }
    });
  }, [pausado, estado, encolar]);

  const cambiarCamara = () => {
    if (camaras.length < 2) return;
    const indice = camaras.findIndex((c) => c.id === camaraActual);
    setCamaraActual(camaras[(indice + 1) % camaras.length].id);
  };

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-black">
        <div id={ID_CONTENEDOR} className="aspect-square w-full" />

        {estado === 'iniciando' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-slate-300">
            <span className="size-8 animate-spin rounded-full border-2 border-slate-600 border-t-marca-400" />
            <p className="text-sm">Encendiendo la camara...</p>
          </div>
        )}

        {pausado && estado === 'activo' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
            <p className="rounded-full bg-slate-900/90 px-4 py-2 text-sm text-slate-300">Lectura en pausa</p>
          </div>
        )}

        {estado === 'activo' && !pausado && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-[70%] rounded-2xl border-2 border-marca-400/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
          </div>
        )}
      </div>

      {(estado === 'error' || estado === 'sin-camara') && (
        <Alerta tono="peligro" titulo="No se pudo abrir la camara" className="mt-3">
          <p>{mensajeError}</p>
          <p className="mt-2 text-xs opacity-80">
            Puedes seguir trabajando escribiendo el codigo de la manilla a mano.
          </p>
          <Boton variante="secundario" tamano="sm" className="mt-3" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Boton>
        </Alerta>
      )}

      {camaras.length > 1 && estado === 'activo' && (
        <Boton variante="fantasma" tamano="sm" className="mt-2 w-full" onClick={cambiarCamara}>
          Cambiar camara
        </Boton>
      )}
    </div>
  );
};
