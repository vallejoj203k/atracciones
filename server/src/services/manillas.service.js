import { randomInt } from 'node:crypto';
import { ApiError } from '../lib/errors.js';
import { normalizarCodigo } from '../lib/format.js';
import { prisma } from '../lib/prisma.js';

// Alfabeto Crockford sin I, L, O, U: evita confundir 0/O y 1/I/L cuando un
// codigo hay que teclearlo a mano porque el QR esta rayado o mojado.
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIJO = 'MIR';

const bloque = (largo) =>
  Array.from({ length: largo }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/** Genera un codigo tipo MIR-4H7K-92QX (~1.1e12 combinaciones). */
export const generarCodigo = () => `${PREFIJO}-${bloque(4)}-${bloque(4)}`;

/** Genera un codigo garantizando que no exista ya en la base. */
const generarCodigoUnico = async (tx = prisma) => {
  for (let intento = 0; intento < 10; intento += 1) {
    const codigo = generarCodigo();
    const existe = await tx.manilla.findUnique({ where: { codigo }, select: { id: true } });
    if (!existe) return codigo;
  }
  throw ApiError.conflict('No se pudo generar un codigo unico, intenta de nuevo', 'CODIGO_NO_GENERADO');
};

export const buscarPorCodigo = async (codigo, tx = prisma) =>
  tx.manilla.findUnique({ where: { codigo: normalizarCodigo(codigo) } });

/**
 * Crea una manilla. Si `codigo` viene, se registra una manilla preimpresa;
 * si no, el sistema genera el codigo para imprimir el sticker.
 */
export const crearManilla = async ({ codigo, nombreVisitante, notas, creadaPorId }, tx = prisma) => {
  const codigoFinal = codigo ? normalizarCodigo(codigo) : await generarCodigoUnico(tx);

  if (codigo) {
    const existente = await tx.manilla.findUnique({ where: { codigo: codigoFinal } });
    if (existente) throw ApiError.conflict('Ya existe una manilla con ese codigo', 'MANILLA_DUPLICADA');
  }

  return tx.manilla.create({
    data: {
      codigo: codigoFinal,
      origen: codigo ? 'PREIMPRESO' : 'GENERADO',
      nombreVisitante: nombreVisitante || null,
      notas: notas || null,
      creadaPorId: creadaPorId ?? null,
    },
  });
};

/** Genera un lote de manillas vacias para imprimir stickers. */
export const crearLote = async ({ cantidad, creadaPorId }) => {
  const codigos = new Set();
  while (codigos.size < cantidad) codigos.add(generarCodigo());

  // createManyAndReturn falla si algun codigo ya existia; con 1.1e12
  // combinaciones es practicamente imposible, pero si pasa se reintenta.
  for (let intento = 0; intento < 3; intento += 1) {
    const lista = [...codigos];
    const existentes = await prisma.manilla.findMany({
      where: { codigo: { in: lista } },
      select: { codigo: true },
    });

    if (existentes.length === 0) {
      return prisma.manilla.createManyAndReturn({
        data: lista.map((codigo) => ({ codigo, origen: 'GENERADO', creadaPorId: creadaPorId ?? null })),
      });
    }

    for (const { codigo } of existentes) codigos.delete(codigo);
    while (codigos.size < cantidad) codigos.add(generarCodigo());
  }

  throw ApiError.conflict('No se pudo generar el lote, intenta de nuevo', 'LOTE_NO_GENERADO');
};

/** Detalle de una manilla con su historial reciente. */
export const detallePorCodigo = async (codigo) => {
  const manilla = await prisma.manilla.findUnique({
    where: { codigo: normalizarCodigo(codigo) },
    include: {
      creadaPor: { select: { id: true, nombre: true } },
      recargas: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { usuario: { select: { id: true, nombre: true } } },
      },
      usos: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          atraccion: { select: { id: true, nombre: true } },
          operador: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  if (!manilla) throw ApiError.notFound('No existe una manilla con ese codigo', 'MANILLA_NO_ENCONTRADA');
  return manilla;
};

export const listarManillas = async ({ busqueda, estado, conSaldo, page, pageSize }) => {
  const where = {
    ...(estado ? { estado } : {}),
    ...(conSaldo === true ? { saldoPuntos: { gt: 0 } } : {}),
    ...(conSaldo === false ? { saldoPuntos: { lte: 0 } } : {}),
    ...(busqueda
      ? {
          OR: [
            { codigo: { contains: normalizarCodigo(busqueda) } },
            { nombreVisitante: { contains: busqueda, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.manilla.count({ where }),
    prisma.manilla.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { creadaPor: { select: { id: true, nombre: true } } },
    }),
  ]);

  return { total, page, pageSize, items };
};
