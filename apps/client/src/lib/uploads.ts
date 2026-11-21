import { getFreshAccessToken, Uploads } from './api';

/** Uploads a file (straight to S3 when the server has a bucket) and returns its URL. */
export async function uploadFile(file: File): Promise<string> {
  const target = await Uploads.create({ type: file.type, size: file.size });
  const headers = { ...target.headers };
  if (target.auth) headers['Authorization'] = `Bearer ${(await getFreshAccessToken()) ?? ''}`;
  const res = await fetch(target.uploadUrl, { method: 'PUT', headers, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return target.url;
}
