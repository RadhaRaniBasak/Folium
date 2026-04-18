import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { AppError } from '../../errors/AppError';

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };
    if (!name || !email || !password) {
      throw new AppError('name, email and password are required', 400);
    }

    const result = await authService.register(name, email, password);
    res.status(201).json({ success: true, data: result, message: 'Registration successful' });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      throw new AppError('email and password are required', 400);
    }

    const result = await authService.login(email, password);
    res.status(200).json({ success: true, data: result, message: 'Login successful' });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      throw new AppError('refreshToken is required', 400);
    }

    const tokens = await authService.refreshTokens(refreshToken);
    res.status(200).json({ success: true, data: tokens, message: 'Tokens refreshed' });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      throw new AppError('refreshToken is required', 400);
    }

    await authService.logout(refreshToken);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const user = await authService.getUserById(req.user.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({ success: true, data: { user }, message: 'User fetched' });
  } catch (err) {
    next(err);
  }
}
