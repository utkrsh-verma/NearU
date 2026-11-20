-- NearU chat enhancement: compact delivery/read/delete state and offline fallback.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_match_active_created
  ON public.messages (match_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unread_recipient
  ON public.messages (match_id, sender_id) WHERE read_at IS NULL AND deleted_at IS NULL;

-- Direct client deletes are allowed only for the sender; the app's server endpoint
-- additionally verifies active match membership and performs a soft delete.
DROP POLICY IF EXISTS "Message senders can delete own messages" ON public.messages;
CREATE POLICY "Message senders can delete own messages"
  ON public.messages FOR DELETE TO authenticated
  USING ((select auth.uid()) = sender_id);
