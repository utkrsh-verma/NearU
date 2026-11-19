import 'dotenv/config';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { Client } from 'pg';
import { supabaseAdmin } from '../src/lib/supabase-admin.ts';
import { PROFILE_PHOTOS_BUCKET } from '../src/lib/photoStorage.ts';

const dataUrl = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let failed = 0;
  try {
    const { rows } = await db.query<{ id: string; user_id: string; storage_path: string }>("select id, user_id, storage_path from public.profile_photos where storage_path like 'data:image/%' order by id");
    console.log(`${dryRun ? 'Would migrate' : 'Migrating'} ${rows.length} photo(s).`);
    for (const photo of rows) try {
      const match = photo.storage_path.match(dataUrl);
      if (!match) throw new Error('unsupported Data URL');
      const webp = await sharp(Buffer.from(match[1], 'base64'), { failOn: 'error' }).rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      if (webp.length > 200 * 1024) throw new Error('converted file is over 200 KB');
      if (dryRun) continue;
      const path = `${photo.user_id}/${photo.id}-${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data: verified, error: verifyError } = await supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).download(path);
      if (verifyError || !verified || verified.size !== webp.length) {
        await supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).remove([path]);
        throw verifyError || new Error('upload verification failed');
      }
      const update = await db.query("update public.profile_photos set legacy_data_url = coalesce(legacy_data_url, storage_path), storage_path = $1, mime_type = 'image/webp' where id = $2 and storage_path like 'data:image/%'", [path, photo.id]);
      if (update.rowCount !== 1) {
        await supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET).remove([path]);
        throw new Error('row changed concurrently; old data was left intact');
      }
    } catch (error) {
      failed++; console.error(`Photo ${photo.id} failed:`, error instanceof Error ? error.message : error);
    }
  } finally { await db.end(); }
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
