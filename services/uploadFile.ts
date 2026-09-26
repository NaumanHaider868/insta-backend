import { del, put } from '@vercel/blob';
import { randomUUID } from 'crypto';

const sanitizePath = (path: string) =>
  path
    .split('/')
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('/');

const uploadFile = async (
  fileData: Buffer,
  blobPath: string,
  contentType: string = 'image/jpeg'
) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const safePath = sanitizePath(blobPath);
  const pathWithUniqueName = safePath.replace(
    /\/([^/]+)$/,
    (_, filename: string) => `/${randomUUID()}-${filename}`
  );
  const blob = await put(pathWithUniqueName, fileData, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
};

const deleteFiles = async (urls: string[]) => {
  if (urls.length === 0) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  await del(urls);
};

export { uploadFile, deleteFiles };
