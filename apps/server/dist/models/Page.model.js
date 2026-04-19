"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Page = void 0;
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
const pageSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    content: { type: mongoose_1.Schema.Types.Mixed, default: [] },
    workspace: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    parent: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Page', default: null },
    icon: { type: String },
    coverImage: { type: String },
    isFavorited: { type: Map, of: Boolean, default: {} },
}, { timestamps: true });
pageSchema.index({ workspace: 1, slug: 1 }, { unique: true });
pageSchema.index({ workspace: 1 });
pageSchema.index({ parent: 1 });
pageSchema.pre('save', async function (next) {
    if (!this.isModified('title') && this.slug) {
        return next();
    }
    const base = slugify(this.title);
    let slug = base;
    let suffix = 1;
    while (await exports.Page.exists({ workspace: this.workspace, slug, _id: { $ne: this._id } })) {
        slug = `${base}-${suffix}`;
        suffix += 1;
    }
    this.slug = slug;
    next();
});
exports.Page = (0, mongoose_1.model)('Page', pageSchema);
