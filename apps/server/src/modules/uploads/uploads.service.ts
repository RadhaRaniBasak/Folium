import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getRedisClient } from '../../config/redis';
import { AppError } from '../../errors/AppError';

/**
 * File uploads for images, video, audio and attachments. With S3 configured (S3_BUCKET, plus
 * S3_ENDPOINT for R2 / MinIO) the browser uploads straight to the bucket with a presigned PUT;
 * otherwise files go to the API and are stored on disk under UPLOAD_DIR.
 */

export const MAX_BYTES = 10 * 1024 * 1024;

/** No SVG or HTML: served from our origin they could run scripts. */
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

export const UPLOAD_DIR = path.resolve(process.env['UPLOAD_DIR'] ?? 'uploads');
const KEY = /^[a-f0-9]{32}\.[a-z0-9]{2,4}$/;

let s3: S3Client | null | undefined;
function bucket(): S3Client | null {
  if (s3 === undefined) {
    const { S3_BUCKET, S3_REGION, S3_ENDPOINT } = process.env;
    s3 = S3_BUCKET
      ? new S3Client({
          region: S3_REGION ?? 'auto',
          ...(S3_ENDPOINT && { endpoint: S3_ENDPOINT, forcePathStyle: true }),
        })
      : null;
  }
  return s3;
}

export interface UploadTarget {
  /** PUT the file here, with these headers. */
  uploadUrl: string;
  headers: Record<string, string>;
  /** Send the access token too (uploads to the API itself). */
  auth: boolean;
  /** Where the file can be read afterwards. */
  url: string;
}

export async function createUpload(
  userId: string,
  input: { type?: unknown; size?: unknown },
): Promise<UploadTarget> {
  const ext = typeof input.type === 'string' ? TYPES[input.type] : undefined;
  if (!ext) throw new AppError('That kind of file can’t be uploaded', 415);
  const size = Number(input.size);
  if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) {
    throw new AppError('Files can be up to 10 MB', 413);
  }
  const key = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const headers = { 'Content-Type': input.type as string };

  const client = bucket();
  if (client) {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: process.env['S3_BUCKET'],
        Key: key,
        ContentType: input.type as string,
        ContentLength: size,
      }),
      { expiresIn: 300 },
    );
    const base = process.env['S3_PUBLIC_URL']?.replace(/\/$/, '');
    if (!base) throw new AppError('S3_PUBLIC_URL is not set', 500);
    return { uploadUrl, headers, auth: false, url: `${base}/${key}` };
  }

  // Local: remember who may upload this key, briefly.
  await getRedisClient().set(`upload:${key}`, `${userId}:${input.type}:${size}`, 'EX', 600);
  return { uploadUrl: `/api/uploads/local/${key}`, headers, auth: true, url: `/uploads/${key}` };
}

export async function saveLocal(
  userId: string,
  key: string,
  contentType: string | undefined,
  body: Buffer,
): Promise<{ url: string }> {
  if (!KEY.test(key)) throw new AppError('Unknown upload', 404);
  const redis = getRedisClient();
  const ticket = await redis.get(`upload:${key}`);
  const [owner, type, size] = ticket?.split(':') ?? [];
  if (owner !== userId) throw new AppError('Unknown upload', 404);
  if (contentType !== type || body.length !== Number(size)) {
    throw new AppError('The file doesn’t match what was announced', 400);
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, key), body, { flag: 'wx' });
  await redis.del(`upload:${key}`);
  return { url: `/uploads/${key}` };
}
