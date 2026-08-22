/**
 * OrbitX Launchpad V2 + Bagworking API.
 *
 * Route: /api/launchpad-v2?action=…
 * Auth: Supabase JWT (same pattern as /api/bagwork).
 * Cron: Vercel Authorization Bearer CRON_SECRET.
 *
 * Does NOT create Pump.fun tokens — launch txs stay on /api/pump-create
 * + LaunchpadPump / LaunchpadCreate. This API registers confirmed launches,
 * stores flywheel/bagworking config, verifies X posts, and opens creator-fee
 * jobs when the pump vault is ≥ $25.
 */
import { createClient } from "@supabase/supabase-js";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  BAGWORKING_DEFAULTS,
  campaignRemaining,
  classifyPost,
  dailyLimitReached,
  defaultFlywheel,
  extractTweetId,
  FEE_THRESHOLD_USD,
  feeReady,
  LAUNCH_KINDS,
  progressToThreshold,
  referencedTweetDisallowed,
  utcDay,
  validateFlywheel,
  validateQualifyingText,
} from "../shared/launchpad-v2.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Wallet, X-Cron-Secret",
};

const OWNER_EMAILS = ["audifyx@gmail.com"];
const OWNER_WALLETS = String(process.env.OWNER_WALLETS || process.env.VITE_OWNER_WALLETS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_USD_CACHE = { v: 0, t: 0 };

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function bodyOf(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  return (req.body && typeof req.body === "object") ? req.body : {};
}

function isOwnerEmail(email) {
  if (!email) return false;
  const e = String(email).toLowerCase();
  if (OWNER_EMAILS.includes(e)) return true;
  const m = e.match(/^([1-9a-zA-Z]{32,44})@wallet\.orbitx\.app$/i);
  if (m && OWNER_WALLETS.some((w) => w === m[1] || w.toLowerCase() === m[1].toLowerCase())) return true;
  return false;
}

function walletHeader(req) {
  return String(req.headers["x-wallet"] || "").trim();
}

function isOwnerWallet(wallet) {
  if (!wallet) return false;
  return OWNER_WALLETS.some((w) => w === wallet || w.toLowerCase() === wallet.toLowerCase());
}

async function requireUser(req) {
  const jwt = bearer(req);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!jwt || !url || !anon) return { error: "Sign in to continue." };
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: anon },
  });
  if (!r.ok) return { error: "Sign in to continue." };
  const u = await r.json().catch(() => null);
  if (!u?.id) return { error: "Sign in to continue." };
  return { user: { id: u.id, email: u.email || null } };
}

function isAdminReq(req, user) {
  return isOwnerEmail(user?.email) || isOwnerWallet(walletHeader(req));
}

function rpc() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    process.env.VITE_SOLANA_RPC ||
    "https://api.mainnet-beta.solana.com"
  );
}

function explorerTx(sig) {
  return sig ? `https://solscan.io/tx/${sig}` : null;
}

function mintOk(mint) {
  try {
    return new PublicKey(String(mint || "").trim()).toBase58();
  } catch {
    return null;
  }
}

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return true;
  const auth = bearer(req);
  const header = String(req.headers["x-cron-secret"] || "");
  const q = String(req.query?.secret || "");
  return auth === secret || header === secret || q === secret;
}

async function confirmSig(connection, signature) {
  const sig = String(signature || "").trim();
  if (!sig || sig.length < 32 || sig.length > 128) return { ok: false, reason: "Invalid signature." };
  try {
    const st = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
    const v = st?.value;
    if (!v) return { ok: false, reason: "Signature not found on-chain yet." };
    if (v.err) return { ok: false, reason: "On-chain transaction failed." };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "RPC status failed." };
  }
}

