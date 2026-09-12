import type { LaunchIdentity } from "./types";

export function canLaunch(profile: LaunchIdentity | null | undefined): boolean {
  return Boolean(profile?.x_user_id && profile?.wallet_pubkey);
}

export function identityFromSession(input: {
  userId?: string | null;
  identities?: Array<{ provider?: string; id?: string; identity_data?: Record<string, unknown> }> | null;
  userMeta?: Record<string, unknown> | null;
  profile?: {
    twitter_id?: string | null;
    twitter_username?: string | null;
    twitter_avatar?: string | null;
    twitter_handle?: string | null;
    wallet_pubkey?: string | null;
    wallet_address?: string | null;
  } | null;
  connectedWallet?: string | null;
}): LaunchIdentity {
  const identities = input.identities ?? [];
  const xIdFromProvider = identities.find((i) => i.provider === "x" || i.provider === "twitter");
  const meta = input.userMeta ?? {};
  const x_user_id =
    input.profile?.twitter_id ||
    (typeof xIdFromProvider?.id === "string" ? xIdFromProvider.id : null) ||
    (typeof meta.provider_id === "string" ? meta.provider_id : null) ||
    (typeof meta.sub === "string" && (meta.iss as string | undefined)?.includes("twitter") ? meta.sub : null) ||
    null;
  const x_handle =
    input.profile?.twitter_username ||
    input.profile?.twitter_handle ||
    str(xIdFromProvider?.identity_data?.user_name) ||
    str(xIdFromProvider?.identity_data?.preferred_username) ||
    str(meta.user_name) ||
    str(meta.preferred_username) ||
    null;
  const x_avatar =
    input.profile?.twitter_avatar ||
    str(xIdFromProvider?.identity_data?.avatar_url) ||
    str(xIdFromProvider?.identity_data?.picture) ||
    str(meta.avatar_url) ||
    str(meta.picture) ||
    null;
  const wallet_pubkey =
    input.profile?.wallet_pubkey ||
    input.profile?.wallet_address ||
    input.connectedWallet ||
    null;
  return { x_user_id, x_handle, x_avatar, wallet_pubkey };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function launchGateReason(profile: LaunchIdentity | null | undefined): string | null {
  if (canLaunch(profile)) return null;
  if (!profile?.x_user_id && !profile?.wallet_pubkey) return "Authenticate with X, then prove your wallet.";
  if (!profile?.x_user_id) return "Authenticate with X to launch.";
  return "Prove your wallet to launch.";
}
