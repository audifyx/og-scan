-- Store granted X OAuth2 scopes so /x can warn if tweet.write is missing.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS twitter_oauth_scopes TEXT;

COMMENT ON COLUMN profiles.twitter_oauth_scopes IS
  'Space-separated OAuth2 scopes from last X token exchange/refresh';
