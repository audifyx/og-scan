-- ═══════════════════════════════════════════════════════════════════════
-- Security hardening — 2026-11-23 audit (B6, B2, B14)
--
-- B6: profiles had only ROW-level RLS (profiles_update_own). Any signed-in
--     user could set privileged columns on their OWN row through the SPA's
--     unfiltered updateProfile (is_official_account, verified, badge,
--     mcp_beta_access, affiliate_org_id, …). This adds a BEFORE INSERT OR
--     UPDATE trigger that silently reverts privileged / server-owned
--     columns for every writer except the service role (all server code)
--     and the owner account (the admin UI runs under the owner's own
--     session and legitimately writes these columns).
--
-- B2: social_messages writes were owner-only at the policy level, which
--     both (a) relied on the client for field safety and (b) silently
--     broke likes/polls on other people's posts. A narrow UPDATE policy
--     for authenticated users is added, paired with a BEFORE UPDATE
--     trigger that enforces field-level rules server-side: identity is
--     auth.uid() from the verified JWT, content fields are author-only,
--     and a non-author may only toggle THEIR OWN entry in liked_by
--     (likes_count is recomputed from the array). gate_meta stays
--     writable by non-authors because polls/reactions are stored there
--     by design — see the audit follow-up (a votes table / RPC is the
--     full fix for poll tampering).
--
-- B14: storage buckets had NO file_size_limit and NO allowed_mime_types,
--     so the public anon key could upload anything (incl. SVG/HTML) to
--     public buckets. The two audited buckets get real limits. Other
--     buckets still need the same treatment once their content types are
--     inventoried (assets, post-images, story-media, community*, …).
-- ═══════════════════════════════════════════════════════════════════════

-- ── B6: profiles privilege guard ──────────────────────────────────────
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := '{}'::jsonb;
  jwt_role text;
  jwt_email text;
begin
  begin
    claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  exception when others then
    claims := '{}'::jsonb;
  end;
  jwt_role := claims ->> 'role';
  jwt_email := lower(coalesce(claims ->> 'email', ''));

  -- Service role (server code, edge functions) and the owner (admin UI)
  -- may write privileged columns.
  if jwt_role = 'service_role' or jwt_email = 'audifyx@gmail.com' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_official_account := false;
    new.verified := false;
    new.mcp_beta_access := false;
    new.badge := null;
    new.affiliate_org_id := null;
    new.twitter_access_token := null;
    new.twitter_refresh_token := null;
    return new;
  end if;

  -- UPDATE: revert every privileged / server-owned column to the
  -- stored value. Cosmetic fields (username, display_name, bio,
  -- avatar_url, banner_url, wallet_address, sol_wallet,
  -- show_verified_holdings, theme_preset, custom_wallpaper_url,
  -- bio_links, twitter identity fields) pass through untouched.
  new.is_official_account := old.is_official_account;
  new.verified := old.verified;
  new.badge := old.badge;
  new.mcp_beta_access := old.mcp_beta_access;
  new.affiliate_org_id := old.affiliate_org_id;
  new.og_score := old.og_score;
  new.og_rank := old.og_rank;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.twitter_access_token := old.twitter_access_token;
  new.twitter_refresh_token := old.twitter_refresh_token;
  new.twitter_token_expires_at := old.twitter_token_expires_at;
  new.first_seen_ip := old.first_seen_ip;
  new.last_fingerprint := old.last_fingerprint;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged();

-- ── B2: social_messages field guard + like policy ─────────────────────
create or replace function public.social_messages_guard_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := '{}'::jsonb;
  jwt_role text;
  jwt_email text;
  caller uuid;
  caller_txt text;
  others text[];
  wants boolean;
begin
  begin
    claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  exception when others then
    claims := '{}'::jsonb;
  end;
  jwt_role := claims ->> 'role';
  jwt_email := lower(coalesce(claims ->> 'email', ''));

  if jwt_role = 'service_role' or jwt_email = 'audifyx@gmail.com' then
    return new;
  end if;

  caller := nullif(claims ->> 'sub', '')::uuid;
  caller_txt := caller::text;

  -- A post can never be re-attributed or re-dated by a client write.
  new.user_id := old.user_id;
  new.created_at := old.created_at;

  if caller is not null and caller = old.user_id then
    return new; -- the author editing their own post
  end if;

  -- Non-author update (like / poll interaction): content and identity
  -- fields are reverted to the stored values.
  new.content := old.content;
  new.username := old.username;
  new.avatar_url := old.avatar_url;
  new.channel := old.channel;
  new.reply_to := old.reply_to;
  new.repost_of := old.repost_of;
  new.quoted_post_id := old.quoted_post_id;
  new.data := old.data;

  -- liked_by: the caller may only add or remove THEIR OWN id. Everyone
  -- else's entries are preserved exactly as stored, and likes_count is
  -- recomputed from the resulting array (never trusted from the client).
  select coalesce(array_agg(x), '{}')
    into others
    from unnest(coalesce(old.liked_by, '{}'::text[])) as x
   where x <> caller_txt;
  wants := new.liked_by is not null and caller_txt is not null and caller_txt = any(new.liked_by);
  new.liked_by := case when wants then others || caller_txt else others end;
  new.likes_count := coalesce(array_length(new.liked_by, 1), 0);
  return new;
end;
$$;

drop trigger if exists social_messages_guard_fields on public.social_messages;
create trigger social_messages_guard_fields
  before update on public.social_messages
  for each row execute function public.social_messages_guard_fields();

-- Authenticated users may UPDATE any post row — the trigger above is
-- the enforcement (authors edit their posts; everyone else can only
-- move like fields). INSERT/DELETE stay owner-only via
-- social_msg_owner_write.
drop policy if exists social_msg_like_update on public.social_messages;
create policy social_msg_like_update on public.social_messages
  for update to authenticated
  using (true)
  with check (true);

-- ── B14: storage bucket limits (audited buckets) ──────────────────────
-- profile-media: avatars/banners + NFT media (<= 50 MB) + NFT metadata JSON.
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array[
         'image/png','image/jpeg','image/webp','image/gif',
         'video/mp4','video/webm','video/quicktime',
         'application/json'
       ]
 where id = 'profile-media';

-- dm-media: DM images + voice notes.
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array[
         'image/png','image/jpeg','image/webp','image/gif',
         'video/mp4','video/webm','video/quicktime',
         'audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4'
       ]
 where id = 'dm-media';
