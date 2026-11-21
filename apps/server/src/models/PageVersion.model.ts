import { Schema, model, Document, Types } from 'mongoose';

/** A saved copy of a page's Yjs document (taken automatically, or named by someone). */
export interface IPageVersion extends Document {
  page: Types.ObjectId;
  /** Y.encodeStateAsUpdate of the page document at that moment. */
  state: Buffer;
  name: string | null;
  /** Who edited since the version before. */
  by: Types.ObjectId[];
  auto: boolean;
  createdAt: Date;
}

const pageVersionSchema = new Schema<IPageVersion>(
  {
    page: { type: Schema.Types.ObjectId, ref: 'Page', required: true },
    state: { type: Buffer, required: true },
    name: { type: String, default: null },
    by: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    auto: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
pageVersionSchema.index({ page: 1, _id: -1 });

export const PageVersion = model<IPageVersion>('PageVersion', pageVersionSchema);
