-- NearU — Passed Profiles feature
--
-- No new table is needed: public.passes (passer_id, passed_id) already stores every
-- Pass (✕) action, with UNIQUE (passer_id, passed_id) and CHECK (passer_id <> passed_id).
-- This migration only (1) adds an index for the "Passed" list and (2) replaces the broad
-- FOR ALL policy with explicit per-operation policies so a user can only ever read,
-- create or remove THEIR OWN pass records.
--
-- Safe to run more than once.

-- 1. Index: list a user's passes, newest first
CREATE INDEX IF NOT EXISTS idx_passes_passer_created
  ON public.passes (passer_id, created_at DESC);

-- 2. RLS: replace the catch-all policy from 001 with explicit ones
DROP POLICY IF EXISTS "Verified users can manage own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can read own passes" ON public.passes;
DROP POLICY IF EXISTS "Verified users can insert own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can delete own passes" ON public.passes;

ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;

-- Read: only your own passes (powers the Passed list)
CREATE POLICY "Users can read own passes"
  ON public.passes FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = passer_id);

-- Create: only as yourself, never on yourself, never on a blocked pair
CREATE POLICY "Verified users can insert own passes"
  ON public.passes FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = passer_id
    AND passer_id <> passed_id
    AND public.is_verified_student((select auth.uid()))
    AND NOT public.is_blocked((select auth.uid()), passed_id)
  );

-- Delete: only your own passes (this is "Undo Pass")
CREATE POLICY "Users can delete own passes"
  ON public.passes FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = passer_id);

-- Intentionally NO UPDATE policy: a pass is created or removed, never edited
-- (prevents re-pointing a pass at a different user).
--
-- Likes and matches are unchanged. "Like" from the Passed list goes through the existing
-- like flow (public.likes insert policy / public.like_and_match RPC / server-side
-- recordLikeAndCheckMatch), so mutual matches are still only created by that trusted path.
