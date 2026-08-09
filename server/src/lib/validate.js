import { ApiError } from './errors.js';

/**
 * Valida `req[source]` con un esquema Zod y reemplaza el valor por el
 * resultado parseado (ya con tipos convertidos y defaults aplicados).
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const detalles = result.error.issues.map((issue) => ({
      campo: issue.path.join('.') || '(raiz)',
      mensaje: issue.message,
    }));
    return next(ApiError.badRequest('Datos invalidos', 'VALIDACION', detalles));
  }

  // req.query es un getter de solo lectura en Express 5: se guarda aparte.
  if (source === 'query') {
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  return next();
};

export const getQuery = (req) => req.validatedQuery ?? req.query;
