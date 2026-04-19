"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.connectRedis = connectRedis;
exports.disconnectRedis = disconnectRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
let redisClient = null;
function getRedisClient() {
    if (!redisClient) {
        redisClient = new ioredis_1.default(env_1.env.REDIS_URL, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });
        redisClient.on('connect', () => console.log('✅ Redis connected'));
        redisClient.on('error', (err) => console.error('❌ Redis error:', err));
    }
    return redisClient;
}
async function connectRedis() {
    await getRedisClient().connect();
}
async function disconnectRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}
