"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const app_1 = require("./app");
async function start() {
    await (0, db_1.connectDB)();
    await (0, redis_1.connectRedis)();
    const app = (0, app_1.createApp)();
    app.listen(env_1.env.PORT, () => {
        console.log(`🚀 Folium server running on http://localhost:${env_1.env.PORT}`);
        console.log(`   Health: http://localhost:${env_1.env.PORT}/api/health`);
    });
}
start().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
