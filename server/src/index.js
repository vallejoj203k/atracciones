import { crearApp } from './app.js';
import { env, validarEntornoServidor } from './config/env.js';
import { prisma } from './lib/prisma.js';

validarEntornoServidor();

const app = crearApp();

const server = app.listen(env.port, () => {
  console.log(`[mirador] API escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
  if (env.serveWeb) console.log(`[mirador] Sirviendo frontend desde ${env.webDist}`);
});

const apagar = async (senal) => {
  console.log(`[mirador] ${senal} recibido, cerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Si algo queda colgado, no dejamos el contenedor bloqueado.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
