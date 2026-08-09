import { Router } from 'express';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { obtenerConfiguracion } from '../services/configuracion.service.js';

export const atraccionesRouter = Router();

atraccionesRouter.use(autenticar);

/** Cualquier usuario autenticado puede listarlas (la estacion las necesita). */
atraccionesRouter.get('/', async (_req, res) => {
  const atracciones = await prisma.atraccion.findMany({
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  });
  res.json({ atracciones });
});

const crearSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  descripcion: z.string().trim().max(500).optional(),
  costoPuntos: z.coerce.number().int().min(1).max(50).default(1),
  cooldownSegundos: z.coerce.number().int().min(0).max(3600).optional(),
  activa: z.boolean().default(true),
  orden: z.coerce.number().int().min(0).default(0),
});

// No hay limite de 3 atracciones: agregar una cuarta es solo crear un registro
// y un usuario operador para su estacion.
atraccionesRouter.post('/', requiereRol('ADMIN'), validate(crearSchema), async (req, res) => {
  const configuracion = await obtenerConfiguracion();
  const atraccion = await prisma.atraccion.create({
    data: {
      ...req.body,
      cooldownSegundos: req.body.cooldownSegundos ?? configuracion.cooldownSegundosDefault,
    },
  });

  await registrarAuditoria({
    req,
    accion: 'atraccion.crear',
    entidad: 'Atraccion',
    entidadId: atraccion.id,
    detalle: { nombre: atraccion.nombre },
  });

  res.status(201).json({ atraccion });
});

const actualizarSchema = crearSchema.partial();

atraccionesRouter.patch('/:id', requiereRol('ADMIN'), validate(actualizarSchema), async (req, res) => {
  const atraccion = await prisma.atraccion.update({ where: { id: req.params.id }, data: req.body });

  await registrarAuditoria({
    req,
    accion: 'atraccion.actualizar',
    entidad: 'Atraccion',
    entidadId: atraccion.id,
    detalle: req.body,
  });

  res.json({ atraccion });
});

/**
 * Solo se permite borrar una atraccion sin historial. Si ya tiene usos
 * registrados hay que desactivarla, para no romper los reportes.
 */
atraccionesRouter.delete('/:id', requiereRol('ADMIN'), async (req, res) => {
  const usos = await prisma.uso.count({ where: { atraccionId: req.params.id } });
  if (usos > 0) {
    throw ApiError.conflict(
      `Esta atraccion ya tiene ${usos} usos registrados. Desactivala en lugar de borrarla.`,
      'ATRACCION_CON_HISTORIAL'
    );
  }

  await prisma.atraccion.delete({ where: { id: req.params.id } });

  await registrarAuditoria({ req, accion: 'atraccion.eliminar', entidad: 'Atraccion', entidadId: req.params.id });

  res.json({ ok: true });
});
