import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import authRouter from './modules/auth/auth.routes';
import workspacesRouter from './modules/workspaces/workspaces.routes';
import pagesRouter from './modules/pages/pages.routes';
import blocksRouter from './modules/blocks/blocks.routes';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() },
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspacesRouter);

  // these routers include full paths (for simplicity)
  app.use('/api', pagesRouter);
  app.use('/api', blocksRouter);

  app.use(errorHandler);
  return app;
}
