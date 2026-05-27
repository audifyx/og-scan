-- OG Scan Org Affiliates System
-- Adds official account flag and affiliate relationship to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_official_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_org_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Index for fast lookups of affiliates of an org
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_org_id ON profiles(affiliate_org_id);

-- Allow admins to update these fields (RLS must already allow admin updates)
-- Public can read is_official_account and affiliate_org_id
COMMENT ON COLUMN profiles.is_official_account IS 'True for the primary brand/org account (e.g. OG Scan official)';
COMMENT ON COLUMN profiles.affiliate_org_id IS 'If set, this user is an official affiliate of the referenced org profile';
