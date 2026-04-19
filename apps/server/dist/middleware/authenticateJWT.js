"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const AppError_1 = require("../errors/AppError");
function authenticateJWT(req, _res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new AppError_1.AppError('Unauthorized — missing Bearer token', 401));
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.user = { userId: decoded.userId, email: decoded.email };
        next();
    }
    catch {
        next(new AppError_1.AppError('Invalid or expired access token', 401));
    }
}
