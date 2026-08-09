import { Router } from 'express';
import { z } from 'zod';
import { getQuery, validate } from '../lib/validate.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { codigoManilla, fechaOpcional, paginacion } from '../schemas/common.js';
import {
  anularRecarga,
  confirmarRecarga,
  crearRecarga,
  listarRecargas,
} from '../services/recargas.service.js';

export const recargasRouter = Router();

recargasRouter.use(autenticar);

const crearSchema = z.object({
  codigoManilla,
  /** Permite recargar una manilla preimpresa que aun no esta en el sistema. */
  crearSiNoExiste: z.boolean().default(false),
  nombreVisitante: z.string().trim().max(120).optional(),
  puntos: z.coerce.number().int().min(1, 'Minimo 1 punto').max(500, 'Maximo 500 puntos por recarga'),
  metodoPago: z.enum(['EFECTIVO', 'DIGITAL']),
  /** Numero de comprobante / referencia de la transferencia. */
  referenciaPago: z.string().trim().max(120).optional(),
});

recargasRouter.post('/', requiereRol('ADMIN', 'RECEPCION'), validate(crearSchema), async (req, res) => {
  const resultado = await crearRecarga({ ...req.body, usuario: req.usuario, req });
  res.status(201).json(resultado);
});

const listarSchema = z.object({
  desde: fechaOpcional,
  hasta: fechaOpcional,
  estado: z.enum(['PENDIENTE', 'CONFIRMADA', 'ANULADA']).optional(),
  metodoPago: z.enum(['EFECTIVO', 'DIGITAL']).optional(),
  usuarioId: z.string().uuid().optional(),
  manillaId: z.string().uuid().optional(),
  ...paginacion,
});

recargasRouter.get('/', requiereRol('ADMIN', 'RECEPCION'), validate(listarSchema, 'query'), async (req, res) => {
  res.json(await listarRecargas(getQuery(req)));
});

recargasRouter.post('/:id/confirmar', requiereRol('ADMIN', 'RECEPCION'), async (req, res) => {
  const recarga = await confirmarRecarga({ id: req.params.id, usuario: req.usuario, req });
  res.json({ recarga });
});

const anularSchema = z.object({
  motivo: z.string().trim().max(300).optional(),
});

// Anular mueve plata y puntos: se reserva al administrador.
recargasRouter.post('/:id/anular', requiereRol('ADMIN'), validate(anularSchema), async (req, res) => {
  const recarga = await anularRecarga({ id: req.params.id, motivo: req.body.motivo, usuario: req.usuario, req });
  res.json({ recarga });
});
