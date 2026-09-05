/**
 * Agent MCP ↔ X (Twitter) using the same profiles.twitter_* tokens as /x and X MCP.
 * Connect via OrbitX X OAuth (Supabase /auth Continue with X, or /x Connect X).
 */
import { postTweetOAuth2, buildTweetText as libBuildTweetText } from "./x-agent-lib.js";

const HOST = "https://www.orbitx.world";

function xScopeInfo(profileOrScope) {
  const scope =
    typeof profileOrScope === "string"
      ? profileOrScope
      : String(profileOrScope?.twitter_oauth_scopes || "");
  const parts = scope.split(/[+\s]+/).filter(Boolean);
  return {
    scopes: parts.length ? parts : null,
    hasTweetWrite: parts.includes("tweet.write"),
    hasTweetRead: parts.includes("tweet.read"),
  };
}

export async function loadXProfile(sb, userId) {
  if (!userId) return null;
  try {
    const rows = await sb(
      `profiles?user_id=eq.${encodeURIComponent(userId)}&select=twitter_access_token,twitter_refresh_token,twitter_token_expires_at,twitter_id,twitter_username,twitter_name,twitter_oauth_scopes,username&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : rows;
  } catch {
    try {
      const rows = await sb(
        `profiles?user_id=eq.${encodeURIComponent(userId)}&select=twitter_access_token,twitter_username,username&limit=1`,
      );
      return Array.isArray(rows) ? rows[0] : rows;
    } catch {
      return null;
    }
  }
}

export function xConnectPayload({ authCode } = {}) {
  const qs = authCode ? `?next=${encodeURIComponent("/supercomputer?tab=channels")}` : "";
  return {
    ok: true,
    action: "x_connect",
    message:
      "Connect X on OrbitX, then post from this MCP. Continue with X on /auth (Supabase) or Connect X on /x (tweet.write).",
    connectUrl: `${HOST}/auth${qs}`,
    writeConnectUrl: `${HOST}/x`,
    authPage: `${HOST}/auth`,
    xHub: `${HOST}/x`,
    hint: "After connecting, call orbitx_x_status then orbitx_x_post with your tweet text.",
  };
}

export async function xStatus(sb, { userId } = {}) {
  if (!userId) {
    return {
      ok: false,
      error: "session_required",
      message: "Link this chat with orbitx_auth_status, then connect X.",
      ...xConnectPayload(),
    };
  }
  const profile = await loadXProfile(sb, userId);
  const connected = Boolean(profile?.twitter_access_token);
  const scope = xScopeInfo(profile);
  if (!connected) {
    return {
      ok: false,
      error: "x_not_connected",
      connected: false,
      message: "X is not connected for this OrbitX user.",
      ...xConnectPayload(),
    };
  }
  return {
    ok: true,
    connected: true,
    username: profile.twitter_username || null,
    twitterId: profile.twitter_id || null,
    ...scope,
    message: profile.twitter_username
      ? `Connected as @${profile.twitter_username}`
      : "X is connected. You can post with orbitx_x_post.",
  };
}

export async function xPost(sb, args, { userId } = {}) {
  const status = await xStatus(sb, { userId });
  if (!status.ok) return status;
  const profile = await loadXProfile(sb, userId);
  const textRaw = String(args.text || args.tweet || args.content || "").trim();
  if (!textRaw) {
    return { ok: false, error: "text_required", message: "What should I post? Pass text." };
  }
  let tweetText;
  try {
    tweetText = libBuildTweetText(textRaw, args.linkUrl || args.link_url || "");
  } catch (e) {
    return { ok: false, error: "text_invalid", message: e?.message || "Invalid tweet text" };
  }
  if (status.scopes && !status.hasTweetWrite) {
    return {
      ok: false,
      error: "tweet_write_missing",
      message:
        "This X token cannot post (missing tweet.write). Reconnect X on https://www.orbitx.world/x after setting the X app to Read and write.",
      fixUrl: `${HOST}/x`,
    };
  }
  const posted = await postTweetOAuth2(profile.twitter_access_token, {
    text: tweetText,
    replyToTweetId: args.replyToTweetId || args.reply_to_tweet_id || "",
    quoteTweetId: args.quoteTweetId || args.quote_tweet_id || "",
  });
  if (!posted.ok) return posted;
  return {
    ok: true,
    action: "x_posted",
    username: profile.twitter_username || null,
    ...posted,
    message: posted.tweetUrl ? `Posted: ${posted.tweetUrl}` : "Posted to X.",
  };
}

export async function dispatchXTool(name, args, { sb, auth } = {}) {
  const userId = auth?.userId || null;
  if (name === "orbitx_x_connect") return xConnectPayload({ authCode: args?.authCode });
  if (name === "orbitx_x_status") return xStatus(sb, { userId });
  if (name === "orbitx_x_post" || name === "orbitx_x_tweet") return xPost(sb, args || {}, { userId });
  if (name === "orbitx_x_reply") {
    return xPost(sb, { ...(args || {}), replyToTweetId: args?.replyToTweetId || args?.tweetId }, { userId });
  }
  if (name === "orbitx_x_quote") {
    return xPost(sb, { ...(args || {}), quoteTweetId: args?.quoteTweetId || args?.tweetId }, { userId });
  }
  return null;
}
