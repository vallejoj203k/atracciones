import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { registrarAuditoria } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { serializarUsuario } from '../lib/format.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { autenticar, firmarToken } from '../middleware/auth.js';

export const authRouter = Router();

// Freno a la fuerza bruta contra las credenciales de los trabajadores.
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos, espera unos minutos' } },
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contrasena requerida'),
});

authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const username = req.body.username.toLowerCase();

  const usuario = await prisma.usuario.findUnique({
    where: { username },
    include: { atraccion: { select: { id: true, nombre: true, activa: true } } },
  });

  // Mismo mensaje para usuario inexistente y clave errada: no se le regala
  // al atacante la informacion de que usuarios existen.
  const credencialesInvalidas = ApiError.unauthorized('Usuario o contrasena incorrectos', 'CREDENCIALES_INVALIDAS');

  if (!usuario) {
    // Hash de descarte para que el tiempo de respuesta no delate la ausencia.
    await bcrypt.compare(req.body.password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    throw credencialesInvalidas;
  }

  const coincide = await bcrypt.compare(req.body.password, usuario.passwordHash);
  if (!coincide) throw credencialesInvalidas;
  if (!usuario.activo) throw ApiError.forbidden('Tu usuario esta desactivado', 'USUARIO_INACTIVO');

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });

  await registrarAuditoria({
    req: { usuario, ip: req.ip },
    accion: 'auth.login',
    entidad: 'Usuario',
    entidadId: usuario.id,
  });

  res.json({ token: firmarToken(usuario), usuario: serializarUsuario(usuario) });
});

authRouter.get('/me', autenticar, async (req, res) => {
  res.json({ usuario: serializarUsuario(req.usuario) });
});

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Contrasena actual requerida'),
  passwordNueva: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres'),
});

authRouter.post('/cambiar-password', autenticar, validate(cambiarPasswordSchema), async (req, res) => {
  const coincide = await bcrypt.compare(req.body.passwordActual, req.usuario.passwordHash);
  if (!coincide) throw ApiError.badRequest('La contrasena actual no es correcta', 'PASSWORD_INCORRECTA');

  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { passwordHash: await bcrypt.hash(req.body.passwordNueva, 10) },
  });

  await registrarAuditoria({
    req,
    accion: 'auth.cambiar_password',
    entidad: 'Usuario',
    entidadId: req.usuario.id,
  });

  res.json({ ok: true });
});
