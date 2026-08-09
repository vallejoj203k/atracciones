import { prisma } from '../lib/prisma.js';

export const CONFIG_ID = 'singleton';

/**
 * Devuelve la configuracion global, creandola con valores por defecto la
 * primera vez. Acepta un cliente transaccional para poder leerla dentro de
 * la misma transaccion que registra una recarga.
 */
export const obtenerConfiguracion = async (tx = prisma) => {
  const existente = await tx.configuracion.findUnique({ where: { id: CONFIG_ID } });
  if (existente) return existente;
  return tx.configuracion.create({ data: { id: CONFIG_ID } });
};
