/**
 * Error de negocio con codigo HTTP y un `code` estable que el frontend puede
 * usar para decidir que mensaje mostrar sin depender del texto.
 */
export class ApiError extends Error {
  constructor(status, code, message, detalles = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detalles = detalles;
  }

  static badRequest(message, code = 'SOLICITUD_INVALIDA', detalles) {
    return new ApiError(400, code, message, detalles);
  }

  static unauthorized(message = 'No autenticado', code = 'NO_AUTENTICADO') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'No tienes permiso para esta accion', code = 'SIN_PERMISO') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Recurso no encontrado', code = 'NO_ENCONTRADO') {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = 'CONFLICTO') {
    return new ApiError(409, code, message);
  }
}
