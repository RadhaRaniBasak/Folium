"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = exports.env = void 0;
require("dotenv/config");
function requireEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
exports.env = {
    NODE_ENV: process.env['NODE_ENV'] ?? 'development',
    PORT: parseInt(process.env['PORT'] ?? '3001', 10),
    MONGO_URI: requireEnv('MONGO_URI'),
    REDIS_URL: requireEnv('REDIS_URL'),
    JWT_SECRET: requireEnv('JWT_SECRET'),
    JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
    CLIENT_URL: requireEnv('CLIENT_URL'),
};
exports.isDev = exports.env.NODE_ENV === 'development';
