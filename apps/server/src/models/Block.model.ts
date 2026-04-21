import { Schema, model, Document, Types } from 'mongoose';

export type BlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'todo'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'quote'
  | 'code'
  | 'divider'
  | 'image';

export interface IBlock extends Document {
  workspace: Types.ObjectId;
  page: Types.ObjectId;
  parentBlock: Types.ObjectId | null;

  type: BlockType;
  props: Record<string, unknown>;

  order: number;

  createdAt: Date;
  updatedAt: Date;
}

const blockSchema = new Schema<IBlock>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    page: { type: Schema.Types.ObjectId, ref: 'Page', required: true, index: true },
    parentBlock: { type: Schema.Types.ObjectId, ref: 'Block', default: null, index: true },

    type: { type: String, required: true },
    props: { type: Schema.Types.Mixed, default: {} },

    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

blockSchema.index({ page: 1, parentBlock: 1, order: 1 });

export const Block = model<IBlock>('Block', blockSchema);
