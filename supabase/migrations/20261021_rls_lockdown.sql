-- OrbitX RLS lockdown (prepared + EXECUTED + VERIFIED 2026-10-21, Muse)
-- Problem: rebuild-era permissive `p_all` policies (and RLS fully DISABLED
-- on 8 tables) let the PUBLIC anon key read/write rows on 18 tables
-- (verified live). Replaced with least-privilege policies. Service role
-- (backend) always bypasses RLS. NOTE: as executed, section A below was
-- adjusted to the real schemas (dm user_a/user_b + sender_id; agent owner
-- via agents.user_id) and also covered social_messages + profiles; section B
-- was executed exactly as templated. ox_live_tp_orders / ox_live_desk /
-- orbitx_calls / follows already had intentional public SELECT policies and
-- were left as-is. Post-execution probes: anon reads on all private tables
-- return 0 rows, anon writes fail 401/42501, authenticated owner writes
-- pass, spoofed-owner writes fail 403.
-- Rollback for any policy: recreate `p_all` (FOR ALL USING (true) WITH CHECK (true)).

-- ═══ A. PRIVATE TABLES — no anon access at all ═══

-- DM conversations/messages: participants only.
-- (Confirm participant columns on dm_conversations at run time and adjust:
--  expected user_a/user_b or a participants array; dm_messages joins via
--  conversation_id and carries sender_id/user_id.)
DROP POLICY IF EXISTS p_all ON public.dm_conversations;
DROP POLICY IF EXISTS p_all ON public.dm_messages;
CREATE POLICY dm_conv_participant ON public.dm_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY dm_msg_participant ON public.dm_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dm_conversations c
                 WHERE c.id = dm_messages.conversation_id
                   AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dm_conversations c
                 WHERE c.id = dm_messages.conversation_id
                   AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)));

-- Agent API keys / settings / MCP link sessions: owner of the agent only.
DROP POLICY IF EXISTS p_all ON public.agent_api_keys;
DROP POLICY IF EXISTS p_all ON public.agent_settings;
DROP POLICY IF EXISTS p_all ON public.mcp_link_sessions;
CREATE POLICY agent_keys_owner ON public.agent_api_keys
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_api_keys.agent_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_api_keys.agent_id AND a.user_id = auth.uid()));
CREATE POLICY agent_settings_owner ON public.agent_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_settings.agent_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_settings.agent_id AND a.user_id = auth.uid()));
CREATE POLICY mcp_link_owner ON public.mcp_link_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Live TP orders: the trader only.
DROP POLICY IF EXISTS p_all ON public.ox_live_tp_orders;
CREATE POLICY tp_orders_owner ON public.ox_live_tp_orders
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══ B. PUBLIC CONTENT — anon keeps SELECT, writes need auth ═══
-- profiles, communities, community_members, community_posts,
-- community_post_replies, follows, launchpad_tokens, orbitx_calls,
-- orbitx_calls_top, ox_live_desk, spaces, social_messages
-- For each: drop p_all, add public_read (SELECT to anon+authenticated),
-- and owner-scoped write policies using the table's owner column
-- (user_id / author_id / creator_id — confirm per table at run time).
-- Template:
--   DROP POLICY IF EXISTS p_all ON public.<t>;
--   CREATE POLICY public_read ON public.<t> FOR SELECT TO anon, authenticated USING (true);
--   CREATE POLICY owner_write ON public.<t> FOR ALL TO authenticated
--     USING (<owner_col> = auth.uid()) WITH CHECK (<owner_col> = auth.uid());

-- ═══ C. VERIFY (anon key must return [] / 401 for section A) ═══
-- GET /rest/v1/dm_messages?limit=1        -> []
-- GET /rest/v1/dm_conversations?limit=1   -> []
-- GET /rest/v1/mcp_link_sessions?limit=1  -> []
-- GET /rest/v1/agent_api_keys?limit=1     -> []
-- GET /rest/v1/agent_settings?limit=1     -> []
-- GET /rest/v1/community_posts?limit=1    -> rows (public by design)
