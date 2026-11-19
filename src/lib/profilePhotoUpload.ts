import { supabase } from './supabase';

const PROFILE_PHOTOS_BUCKET = 'profile-photos';

export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  if (file.type !== 'image/webp' || file.size > 200 * 1024) throw new Error('Profile photos must be WebP files no larger than 200 KB.');
  const objectPath = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).upload(objectPath, file, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw new Error(`Could not upload photo: ${error.message}`);
  return objectPath;
}

export async function removeUploadedProfilePhoto(objectPath: string): Promise<void> {
  await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([objectPath]);
}
