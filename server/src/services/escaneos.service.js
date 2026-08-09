import { ApiError } from '../lib/errors.js';
import { normalizarCodigo } from '../lib/format.js';
import { prisma } from '../lib/prisma.js';

/**
 * Resultados posibles de un escaneo. Todos viajan con HTTP 200: para la
 * estacion de atraccion "saldo insuficiente" no es un error de la peticion,
 * es una respuesta de negocio que la pantalla debe mostrar en rojo.
 */
export const ResultadoEscaneo = {
  PERMITIDO: 'PERMITIDO',
  /** Re-escaneo dentro de la ventana de cortesia: se deja pasar sin cobrar. */
  COOLDOWN: 'COOLDOWN',
  SALDO_INSUFICIENTE: 'SALDO_INSUFICIENTE',
  MANILLA_NO_ENCONTRADA: 'MANILLA_NO_ENCONTRADA',
  MANILLA_INACTIVA: 'MANILLA_INACTIVA',
  ATRACCION_INACTIVA: 'ATRACCION_INACTIVA',
};

const MENSAJES = {
  [ResultadoEscaneo.PERMITIDO]: 'Acceso permitido',
  [ResultadoEscaneo.COOLDOWN]: 'Acceso ya registrado hace un momento',
  [ResultadoEscaneo.SALDO_INSUFICIENTE]: 'Saldo insuficiente: recarga en recepcion',
  [ResultadoEscaneo.MANILLA_NO_ENCONTRADA]: 'Manilla no reconocida',
  [ResultadoEscaneo.MANILLA_INACTIVA]: 'Manilla inactiva: acude a recepcion',
  [ResultadoEscaneo.ATRACCION_INACTIVA]: 'Esta atraccion esta fuera de servicio',
};

const respuesta = (resultado, extra = {}) => ({
  resultado,
  permitido: resultado === ResultadoEscaneo.PERMITIDO || resultado === ResultadoEscaneo.COOLDOWN,
  mensaje: MENSAJES[resultado],
  ...extra,
});

/**
 * Resuelve la atraccion sobre la que se escanea.
 * Un OPERADOR solo puede escanear en la atraccion que tiene asignada; admin y
 * recepcion pueden indicar cualquiera (util para pruebas y para cubrir turnos).
 */
export const resolverAtraccion = async (usuario, atraccionIdSolicitada) => {
  if (usuario.rol === 'OPERADOR') {
    if (!usuario.atraccionId) {
      throw ApiError.forbidden(
        'Tu usuario no tiene una atraccion asignada. Pide al administrador que te asigne una.',
        'SIN_ATRACCION_ASIGNADA'
      );
    }
    if (atraccionIdSolicitada && atraccionIdSolicitada !== usuario.atraccionId) {
      throw ApiError.forbidden('Solo puedes registrar accesos en tu atraccion asignada');
    }
    return prisma.atraccion.findUnique({ where: { id: usuario.atraccionId } });
  }

  if (!atraccionIdSolicitada) {
    throw ApiError.badRequest('Debes indicar la atraccion', 'ATRACCION_REQUERIDA');
  }

  const atraccion = await prisma.atraccion.findUnique({ where: { id: atraccionIdSolicitada } });
  if (!atraccion) throw ApiError.notFound('La atraccion no existe', 'ATRACCION_NO_ENCONTRADA');
  return atraccion;
};

/**
 * Registra el escaneo de una manilla en una atraccion.
 *
 * El descuento se hace con un UPDATE condicional (`saldoPuntos >= costo`)
 * dentro de una transaccion: si la misma manilla se escanea al mismo tiempo
 * en dos atracciones, solo una de las dos alcanza a descontar el ultimo punto.
 */
