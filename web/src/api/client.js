const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const CLAVE_TOKEN = 'mirador.token';

export const guardarToken = (token) => localStorage.setItem(CLAVE_TOKEN, token);
export const leerToken = () => localStorage.getItem(CLAVE_TOKEN);
export const borrarToken = () => localStorage.removeItem(CLAVE_TOKEN);

/** Error de API con el `code` estable que devuelve el backend. */
export class ErrorApi extends Error {
  constructor(status, code, message, detalles) {
    super(message);
    this.name = 'ErrorApi';
    this.status = status;
    this.code = code;
    this.detalles = detalles;
  }
}

// Se avisa a la app cuando el token deja de servir, para sacar al usuario
// al login sin tener que propagar el error por toda la jerarquia.
const oyentesSesion = new Set();
export const alPerderSesion = (fn) => {
  oyentesSesion.add(fn);
  return () => oyentesSesion.delete(fn);
};

const construirUrl = (ruta, params) => {
  const url = `${BASE}/api${ruta}`;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    search.append(clave, valor instanceof Date ? valor.toISOString() : String(valor));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
};

export const api = async (ruta, { method = 'GET', body, params, signal } = {}) => {
  const token = leerToken();

  let respuesta;
  try {
    respuesta = await fetch(construirUrl(ruta, params), {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexion con el servidor. Revisa el internet del dispositivo.');
  }

  if (respuesta.status === 204) return null;

  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    const error = datos?.error ?? {};
    if (respuesta.status === 401) {
      borrarToken();
      for (const fn of oyentesSesion) fn();
    }
    throw new ErrorApi(
      respuesta.status,
      error.code ?? 'ERROR',
      error.message ?? `Error ${respuesta.status}`,
      error.detalles
    );
  }

  return datos;
};

export const get = (ruta, params, opciones) => api(ruta, { ...opciones, params });
export const post = (ruta, body, opciones) => api(ruta, { ...opciones, method: 'POST', body });
export const patch = (ruta, body, opciones) => api(ruta, { ...opciones, method: 'PATCH', body });
export const put = (ruta, body, opciones) => api(ruta, { ...opciones, method: 'PUT', body });
export const del = (ruta, opciones) => api(ruta, { ...opciones, method: 'DELETE' });
