import { prisma } from './prisma.js';

/**
 * Registra una accion sensible en la bitacora. Nunca hace fallar la operacion
 * principal: si la auditoria falla, se loguea y se sigue.
 *
 * @param {object} opts
 * @param {object} [opts.tx] Cliente transaccional de Prisma, si aplica.
 * @param {object} [opts.req] Request de Express, para extraer usuario e IP.
 * @param {string} opts.accion  Ej. "recarga.crear"
 * @param {string} opts.entidad Ej. "Recarga"
 */
export const registrarAuditoria = async ({ tx, req, accion, entidad, entidadId, detalle }) => {
  const db = tx ?? prisma;
  try {
    await db.auditLog.create({
      data: {
        usuarioId: req?.usuario?.id ?? null,
        accion,
        entidad,
        entidadId: entidadId ?? null,
        detalle: detalle ?? undefined,
        ip: req?.ip ?? null,
      },
    });
  } catch (error) {
    console.error('[auditoria] no se pudo registrar', accion, error.message);
  }
};