export const registrarEscaneo = async ({ codigo, atraccion, operador }) => {
  const codigoNormalizado = normalizarCodigo(codigo);

  if (!atraccion) throw ApiError.notFound('La atraccion no existe', 'ATRACCION_NO_ENCONTRADA');

  const atraccionResumen = { id: atraccion.id, nombre: atraccion.nombre, costoPuntos: atraccion.costoPuntos };

  if (!atraccion.activa) {
    return respuesta(ResultadoEscaneo.ATRACCION_INACTIVA, { atraccion: atraccionResumen });
  }

  const manilla = await prisma.manilla.findUnique({ where: { codigo: codigoNormalizado } });

  if (!manilla) {
    return respuesta(ResultadoEscaneo.MANILLA_NO_ENCONTRADA, {
      codigo: codigoNormalizado,
      atraccion: atraccionResumen,
    });
  }

  const manillaResumen = {
    id: manilla.id,
    codigo: manilla.codigo,
    nombreVisitante: manilla.nombreVisitante,
    saldoPuntos: manilla.saldoPuntos,
  };

  if (manilla.estado === 'INACTIVA') {
    return respuesta(ResultadoEscaneo.MANILLA_INACTIVA, {
      manilla: manillaResumen,
      atraccion: atraccionResumen,
      saldoAntes: manilla.saldoPuntos,
      saldoDespues: manilla.saldoPuntos,
    });
  }

  // Ventana de cortesia: un re-escaneo accidental no vuelve a cobrar.
  if (atraccion.cooldownSegundos > 0) {
    const desde = new Date(Date.now() - atraccion.cooldownSegundos * 1000);
    const usoReciente = await prisma.uso.findFirst({
      where: { manillaId: manilla.id, atraccionId: atraccion.id, createdAt: { gte: desde } },
      orderBy: { createdAt: 'desc' },
    });

    if (usoReciente) {
      const segundosRestantes = Math.max(
        0,
        Math.ceil((usoReciente.createdAt.getTime() + atraccion.cooldownSegundos * 1000 - Date.now()) / 1000)
      );
      return respuesta(ResultadoEscaneo.COOLDOWN, {
        manilla: manillaResumen,
        atraccion: atraccionResumen,
        saldoAntes: manilla.saldoPuntos,
        saldoDespues: manilla.saldoPuntos,
        uso: usoReciente,
        cooldownSegundosRestantes: segundosRestantes,
      });
    }
  }

  const costo = atraccion.costoPuntos;

  if (manilla.saldoPuntos < costo) {
    return respuesta(ResultadoEscaneo.SALDO_INSUFICIENTE, {
      manilla: manillaResumen,
      atraccion: atraccionResumen,
      saldoAntes: manilla.saldoPuntos,
      saldoDespues: manilla.saldoPuntos,
      puntosFaltantes: costo - manilla.saldoPuntos,
    });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const descuento = await tx.manilla.updateMany({
      where: { id: manilla.id, saldoPuntos: { gte: costo }, estado: 'ACTIVA' },
      data: { saldoPuntos: { decrement: costo } },
    });

    // Otro dispositivo gasto el saldo entre la lectura y el descuento.
    if (descuento.count === 0) return null;

    const actualizada = await tx.manilla.findUnique({ where: { id: manilla.id } });

    const uso = await tx.uso.create({
      data: {
        manillaId: manilla.id,
        atraccionId: atraccion.id,
        operadorId: operador.id,
        puntosDescontados: costo,
        saldoAntes: actualizada.saldoPuntos + costo,
        saldoDespues: actualizada.saldoPuntos,
      },
    });

    return { uso, saldoDespues: actualizada.saldoPuntos };
  });

  if (!resultado) {
    const refrescada = await prisma.manilla.findUnique({ where: { id: manilla.id } });
    return respuesta(ResultadoEscaneo.SALDO_INSUFICIENTE, {
      manilla: { ...manillaResumen, saldoPuntos: refrescada?.saldoPuntos ?? 0 },
      atraccion: atraccionResumen,
      saldoAntes: refrescada?.saldoPuntos ?? 0,
      saldoDespues: refrescada?.saldoPuntos ?? 0,
      puntosFaltantes: Math.max(0, costo - (refrescada?.saldoPuntos ?? 0)),
    });
  }

  return respuesta(ResultadoEscaneo.PERMITIDO, {
    manilla: { ...manillaResumen, saldoPuntos: resultado.saldoDespues },
    atraccion: atraccionResumen,
    saldoAntes: resultado.uso.saldoAntes,
    saldoDespues: resultado.uso.saldoDespues,
    puntosDescontados: costo,
    uso: resultado.uso,
  });
};

/** Resumen del turno para el contador que ve el operador en pantalla. */
export const resumenDelDia = async ({ atraccionId, operadorId }) => {
  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);

  const [usosHoy, usosOperador, ultimos] = await Promise.all([
    prisma.uso.count({ where: { atraccionId, createdAt: { gte: inicioDelDia } } }),
    operadorId
      ? prisma.uso.count({ where: { atraccionId, operadorId, createdAt: { gte: inicioDelDia } } })
      : Promise.resolve(null),
    prisma.uso.findMany({
      where: { atraccionId, createdAt: { gte: inicioDelDia } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { manilla: { select: { codigo: true, saldoPuntos: true } } },
    }),
  ]);

  return { desde: inicioDelDia, usosHoy, usosOperador, ultimos };
};
