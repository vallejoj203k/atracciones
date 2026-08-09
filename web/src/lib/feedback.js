/**
 * Retroalimentacion sonora y haptica para la estacion de atraccion.
 *
 * Los tonos se sintetizan con WebAudio en vez de cargar archivos de audio:
 * asi la PWA no depende de descargar assets y el sonido suena al instante,
 * que es lo que importa cuando hay fila.
 */

let contexto = null;

const obtenerContexto = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!contexto) contexto = new AudioCtx();
  return contexto;
};

/**
 * Los navegadores moviles bloquean el audio hasta que el usuario interactua.
 * La estacion llama a esto en el primer toque de pantalla.
 */
export const desbloquearAudio = async () => {
  const ctx = obtenerContexto();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* el navegador lo rechazo; se seguira intentando en el proximo toque */
    }
  }
};

const tono = (frecuencia, duracion, inicio = 0, volumen = 0.25) => {
  const ctx = obtenerContexto();
  if (!ctx || ctx.state !== 'running') return;

  const oscilador = ctx.createOscillator();
  const ganancia = ctx.createGain();

  oscilador.type = 'sine';
  oscilador.frequency.value = frecuencia;

  const t0 = ctx.currentTime + inicio;
  ganancia.gain.setValueAtTime(0, t0);
  ganancia.gain.linearRampToValueAtTime(volumen, t0 + 0.01);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);

  oscilador.connect(ganancia).connect(ctx.destination);
  oscilador.start(t0);
  oscilador.stop(t0 + duracion + 0.02);
};

const vibrar = (patron) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(patron);
};

/** Dos notas ascendentes: acceso permitido. */
export const sonarExito = () => {
  tono(880, 0.12);
  tono(1320, 0.18, 0.11);
  vibrar(60);
};

/** Nota grave sostenida: acceso negado. Se distingue del exito sin mirar. */
export const sonarError = () => {
  tono(220, 0.32, 0, 0.3);
  tono(180, 0.36, 0.18, 0.3);
  vibrar([90, 70, 90]);
};

/** Nota corta neutra: re-escaneo dentro de la ventana de cortesia. */
export const sonarAviso = () => {
  tono(660, 0.16, 0, 0.2);
  vibrar(40);
};
