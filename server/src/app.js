import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

export const crearApp = () => {
  const app = express();

  // Railway y cualquier proxy: necesario para que req.ip y el rate limit vean
  // la IP real del cliente y no la del balanceador.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // El frontend se sirve desde el mismo origen y usa la camara; la CSP por
      // defecto de helmet rompe el bundle de Vite, asi que se desactiva aqui
      // y se confia en el resto de cabeceras.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  const permitirTodo = env.corsOrigins.length === 0 || env.corsOrigins.includes('*');
  app.use(
    cors({
      origin: permitirTodo ? true : env.corsOrigins,
      credentials: false,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.use('/api', apiRouter);

  // Un solo servicio en Railway: Express tambien entrega el frontend compilado.
  if (env.serveWeb && existsSync(env.webDist)) {
    app.use(express.static(env.webDist, { index: false, maxAge: '1h' }));

    // SPA fallback: cualquier ruta que no sea /api la resuelve React Router.
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(env.webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
