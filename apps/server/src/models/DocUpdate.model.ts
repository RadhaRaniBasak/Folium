import { Schema, model, Document, Types } from 'mongoose';

/**
 * Append-only log of Yjs updates for a page's collaborative document.
 * Rows are merged (and compacted) when a client joins — see realtime/collab.ts.
 */
export interface IDocUpdate extends Document {
  page: Types.ObjectId;
  update: Buffer;
  createdAt: Date;
}

const docUpdateSchema = new Schema<IDocUpdate>(
  {
    page: { type: Schema.Types.ObjectId, ref: 'Page', required: true, index: true },
    update: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const DocUpdate = model<IDocUpdate>('DocUpdate', docUpdateSchema);
