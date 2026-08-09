import { Prisma } from '@prisma/client';
import { registrarAuditoria } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { normalizarCodigo, serializarRecarga } from '../lib/format.js';
import { prisma } from '../lib/prisma.js';
import { obtenerConfiguracion } from './configuracion.service.js';
import { crearManilla } from './manillas.service.js';
import { obtenerProveedorPago } from './pagos/index.js';

const incluirRelaciones = {
  manilla: { select: { id: true, codigo: true, saldoPuntos: true, estado: true } },
  usuario: { select: { id: true, nombre: true, username: true } },
  confirmadaPor: { select: { id: true, nombre: true } },
};

/**
 * Registra una recarga de puntos.
 *
 * - EFECTIVO: se confirma en el acto y el saldo sube de inmediato.
 * - DIGITAL con confirmacion manual: nace PENDIENTE y el saldo NO sube hasta
 *   que recepcion confirme haber visto el comprobante. Asi nunca se regalan
 *   puntos por una transferencia que no llego.
 * - DIGITAL con pasarela automatica: la pasarela confirma via webhook.
 */
export const crearRecarga = async ({
  codigoManilla,
  crearSiNoExiste = false,
  nombreVisitante,
  puntos,
  metodoPago,
  referenciaPago,
  usuario,
  req,
}) => {
  const codigo = normalizarCodigo(codigoManilla);

  const resultado = await prisma.$transaction(async (tx) => {
    const configuracion = await obtenerConfiguracion(tx);

    let manilla = await tx.manilla.findUnique({ where: { codigo } });
    let manillaCreada = false;

    if (!manilla) {
      if (!crearSiNoExiste) {
        throw ApiError.notFound(
          'No existe una manilla con ese codigo. Marca "crear manilla nueva" si es una manilla preimpresa.',
          'MANILLA_NO_ENCONTRADA'
        );
      }
      manilla = await crearManilla(
        { codigo, nombreVisitante, creadaPorId: usuario.id },
        tx
      );
      manillaCreada = true;
    }

    if (manilla.estado === 'INACTIVA') {
      throw ApiError.conflict('La manilla esta inactiva; actívala antes de recargar', 'MANILLA_INACTIVA');
    }

    if (nombreVisitante && !manilla.nombreVisitante) {
      manilla = await tx.manilla.update({
        where: { id: manilla.id },
        data: { nombreVisitante },
      });
    }

    const precioUnitario = new Prisma.Decimal(configuracion.precioPunto);
    const montoTotal = precioUnitario.mul(puntos);

    const proveedor = obtenerProveedorPago();
    const esDigital = metodoPago === 'DIGITAL';
    const requiereConfirmacion = esDigital && configuracion.confirmacionDigitalManual;
    const estado = requiereConfirmacion ? 'PENDIENTE' : 'CONFIRMADA';

    let pago = null;
    if (esDigital) {
      pago = await proveedor.crearIntento({
        montoTotal: montoTotal.toNumber(),
        moneda: configuracion.moneda,
        configuracion,
        referenciaExterna: referenciaPago,
      });
    }

    const recarga = await tx.recarga.create({
      data: {
        manillaId: manilla.id,
        puntos,
        precioUnitario,
        montoTotal,
        moneda: configuracion.moneda,
        metodoPago,
        estado,
        proveedorPago: esDigital ? proveedor.nombre : null,
        referenciaPago: esDigital ? pago?.referencia ?? referenciaPago ?? null : referenciaPago ?? null,
        usuarioId: usuario.id,
        confirmadaPorId: estado === 'CONFIRMADA' ? usuario.id : null,
        confirmadaEn: estado === 'CONFIRMADA' ? new Date() : null,
      },
      include: incluirRelaciones,
    });

    if (estado === 'CONFIRMADA') {
      manilla = await tx.manilla.update({
        where: { id: manilla.id },
        data: { saldoPuntos: { increment: puntos } },
      });
    }

    await registrarAuditoria({
      tx,
      req,
      accion: manillaCreada ? 'recarga.crear_con_manilla_nueva' : 'recarga.crear',
      entidad: 'Recarga',
      entidadId: recarga.id,
      detalle: {
        codigoManilla: manilla.codigo,
        puntos,
        metodoPago,
        estado,
        montoTotal: montoTotal.toNumber(),
      },
    });

    return {
      recarga: { ...recarga, manilla: { ...recarga.manilla, saldoPuntos: manilla.saldoPuntos } },
      manilla,
      manillaCreada,
      pago,
    };
  });

  return {
    ...resultado,
    recarga: serializarRecarga(resultado.recarga),
  };
};

