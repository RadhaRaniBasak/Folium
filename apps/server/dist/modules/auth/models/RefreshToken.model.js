"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshToken = void 0;
const mongoose_1 = require("mongoose");
const refreshTokenSchema = new mongoose_1.Schema({
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.RefreshToken = (0, mongoose_1.model)('RefreshToken', refreshTokenSchema);
