/* ══════════════════════════════════════════════════════════════
   Admin Dashboard — shared types
   ══════════════════════════════════════════════════════════════ */

export interface Submission {
  id: string; token_name: string; symbol: string; contract_address: string;
  launch_platform: string; status: string; promotion_tier: string;
  is_featured: boolean; user_id: string | null; created_at: string;
  admin_notes: string | null; logo_url: string | null;
}

export interface AuditLog {
  id: string; admin_user_id: string; action: string;
  target_type: string | null; target_id: string | null;
  created_at: string; new_values: any; old_values: any;
}

export interface UserProfile {
  id: string; user_id: string; username: string | null;
  wallet_address: string | null; created_at: string;
  total_pnl: number | null; trades_count: number | null;
  avatar_url: string | null; bio: string | null;
  theme_preset: string | null;
}

export interface UserCreditsData {
  id: string; user_id: string; total_credits: number;
  used_credits: number; last_reset_at: string; next_reset_at: string;
}

export interface CreditTransaction {
  id: string; user_id?: string; tool_name: string; tool_category: string;
  cost: number; description: string | null; created_at: string;
}

export interface PlatformSetting {
  id: string; key: string; value: any; category: string;
  description: string | null; updated_at: string;
}

export interface LobbyData {
  id: string; name: string; description: string | null;
  created_by: string; creator_name: string | null;
  privacy: string; member_count: number | null;
  is_active: boolean | null; created_at: string | null;
}

export interface LobbyMember {
  id: string; lobby_id: string; user_id: string; role: string;
  joined_at: string; username?: string;
}

export interface LobbyMessage {
  id: string; lobby_id: string; user_id: string; content: string;
  created_at: string; username?: string;
}

export interface Community {
  id: string; name: string; description: string | null;
  creator_id: string; type: string; member_count: number;
  is_featured: boolean; created_at: string;
  avatar_url: string | null; banner_url: string | null;
  rules: string | null; tags: string[] | null;
}

export interface CommunityPost {
  id: string; community_id: string; user_id: string; content: string;
  image_url: string | null; created_at: string; is_pinned: boolean;
  like_count: number; reply_count: number; username?: string;
}

export interface CommunityMember {
  id: string; community_id: string; user_id: string; role: string;
  joined_at: string; username?: string;
}

export interface SpaceData {
  id: string; title: string; description: string | null;
  host_id: string; status: string; is_recording: boolean;
  listener_count: number; speaker_count: number;
  created_at: string; ended_at: string | null;
  scheduled_for: string | null;
}

export interface SpaceMessage {
  id: string; space_id: string; user_id: string; content: string;
  created_at: string; username?: string;
}

export interface SpacePoll {
  id: string; space_id: string; question: string;
  options: any; created_at: string; is_active: boolean;
}

export interface SpaceRecording {
  id: string; space_id: string; url: string;
  duration: number | null; created_at: string;
}

export interface SpeakerRequest {
  id: string; space_id: string; user_id: string;
  status: string; created_at: string; username?: string;
}

export interface SupportTicket {
  id: string; user_id: string; subject: string; status: string;
  priority: string; category: string; created_at: string;
  updated_at: string; username?: string;
}

export interface SupportMessage {
  id: string; ticket_id: string; user_id: string; content: string;
  is_admin: boolean; created_at: string;
}

export interface ChatMessage {
  id: string; user_id: string; content: string;
  room_id: string | null; created_at: string; username?: string;
}

export interface AlphaDiscussion {
  id: string; user_id: string; title: string; content: string;
  category: string | null; created_at: string; username?: string;
}

export interface NotificationData {
  id: string; user_id: string; title: string; message: string;
  type: string; read: boolean; created_at: string; data: any;
}

export interface PriceAlert {
  id: string; user_id: string; token_address: string; token_symbol: string;
  target_price: number; condition: string; is_active: boolean;
  created_at: string; triggered_at: string | null;
}

export interface TrackedWallet {
  id: string; user_id: string; wallet_address: string;
  label: string | null; created_at: string;
}

export interface TrackedToken {
  id: string; user_id: string; token_address: string;
  token_symbol: string | null; created_at: string;
}

export interface TradeHistoryEntry {
  id: string; user_id: string; token_address: string;
  token_symbol: string | null; action: string;
  amount: number; price: number; pnl: number | null;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string; user_id: string; username: string | null;
  total_pnl: number; trade_count: number;
  win_rate: number | null; updated_at: string;
}

export interface WallpaperData {
  id: string; name: string; url: string; category: string;
  is_premium: boolean; created_at: string;
}

export interface FollowerData {
  id: string; follower_id: string; following_id: string;
  created_at: string;
}

export interface UserActivity {
  id: string; user_id: string; action: string;
  metadata: any; created_at: string;
}

export interface AdminRole {
  id: string; user_id: string; role: string;
  created_at: string;
}

/* ── Section navigation ── */
export type AdminSection =
  | "overview" | "users" | "communities" | "moderation"
  | "lobbies" | "tokens" | "spaces" | "support"
  | "chat" | "notifications" | "alerts" | "wallets"
  | "media" | "settings" | "audit" | "analytics" | "tools";

export interface AdminSectionDef {
  id: AdminSection;
  label: string;
  icon: string; // lucide icon name
  badge?: number;
  group: "core" | "content" | "engagement" | "system";
}
