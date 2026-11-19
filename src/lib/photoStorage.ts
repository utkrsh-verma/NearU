import crypto from 'node:crypto';
import { supabaseAdmin } from './supabase-admin.ts';

export const PROFILE_PHOTOS_BUCKET = 'profile-photos';
const SIGNING_SECRET = crypto.createHash('sha256').update(`${process.env.PHOTO_SIGNING_SECRET || process.env.SQL_PASSWORD || 'nearu-dev-key'}:nearu-photo-hmac-v1`).digest('hex');

export function isLegacyDataUrl(value: string): boolean { return value.startsWith('data:image/'); }

export function isOwnedProfilePhotoPath(userId: string, storagePath: string): boolean {
  return new RegExp(`^${userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[a-zA-Z0-9_-]+\\.webp$`).test(storagePath);
}

export async function verifyProfilePhotoObject(userId: string, storagePath: string): Promise<boolean> {
  if (!isOwnedProfilePhotoPath(userId, storagePath)) return false;
  const filename = storagePath.slice(userId.length + 1);
  const { data, error } = await supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).list(userId, { search: filename });
  return !error && Boolean(data?.some((item) => item.name === filename));
}

export async function deleteStoredPhotoFile(storagePath: string): Promise<void> {
  if (!storagePath || isLegacyDataUrl(storagePath)) return;
  const { error } = await supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]);
  if (error) console.warn('Could not remove replaced profile photo:', error.message);
}

export function createPublicStorageUrl(storagePath: string): string {
  return supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export function createSignedPhotoUrl(photoId: number): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(`${photoId}:${exp}`).digest('hex');
  return `/api/photos/${photoId}?exp=${exp}&sig=${sig}`;
}

export function verifySignedPhotoToken(photoId: number, expRaw: string | undefined, sigRaw: string | undefined): boolean {
  if (!expRaw || !sigRaw) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(`${photoId}:${exp}`).digest('hex');
  const a = Buffer.from(sigRaw, 'utf8'); const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
