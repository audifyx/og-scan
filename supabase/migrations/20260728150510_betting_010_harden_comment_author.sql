-- ============================================================
-- 010: Prevent comment author spoofing.
-- The insert policy previously only checked user_id = auth.uid(),
-- letting a user attach someone else's profile_id (impersonation).
-- Now profile_id must be null or owned by the authenticated user.
-- ============================================================
DROP POLICY IF EXISTS comments_self_insert ON public.bet_comments;
CREATE POLICY comments_self_insert ON public.bet_comments FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (
    profile_id IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid())
  )
);
