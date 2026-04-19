"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const AppError_1 = require("../errors/AppError");
const env_1 = require("../config/env");
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof AppError_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            stack: env_1.isDev ? err.stack : undefined,
        });
        return;
    }
    console.error('Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    const stack = err instanceof Error ? err.stack : undefined;
    res.status(500).json({
        success: false,
        message: env_1.isDev ? message : 'Internal server error',
        stack: env_1.isDev ? stack : undefined,
    });
};
exports.errorHandler = errorHandler;
