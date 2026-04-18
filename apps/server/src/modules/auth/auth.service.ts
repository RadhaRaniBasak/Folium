import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { getRedisClient } from '../../config/redis';
import { AppError } from '../../errors/AppError';
import { User, IUser } from './models/User.model';
import { RefreshToken } from './models/RefreshToken.model';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

async function persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  // Persist hash in DB
  await RefreshToken.create({ token: tokenHash, userId, expiresAt });

  // Cache hash in Redis with TTL
  const redis = getRedisClient();
  await redis.set(`rt:${tokenHash}`, userId, 'EX', REFRESH_TOKEN_TTL_SECONDS);
}

async function invalidateRefreshToken(tokenHash: string): Promise<void> {
  await RefreshToken.deleteOne({ token: tokenHash });
  const redis = getRedisClient();
  await redis.del(`rt:${tokenHash}`);
}

function toSafeUser(user: IUser): { id: string; name: string; email: string; avatar?: string } {
  return {
    id: user.id as string,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: ReturnType<typeof toSafeUser> }> {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });

  const accessToken = generateAccessToken(user.id as string, user.email);
  const refreshToken = generateRefreshToken(user.id as string);
  await persistRefreshToken(user.id as string, refreshToken);

  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: ReturnType<typeof toSafeUser> }> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  const accessToken = generateAccessToken(user.id as string, user.email);
  const refreshToken = generateRefreshToken(user.id as string);
  await persistRefreshToken(user.id as string, refreshToken);

  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function refreshTokens(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Verify signature
  let payload: { userId: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const tokenHash = hashToken(refreshToken);

  // Validate against Redis (fast path) or DB (fallback)
  const redis = getRedisClient();
  const redisUserId = await redis.get(`rt:${tokenHash}`);
  if (!redisUserId) {
    const dbToken = await RefreshToken.findOne({ token: tokenHash });
    if (!dbToken || dbToken.expiresAt < new Date()) {
      throw new AppError('Refresh token not found or expired', 401);
    }
  }

  // Rotate: invalidate old, issue new
  await invalidateRefreshToken(tokenHash);

  // Re-fetch user email for the access token
  const user = await User.findById(payload.userId);
  if (!user) {
    throw new AppError('User not found', 401);
  }

  const newRefreshToken = generateRefreshToken(payload.userId);
  await persistRefreshToken(payload.userId, newRefreshToken);

  const accessToken = generateAccessToken(payload.userId, user.email);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await invalidateRefreshToken(tokenHash);
}

export async function getUserById(
  userId: string,
): Promise<ReturnType<typeof toSafeUser> | null> {
  const user = await User.findById(userId);
  return user ? toSafeUser(user) : null;
}
