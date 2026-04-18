import { Schema, model, Document, Types } from 'mongoose';

// ─── Slug helper ──────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

const WORKSPACE_ROLES: WorkspaceRole[] = ['owner', 'editor', 'viewer'];

export interface IWorkspaceMember {
  user: Types.ObjectId;
  role: WorkspaceRole;
}

export interface IWorkspace extends Document {
  name: string;
  slug: string;
  owner: Types.ObjectId;
  members: IWorkspaceMember[];
  icon?: string;
  coverImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const workspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: WORKSPACE_ROLES,
      required: true,
    },
  },
  { _id: false },
);

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [workspaceMemberSchema], default: [] },
    icon: { type: String },
    coverImage: { type: String },
  },
  { timestamps: true },
);

// Auto-generate slug from name before saving if not already set
workspaceSchema.pre('save', async function (next) {
  if (!this.isModified('name') && this.slug) {
    return next();
  }

  const base = slugify(this.name);
  let slug = base;
  let suffix = 1;

  // Ensure uniqueness
  while (
    await Workspace.exists({ slug, _id: { $ne: this._id } })
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  this.slug = slug;
  next();
});

export const Workspace = model<IWorkspace>('Workspace', workspaceSchema);
