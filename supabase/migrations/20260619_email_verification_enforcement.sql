-- Email verification enforcement
-- Sensitive operations require verified email

-- Ensure is_email_verified column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_email_verified boolean DEFAULT false;

-- Create a function to check if user's email is verified
CREATE OR REPLACE FUNCTION public.user_email_verified(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  verified boolean;
BEGIN
  SELECT COALESCE(email_confirmed_at, NULL) IS NOT NULL
  INTO verified
  FROM auth.users
  WHERE id = user_id;
  
  RETURN COALESCE(verified, false);
END;
$$;

-- Add RLS policy to restrict profile updates to email-verified users
-- (optional: can enforce stricter rules by limiting sensitive field updates)
-- This is informational; actual enforcement is in business logic

-- Create function to sync email verification status from auth.users
CREATE OR REPLACE FUNCTION public.sync_email_verified_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET is_email_verified = true
    WHERE user_id = NEW.id;
  ELSIF NEW.email_confirmed_at IS NULL AND OLD.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET is_email_verified = false
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to sync when auth.users email_confirmed_at changes
DROP TRIGGER IF EXISTS sync_email_verified_trigger ON auth.users;
CREATE TRIGGER sync_email_verified_trigger
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_email_verified_status();

-- Backfill is_email_verified from auth.users
UPDATE public.profiles p
SET is_email_verified = COALESCE(au.email_confirmed_at, NULL) IS NOT NULL
FROM auth.users au
WHERE p.user_id = au.id;
