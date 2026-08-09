import { Router } from 'express';
import { atraccionesRouter } from './atracciones.routes.js';
import { authRouter } from './auth.routes.js';
import { configuracionRouter } from './configuracion.routes.js';
import { escaneosRouter } from './escaneos.routes.js';
import { manillasRouter } from './manillas.routes.js';
import { recargasRouter } from './recargas.routes.js';
import { reportesRouter } from './reportes.routes.js';
import { usuariosRouter } from './usuarios.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/atracciones', atraccionesRouter);
apiRouter.use('/manillas', manillasRouter);
apiRouter.use('/recargas', recargasRouter);
apiRouter.use('/escaneos', escaneosRouter);
apiRouter.use('/usuarios', usuariosRouter);
apiRouter.use('/configuracion', configuracionRouter);
apiRouter.use('/reportes', reportesRouter);
