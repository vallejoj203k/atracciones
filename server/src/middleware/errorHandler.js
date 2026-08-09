import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { ApiError } from '../lib/errors.js';

export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars -- Express identifica el handler de errores por su aridad de 4.
export const errorHandler = (error, req, res, _next) => {
  let status = 500;
  let code = 'ERROR_INTERNO';
  let message = 'Ocurrio un error inesperado';
  let detalles;

  if (error instanceof ApiError) {
    ({ status, code, message, detalles } = error);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      status = 409;
      code = 'DUPLICADO';
      const campos = error.meta?.target;
      message = `Ya existe un registro con ese valor${campos ? ` (${campos})` : ''}`;
    } else if (error.code === 'P2025') {
      status = 404;
      code = 'NO_ENCONTRADO';
      message = 'El registro solicitado no existe';
    } else if (error.code === 'P2003') {
      status = 409;
      code = 'REFERENCIA_EN_USO';
      message = 'No se puede completar: el registro esta referenciado por otros datos';
    }
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400;
    code = 'JSON_INVALIDO';
    message = 'El cuerpo de la peticion no es JSON valido';
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(detalles ? { detalles } : {}),
      ...(env.isProduction || status < 500 ? {} : { stack: error.stack }),
    },
  });
};
