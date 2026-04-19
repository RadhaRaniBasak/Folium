"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authenticateJWT_1 = require("../../middleware/authenticateJWT");
const auth_controller_1 = require("./auth.controller");
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15-minute rate-limit window
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
const router = (0, express_1.Router)();
router.post('/register', authLimiter, auth_controller_1.registerHandler);
router.post('/login', authLimiter, auth_controller_1.loginHandler);
router.post('/refresh', authLimiter, auth_controller_1.refreshHandler);
router.post('/logout', authLimiter, auth_controller_1.logoutHandler);
router.get('/me', apiLimiter, authenticateJWT_1.authenticateJWT, auth_controller_1.meHandler);
exports.default = router;
