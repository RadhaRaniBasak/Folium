import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import { isDev } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      stack: isDev ? err.stack : undefined,
    });
    return;
  }

  console.error('Unexpected error:', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  const stack = err instanceof Error ? err.stack : undefined;

  res.status(500).json({
    success: false,
    message: isDev ? message : 'Internal server error',
    stack: isDev ? stack : undefined,
  });
};
