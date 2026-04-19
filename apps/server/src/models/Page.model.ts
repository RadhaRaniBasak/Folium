import { Schema, model, Document, Types } from 'mongoose';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}
export type BlockContent = Record<string, unknown>[];

export interface IPage extends Document {
  title: string;
  slug: string;
  content: BlockContent;
  workspace: Types.ObjectId;
  parent: Types.ObjectId | null;
  icon?: string;
  coverImage?: string;
  isFavorited: Map<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<IPage>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    content: { type: Schema.Types.Mixed, default: [] },
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Page', default: null },
    icon: { type: String },
    coverImage: { type: String },
    isFavorited: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true },
);
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

  while (
    await Page.exists({ workspace: this.workspace, slug, _id: { $ne: this._id } })
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  this.slug = slug;
  next();
});

export const Page = model<IPage>('Page', pageSchema);
