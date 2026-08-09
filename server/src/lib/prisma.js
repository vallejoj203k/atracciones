import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// `globalThis` evita abrir un pool nuevo en cada recarga de `node --watch`.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__miradorPrisma ??
  new PrismaClient({
    log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProduction) globalForPrisma.__miradorPrisma = prisma;
