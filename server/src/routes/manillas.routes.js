import { Router } from 'express';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { getQuery, validate } from '../lib/validate.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { codigoManilla, paginacion } from '../schemas/common.js';
import {
  crearLote,
  crearManilla,
  detallePorCodigo,
  listarManillas,
} from '../services/manillas.service.js';

export const manillasRouter = Router();

manillasRouter.use(autenticar, requiereRol('ADMIN', 'RECEPCION'));

const listarSchema = z.object({
  busqueda: z.string().trim().optional(),
  estado: z.enum(['ACTIVA', 'INACTIVA']).optional(),
  conSaldo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  ...paginacion,
});

manillasRouter.get('/', validate(listarSchema, 'query'), async (req, res) => {
  res.json(await listarManillas(getQuery(req)));
});

const crearSchema = z.object({
  // Sin codigo -> el sistema lo genera (sticker por imprimir).
  // Con codigo -> se registra una manilla que ya venia preimpresa.
  codigo: codigoManilla.optional(),
  nombreVisitante: z.string().trim().max(120).optional(),
  notas: z.string().trim().max(500).optional(),
});

manillasRouter.post('/', validate(crearSchema), async (req, res) => {
  const manilla = await crearManilla({ ...req.body, creadaPorId: req.usuario.id });

  await registrarAuditoria({
    req,
    accion: 'manilla.crear',
    entidad: 'Manilla',
    entidadId: manilla.id,
    detalle: { codigo: manilla.codigo, origen: manilla.origen },
  });

  res.status(201).json({ manilla });
});

const loteSchema = z.object({
  cantidad: z.coerce.number().int().min(1).max(500),
});

manillasRouter.post('/lote', validate(loteSchema), async (req, res) => {
  const manillas = await crearLote({ cantidad: req.body.cantidad, creadaPorId: req.usuario.id });

  await registrarAuditoria({
    req,
    accion: 'manilla.crear_lote',
    entidad: 'Manilla',
    detalle: { cantidad: manillas.length },
  });

  res.status(201).json({ manillas });
});

manillasRouter.get('/:codigo', async (req, res) => {
  res.json({ manilla: await detallePorCodigo(req.params.codigo) });
});

const actualizarSchema = z.object({
  estado: z.enum(['ACTIVA', 'INACTIVA']).optional(),
  nombreVisitante: z.string().trim().max(120).nullish(),
  notas: z.string().trim().max(500).nullish(),
});

manillasRouter.patch('/:id', validate(actualizarSchema), async (req, res) => {
  const manilla = await prisma.manilla.update({ where: { id: req.params.id }, data: req.body });

  await registrarAuditoria({
    req,
    accion: 'manilla.actualizar',
    entidad: 'Manilla',
    entidadId: manilla.id,
    detalle: req.body,
  });

  res.json({ manilla });
});
