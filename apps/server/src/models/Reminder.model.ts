import { Schema, model, Document, Types } from 'mongoose';

/** One reminder chip in a page, kept in sync with the page's block snapshot. */
export interface IReminder extends Document {
  workspace: Types.ObjectId;
  page: Types.ObjectId;
  blockId: string;
  owner: Types.ObjectId;
  recipients: Types.ObjectId[];
  /** The block's text, e.g. "pay rent". */
  text: string;
  at: Date | null;
  rrule: string | null;
  tz: string;
  anchor: Date;
  /** Checked to-dos don't fire one-off reminders. */
  checked: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

const reminderSchema = new Schema<IReminder>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    page: { type: Schema.Types.ObjectId, ref: 'Page', required: true },
    blockId: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipients: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    text: { type: String, default: '' },
    at: { type: Date, default: null },
    rrule: { type: String, default: null },
    tz: { type: String, required: true },
    anchor: { type: Date, required: true },
    checked: { type: Boolean, default: false },
    nextRunAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true },
);
reminderSchema.index({ page: 1, blockId: 1 }, { unique: true });
reminderSchema.index({ recipients: 1, nextRunAt: 1 });

export const Reminder = model<IReminder>('Reminder', reminderSchema);
