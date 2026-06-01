-- Support messages: add sender profile join fields + read receipts
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_avatar text;

-- Support tickets: add unread count helpers
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS unread_user int4 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_agent int4 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

-- Trigger: update ticket last_message + bump unread counts on new message
CREATE OR REPLACE FUNCTION support_message_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_admin THEN
    UPDATE support_tickets SET
      last_message = NEW.content,
      last_message_at = NEW.created_at,
      unread_user = unread_user + 1,
      unread_agent = 0,
      updated_at = NOW()
    WHERE id = NEW.ticket_id;
  ELSE
    UPDATE support_tickets SET
      last_message = NEW.content,
      last_message_at = NEW.created_at,
      unread_agent = unread_agent + 1,
      unread_user = 0,
      updated_at = NOW()
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_message_after_insert ON support_messages;
CREATE TRIGGER trg_support_message_after_insert
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION support_message_after_insert();

-- RLS: agents (admin or support role) can see all tickets + messages
CREATE POLICY IF NOT EXISTS "agents_read_tickets" ON support_tickets
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid() AND role IN ('admin','support')
    )
  );

CREATE POLICY IF NOT EXISTS "agents_update_tickets" ON support_tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid() AND role IN ('admin','support')
    )
  );

CREATE POLICY IF NOT EXISTS "agents_read_messages" ON support_messages
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid() AND role IN ('admin','support')
    )
  );
