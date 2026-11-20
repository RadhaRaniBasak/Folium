import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';
import { Block } from '../../models/Block.model';
import { Page } from '../../models/Page.model';
import { assertCanEdit, getRoleOrThrow } from '../workspaces/access';

const MAX_BLOCKS = 5000;
const MAX_DEPTH = 40;

async function loadPageForUser(userId: string, pageId: string, edit: boolean) {
  if (!Types.ObjectId.isValid(pageId)) throw new AppError('Invalid pageId', 400);
  const page = await Page.findById(pageId);
  if (!page) throw new AppError('Page not found', 404);
  const role = await getRoleOrThrow(userId, String(page.workspace));
  if (edit) assertCanEdit(role);
  return page;
}

export async function createBlock(input: {
  userId: string;
  pageId: string;
  type: string;
  props: Record<string, unknown>;
  parentBlock: string | null;
  order: number;
}) {
  const { userId, pageId, type, props, parentBlock, order } = input;
  if (parentBlock && !Types.ObjectId.isValid(parentBlock))
    throw new AppError('Invalid parentBlock', 400);

  const page = await loadPageForUser(userId, pageId, true);

  return Block.create({
    workspace: page.workspace,
    page: page._id,
    parentBlock: parentBlock ? new Types.ObjectId(parentBlock) : null,
    type,
    props,
    order,
  });
}

export async function listBlocks(input: {
  userId: string;
  pageId: string;
  parentBlock: string | null;
}) {
  const { userId, pageId, parentBlock } = input;
  if (parentBlock && !Types.ObjectId.isValid(parentBlock))
    throw new AppError('Invalid parentBlock', 400);

  await loadPageForUser(userId, pageId, false); // viewer allowed

  return Block.find({
    page: pageId,
    parentBlock: parentBlock ? parentBlock : null,
  }).sort({ order: 1, createdAt: 1 });
}

/** A block as BlockNote serializes it (`editor.document`). */
interface EditorBlock {
  id?: unknown;
  type?: unknown;
  props?: unknown;
  content?: unknown;
  children?: unknown;
}

/** Collects every `text` string inside BlockNote inline/table content. */
function collectText(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj['text'] === 'string') out.push(obj['text']);
    for (const key of ['content', 'rows', 'cells']) collectText(obj[key], out);
  }
}

/**
 * Replaces a page's block records with the editor's current document.
 * The live document lives in Yjs; this snapshot keeps the Notion-style block
 * records (and the page's search text) up to date.
 */
export async function replaceBlocks(userId: string, pageId: string, blocks: unknown) {
  if (!Array.isArray(blocks)) throw new AppError('blocks must be an array', 400);
  const page = await loadPageForUser(userId, pageId, true);

  const docs: Record<string, unknown>[] = [];
  const lines: string[] = [];

  const walk = (items: unknown[], parentBlock: Types.ObjectId | null, depth: number) => {
    if (depth > MAX_DEPTH) throw new AppError('Blocks are nested too deeply', 400);
    items.forEach((raw, order) => {
      const block = raw as EditorBlock;
      if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
        throw new AppError('Every block needs a type', 400);
      }
      const _id = new Types.ObjectId();
      const props = block.props && typeof block.props === 'object' ? block.props : {};
      docs.push({
        _id,
        workspace: page.workspace,
        page: page._id,
        parentBlock,
        type: block.type,
        props: { ...props, content: block.content ?? null, blockId: block.id ?? null },
        order,
      });
      const text: string[] = [];
      collectText(block.content, text);
      if (text.length > 0) lines.push(text.join(''));
      if (Array.isArray(block.children)) walk(block.children, _id, depth + 1);
    });
  };
  walk(blocks, null, 0);
  if (docs.length > MAX_BLOCKS) throw new AppError('Too many blocks', 413);

  // Insert first, then drop the old rows: readers never see an empty page.
  if (docs.length > 0) await Block.insertMany(docs);
  await Block.deleteMany({ page: page._id, _id: { $nin: docs.map((d) => d['_id']) } });

  page.text = lines.join('\n').slice(0, 20000);
  page.lastEditedBy = new Types.ObjectId(userId);
  await page.save();

  return { count: docs.length };
}
