import { Schema, model, Document, Types } from 'mongoose';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Content is stored as a JSON array of block objects (e.g. BlockNote / Notion-style blocks).
 * Using Schema.Types.Mixed gives full flexibility without constraining the block structure.
 */
export type BlockContent = Record<string, unknown>[];

export interface IPage extends Document {
  title: string;
  slug: string;
  /** Block array stored as raw JSON (Mixed) */
  content: BlockContent;
  workspace: Types.ObjectId;
  /** Null for root-level pages */
  parent: Types.ObjectId | null;
  icon?: string;
  coverImage?: string;
  /**
   * Tracks which users have favorited this page.
   * Key = userId (string), Value = true.
   * Using a Map keeps the document self-contained and avoids a separate join collection.
   */
  isFavorited: Map<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

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

// Slug must be unique within a workspace (but can repeat across workspaces)
pageSchema.index({ workspace: 1, slug: 1 }, { unique: true });

// Efficient look-up of all pages in a workspace
pageSchema.index({ workspace: 1 });

// Efficient look-up of child pages
pageSchema.index({ parent: 1 });

export const Page = model<IPage>('Page', pageSchema);
