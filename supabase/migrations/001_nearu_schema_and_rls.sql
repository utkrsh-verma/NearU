-- NearU V1 — Production PostgreSQL & Supabase Reference Schema + Row Level Security (RLS)
-- Note: The AI Studio runtime uses Cloud SQL PostgreSQL + Drizzle ORM + Express Auth Middleware.
-- Use this SQL migration if deploying externally to Supabase + Vercel.

-- 1. TABLES & CONSTRAINTS
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  college_email text,
  roll_number text,
  verification_method text CHECK (verification_method IN ('domain_email', 'campus_invite')),
  is_verified boolean NOT NULL DEFAULT false,
  is_profile_complete boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  full_name text,
  date_of_birth date CHECK (date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')),
  gender text,
  branch text,
  batch_year text,
  campus_spot text,
  bio text CHECK (char_length(bio) <= 180),
  looking_for text,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_photos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/webp',
  display_order smallint NOT NULL CHECK (display_order IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, display_order)
);

CREATE TABLE IF NOT EXISTS public.likes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  liker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  liked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (liker_id <> liked_id),
  UNIQUE (liker_id, liked_id)
);

CREATE TABLE IF NOT EXISTS public.passes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  passer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  passed_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (passer_id <> passed_id),
  UNIQUE (passer_id, passed_id)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user1_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unmatched', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user1_id < user2_id),
  UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id bigint NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 1000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blocks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (blocker_id <> blocked_id),
  UNIQUE (blocker_id, blocked_id)
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_eligible ON public.profiles (is_verified, is_profile_complete, is_active);
CREATE INDEX IF NOT EXISTS idx_profile_photos_user ON public.profile_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_likes_liked_id ON public.likes (liked_id);
CREATE INDEX IF NOT EXISTS idx_passes_passer_id ON public.passes (passer_id);
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON public.matches (user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON public.matches (user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_match_created ON public.messages (match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON public.blocks (blocked_id);

-- 3. SECURITY HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_verified_student(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND is_verified = true AND is_active = true
  );
$$;

-- 4. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Verified users can read active eligible unblocked profiles"
  ON public.profiles FOR SELECT
  USING (
    public.is_verified_student(auth.uid())
    AND is_verified = true
    AND is_profile_complete = true
    AND is_active = true
    AND NOT public.is_blocked(auth.uid(), id)
  );

CREATE POLICY "Users can update only own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- PROFILE PHOTOS RLS
CREATE POLICY "Users can manage own photos"
  ON public.profile_photos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Verified users can view unblocked eligible photos"
  ON public.profile_photos FOR SELECT
  USING (
    public.is_verified_student(auth.uid())
    AND NOT public.is_blocked(auth.uid(), user_id)
  );

-- LIKES & PASSES RLS (no direct match creation allowed from clients)
CREATE POLICY "Verified users can read own likes"
  ON public.likes FOR SELECT
  USING (auth.uid() = liker_id);

CREATE POLICY "Verified users can insert likes to unblocked profiles"
  ON public.likes FOR INSERT
  WITH CHECK (
    auth.uid() = liker_id
    AND liker_id <> liked_id
    AND public.is_verified_student(auth.uid())
    AND NOT public.is_blocked(auth.uid(), liked_id)
  );

CREATE POLICY "Verified users can manage own passes"
  ON public.passes FOR ALL
  USING (auth.uid() = passer_id)
  WITH CHECK (auth.uid() = passer_id AND passer_id <> passed_id);

-- MATCHES RLS (created exclusively via SECURITY DEFINER RPC below)
CREATE POLICY "Participants can view active unblocked matches"
  ON public.matches FOR SELECT
  USING (
    status = 'active'
    AND (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND NOT public.is_blocked(user1_id, user2_id)
  );

CREATE POLICY "Participants can unmatch their active match"
  ON public.matches FOR UPDATE
  USING (
    status = 'active'
    AND (auth.uid() = user1_id OR auth.uid() = user2_id)
  )
  WITH CHECK (status IN ('unmatched', 'blocked'));

-- MESSAGES RLS (participants of active unblocked match only)
CREATE POLICY "Match participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.status = 'active'
        AND (auth.uid() = m.user1_id OR auth.uid() = m.user2_id)
        AND NOT public.is_blocked(m.user1_id, m.user2_id)
    )
  );

CREATE POLICY "Match participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.status = 'active'
        AND (auth.uid() = m.user1_id OR auth.uid() = m.user2_id)
        AND NOT public.is_blocked(m.user1_id, m.user2_id)
    )
  );

-- BLOCKS RLS
CREATE POLICY "Users can read and create own blocks"
  ON public.blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can insert own blocks"
  ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

-- 5. SERVER-CONTROLLED MUTUAL MATCH RPC
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

  INSERT INTO public.likes (liker_id, liked_id)
  VALUES (v_me, target_user_id)
  ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.likes WHERE liker_id = target_user_id AND liked_id = v_me) THEN
    v_u1 := LEAST(v_me, target_user_id);
    v_u2 := GREATEST(v_me, target_user_id);
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
