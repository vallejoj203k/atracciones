import { env } from '../../config/env.js';
import { manualProvider } from './manual.provider.js';
import { wompiProvider } from './wompi.provider.js';

const proveedores = {
  manual: manualProvider,
  wompi: wompiProvider,
};

/**
 * Punto unico de acceso a la pasarela de pago. Todo el resto del backend
 * habla contra esta interfaz, de modo que cambiar de proveedor sea cambiar
 * una variable de entorno y no tocar rutas ni servicios.
 */
export const obtenerProveedorPago = (nombre = env.pagos.proveedor) =>
  proveedores[nombre] ?? manualProvider;

export const proveedoresDisponibles = () =>
  Object.values(proveedores).map((p) => ({
    nombre: p.nombre,
    soportaConfirmacionAutomatica: p.soportaConfirmacionAutomatica,
    activo: p.nombre === env.pagos.proveedor,
  }));
