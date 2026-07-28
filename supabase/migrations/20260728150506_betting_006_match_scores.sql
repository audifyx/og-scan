-- Skill-based duels: each player plays, gets a score, pays, submits.
-- Higher submitted score wins (tie -> creator). Winner takes the pot.
ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS creator_score  BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.game_matches ADD COLUMN IF NOT EXISTS opponent_score BIGINT NOT NULL DEFAULT 0;
