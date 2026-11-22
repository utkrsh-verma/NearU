-- NearU — atomic like/match + received-likes index
--
-- No new table. This migration only:
--   1. adds an index for the "received likes, newest first" list, and
--   2. hardens public.like_and_match() so two people liking each other at the same instant
--      can never produce zero matches (see below).
--
-- RLS is intentionally UNCHANGED. Clients still cannot read other people's likes: the policy
-- from 001 only exposes rows where auth.uid() = liker_id. The incoming-likes list is served
-- by the authenticated API, which only ever queries WHERE liked_id = <the caller>.
-- No existing data is modified. Safe to run more than once.

-- 1. Index: a user's received likes, newest first
CREATE INDEX IF NOT EXISTS idx_likes_liked_created
  ON public.likes (liked_id, created_at DESC);

-- 2. Atomic like + match
-- Under READ COMMITTED, if A->B and B->A run concurrently, each transaction can miss the
-- other's uncommitted like, so both commit and NO match is created. Serialising per pair with
-- a transaction-scoped advisory lock fixes this; it is released automatically at commit.
CREATE OR REPLACE FUNCTION public.like_and_match(target_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_u1 uuid;
  v_u2 uuid;
  v_match_id bigint;
BEGIN
  IF v_me IS NULL OR v_me = target_user_id THEN
    RAISE EXCEPTION 'Invalid like target';
  END IF;
  IF NOT public.is_verified_student(v_me) OR public.is_blocked(v_me, target_user_id) THEN
    RAISE EXCEPTION 'Action forbidden';
  END IF;

  v_u1 := LEAST(v_me, target_user_id);
  v_u2 := GREATEST(v_me, target_user_id);

  -- The only change from 001: serialise concurrent likes for this pair (released at commit)
  PERFORM pg_advisory_xact_lock(hashtextextended(v_u1::text || ':' || v_u2::text, 0));

  INSERT INTO public.likes (liker_id, liked_id)
  VALUES (v_me, target_user_id)
  ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.likes WHERE liker_id = target_user_id AND liked_id = v_me) THEN
    INSERT INTO public.matches (user1_id, user2_id, status)
    VALUES (v_u1, v_u2, 'active')
    ON CONFLICT (user1_id, user2_id) DO NOTHING
    RETURNING id INTO v_match_id;

    IF v_match_id IS NULL THEN
      SELECT id INTO v_match_id FROM public.matches
      WHERE user1_id = v_u1 AND user2_id = v_u2 AND status = 'active';
    END IF;
    RETURN v_match_id;
  END IF;

  RETURN NULL;
END;
$$;
