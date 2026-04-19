"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const mongoose_1 = require("mongoose");
function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '');
}
const WORKSPACE_ROLES = ['owner', 'editor', 'viewer'];
const workspaceMemberSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
        type: String,
        enum: WORKSPACE_ROLES,
        required: true,
    },
}, { _id: false });
const workspaceSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    owner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [workspaceMemberSchema], default: [] },
    icon: { type: String },
    coverImage: { type: String },
}, { timestamps: true });
workspaceSchema.pre('save', async function (next) {
    if (!this.isModified('name') && this.slug) {
        return next();
    }
    const base = slugify(this.name);
    let slug = base;
    let suffix = 1;
    while (await exports.Workspace.exists({ slug, _id: { $ne: this._id } })) {
        slug = `${base}-${suffix}`;
        suffix += 1;
    }
    this.slug = slug;
    next();
});
exports.Workspace = (0, mongoose_1.model)('Workspace');
