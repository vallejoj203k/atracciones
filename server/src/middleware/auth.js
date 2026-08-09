import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export const firmarToken = (usuario) =>
  jwt.sign({ sub: usuario.id, rol: usuario.rol }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const extraerToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
};

/**
 * Verifica el JWT y recarga el usuario desde la base en cada request. Es una
 * consulta extra, pero permite desactivar a un trabajador o cambiarle la
 * atraccion asignada y que surta efecto de inmediato, sin esperar a que
 * expire su token (importante: los tokens de las estaciones duran 30 dias).
 */
export const autenticar = async (req, _res, next) => {
  const token = extraerToken(req);
  if (!token) return next(ApiError.unauthorized('Falta el token de autenticacion'));

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(ApiError.unauthorized('Sesion invalida o expirada', 'TOKEN_INVALIDO'));
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    include: { atraccion: { select: { id: true, nombre: true, activa: true, costoPuntos: true, cooldownSegundos: true } } },
  });

  if (!usuario) return next(ApiError.unauthorized('El usuario ya no existe', 'TOKEN_INVALIDO'));
  if (!usuario.activo) return next(ApiError.forbidden('Tu usuario esta desactivado', 'USUARIO_INACTIVO'));

  req.usuario = usuario;
  return next();
};

/** Restringe el endpoint a los roles indicados. */
export const requiereRol = (...roles) => (req, _res, next) => {
  if (!req.usuario) return next(ApiError.unauthorized());
  if (!roles.includes(req.usuario.rol)) {
    return next(ApiError.forbidden(`Esta accion requiere rol: ${roles.join(' o ')}`));
  }
  return next();
};
