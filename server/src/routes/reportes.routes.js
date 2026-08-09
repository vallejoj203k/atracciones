import { Router } from 'express';
import { z } from 'zod';
import { getQuery, validate } from '../lib/validate.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { fechaOpcional, paginacion, resolverRango } from '../schemas/common.js';
import { ZONA_HORARIA_DEFECTO, dashboard, listarAuditoria, listarUsos } from '../services/reportes.service.js';

export const reportesRouter = Router();

reportesRouter.use(autenticar, requiereRol('ADMIN'));

const rangoSchema = z.object({
  desde: fechaOpcional,
  hasta: fechaOpcional,
  zonaHoraria: z.string().trim().max(64).default(ZONA_HORARIA_DEFECTO),
});

reportesRouter.get('/dashboard', validate(rangoSchema, 'query'), async (req, res) => {
  const query = getQuery(req);
  res.json(await dashboard({ ...resolverRango(query), zonaHoraria: query.zonaHoraria }));
});

const usosSchema = z.object({
  desde: fechaOpcional,
  hasta: fechaOpcional,
  atraccionId: z.string().uuid().optional(),
  operadorId: z.string().uuid().optional(),
  manillaId: z.string().uuid().optional(),
  ...paginacion,
});

reportesRouter.get('/usos', validate(usosSchema, 'query'), async (req, res) => {
  res.json(await listarUsos(getQuery(req)));
});

const auditoriaSchema = z.object({
  desde: fechaOpcional,
  hasta: fechaOpcional,
  entidad: z.string().trim().max(40).optional(),
  usuarioId: z.string().uuid().optional(),
  ...paginacion,
});

reportesRouter.get('/auditoria', validate(auditoriaSchema, 'query'), async (req, res) => {
  res.json(await listarAuditoria(getQuery(req)));
});
