-- ============================================================
-- 013: Live support chat — user tickets + messages.
-- Users see their own thread; admin reads/replies via service role.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  subject         TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sender     TEXT NOT NULL DEFAULT 'user' CHECK (last_sender IN ('user','admin')),
  admin_unread    BOOLEAN NOT NULL DEFAULT true,
  user_unread     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_recent ON public.support_tickets(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('user','admin')),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id, created_at);

-- ─── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: owner-only read; owner can update (e.g. clear unread). Inserts go through service role.
DROP POLICY IF EXISTS tickets_owner_read   ON public.support_tickets;
DROP POLICY IF EXISTS tickets_owner_update ON public.support_tickets;
CREATE POLICY tickets_owner_read   ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tickets_owner_update ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id);

-- Messages: owner of the parent ticket can read (enables user realtime). Writes go through service role.
DROP POLICY IF EXISTS messages_owner_read ON public.support_messages;
CREATE POLICY messages_owner_read ON public.support_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
);

-- ─── grants ────────────────────────────────────────────────────
REVOKE ALL ON public.support_tickets, public.support_messages FROM anon;
GRANT SELECT, UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
