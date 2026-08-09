import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const serverRoot = path.resolve(__dirname, '..', '..');
export const repoRoot = path.resolve(serverRoot, '..');

// Se aceptan server/.env y un .env en la raiz del repo (comodo en desarrollo).
// En Railway las variables llegan por el entorno y no hay archivos .env.
for (const file of [path.join(serverRoot, '.env'), path.join(repoRoot, '.env')]) {
  if (existsSync(file)) dotenv.config({ path: file });
}

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'dev-secret-no-usar-en-produccion');

// Todo lo que toca la base necesita esto, incluido el seed.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no esta definida. Revisa tu archivo .env o las variables del entorno.');
}

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: int(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  serveWeb: bool(process.env.SERVE_WEB, isProduction),
  webDist: path.join(repoRoot, 'web', 'dist'),
  seed: {
    adminUsername: process.env.SEED_ADMIN_USERNAME || 'admin',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'cambiar123',
    adminNombre: process.env.SEED_ADMIN_NOMBRE || 'Administrador',
  },
  pagos: {
    proveedor: (process.env.PAGOS_PROVEEDOR || 'manual').toLowerCase(),
    wompi: {
      publicKey: process.env.WOMPI_PUBLIC_KEY || '',
      privateKey: process.env.WOMPI_PRIVATE_KEY || '',
      eventsSecret: process.env.WOMPI_EVENTS_SECRET || '',
      integritySecret: process.env.WOMPI_INTEGRITY_SECRET || '',
      baseUrl: process.env.WOMPI_BASE_URL || 'https://production.wompi.co/v1',
    },
  },
};

/**
 * Comprobaciones que solo aplican al proceso que atiende peticiones.
 *
 * Va aparte del cuerpo del modulo a proposito: el seed y las tareas de
 * mantenimiento tambien importan `env` y no firman tokens, asi que un
 * JWT_SECRET ausente no debe impedir que se ejecuten. El unico que se niega a
 * arrancar sin un secreto fuerte es el servidor HTTP.
 */
export const validarEntornoServidor = () => {
  if (env.isProduction && env.jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET es obligatorio en produccion y debe tener al menos 32 caracteres. ' +
        'Generalo con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
};
