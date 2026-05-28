export type NotificationPreferenceKey =
  | "directMessages"
  | "support"
  | "spaces"
  | "priceAlerts"
  | "whaleAlerts"
  | "walletActivity"
  | "communityPosts"
  | "newFollowers"
  | "tradeSignals"
  | "lobbyInvites"
  | "ourCoin"
  | "system";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  directMessages: true,
  support: true,
  spaces: true,
  priceAlerts: true,
  whaleAlerts: true,
  walletActivity: true,
  communityPosts: true,
  newFollowers: true,
  tradeSignals: true,
  lobbyInvites: true,
  ourCoin: true,
  system: true,
};

export function normalizeNotificationPreferences(
  value: Record<string, boolean> | null | undefined
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(value || {}),
  };
}

export function notificationTypeToPreference(type?: string | null): NotificationPreferenceKey {
  switch (type) {
    case "dm":
      return "directMessages";
    case "support_ticket":
    case "support_reply":
      return "support";
    case "space_live":
    case "space_reminder":
    case "promoted":
    case "mentioned":
    case "space_ending":
    case "reminder":
      return "spaces";
    case "price_alert":
      return "priceAlerts";
    case "whale_alert":
      return "whaleAlerts";
    case "wallet_alert":
    case "wallet_buy":
    case "wallet_sell":
      return "walletActivity";
    case "community_post":
      return "communityPosts";
    case "new_follower":
      return "newFollowers";
    case "trade_signal":
    case "token_callout":
      return "tradeSignals";
    case "lobby_invite":
      return "lobbyInvites";
    case "our_coin_buy":
      return "ourCoin";
    default:
      return "system";
  }
}

function toMinutes(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isInQuietHours(
  now: Date,
  start?: string | null,
  end?: string | null
) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes === null || endMinutes === null) return false;
  if (startMinutes === endMinutes) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function getNotificationGroupTag(type?: string | null) {
  const preferenceKey = notificationTypeToPreference(type);
  return `group-${preferenceKey}`;
}
