import { Prisma } from '@prisma/client';
import { toNumber } from '../lib/format.js';
import { prisma } from '../lib/prisma.js';

export const ZONA_HORARIA_DEFECTO = 'America/Bogota';

/**
 * Dashboard del administrador.
 *
 * Solo cuentan como ingreso las recargas CONFIRMADAS: una transferencia
 * digital pendiente todavia no es plata en caja.
 */
export const dashboard = async ({ desde, hasta, zonaHoraria = ZONA_HORARIA_DEFECTO }) => {
  const rango = { gte: desde, lte: hasta };
  const recargasConfirmadas = { estado: 'CONFIRMADA', createdAt: rango };

  const [
    agregadoRecargas,
    porMetodo,
    pendientes,
    usosTotales,
    usosPorAtraccion,
    atracciones,
    manillasActivas,
    manillasConSaldo,
    puntosEnCirculacion,
    manillasNuevas,
    topOperadores,
    serieIngresos,
    serieUsos,
  ] = await Promise.all([
    prisma.recarga.aggregate({
      where: recargasConfirmadas,
      _sum: { montoTotal: true, puntos: true },
      _count: { _all: true },
    }),
    prisma.recarga.groupBy({
      by: ['metodoPago'],
      where: recargasConfirmadas,
      _sum: { montoTotal: true, puntos: true },
      _count: { _all: true },
    }),
    prisma.recarga.aggregate({
      where: { estado: 'PENDIENTE', createdAt: rango },
      _sum: { montoTotal: true },
      _count: { _all: true },
    }),
    prisma.uso.count({ where: { createdAt: rango } }),
    prisma.uso.groupBy({
      by: ['atraccionId'],
      where: { createdAt: rango },
      _sum: { puntosDescontados: true },
      _count: { _all: true },
    }),
    prisma.atraccion.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] }),
    prisma.manilla.count({ where: { estado: 'ACTIVA' } }),
    prisma.manilla.count({ where: { estado: 'ACTIVA', saldoPuntos: { gt: 0 } } }),
    prisma.manilla.aggregate({ where: { estado: 'ACTIVA' }, _sum: { saldoPuntos: true } }),
    prisma.manilla.count({ where: { createdAt: rango } }),
    prisma.uso.groupBy({
      by: ['operadorId'],
      where: { createdAt: rango },
      _count: { _all: true },
      orderBy: { _count: { operadorId: 'desc' } },
      take: 5,
    }),
    prisma.$queryRaw`
      SELECT to_char(date_trunc('day', r."createdAt" AT TIME ZONE ${zonaHoraria}), 'YYYY-MM-DD') AS dia,
             COALESCE(SUM(r."montoTotal"), 0)::float8 AS ingresos,
             COALESCE(SUM(r."puntos"), 0)::int        AS puntos,
             COUNT(*)::int                            AS recargas
      FROM "Recarga" r
      WHERE r."estado" = 'CONFIRMADA'
        AND r."createdAt" >= ${desde}
        AND r."createdAt" <= ${hasta}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw`
      SELECT to_char(date_trunc('day', u."createdAt" AT TIME ZONE ${zonaHoraria}), 'YYYY-MM-DD') AS dia,
             COUNT(*)::int AS usos
      FROM "Uso" u
      WHERE u."createdAt" >= ${desde}
        AND u."createdAt" <= ${hasta}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const operadores = topOperadores.length
    ? await prisma.usuario.findMany({
        where: { id: { in: topOperadores.map((o) => o.operadorId) } },
        select: { id: true, nombre: true },
      })
    : [];
  const nombreOperador = new Map(operadores.map((o) => [o.id, o.nombre]));

  const usosPorAtraccionMap = new Map(usosPorAtraccion.map((u) => [u.atraccionId, u]));

  // Une las dos series diarias en una sola lista para graficar.
  const dias = [...new Set([...serieIngresos.map((d) => d.dia), ...serieUsos.map((d) => d.dia)])].sort();
  const ingresosPorDia = new Map(serieIngresos.map((d) => [d.dia, d]));
  const usosPorDia = new Map(serieUsos.map((d) => [d.dia, d]));

  return {
    rango: { desde, hasta, zonaHoraria },
    ingresos: {
      total: toNumber(agregadoRecargas._sum.montoTotal) ?? 0,
      recargas: agregadoRecargas._count._all,
      puntosVendidos: agregadoRecargas._sum.puntos ?? 0,
      porMetodoPago: porMetodo.map((m) => ({
        metodoPago: m.metodoPago,
        total: toNumber(m._sum.montoTotal) ?? 0,
        puntos: m._sum.puntos ?? 0,
        recargas: m._count._all,
      })),
      pendientes: {
        cantidad: pendientes._count._all,
        total: toNumber(pendientes._sum.montoTotal) ?? 0,
      },
    },
    usos: {
      total: usosTotales,
      porAtraccion: atracciones.map((atraccion) => ({
        atraccionId: atraccion.id,
        nombre: atraccion.nombre,
        activa: atraccion.activa,
        usos: usosPorAtraccionMap.get(atraccion.id)?._count._all ?? 0,
        puntosConsumidos: usosPorAtraccionMap.get(atraccion.id)?._sum.puntosDescontados ?? 0,
      })),
      topOperadores: topOperadores.map((o) => ({
        operadorId: o.operadorId,
        nombre: nombreOperador.get(o.operadorId) ?? 'Desconocido',
        usos: o._count._all,
      })),
    },
    manillas: {
      activas: manillasActivas,
      conSaldo: manillasConSaldo,
      puntosEnCirculacion: puntosEnCirculacion._sum.saldoPuntos ?? 0,
      nuevasEnRango: manillasNuevas,
    },
    serieDiaria: dias.map((dia) => ({
      dia,
      ingresos: ingresosPorDia.get(dia)?.ingresos ?? 0,
      puntos: ingresosPorDia.get(dia)?.puntos ?? 0,
      recargas: ingresosPorDia.get(dia)?.recargas ?? 0,
      usos: usosPorDia.get(dia)?.usos ?? 0,
    })),
  };
};

/** Listado paginado de usos, para la pestaña de trazabilidad del admin. */
export const listarUsos = async ({ desde, hasta, atraccionId, operadorId, manillaId, page, pageSize }) => {
  const where = {
    ...(atraccionId ? { atraccionId } : {}),
    ...(operadorId ? { operadorId } : {}),
    ...(manillaId ? { manillaId } : {}),
    ...(desde || hasta
      ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.uso.count({ where }),
    prisma.uso.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        manilla: { select: { id: true, codigo: true } },
        atraccion: { select: { id: true, nombre: true } },
        operador: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  return { total, page, pageSize, items };
};

/** Bitacora de auditoria. */
export const listarAuditoria = async ({ desde, hasta, entidad, usuarioId, page, pageSize }) => {
  const where = {
    ...(entidad ? { entidad } : {}),
    ...(usuarioId ? { usuarioId } : {}),
    ...(desde || hasta
      ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { usuario: { select: { id: true, nombre: true, rol: true } } },
    }),
  ]);

  return { total, page, pageSize, items };
};

// Se exporta para que quede claro que Prisma.Decimal es el tipo de dinero.
export const DecimalDinero = Prisma.Decimal;
