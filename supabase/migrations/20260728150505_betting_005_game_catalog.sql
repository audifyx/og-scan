-- ============================================================
-- SOLNO - Game Catalog. A directory of every game the platform
-- offers. This platform is 2-PLAYER ONLY: every game runs through
-- the duel match engine (creator vs opponent, equal manual stakes,
-- provably-fair resolution). No single-player / vs-house games.
-- Additive only. Public read. Drives the Arcade directory page.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.game_catalog (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  mode         TEXT NOT NULL DEFAULT 'Duel' CHECK (mode IN ('Duel')),
  engine       TEXT NOT NULL DEFAULT 'duel' CHECK (engine IN ('duel')),
  live         BOOLEAN NOT NULL DEFAULT true,    -- every catalog game is playable now
  min_stake    NUMERIC NOT NULL DEFAULT 0.01,    -- SOL
  max_stake    NUMERIC NOT NULL DEFAULT 5,       -- SOL
  description  TEXT NOT NULL DEFAULT '',
  how_to_play  TEXT NOT NULL DEFAULT '',
  resolution   TEXT NOT NULL DEFAULT '',
  why_manual   TEXT NOT NULL DEFAULT '',
  sort         INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_public_read ON public.game_catalog;
CREATE POLICY gc_public_read ON public.game_catalog FOR SELECT USING (true);
GRANT SELECT ON public.game_catalog TO anon, authenticated;

-- 2-player only: purge any non-duel / non-live entries from older seeds.
DELETE FROM public.game_catalog WHERE engine <> 'duel' OR live = false;

INSERT INTO public.game_catalog
  (slug, name, mode, engine, live, min_stake, max_stake, description, how_to_play, resolution, why_manual, sort)
VALUES
  ('coinflip','Coin Flip Duel','Duel','duel',true,0.01,5,'Classic 50/50 heads-or-tails head-to-head.','Two players deposit equal SOL; one takes heads, one tails.','Provably-fair flip from the match server seed (revealed after).','Outcome derives from a pre-committed seed, no live randomness needed.',1),
  ('dice','Dice Duel','Duel','duel',true,0.01,5,'Two players roll, highest wins.','Both deposit equal stakes; each gets a 1-100 roll.','Provably-fair roll, higher wins, tie re-rolls.','Each match seed is committed up front and revealed at resolution.',2),
  ('rps','Rock Paper Scissors','Duel','duel',true,0.01,5,'Both throw, best hand wins.','Equal deposits; each player''s move is drawn from the seed.','Provably-fair moves compared by RPS rules; ties re-throw.','Seed committed at create, resolved instantly when joined.',3),
  ('highcard','Higher or Lower (High Card)','Duel','duel',true,0.01,5,'Higher card wins the duel.','Equal deposits; each draws a card 2-A.','Provably-fair draw, higher rank wins, tie re-draws.','Deterministic from committed seed.',4),
  ('war','Card War','Duel','duel',true,0.01,5,'Best of 5 high-card rounds.','Equal deposits; 5 card rounds, most rounds won wins.','Provably-fair rounds from the match seed.','All rounds resolve from one committed seed.',5),
  ('redblack','Roulette (Red/Black)','Duel','duel',true,0.01,5,'Pick a color, the spin decides.','Equal deposits; creator picks red or black.','Provably-fair spin; matching color wins.','Color derived from committed seed at resolution.',6),
  ('evenodd','Odd or Even Showdown','Duel','duel',true,0.01,5,'Call odd or even on a random number.','Equal deposits; creator picks odd or even.','Provably-fair number parity decides.','Parity from committed seed.',7),
  ('slots','Slot Spin Duel','Duel','duel',true,0.01,3,'Two players spin, best combo wins.','Equal deposits; each gets a 3-reel spin.','Provably-fair reels; higher payline value wins.','Reels from committed seed.',8),
  ('sevens','Lucky 7s','Duel','duel',true,0.01,3,'Higher two-dice total wins.','Equal deposits; each rolls two dice.','Provably-fair dice; higher sum wins.','Dice from committed seed.',9),
  ('crash','Crash Duel','Duel','duel',true,0.01,5,'Higher crash multiplier wins.','Equal deposits; each gets a crash point.','Provably-fair crash values compared.','Crash points from committed seed.',10),
  ('plinko','Plinko Duel','Duel','duel',true,0.01,5,'Higher multiplier bucket wins.','Equal deposits; each drops one ball.','Provably-fair bucket; higher multiplier wins.','Bucket path from committed seed.',11),
  ('wheel','Wheel Duel','Duel','duel',true,0.01,5,'Spin the wheel, winner takes all.','Equal deposits; the wheel picks a winner.','Provably-fair spin angle.','Outcome from committed seed.',12),
  ('blackjack','Blackjack 21','Duel','duel',true,0.01,5,'Closest to 21 without busting.','Equal deposits; each is dealt to a 21 target.','Provably-fair deal; closest to 21 wins, both bust re-deals.','Hands dealt from committed seed.',13),
  ('darts','Darts 180','Duel','duel',true,0.01,3,'Higher dart score wins.','Equal deposits; each throws for 0-180.','Provably-fair score; higher wins.','Score from committed seed.',14),
  ('race','Rocket Race','Duel','duel',true,0.01,3,'Furthest rocket wins.','Equal deposits; each rocket flies a distance.','Provably-fair distance; furthest wins.','Distance from committed seed.',15),
  ('penalty','Penalty Shootout','Duel','duel',true,0.01,3,'Best of 5 penalties wins.','Equal deposits; 5 shots each.','Provably-fair shots; most goals wins, tie goes to sudden death.','Shots from committed seed.',16)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, mode = EXCLUDED.mode, engine = EXCLUDED.engine, live = EXCLUDED.live,
  min_stake = EXCLUDED.min_stake, max_stake = EXCLUDED.max_stake, description = EXCLUDED.description,
  how_to_play = EXCLUDED.how_to_play, resolution = EXCLUDED.resolution, why_manual = EXCLUDED.why_manual,
  sort = EXCLUDED.sort;
