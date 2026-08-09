import { Router } from 'express';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/audit.js';
import { serializarConfiguracion, toNumber } from '../lib/format.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { autenticar, requiereRol } from '../middleware/auth.js';
import { CONFIG_ID, obtenerConfiguracion } from '../services/configuracion.service.js';
import { proveedoresDisponibles } from '../services/pagos/index.js';

export const configuracionRouter = Router();

configuracionRouter.use(autenticar);

/**
 * Recepcion necesita leer el precio del punto y los datos de pago digital,
 * por eso la lectura no esta restringida a ADMIN.
 */
configuracionRouter.get('/', async (_req, res) => {
  const configuracion = await obtenerConfiguracion();
  res.json({
    configuracion: serializarConfiguracion(configuracion),
    pagos: proveedoresDisponibles(),
  });
});

const actualizarSchema = z.object({
  nombreNegocio: z.string().trim().min(1).max(120).optional(),
  moneda: z.string().trim().length(3).toUpperCase().optional(),
  precioPunto: z.coerce.number().min(0).max(100_000_000).optional(),
  cooldownSegundosDefault: z.coerce.number().int().min(0).max(3600).optional(),
  pagoDigitalTitular: z.string().trim().max(120).nullish(),
  pagoDigitalEntidad: z.string().trim().max(120).nullish(),
  pagoDigitalNumero: z.string().trim().max(60).nullish(),
  pagoDigitalInstrucciones: z.string().trim().max(500).nullish(),
  confirmacionDigitalManual: z.boolean().optional(),
});

configuracionRouter.put('/', requiereRol('ADMIN'), validate(actualizarSchema), async (req, res) => {
  const anterior = await obtenerConfiguracion();

  const configuracion = await prisma.configuracion.update({
    where: { id: CONFIG_ID },
    data: req.body,
  });

  await registrarAuditoria({
    req,
    accion: 'configuracion.actualizar',
    entidad: 'Configuracion',
    entidadId: CONFIG_ID,
    detalle: {
      cambios: req.body,
      precioPuntoAnterior: toNumber(anterior.precioPunto),
    },
  });

  res.json({ configuracion: serializarConfiguracion(configuracion) });
});