/** Confirma una recarga digital pendiente y acredita los puntos. */
export const confirmarRecarga = async ({ id, usuario, req }) => {
  const recarga = await prisma.$transaction(async (tx) => {
    const actual = await tx.recarga.findUnique({ where: { id } });
    if (!actual) throw ApiError.notFound('La recarga no existe', 'RECARGA_NO_ENCONTRADA');
    if (actual.estado === 'CONFIRMADA') {
      throw ApiError.conflict('Esta recarga ya estaba confirmada', 'RECARGA_YA_CONFIRMADA');
    }
    if (actual.estado === 'ANULADA') {
      throw ApiError.conflict('No se puede confirmar una recarga anulada', 'RECARGA_ANULADA');
    }

    await tx.manilla.update({
      where: { id: actual.manillaId },
      data: { saldoPuntos: { increment: actual.puntos } },
    });

    const actualizada = await tx.recarga.update({
      where: { id },
      data: { estado: 'CONFIRMADA', confirmadaPorId: usuario.id, confirmadaEn: new Date() },
      include: incluirRelaciones,
    });

    await registrarAuditoria({
      tx,
      req,
      accion: 'recarga.confirmar',
      entidad: 'Recarga',
      entidadId: id,
      detalle: { puntos: actual.puntos, manillaId: actual.manillaId },
    });

    return actualizada;
  });

  return serializarRecarga(recarga);
};

/**
 * Anula una recarga. Si ya estaba confirmada, devuelve los puntos. El saldo
 * puede quedar por debajo de los puntos devueltos si el visitante ya los uso,
 * por eso nunca se deja el saldo en negativo.
 */
export const anularRecarga = async ({ id, motivo, usuario, req }) => {
  const recarga = await prisma.$transaction(async (tx) => {
    const actual = await tx.recarga.findUnique({ where: { id }, include: { manilla: true } });
    if (!actual) throw ApiError.notFound('La recarga no existe', 'RECARGA_NO_ENCONTRADA');
    if (actual.estado === 'ANULADA') {
      throw ApiError.conflict('Esta recarga ya estaba anulada', 'RECARGA_YA_ANULADA');
    }

    let puntosDevueltos = 0;
    if (actual.estado === 'CONFIRMADA') {
      puntosDevueltos = Math.min(actual.puntos, actual.manilla.saldoPuntos);
      if (puntosDevueltos > 0) {
        await tx.manilla.update({
          where: { id: actual.manillaId },
          data: { saldoPuntos: { decrement: puntosDevueltos } },
        });
      }
    }

    const actualizada = await tx.recarga.update({
      where: { id },
      data: { estado: 'ANULADA', anuladaEn: new Date(), motivoAnulado: motivo || null },
      include: incluirRelaciones,
    });

    await registrarAuditoria({
      tx,
      req,
      accion: 'recarga.anular',
      entidad: 'Recarga',
      entidadId: id,
      detalle: {
        motivo: motivo || null,
        puntosDevueltos,
        puntosNoRecuperados: actual.puntos - puntosDevueltos,
      },
    });

    return actualizada;
  });

  return serializarRecarga(recarga);
};

export const listarRecargas = async ({ desde, hasta, estado, metodoPago, usuarioId, manillaId, page, pageSize }) => {
  const where = {
    ...(estado ? { estado } : {}),
    ...(metodoPago ? { metodoPago } : {}),
    ...(usuarioId ? { usuarioId } : {}),
    ...(manillaId ? { manillaId } : {}),
    ...(desde || hasta
      ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.recarga.count({ where }),
    prisma.recarga.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: incluirRelaciones,
    }),
  ]);

  return { total, page, pageSize, items: items.map(serializarRecarga) };
};
