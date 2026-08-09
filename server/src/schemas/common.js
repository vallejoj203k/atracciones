import { z } from 'zod';

export const paginacion = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
};

export const fechaOpcional = z.coerce.date().optional();

/** Inicio del dia de hoy en la zona del servidor. */
export const inicioDeHoy = () => {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  return fecha;
};

/**
 * Rellena el rango cuando el cliente no lo manda: por defecto, el dia de hoy.
 */
export const resolverRango = ({ desde, hasta }) => ({
  desde: desde ?? inicioDeHoy(),
  hasta: hasta ?? new Date(),
});

export const codigoManilla = z
  .string()
  .trim()
  .min(3, 'El codigo es demasiado corto')
  .max(64, 'El codigo es demasiado largo');