async function profileFor(sb, userId) {
  const { data } = await sb
    .from("profiles")
    .select("id, user_id, wallet_address, twitter_id, twitter_username, twitter_access_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data;
  const { data: byId } = await sb
    .from("profiles")
    .select("id, user_id, wallet_address, twitter_id, twitter_username, twitter_access_token")
    .eq("id", userId)
    .maybeSingle();
  return byId || null;
}

function xUserId(profile) {
  return String(profile?.twitter_id || profile?.twitter_user_id || "").trim();
}

async function rulesFor(sb) {
  const { data } = await sb.from("ox_lp_bagworking_rules").select("*").eq("id", "global").maybeSingle();
  if (!data) return { ...BAGWORKING_DEFAULTS };
  return {
    ...BAGWORKING_DEFAULTS,
    short_reward_usd: Number(data.short_reward_usd ?? BAGWORKING_DEFAULTS.short_reward_usd),
    long_reward_usd: Number(data.long_reward_usd ?? BAGWORKING_DEFAULTS.long_reward_usd),
    min_short_chars: Number(data.min_short_chars ?? BAGWORKING_DEFAULTS.min_short_chars),
    long_min_chars: Number(data.long_min_chars ?? BAGWORKING_DEFAULTS.long_min_chars),
    max_posts_per_day: Number(data.max_posts_per_day ?? BAGWORKING_DEFAULTS.max_posts_per_day),
    require_ticker: data.require_ticker !== false,
    require_ca: Boolean(data.require_ca),
    require_hashtag: Boolean(data.require_hashtag),
    require_url: Boolean(data.require_url),
    replies_count: Boolean(data.replies_count),
    quotes_count: Boolean(data.quotes_count),
    reposts_count: Boolean(data.reposts_count),
    fee_threshold_usd: Number(data.fee_threshold_usd || FEE_THRESHOLD_USD),
  };
}

async function audit(sb, actor, action, payload) {
  try {
    await sb.from("ox_lp_audit").insert({ actor: actor || "system", action, payload: payload || {} });
  } catch {
    /* never fail the request on audit */
  }
}

function pumpCreatorVaultPda(creator) {
  return PublicKey.findProgramAddressSync([Buffer.from("creator-vault"), creator.toBuffer()], PUMP_PROGRAM_ID)[0];
}

async function getPumpClaimableSol(connection, creator) {
  const vault = pumpCreatorVaultPda(creator);
  const [bal, rentFloor] = await Promise.all([
    connection.getBalance(vault),
    connection.getMinimumBalanceForRentExemption(0),
  ]);
  const excess = Math.max(0, bal - rentFloor);
  return { vault: vault.toBase58(), lamports: excess, sol: excess / LAMPORTS_PER_SOL };
}

async function fetchSolUsdPrice() {
  if (Date.now() - SOL_USD_CACHE.t < 60_000 && SOL_USD_CACHE.v > 0) return SOL_USD_CACHE.v;
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
    const d = await r.json();
    const px = Number(d?.[SOL_MINT]?.usdPrice) || 0;
    if (px > 0) {
      SOL_USD_CACHE.v = px;
      SOL_USD_CACHE.t = Date.now();
      return px;
    }
  } catch { /* try coingecko */ }
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const d = await r.json();
    const px = Number(d?.solana?.usd) || 0;
    if (px > 0) {
      SOL_USD_CACHE.v = px;
      SOL_USD_CACHE.t = Date.now();
      return px;
    }
  } catch { /* ignore */ }
  return SOL_USD_CACHE.v || 0;
}

async function handleOverview(_req, res, sb) {
  const [launches, campaigns, jobs] = await Promise.all([
    sb.from("ox_lp_launches").select("id", { count: "exact", head: true }),
    sb.from("ox_lp_campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("ox_lp_fee_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "awaiting_creator_sign", "claiming"]),
  ]);
  return json(res, 200, {
    ok: true,
    launches: launches.count || 0,
    active_campaigns: campaigns.count || 0,
    open_fee_jobs: jobs.count || 0,
    kinds: LAUNCH_KINDS,
    fee_threshold_usd: FEE_THRESHOLD_USD,
    bagworking: BAGWORKING_DEFAULTS,
  });
}

