-- ====================================================================
-- Community Rooms — Phase 2 (OGScan Spaces Mega v3)
-- ====================================================================

-- 1. Community Rooms
CREATE TABLE IF NOT EXISTS community_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  is_private      BOOLEAN NOT NULL DEFAULT false,
  is_pinned       BOOLEAN NOT NULL DEFAULT false,
  category        TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_count    INTEGER NOT NULL DEFAULT 0,
  unread_count    INTEGER NOT NULL DEFAULT 0,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_rooms_name_idx ON community_rooms(name);
CREATE INDEX IF NOT EXISTS community_rooms_category_idx ON community_rooms(category);
CREATE INDEX IF NOT EXISTS community_rooms_last_message_at_idx ON community_rooms(last_message_at DESC);

ALTER TABLE community_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "rooms_select_public" ON community_rooms FOR SELECT USING (NOT is_private OR created_by = auth.uid());
CREATE POLICY IF NOT EXISTS "rooms_insert_auth" ON community_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY IF NOT EXISTS "rooms_update_owner" ON community_rooms FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY IF NOT EXISTS "rooms_delete_owner" ON community_rooms FOR DELETE USING (created_by = auth.uid());

-- 2. Community Messages
CREATE TABLE IF NOT EXISTS community_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT false,
  reply_to_id UUID REFERENCES community_messages(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_messages_room_id_idx ON community_messages(room_id, created_at DESC);

ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "msgs_select_all" ON community_messages FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "msgs_insert_auth" ON community_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "msgs_update_own" ON community_messages FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IN (SELECT created_by FROM community_rooms WHERE id = room_id));
CREATE POLICY IF NOT EXISTS "msgs_delete_own" ON community_messages FOR DELETE USING (auth.uid() = user_id);

-- 3. Community Room Members
CREATE TABLE IF NOT EXISTS community_room_members (
  room_id   UUID NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE community_room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "members_select_all" ON community_room_members FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "members_insert_auth" ON community_room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "members_delete_own" ON community_room_members FOR DELETE USING (auth.uid() = user_id);

-- Grants
GRANT SELECT ON community_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON community_rooms TO authenticated;
GRANT SELECT ON community_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON community_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON community_room_members TO authenticated;
