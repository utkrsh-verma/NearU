import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'photos')
  : path.resolve(process.cwd(), 'uploads', 'photos');
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 2.5 * 1024 * 1024; // 2.5 MB limit after client compression

const SIGNING_SECRET = crypto
  .createHash('sha256')
  .update(
    `${process.env.PHOTO_SIGNING_SECRET || process.env.SQL_PASSWORD || 'nearu-dev-key'}:nearu-photo-hmac-v1`
  )
  .digest('hex');

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function ensureUploadDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function saveBase64ProfilePhoto(
  userId: string,
  displayOrder: number,
  dataUrl: string
): { storagePath: string; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Only JPEG, PNG, and WebP images are supported.');
  }

  const mimeType = match[1];
  const base64Data = match[2];

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported image format.');
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0) {
    throw new Error('Uploaded image is empty.');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('Image exceeds the 2.5 MB size limit. Please choose a smaller photo.');
  }

  // Verify magic bytes so non-image payloads cannot spoof MIME headers
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (
    (mimeType === 'image/jpeg' && !isJpeg) ||
    (mimeType === 'image/png' && !isPng) ||
    (mimeType === 'image/webp' && !isWebp)
  ) {
    throw new Error('File contents do not match the declared image format.');
  }

  ensureUploadDir();

  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const rand = crypto.randomBytes(6).toString('hex');
  const ext = MIME_TO_EXT[mimeType] || 'webp';
  const filename = `${safeUid}_slot${displayOrder}_${Date.now()}_${rand}.${ext}`;
  const fullPath = path.join(UPLOADS_DIR, filename);

  fs.writeFileSync(fullPath, buffer);
  return { storagePath: filename, mimeType };
}

export function deleteStoredPhotoFile(storagePath: string) {
  try {
    const safeName = path.basename(storagePath);
    const fullPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn('Could not delete old photo file:', err);
  }
}

export function resolveStoredPhotoPath(storagePath: string): string | null {
  const safeName = path.basename(storagePath);
  const fullPath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

export function createSignedPhotoUrl(photoId: number): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // Valid 6 hours
  const payload = `${photoId}:${exp}`;
  const sig = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(payload)
    .digest('hex');
  return `/api/photos/${photoId}?exp=${exp}&sig=${sig}`;
}

export function verifySignedPhotoToken(
  photoId: number,
  expRaw: string | undefined,
  sigRaw: string | undefined
): boolean {
  if (!expRaw || !sigRaw) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${photoId}:${exp}`)
    .digest('hex');
  const a = Buffer.from(sigRaw, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
