import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { serializarUsuario } from '../lib/format.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { autenticar, requiereRol } from '../middleware/auth.js';

export const usuariosRouter = Router();

usuariosRouter.use(autenticar, requiereRol('ADMIN'));

const seleccion = {
  id: true,
  nombre: true,
  username: true,
  rol: true,
  activo: true,
  ultimoAcceso: true,
  atraccionId: true,
  atraccion: { select: { id: true, nombre: true } },
  createdAt: true,
};

usuariosRouter.get('/', async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    select: seleccion,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });
  res.json({ usuarios });
});

const baseSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9._-]+$/, 'Solo letras, numeros, punto, guion y guion bajo'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
  rol: z.enum(['ADMIN', 'RECEPCION', 'OPERADOR']),
  atraccionId: z.string().uuid().nullish(),
  activo: z.boolean().default(true),
});

/** Un operador sin atraccion asignada no puede escanear: se exige aqui. */
const validarAtraccion = async (rol, atraccionId) => {
  if (rol === 'OPERADOR') {
    if (!atraccionId) {
      throw ApiError.badRequest('Un operador necesita una atraccion asignada', 'ATRACCION_REQUERIDA');
    }
    const existe = await prisma.atraccion.findUnique({ where: { id: atraccionId } });
    if (!existe) throw ApiError.badRequest('La atraccion indicada no existe', 'ATRACCION_NO_ENCONTRADA');
    return atraccionId;
  }
  // Admin y recepcion no se atan a una atraccion.
  return null;
};

usuariosRouter.post('/', validate(baseSchema), async (req, res) => {
  const { password, ...datos } = req.body;
  const atraccionId = await validarAtraccion(datos.rol, datos.atraccionId);

  const usuario = await prisma.usuario.create({
    data: { ...datos, atraccionId, passwordHash: await bcrypt.hash(password, 10) },
    select: seleccion,
  });

  await registrarAuditoria({
    req,
    accion: 'usuario.crear',
    entidad: 'Usuario',
    entidadId: usuario.id,
    detalle: { username: usuario.username, rol: usuario.rol },
  });

  res.status(201).json({ usuario });
});

const actualizarSchema = baseSchema.partial().extend({
  password: z.string().min(8, 'Minimo 8 caracteres').optional(),
});

usuariosRouter.patch('/:id', validate(actualizarSchema), async (req, res) => {
  const actual = await prisma.usuario.findUnique({ where: { id: req.params.id } });
  if (!actual) throw ApiError.notFound('El usuario no existe', 'USUARIO_NO_ENCONTRADO');

  const { password, ...datos } = req.body;
  const rolFinal = datos.rol ?? actual.rol;

  // Evita que el ultimo admin se desactive o se degrade y deje el sistema
  // sin nadie que pueda administrarlo.
  const perderiaAdmin =
    actual.rol === 'ADMIN' && ((datos.rol && datos.rol !== 'ADMIN') || datos.activo === false);
  if (perderiaAdmin) {
    const adminsActivos = await prisma.usuario.count({
      where: { rol: 'ADMIN', activo: true, id: { not: actual.id } },
    });
    if (adminsActivos === 0) {
      throw ApiError.conflict('Debe quedar al menos un administrador activo', 'ULTIMO_ADMIN');
    }
  }

  const atraccionId =
    datos.rol !== undefined || datos.atraccionId !== undefined
      ? await validarAtraccion(rolFinal, datos.atraccionId ?? actual.atraccionId)
      : undefined;

  const usuario = await prisma.usuario.update({
    where: { id: req.params.id },
    data: {
      ...datos,
      ...(atraccionId !== undefined ? { atraccionId } : {}),
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    select: seleccion,
  });

  await registrarAuditoria({
    req,
    accion: 'usuario.actualizar',
    entidad: 'Usuario',
    entidadId: usuario.id,
    detalle: { ...datos, password: password ? '(cambiada)' : undefined },
  });

  res.json({ usuario });
});

/**
 * No se borran usuarios: quedan referenciados por recargas y usos, y borrarlos
 * destruiria la trazabilidad. Se desactivan.
 */
usuariosRouter.delete('/:id', async (req, res) => {
  if (req.params.id === req.usuario.id) {
    throw ApiError.conflict('No puedes desactivar tu propio usuario', 'AUTO_DESACTIVACION');
  }

  const actual = await prisma.usuario.findUnique({ where: { id: req.params.id } });
  if (!actual) throw ApiError.notFound('El usuario no existe', 'USUARIO_NO_ENCONTRADO');

  if (actual.rol === 'ADMIN') {
    const adminsActivos = await prisma.usuario.count({
      where: { rol: 'ADMIN', activo: true, id: { not: actual.id } },
    });
    if (adminsActivos === 0) {
      throw ApiError.conflict('Debe quedar al menos un administrador activo', 'ULTIMO_ADMIN');
    }
  }

  const usuario = await prisma.usuario.update({
    where: { id: req.params.id },
    data: { activo: false },
    select: seleccion,
  });

  await registrarAuditoria({ req, accion: 'usuario.desactivar', entidad: 'Usuario', entidadId: usuario.id });

  res.json({ usuario });
});
