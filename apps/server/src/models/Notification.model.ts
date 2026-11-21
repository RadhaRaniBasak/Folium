import { Schema, model, Document, Types } from 'mongoose';
import type { NotificationType } from '@repo/shared';

export const NOTIFICATION_TYPES = ['mention', 'invite', 'assign', 'reminder', 'comment'] as const;

export interface INotification extends Document {
  /** Recipient. */
  user: Types.ObjectId;
  actor: Types.ObjectId | null;
  workspace: Types.ObjectId;
  page: Types.ObjectId | null;
  /** The block a mention is in, so the inbox can jump straight to it. */
  blockId: string | null;
  text: string | null;
  threadId: string | null;
  type: NotificationType;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    page: { type: Schema.Types.ObjectId, ref: 'Page', default: null },
    blockId: { type: String, default: null },
    text: { type: String, default: null },
    threadId: { type: String, default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
