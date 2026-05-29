-- Block reserved admin/dev-style usernames for everyone except the owner account

CREATE OR REPLACE FUNCTION public.is_reserved_profile_username(candidate text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
BEGIN
  IF candidate IS NULL THEN
    RETURN false;
  END IF;

  normalized := lower(regexp_replace(candidate, '[^a-zA-Z0-9]+', '', 'g'));

  IF normalized = '' THEN
    RETURN false;
  END IF;

  IF normalized LIKE '%admin%'
    OR normalized LIKE '%administrator%'
    OR normalized LIKE '%owner%'
    OR normalized LIKE '%founder%'
    OR normalized LIKE '%cofounder%'
    OR normalized LIKE '%official%'
    OR normalized LIKE '%staff%'
    OR normalized LIKE '%support%'
    OR normalized LIKE '%root%'
    OR normalized LIKE '%sysadmin%'
  THEN
    RETURN true;
  END IF;

  IF normalized LIKE 'dev%'
    OR normalized LIKE '%dev'
    OR normalized LIKE '%developer%'
  THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_reserved_profile_usernames()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  account_email text;
BEGIN
  IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND coalesce(NEW.username, '') = coalesce(OLD.username, '') THEN
    RETURN NEW;
  END IF;

  IF public.is_reserved_profile_username(NEW.username) THEN
    SELECT lower(email)
    INTO account_email
    FROM auth.users
    WHERE id = NEW.user_id;

    IF account_email IS DISTINCT FROM 'audifyx@gmail.com' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'This username is reserved. Only the authorized owner account can use admin/dev-style usernames.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_reserved_profile_usernames ON public.profiles;

CREATE TRIGGER trg_enforce_reserved_profile_usernames
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_reserved_profile_usernames();
