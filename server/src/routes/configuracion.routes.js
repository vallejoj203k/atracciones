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
  nombreNegocio: z.string().trim().min(1, 'No puede quedar vacio').max(120, 'Maximo 120 caracteres').optional(),
  moneda: z.string().trim().length(3, 'Usa el codigo de 3 letras, ej. COP').toUpperCase().optional(),
  precioPunto: z.coerce.number().min(0, 'No puede ser negativo').max(100_000_000, 'Precio demasiado alto').optional(),
  cooldownSegundosDefault: z.coerce
    .number()
    .int()
    .min(0, 'No puede ser negativo')
    .max(3600, 'Maximo 3600 segundos (1 hora)')
    .optional(),
  pagoDigitalTitular: z.string().trim().max(120, 'Maximo 120 caracteres').nullish(),
  pagoDigitalEntidad: z.string().trim().max(120, 'Maximo 120 caracteres').nullish(),
  pagoDigitalNumero: z.string().trim().max(60, 'Maximo 60 caracteres').nullish(),
  pagoDigitalInstrucciones: z.string().trim().max(500, 'Maximo 500 caracteres').nullish(),
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
