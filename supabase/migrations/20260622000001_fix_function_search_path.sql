-- 20260622000001_fix_function_search_path.sql
-- SAFE: pins a non-mutable search_path on flagged public functions.
-- Fixes advisor lint 0011 (function_search_path_mutable) for 77 functions.
-- Pinning to 'public' prevents search_path injection without breaking
-- unqualified object references inside the function bodies.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
      '_attach_moderation_trigger',
      '_compute_expiry',
      '_dm_stamp_delivered',
      '_is_owner_email',
      'accept_community_invite',
      'add_news_social_comment',
      'add_raised_hand',
      'admin_audit_log_target_id_sanitize',
      'apply_scan_prices',
      'bump_streak',
      'can_send_room_message',
      'check_username_available',
      'complete_onboarding',
      'compute_hot_score',
      'count_viewers_now',
      'credit_cost_for_action',
      'decrement_listener',
      'default_share_route',
      'dm_messages_stamp_delivered',
      'ensure_community_room_slug',
      'event_rsvps_after_change',
      'events_refresh_counts',
      'expire_dm_messages',
      'expire_stale_online_status',
      'grim_leaderboard',
      'grim_track_record_stats',
      'handle_follow_change',
      'handle_like_change',
      'handle_reply_change',
      'handle_updated_at',
      'handle_user_signin',
      'heartbeat',
      'increment_listener',
      'invite_to_community',
      'is_reserved_profile_username',
      'is_room_moderator',
      'launchpad_min_retain_volume',
      'list_active_stories',
      'lower_hand',
      'new_share_code',
      'normalize_solana_mint_address',
      'notify_telegram_announcer',
      'ogi_block_mutation',
      'profile_public_name',
      'prune_launchpad_tokens',
      'prune_old_news',
      'raise_hand',
      'random_string',
      'record_story_view',
      'register_username_player',
      'release_scheduled_dms',
      'remove_raised_hand',
      'rsvp_event',
      'set_updated_at',
      'submit_quest_score',
      'support_message_after_insert',
      'sync_quest_player_score',
      'toggle_news_like',
      'toggle_news_repost',
      'touch_presence',
      'touch_updated_at',
      'touch_voice_lobby_updated_at',
      'update_community_banner',
      'update_community_image_time',
      'update_community_post_sync_time',
      'update_community_timestamp',
      'update_profile_sync_time',
      'update_profile_sync_timestamp',
      'update_reel_comment_count',
      'update_reel_like_count',
      'update_reel_share_count',
      'update_updated_at_column',
      'update_user_level',
      'update_wallet_data',
      'upsert_launch_token',
      'upsert_news_social_items',
      'validate_sol_wallet'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;
