"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandler = registerHandler;
exports.loginHandler = loginHandler;
exports.refreshHandler = refreshHandler;
exports.logoutHandler = logoutHandler;
exports.meHandler = meHandler;
const authService = __importStar(require("./auth.service"));
const AppError_1 = require("../../errors/AppError");
async function registerHandler(req, res, next) {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            throw new AppError_1.AppError('name, email, and password are required', 400);
        }
        const result = await authService.register(name, email, password);
        res.status(201).json({ success: true, data: result, message: 'Registration successful' });
    }
    catch (err) {
        next(err);
    }
}
async function loginHandler(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new AppError_1.AppError('email and password are required', 400);
        }
        const result = await authService.login(email, password);
        res.status(200).json({ success: true, data: result, message: 'Login successful' });
    }
    catch (err) {
        next(err);
    }
}
async function refreshHandler(req, res, next) {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new AppError_1.AppError('refreshToken is required', 400);
        }
        const tokens = await authService.refreshTokens(refreshToken);
        res.status(200).json({ success: true, data: tokens, message: 'Tokens refreshed' });
    }
    catch (err) {
        next(err);
    }
}
async function logoutHandler(req, res, next) {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new AppError_1.AppError('refreshToken is required', 400);
        }
        await authService.logout(refreshToken);
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
    catch (err) {
        next(err);
    }
}
async function meHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new AppError_1.AppError('Unauthorized', 401);
        }
        const user = await authService.getUserById(req.user.userId);
        if (!user) {
            throw new AppError_1.AppError('User not found', 404);
        }
        res.status(200).json({ success: true, data: { user }, message: 'User fetched' });
    }
    catch (err) {
        next(err);
    }
}
