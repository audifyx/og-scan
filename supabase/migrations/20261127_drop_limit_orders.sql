-- Drop limit orders (user, 2026-11-27 03:03 EST: "don't want limit orders").
-- The Trigger v1 limit-order routes + this table were built in the
-- solve-everything backend batch and removed the same day; nothing ever
-- used them (no app UI was built, no order was ever confirmed/recorded).
-- user_trades + user_trade_volume from 20261127_user_trades.sql stay.
DROP TABLE IF EXISTS public.user_limit_orders CASCADE;
