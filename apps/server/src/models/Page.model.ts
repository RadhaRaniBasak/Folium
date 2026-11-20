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

export const PAGE_FONTS = ['sans', 'serif', 'mono'] as const;
export type PageFont = (typeof PAGE_FONTS)[number];

export interface IPage extends Document {
  title: string;
  slug: string;
  content: BlockContent;
  /** Plain-text snapshot of the blocks, used for search and snippets. */
  text: string;
  workspace: Types.ObjectId;
  parent: Types.ObjectId | null;
  /** Position among siblings in the sidebar (fractional values allowed). */
  order: number;
  icon?: string;
  coverImage?: string;
  fullWidth: boolean;
  font: PageFont;
  isFavorited: Map<string, boolean>;
  createdBy?: Types.ObjectId;
  lastEditedBy?: Types.ObjectId;
  /** Set when the page is in the trash. */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<IPage>(
  {
    // Empty titles are allowed — the UI shows an "Untitled" placeholder, like Notion.
    title: { type: String, default: '', trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    content: { type: Schema.Types.Mixed, default: [] },
    text: { type: String, default: '' },
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Page', default: null },
    order: { type: Number, default: 0 },
    icon: { type: String },
    coverImage: { type: String },
    fullWidth: { type: Boolean, default: false },
    font: { type: String, enum: PAGE_FONTS, default: 'sans' },
    isFavorited: { type: Map, of: Boolean, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
pageSchema.index({ workspace: 1, slug: 1 }, { unique: true });

pageSchema.index({ workspace: 1 });

pageSchema.index({ parent: 1 });

// 'validate', not 'save': validation runs first and `slug` is required.
pageSchema.pre('validate', async function (next) {
  if (!this.isModified('title') && this.slug) {
    return next();
  }

  const base = slugify(this.title) || 'untitled';
  let slug = base;
  let suffix = 1;

  while (await Page.exists({ workspace: this.workspace, slug, _id: { $ne: this._id } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  this.slug = slug;
  next();
});

export const Page = model<IPage>('Page', pageSchema);
