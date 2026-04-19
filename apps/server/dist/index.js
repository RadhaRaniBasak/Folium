"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const shared_1 = require("@repo/shared");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get(shared_1.ROUTES.HEALTH, (_req, res) => {
    const response = {
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        },
    };
    res.status(shared_1.HTTP_STATUS.OK).json(response);
});
app.get('/', (_req, res) => {
    const response = {
        success: true,
        data: { message: `Welcome to ${shared_1.APP_NAME} API` },
    };
    res.status(shared_1.HTTP_STATUS.OK).json(response);
});
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : shared_1.DEFAULT_PORT;
app.listen(port, () => {
    console.log(`🚀 ${shared_1.APP_NAME} server running on http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}${shared_1.ROUTES.HEALTH}`);
});