async function handleRegisterLaunch(req, res, sb, user) {
  const body = bodyOf(req);
  const mint = mintOk(body.mint);
  if (!mint) return json(res, 400, { ok: false, error: "Valid token mint required." });
  const kind = LAUNCH_KINDS.includes(body.kind) ? body.kind : "standard";
  const lane = body.lane === "custom" ? "custom" : "pump";
  const signature = String(body.signature || body.mint_signature || "").trim();
  if (!signature) return json(res, 400, { ok: false, error: "Confirmed launch signature required." });

  const connection = new Connection(rpc(), "confirmed");
  const confirmed = await confirmSig(connection, signature);
  if (!confirmed.ok) return json(res, 400, { ok: false, error: confirmed.reason });

  let flywheel = defaultFlywheel();
  let flyBps = null;
  if (kind === "flywheel") {
    const checked = validateFlywheel({
      community: body.community ?? body.community_bps,
      buyBurn: body.buyBurn ?? body.buy_burn ?? body.buy_burn_bps,
      creator: body.creator ?? body.creator_bps,
      rewards: body.rewards ?? body.rewards_bps,
    });
    if (!checked.ok) return json(res, 400, { ok: false, error: checked.error });
    flyBps = checked.bps;
    flywheel = {
      community: flyBps.community / 100,
      buyBurn: flyBps.buyBurn / 100,
      creator: flyBps.creator / 100,
      rewards: flyBps.rewards / 100,
    };
  }

  const creatorWallet = String(body.creator_wallet || "").trim();
  try {
    new PublicKey(creatorWallet);
  } catch {
    return json(res, 400, { ok: false, error: "Creator wallet required." });
  }

  const row = {
    mint,
    creator_wallet: creatorWallet,
    user_id: user.id,
    name: String(body.name || "").slice(0, 32) || "Token",
    ticker: String(body.ticker || body.symbol || "").slice(0, 10) || "TKN",
    launch_kind: kind,
    lane,
    mint_signature: signature,
    metadata_uri: body.metadata_uri ? String(body.metadata_uri).slice(0, 2000) : null,
    image_url: body.image_url ? String(body.image_url).slice(0, 2000) : null,
    website: body.website ? String(body.website).slice(0, 500) : null,
    twitter: body.twitter ? String(body.twitter).slice(0, 200) : null,
    telegram: body.telegram ? String(body.telegram).slice(0, 200) : null,
    bagworking_eligible: kind === "bagworking",
    auto_fee_claim: kind !== "standard",
    status: "live",
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await sb.from("ox_lp_launches").select("id").eq("mint", mint).maybeSingle();
  let launch;
  if (existing?.id) {
    const { data, error } = await sb.from("ox_lp_launches").update(row).eq("id", existing.id).select("*").single();
    if (error) return json(res, 500, { ok: false, error: error.message });
    launch = data;
  } else {
    const { data, error } = await sb.from("ox_lp_launches").insert(row).select("*").single();
    if (error) return json(res, 500, { ok: false, error: error.message });
    launch = data;
  }

  if (kind === "flywheel" && flyBps) {
    await sb.from("ox_lp_flywheel_configs").upsert({
      launch_id: launch.id,
      community_bps: flyBps.community,
      buy_burn_bps: flyBps.buyBurn,
      creator_bps: flyBps.creator,
      rewards_bps: flyBps.rewards,
    });
  }

  let campaign = null;
  if (kind === "bagworking") {
    const { data: camp } = await sb.from("ox_lp_campaigns").select("*").eq("launch_id", launch.id).maybeSingle();
    if (!camp) {
      const ins = await sb.from("ox_lp_campaigns").insert({
        launch_id: launch.id,
        mint,
        creator_wallet: creatorWallet,
        title: `${row.ticker} Bagworking`,
        status: "draft",
        budget_usd: Number(body.reward_pool_usd || body.budget_usd || 500),
        short_reward_usd: Number(body.short_reward_usd || BAGWORKING_DEFAULTS.short_reward_usd),
        long_reward_usd: Number(body.long_reward_usd || BAGWORKING_DEFAULTS.long_reward_usd),
        max_per_user_day: BAGWORKING_DEFAULTS.max_posts_per_day,
        required_ticker: row.ticker.replace(/^\$/, ""),
        ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      }).select("*").single();
      campaign = ins.data;
    } else {
      campaign = camp;
    }
  }

  await audit(sb, user.id, "register_launch", { mint, kind, signature });
  return json(res, 200, { ok: true, launch, campaign, flywheel: kind === "flywheel" ? flywheel : null });
}

async function handleMyLaunches(_req, res, sb, user) {
  const { data, error } = await sb
    .from("ox_lp_launches")
    .select("*, ox_lp_flywheel_configs(*), ox_lp_campaigns(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) return json(res, 500, { ok: false, error: error.message });
  return json(res, 200, { ok: true, launches: data || [] });
}

async function handleEligible(_req, res, sb) {
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("ox_lp_campaigns")
    .select("*, ox_lp_launches(*)")
    .eq("status", "active")
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) return json(res, 500, { ok: false, error: error.message });
  const coins = (data || []).map((c) => {
    const launch = Array.isArray(c.ox_lp_launches) ? c.ox_lp_launches[0] : c.ox_lp_launches;
    const remaining = campaignRemaining(c);
    return {
      campaign_id: c.id,
      mint: c.mint,
      status: c.status,
      name: launch?.name || c.title || "",
      symbol: launch?.ticker || c.required_ticker || "",
      image_url: launch?.image_url || null,
      creator_wallet: c.creator_wallet,
      kind: launch?.launch_kind || "bagworking",
      reward_short: Number(c.short_reward_usd ?? BAGWORKING_DEFAULTS.short_reward_usd),
      reward_long: Number(c.long_reward_usd ?? BAGWORKING_DEFAULTS.long_reward_usd),
      remaining_usd: remaining,
      pool_usd: Number(c.budget_usd),
      spent_usd: Number(c.spent_usd),
      posts_count: c.posts_count || 0,
      participants_count: c.participants_count || 0,
      ends_at: c.ends_at,
      required_ticker: c.required_ticker,
    };
  }).filter((c) => c.remaining_usd > 0);
  return json(res, 200, { ok: true, coins });
}

async function handleCampaignGet(req, res, sb) {
  const id = String(req.query.campaign_id || req.query.id || "").trim();
  if (!id) return json(res, 400, { ok: false, error: "campaign_id required." });
  const { data, error } = await sb.from("ox_lp_campaigns").select("*, ox_lp_launches(*)").eq("id", id).maybeSingle();
  if (error || !data) return json(res, 404, { ok: false, error: "Campaign not found." });
  return json(res, 200, { ok: true, campaign: data, remaining_usd: campaignRemaining(data) });
}

async function handleUpdateCampaign(req, res, sb, user, adminUser) {
  const body = bodyOf(req);
  const campaignId = String(body.campaign_id || "").trim();
  if (!campaignId) return json(res, 400, { ok: false, error: "campaign_id required." });
  const { data: camp, error } = await sb.from("ox_lp_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (error || !camp) return json(res, 404, { ok: false, error: "Campaign not found." });

  const { data: launch } = await sb.from("ox_lp_launches").select("user_id, creator_wallet").eq("id", camp.launch_id).maybeSingle();
  const owns = launch?.user_id === user.id || camp.creator_wallet === walletHeader(req);
  if (!adminUser && !owns) return json(res, 403, { ok: false, error: "Not your campaign." });

  const patch = { updated_at: new Date().toISOString() };
  if (body.status && ["draft", "active", "paused", "completed", "expired"].includes(body.status)) {
    patch.status = body.status;
  }
  if (body.budget_usd != null || body.reward_pool_usd != null) {
    patch.budget_usd = Number(body.budget_usd ?? body.reward_pool_usd);
  }
  if (body.short_reward_usd != null) patch.short_reward_usd = Number(body.short_reward_usd);
  if (body.long_reward_usd != null) patch.long_reward_usd = Number(body.long_reward_usd);
  if (body.duration_days != null) {
    patch.ends_at = new Date(Date.now() + Number(body.duration_days) * 86400000).toISOString();
  }
  if (body.required_ticker != null) patch.required_ticker = String(body.required_ticker).replace(/^\$/, "");
  if (body.required_hashtag != null) patch.required_hashtag = String(body.required_hashtag).replace(/^#/, "") || null;
  if (body.required_url != null) patch.required_url = String(body.required_url) || null;
  if (body.required_keywords != null) {
    patch.required_keywords = Array.isArray(body.required_keywords)
      ? body.required_keywords.map(String)
      : String(body.required_keywords).split(",").map((s) => s.trim()).filter(Boolean);
  }

  const { data: updated, error: upErr } = await sb.from("ox_lp_campaigns").update(patch).eq("id", campaignId).select("*").single();
  if (upErr) return json(res, 500, { ok: false, error: upErr.message });
  await audit(sb, user.id, "update_campaign", { campaignId, ...patch });
  return json(res, 200, { ok: true, campaign: updated });
}

async function fetchTweet(tweetId, userAccessToken) {
  const token = userAccessToken || process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "";
  if (!token) return { error: "X API is not configured." };
  const url = new URL(`https://api.twitter.com/2/tweets/${tweetId}`);
  url.searchParams.set("tweet.fields", "author_id,created_at,text,referenced_tweets,public_metrics");
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.detail || data?.title || data?.errors?.[0]?.message || `X API ${r.status}`;
    return { error: msg, status: r.status, data };
  }
  if (!data.data) return { error: "Post not found or is not public." };
  return { tweet: data.data, includes: data.includes };
}

async function flagAbuse(sb, row) {
  try {
    await sb.from("ox_lp_abuse_flags").insert(row);
  } catch { /* ignore */ }
}

async function handleSubmitPost(req, res, sb, user) {
  const body = bodyOf(req);
  const tweetId = extractTweetId(body.tweet_url || body.tweet_id || "");
  if (!tweetId) return json(res, 400, { ok: false, error: "Paste an X post URL or tweet id." });
  const campaignId = String(body.campaign_id || "").trim();
  if (!campaignId) return json(res, 400, { ok: false, error: "campaign_id required." });

  const { data: restricted } = await sb
    .from("ox_lp_abuse_flags")
    .select("risk")
    .eq("user_id", user.id)
    .in("risk", ["restricted", "banned"])
    .limit(1);
  if (restricted?.length) {
    return json(res, 403, { ok: false, error: "This account is restricted from Bagworking. Contact OrbitX." });
  }

  const profile = await profileFor(sb, user.id);
  const xid = xUserId(profile);
  if (!xid) return json(res, 400, { ok: false, error: "Connect X before submitting a Bagworking post." });

  const { data: camp } = await sb.from("ox_lp_campaigns").select("*, ox_lp_launches(*)").eq("id", campaignId).maybeSingle();
  if (!camp || camp.status !== "active") return json(res, 400, { ok: false, error: "Campaign is not active." });
  if (camp.ends_at && new Date(camp.ends_at).getTime() < Date.now()) {
    await sb.from("ox_lp_campaigns").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", campaignId);
    return json(res, 400, { ok: false, error: "Campaign expired." });
  }

  const remaining = campaignRemaining(camp);
  if (remaining <= 0) return json(res, 400, { ok: false, error: "Campaign funded pool is exhausted." });

  const { data: dup } = await sb.from("ox_lp_posts").select("id").eq("x_post_id", tweetId).maybeSingle();
  if (dup) return json(res, 409, { ok: false, error: "This X post has already been submitted." });

  const day = utcDay();
  const { data: limitRow } = await sb
    .from("ox_lp_daily_limits")
    .select("*")
    .eq("user_id", user.id)
    .eq("day", day)
    .maybeSingle();
  const used = limitRow?.posts || 0;
  const rules = await rulesFor(sb);
  if (dailyLimitReached(used, { max_posts_per_day: camp.max_per_user_day || rules.max_posts_per_day })) {
    return json(res, 400, { ok: false, error: "Daily Bagworking limit reached." });
  }

  const fetched = await fetchTweet(tweetId, profile.twitter_access_token);
  if (fetched.error) return json(res, 400, { ok: false, error: `X verification failed: ${fetched.error}` });
  const tweet = fetched.tweet;
  if (String(tweet.author_id) !== xid) {
    return json(res, 400, { ok: false, error: "Post author does not match the connected X account." });
  }

  const refBlock = referencedTweetDisallowed(tweet, rules);
  if (refBlock) return json(res, 400, { ok: false, error: refBlock });

  const launch = Array.isArray(camp.ox_lp_launches) ? camp.ox_lp_launches[0] : camp.ox_lp_launches;
  const textCheck = validateQualifyingText(tweet.text || "", {
    required_ticker: camp.required_ticker || launch?.ticker,
    mint: camp.mint,
    required_hashtag: camp.required_hashtag,
    required_url: camp.required_url,
    required_keywords: camp.required_keywords,
  }, {
    ...rules,
    require_ticker: Boolean(camp.required_ticker) || rules.require_ticker,
    require_hashtag: Boolean(camp.required_hashtag) || rules.require_hashtag,
    require_url: Boolean(camp.required_url) || rules.require_url,
  });
  if (!textCheck.ok) return json(res, 400, { ok: false, error: textCheck.error });

  const kind = classifyPost(tweet.text || "", rules);
  if (kind === "too_short") {
    return json(res, 400, { ok: false, error: `Post is too short (min ${rules.min_short_chars} characters).` });
  }
  const reward = kind === "long"
    ? Number(camp.long_reward_usd ?? rules.long_reward_usd)
    : Number(camp.short_reward_usd ?? rules.short_reward_usd);
  if (reward > remaining + 1e-9) {
    return json(res, 400, { ok: false, error: "Campaign funded pool cannot cover this reward." });
  }

  const postInsert = await sb.from("ox_lp_posts").insert({
    campaign_id: campaignId,
    user_id: user.id,
    wallet: profile.wallet_address || null,
    x_user_id: xid,
    x_username: profile.twitter_username || null,
    x_post_id: tweetId,
    post_url: `https://x.com/i/status/${tweetId}`,
    post_text: String(tweet.text || "").slice(0, 2000),
    post_kind: kind,
    reward_usd: reward,
    status: "verified",
  }).select("*").single();
  if (postInsert.error) {
    if (String(postInsert.error.message || "").includes("duplicate") || postInsert.error.code === "23505") {
      return json(res, 409, { ok: false, error: "This X post has already been submitted." });
    }
    return json(res, 500, { ok: false, error: postInsert.error.message });
  }

  await sb.from("ox_lp_rewards").insert({
    post_id: postInsert.data.id,
    user_id: user.id,
    campaign_id: campaignId,
    amount_usd: reward,
    status: "credited",
  });

  const { data: bal } = await sb.from("ox_lp_balances").select("*").eq("user_id", user.id).maybeSingle();
  if (bal) {
    await sb.from("ox_lp_balances").update({
      pending_usd: Number(bal.pending_usd) + reward,
      lifetime_usd: Number(bal.lifetime_usd || 0) + reward,
      lifetime_posts: Number(bal.lifetime_posts || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
  } else {
    await sb.from("ox_lp_balances").insert({
      user_id: user.id,
      pending_usd: reward,
      lifetime_usd: reward,
      lifetime_posts: 1,
    });
  }

  if (limitRow) {
    await sb.from("ox_lp_daily_limits").update({
      posts: used + 1,
      earned_usd: Number(limitRow.earned_usd) + reward,
    }).eq("user_id", user.id).eq("day", day);
  } else {
    await sb.from("ox_lp_daily_limits").insert({
      user_id: user.id,
      day,
      posts: 1,
      earned_usd: reward,
    });
  }

  const nextSpent = Number(camp.spent_usd) + reward;
  const campPatch = {
    spent_usd: nextSpent,
    posts_count: (camp.posts_count || 0) + 1,
    updated_at: new Date().toISOString(),
  };
  if (nextSpent >= Number(camp.budget_usd) - 1e-9) campPatch.status = "completed";
  await sb.from("ox_lp_campaigns").update(campPatch).eq("id", campaignId);

  const { count: xUsers } = await sb.from("ox_lp_posts").select("user_id", { count: "exact", head: true }).eq("x_user_id", xid);
  if ((xUsers || 0) <= 1) {
    const { data: other } = await sb.from("ox_lp_posts").select("user_id").eq("x_user_id", xid).neq("user_id", user.id).limit(1);
    if (other?.length) {
      await flagAbuse(sb, {
        user_id: user.id,
        x_user_id: xid,
        risk: "review",
        reason: "Same X account used by multiple OrbitX users",
        detail: { other_user_id: other[0].user_id },
      });
    }
  }

  const created = profile ? new Date(0) : null;
  void created;
  if (used + 1 >= 6) {
    const { data: recent } = await sb
      .from("ox_lp_posts")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);
    if (recent?.length >= 6) {
      const newest = new Date(recent[0].created_at).getTime();
      const oldest = new Date(recent[5].created_at).getTime();
      if (newest - oldest < 10 * 60 * 1000) {
        await flagAbuse(sb, {
          user_id: user.id,
          x_user_id: xid,
          risk: "review",
          reason: "Rapid posting (6 posts in under 10 minutes)",
          detail: { window_ms: newest - oldest },
        });
      }
    }
  }

  await audit(sb, user.id, "submit_post", { tweetId, reward, kind, campaignId });
  return json(res, 200, {
    ok: true,
    post: postInsert.data,
    reward_usd: reward,
    kind,
    posts_today: used + 1,
    earned_today: Number(limitRow?.earned_usd || 0) + reward,
  });
}

async function handleRewards(_req, res, sb, user) {
  const day = utcDay();
  const [{ data: bal }, { data: limit }, { data: posts }] = await Promise.all([
    sb.from("ox_lp_balances").select("*").eq("user_id", user.id).maybeSingle(),
    sb.from("ox_lp_daily_limits").select("*").eq("user_id", user.id).eq("day", day).maybeSingle(),
    sb.from("ox_lp_posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const profile = await profileFor(sb, user.id);
  return json(res, 200, {
    ok: true,
    x: {
      connected: Boolean(xUserId(profile)),
      username: profile?.twitter_username || null,
    },
    balance: bal || { pending_usd: 0, paid_usd: 0, lifetime_usd: 0, lifetime_posts: 0 },
    today: {
      posts: limit?.posts || 0,
      earned_usd: Number(limit?.earned_usd || 0),
      max_posts: BAGWORKING_DEFAULTS.max_posts_per_day,
    },
    posts: posts || [],
  });
}

async function handleMe(_req, res, sb, user) {
  const profile = await profileFor(sb, user.id);
  return json(res, 200, {
    ok: true,
    user_id: user.id,
    x_connected: Boolean(xUserId(profile)),
    x_username: profile?.twitter_username || null,
    wallet: profile?.wallet_address || null,
  });
}

async function handleLaunchGet(req, res, sb) {
  const mint = mintOk(req.query.mint);
  if (!mint) return json(res, 400, { ok: false, error: "mint required." });
  const { data: launch } = await sb
    .from("ox_lp_launches")
    .select("*, ox_lp_flywheel_configs(*), ox_lp_campaigns(*)")
    .eq("mint", mint)
    .maybeSingle();
  const { data: jobs } = await sb
    .from("ox_lp_fee_jobs")
    .select("*, ox_lp_fee_events(*)")
    .eq("mint", mint)
    .order("created_at", { ascending: false })
    .limit(20);
  const completed = (jobs || []).filter((j) => j.status === "completed");
  const claimedJobs = (jobs || []).filter((j) => ["claimed", "buying", "burning", "completed"].includes(j.status));
  const open = (jobs || []).find((j) => !["completed", "failed"].includes(j.status));
  const totalClaimed = claimedJobs.reduce((s, j) => s + Number(j.claimable_usd || 0), 0);
  let liveUsd = 0;
  let liveSol = 0;
  if (launch?.creator_wallet) {
    try {
      const connection = new Connection(rpc(), "confirmed");
      const claimable = await getPumpClaimableSol(connection, new PublicKey(launch.creator_wallet));
      const solUsd = await fetchSolUsdPrice();
      liveSol = claimable.sol;
      liveUsd = solUsd > 0 ? claimable.sol * solUsd : 0;
    } catch { /* live progress is best-effort */ }
  }
  const threshold = Number(open?.threshold_usd || FEE_THRESHOLD_USD);
  return json(res, 200, {
    ok: true,
    launch: launch || null,
    jobs: jobs || [],
    stats: {
      total_claimed_usd: totalClaimed,
      completed_burns: completed.length,
      last_claim_sig: claimedJobs[0]?.claim_signature || null,
      last_burn_sig: completed[0]?.burn_signature || null,
      last_buy_sig: completed[0]?.buy_signature || null,
      open_job: open || null,
      threshold_usd: threshold,
      live_claimable_usd: liveUsd,
      live_claimable_sol: liveSol,
      progress: progressToThreshold(liveUsd, threshold),
    },
  });
}

async function handleAckClaim(req, res, sb, user) {
  const body = bodyOf(req);
  const jobId = String(body.job_id || "").trim();
  const claimSig = String(body.claim_signature || "").trim();
  if (!jobId || !claimSig) return json(res, 400, { ok: false, error: "job_id and claim_signature required." });
  const { data: job } = await sb.from("ox_lp_fee_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return json(res, 404, { ok: false, error: "Job not found." });
  const { data: launch } = job.launch_id
    ? await sb.from("ox_lp_launches").select("user_id, creator_wallet").eq("id", job.launch_id).maybeSingle()
    : { data: null };
  if (launch?.user_id && launch.user_id !== user.id && !isAdminReq(req, user)) {
    return json(res, 403, { ok: false, error: "Not your fee job." });
  }
  const connection = new Connection(rpc(), "confirmed");
  const confirmed = await confirmSig(connection, claimSig);
  if (!confirmed.ok) return json(res, 400, { ok: false, error: confirmed.reason });

  await sb.from("ox_lp_fee_jobs").update({
    status: "claimed",
    claim_signature: claimSig,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
  await sb.from("ox_lp_fee_events").insert({
    job_id: jobId,
    mint: job.mint,
    kind: "claimed",
    signature: claimSig,
    amount_usd: job.claimable_usd,
    note: "Creator-signed Pump.fun collectCreatorFee verified on-chain. OrbitX does not custody keys — buy/burn waits for platform-routed proceeds.",
  });
  await audit(sb, user.id, "ack_claim", { jobId, claimSig });
  return json(res, 200, {
    ok: true,
    status: "claimed",
    explorer: explorerTx(claimSig),
    note: "Claim verified. Buy/burn of $ORBITX runs only after proceeds reach the platform wallet — we never invent a burn signature.",
  });
}

async function handleCronFeeSweep(req, res, sb) {
  if (!cronAuthorized(req)) return json(res, 401, { ok: false, error: "Unauthorized cron." });

  const { data: launches } = await sb
    .from("ox_lp_launches")
    .select("id, mint, creator_wallet, user_id, launch_kind, status, auto_fee_claim")
    .eq("status", "live")
    .limit(80);

  const connection = new Connection(rpc(), "confirmed");
  let solUsd = 0;
  try { solUsd = await fetchSolUsdPrice(); } catch { solUsd = 0; }
  const opened = [];
  const skipped = [];
  const seen = new Set();

  for (const launch of launches || []) {
    if (seen.has(launch.creator_wallet)) continue;
    seen.add(launch.creator_wallet);
    let creator;
    try {
      creator = new PublicKey(launch.creator_wallet);
    } catch {
      skipped.push({ mint: launch.mint, reason: "bad_wallet" });
      continue;
    }

    const { data: openJob } = await sb
      .from("ox_lp_fee_jobs")
      .select("id, status")
      .eq("creator_wallet", launch.creator_wallet)
      .in("status", ["pending", "claiming", "claimed", "buying", "burning", "awaiting_creator_sign"])
      .maybeSingle();
    if (openJob) {
      skipped.push({ mint: launch.mint, reason: "open_job", job_id: openJob.id });
      continue;
    }

    let claimable;
    try {
      claimable = await getPumpClaimableSol(connection, creator);
    } catch (e) {
      skipped.push({ mint: launch.mint, reason: e instanceof Error ? e.message : "rpc" });
      continue;
    }
    const usd = solUsd > 0 ? claimable.sol * solUsd : 0;
    if (!feeReady(usd)) {
      skipped.push({ mint: launch.mint, reason: "below_threshold", usd, sol: claimable.sol });
      continue;
    }

    const ins = await sb.from("ox_lp_fee_jobs").insert({
      launch_id: launch.id,
      mint: launch.mint,
      creator_wallet: launch.creator_wallet,
      threshold_usd: FEE_THRESHOLD_USD,
      claimable_sol: claimable.sol,
      claimable_usd: usd,
      status: "awaiting_creator_sign",
      error: `Vault ${claimable.sol.toFixed(4)} SOL ($${usd.toFixed(2)}) ≥ $${FEE_THRESHOLD_USD}. Creator must sign collectCreatorFee — OrbitX does not custody keys.`,
    }).select("*").single();
    if (ins.error) {
      skipped.push({ mint: launch.mint, reason: ins.error.message });
      continue;
    }
    await sb.from("ox_lp_fee_events").insert({
      job_id: ins.data.id,
      mint: launch.mint,
      kind: "awaiting_creator_sign",
      amount_usd: usd,
      amount_sol: claimable.sol,
      note: ins.data.error,
    });
    opened.push({ mint: launch.mint, job_id: ins.data.id, usd, sol: claimable.sol });
  }

  await audit(sb, "cron", "cron_fee_sweep", { opened: opened.length, skipped: skipped.length, solUsd });
  return json(res, 200, {
    ok: true,
    threshold_usd: FEE_THRESHOLD_USD,
    sol_usd: solUsd,
    opened,
    skipped_count: skipped.length,
    note: "Jobs wait for the creator wallet to sign collectCreatorFee. OrbitX never stores user keys.",
  });
}

async function handleAdmin(req, res, sb, user) {
  if (!isAdminReq(req, user)) return json(res, 403, { ok: false, error: "Desk access required." });
  const body = bodyOf(req);

  if (body.set_rules) {
    const { data, error } = await sb.from("ox_lp_bagworking_rules").update({
      min_short_chars: Number(body.min_short_chars ?? BAGWORKING_DEFAULTS.min_short_chars),
      long_min_chars: Number(body.long_min_chars ?? BAGWORKING_DEFAULTS.long_min_chars),
      require_ticker: body.require_ticker !== false,
      require_ca: Boolean(body.require_ca),
      require_hashtag: Boolean(body.require_hashtag),
      require_url: Boolean(body.require_url),
      replies_count: Boolean(body.replies_count),
      quotes_count: Boolean(body.quotes_count),
      reposts_count: Boolean(body.reposts_count),
      max_posts_per_day: Number(body.max_posts_per_day ?? 10),
      short_reward_usd: Number(body.short_reward_usd ?? 1.5),
      long_reward_usd: Number(body.long_reward_usd ?? 3),
      fee_threshold_usd: Number(body.fee_threshold_usd ?? 25),
      updated_at: new Date().toISOString(),
    }).eq("id", "global").select("*").single();
    if (error) return json(res, 500, { ok: false, error: error.message });
    await audit(sb, user.id, "set_rules", body);
    return json(res, 200, { ok: true, rules: data });
  }

  if (body.review_flag) {
    const { data, error } = await sb.from("ox_lp_abuse_flags").update({
      risk: body.risk || "review",
      status: body.status || "open",
    }).eq("id", body.flag_id).select("*").single();
    if (error) return json(res, 500, { ok: false, error: error.message });
    return json(res, 200, { ok: true, flag: data });
  }

  if (body.reject_post) {
    const { data: post } = await sb.from("ox_lp_posts").select("*").eq("id", body.post_id).maybeSingle();
    if (!post) return json(res, 404, { ok: false, error: "Post not found." });
    await sb.from("ox_lp_posts").update({ status: "rejected", reject_reason: String(body.reason || "admin") }).eq("id", body.post_id);
    await sb.from("ox_lp_rewards").update({ status: "void" }).eq("post_id", body.post_id);
    return json(res, 200, { ok: true });
  }

  const [launches, jobs, campaigns, posts, flags] = await Promise.all([
    sb.from("ox_lp_launches").select("*").order("created_at", { ascending: false }).limit(80),
    sb.from("ox_lp_fee_jobs").select("*").order("created_at", { ascending: false }).limit(80),
    sb.from("ox_lp_campaigns").select("*").order("created_at", { ascending: false }).limit(80),
    sb.from("ox_lp_posts").select("*").order("created_at", { ascending: false }).limit(80),
    sb.from("ox_lp_abuse_flags").select("*").eq("status", "open").limit(40),
  ]);

  const launchRows = launches.data || [];
  const jobRows = jobs.data || [];
  const postRows = posts.data || [];
  return json(res, 200, {
    ok: true,
    launches: launchRows,
    fee_jobs: jobRows,
    campaigns: campaigns.data || [],
    posts: postRows,
    flags: flags.data || [],
    rules: await rulesFor(sb),
    stats: {
      total_launches: launchRows.length,
      live: launchRows.filter((l) => l.status === "live").length,
      failed: launchRows.filter((l) => l.status === "failed").length,
      kinds: {
        standard: launchRows.filter((l) => l.launch_kind === "standard").length,
        flywheel: launchRows.filter((l) => l.launch_kind === "flywheel").length,
        bagworking: launchRows.filter((l) => l.launch_kind === "bagworking").length,
      },
      fee_pending: jobRows.filter((j) => ["pending", "awaiting_creator_sign", "claiming"].includes(j.status)).length,
      fee_completed: jobRows.filter((j) => j.status === "completed").length,
      fee_failed: jobRows.filter((j) => j.status === "failed").length,
      total_claimed_usd: jobRows.reduce((s, j) => s + Number(j.claimable_usd || 0), 0),
      posts_verified: postRows.filter((p) => p.status === "verified" || p.status === "paid").length,
      posts_rejected: postRows.filter((p) => p.status === "rejected").length,
      rewards_usd: postRows.filter((p) => p.status !== "rejected").reduce((s, p) => s + Number(p.reward_usd || 0), 0),
    },
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.end();
  }

  const sb = admin();
  if (!sb) return json(res, 503, { ok: false, error: "Supabase is not configured." });

  const action = String(req.query?.action || bodyOf(req).action || "overview").trim();

  try {
    if (action === "overview") return await handleOverview(req, res, sb);
    if (action === "eligible") return await handleEligible(req, res, sb);
    if (action === "launch") return await handleLaunchGet(req, res, sb);
    if (action === "campaign") return await handleCampaignGet(req, res, sb);
    if (action === "cron_fee_sweep") return await handleCronFeeSweep(req, res, sb);

    const auth = await requireUser(req);
    if (action === "admin") {
      if (auth.error) return json(res, 401, { ok: false, error: auth.error });
      return await handleAdmin(req, res, sb, auth.user);
    }
    if (auth.error) return json(res, 401, { ok: false, error: auth.error });

    if (action === "register_launch") return await handleRegisterLaunch(req, res, sb, auth.user);
    if (action === "my_launches") return await handleMyLaunches(req, res, sb, auth.user);
    if (action === "update_campaign") return await handleUpdateCampaign(req, res, sb, auth.user, isAdminReq(req, auth.user));
    if (action === "submit_post") return await handleSubmitPost(req, res, sb, auth.user);
    if (action === "rewards") return await handleRewards(req, res, sb, auth.user);
    if (action === "me") return await handleMe(req, res, sb, auth.user);
    if (action === "ack_claim") return await handleAckClaim(req, res, sb, auth.user);

    return json(res, 400, { ok: false, error: `Unknown action: ${action}` });
  } catch (e) {
    return json(res, 500, { ok: false, error: e instanceof Error ? e.message : "Launchpad V2 failed." });
  }
}
