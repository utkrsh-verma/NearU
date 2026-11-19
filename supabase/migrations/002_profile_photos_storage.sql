-- NearU profile-photo Storage migration. Run this before deploying the application code.
-- The bucket is public because discovery, matches, and chat render CDN URLs directly.
-- Object names are opaque UUIDs; folder RLS still restricts write/delete ownership.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-photos', 'profile-photos', true, 204800, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.profile_photos
  ADD COLUMN IF NOT EXISTS legacy_data_url text;

-- Names are deliberately specific so this migration does not affect policies for other buckets.
DROP POLICY IF EXISTS "NearU profile photos: owner can insert" ON storage.objects;
DROP POLICY IF EXISTS "NearU profile photos: owner can select" ON storage.objects;
DROP POLICY IF EXISTS "NearU profile photos: owner can update" ON storage.objects;
DROP POLICY IF EXISTS "NearU profile photos: owner can delete" ON storage.objects;

CREATE POLICY "NearU profile photos: owner can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
  AND lower(storage.extension(name)) = 'webp'
);

-- Required by Supabase for an owner to replace/update an object; it does not permit bucket listing.
CREATE POLICY "NearU profile photos: owner can select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

CREATE POLICY "NearU profile photos: owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
  AND lower(storage.extension(name)) = 'webp'
);

CREATE POLICY "NearU profile photos: owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

COMMENT ON COLUMN public.profile_photos.legacy_data_url IS
  'Temporary verified backup during the Base64-to-Storage migration. Do not clear until migration audit is accepted.';
