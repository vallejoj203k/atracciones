import { Router } from 'express';
import { z } from 'zod';
import { getQuery, validate } from '../lib/validate.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { codigoManilla } from '../schemas/common.js';
import { registrarEscaneo, resolverAtraccion, resumenDelDia } from '../services/escaneos.service.js';

export const escaneosRouter = Router();

escaneosRouter.use(autenticar, requiereRol('OPERADOR', 'ADMIN', 'RECEPCION'));

const escanearSchema = z.object({
  codigo: codigoManilla,
  /** Opcional para OPERADOR: se toma la atraccion que tiene asignada. */
  atraccionId: z.string().uuid().optional(),
});

/**
 * Endpoint que usa la estacion de atraccion.
 * Responde 200 incluso cuando el acceso se niega: el resultado del negocio
 * viaja en `resultado` para que la pantalla lo pinte en verde o en rojo.
 */
escaneosRouter.post('/', validate(escanearSchema), async (req, res) => {
  const atraccion = await resolverAtraccion(req.usuario, req.body.atraccionId);
  const resultado = await registrarEscaneo({
    codigo: req.body.codigo,
    atraccion,
    operador: req.usuario,
  });
  res.json(resultado);
});

const resumenSchema = z.object({
  atraccionId: z.string().uuid().optional(),
});

/** Contador de usos del dia que la estacion muestra en pantalla. */
escaneosRouter.get('/resumen', validate(resumenSchema, 'query'), async (req, res) => {
  const atraccion = await resolverAtraccion(req.usuario, getQuery(req).atraccionId);
  const resumen = await resumenDelDia({
    atraccionId: atraccion.id,
    operadorId: req.usuario.rol === 'OPERADOR' ? req.usuario.id : undefined,
  });
  res.json({
    atraccion: { id: atraccion.id, nombre: atraccion.nombre, activa: atraccion.activa, costoPuntos: atraccion.costoPuntos },
    ...resumen,
  });
});
