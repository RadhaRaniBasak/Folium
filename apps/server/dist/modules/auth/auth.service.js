"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refreshTokens = refreshTokens;
exports.logout = logout;
exports.getUserById = getUserById;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
const AppError_1 = require("../../errors/AppError");
const User_model_1 = require("./models/User.model");
const RefreshToken_model_1 = require("./models/RefreshToken.model");
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
function generateAccessToken(userId, email) {
    return jsonwebtoken_1.default.sign({ userId, email }, env_1.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}
function generateRefreshToken(userId) {
    return jsonwebtoken_1.default.sign({ userId }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}
async function persistRefreshToken(userId, refreshToken) {
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    await RefreshToken_model_1.RefreshToken.create({ token: tokenHash, userId, expiresAt });
    const redis = (0, redis_1.getRedisClient)();
    await redis.set(`rt:${tokenHash}`, userId, 'EX', REFRESH_TOKEN_TTL_SECONDS);
}
async function invalidateRefreshToken(tokenHash) {
    await RefreshToken_model_1.RefreshToken.deleteOne({ token: tokenHash });
    const redis = (0, redis_1.getRedisClient)();
    await redis.del(`rt:${tokenHash}`);
}
function toSafeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
    };
}
async function register(name, email, password) {
    const existing = await User_model_1.User.findOne({ email: email.toLowerCase() });
    if (existing) {
        throw new AppError_1.AppError('Email already in use', 409);
    }
    const passwordHash = await bcryptjs_1.default.hash(password, BCRYPT_ROUNDS);
    const user = await User_model_1.User.create({ name, email, passwordHash });
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);
    await persistRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken, user: toSafeUser(user) };
}
async function login(email, password) {
    const user = await User_model_1.User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new AppError_1.AppError('Invalid credentials', 401);
    }
    const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new AppError_1.AppError('Invalid credentials', 401);
    }
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);
    await persistRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken, user: toSafeUser(user) };
}
async function refreshTokens(refreshToken) {
    // Verify signature
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
    }
    catch {
        throw new AppError_1.AppError('Invalid or expired refresh token', 401);
    }
    const tokenHash = hashToken(refreshToken);
    // Validate against Redis (fast path) or DB (fallback)
    const redis = (0, redis_1.getRedisClient)();
    const redisUserId = await redis.get(`rt:${tokenHash}`);
    if (!redisUserId) {
        const dbToken = await RefreshToken_model_1.RefreshToken.findOne({ token: tokenHash });
        if (!dbToken || dbToken.expiresAt < new Date()) {
            throw new AppError_1.AppError('Refresh token not found or expired', 401);
        }
    }
    await invalidateRefreshToken(tokenHash);
    const user = await User_model_1.User.findById(payload.userId);
    if (!user) {
        throw new AppError_1.AppError('User not found', 401);
    }
    const newRefreshToken = generateRefreshToken(payload.userId);
    await persistRefreshToken(payload.userId, newRefreshToken);
    const accessToken = generateAccessToken(payload.userId, user.email);
    return { accessToken, refreshToken: newRefreshToken };
}
async function logout(refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await invalidateRefreshToken(tokenHash);
}
async function getUserById(userId) {
    const user = await User_model_1.User.findById(userId);
    return user ? toSafeUser(user) : null;
}
