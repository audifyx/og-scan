export const LAUNCH_TYPES = ["normal", "vanity", "custom_ca", "rewards", "bagwork", "predict"] as const;
export type LaunchType = (typeof LAUNCH_TYPES)[number];

export const LAUNCH_STYLES = ["curve", "delay", "dutch", "batch", "ido_then_curve"] as const;
export type LaunchStyle = (typeof LAUNCH_STYLES)[number];

export const GRADUATION_DESTS = ["pumpswap", "raydium", "meteora", "none"] as const;
export type GraduationDest = (typeof GRADUATION_DESTS)[number];

export const REWARDS_TRACKS = ["pump_holder", "epoch_vault", "none"] as const;
export type RewardsTrack = (typeof REWARDS_TRACKS)[number];

export const RESOLVERS = ["pyth", "switchboard", "metric", "mofn", "optimistic"] as const;
export type ResolverKind = (typeof RESOLVERS)[number];

export const MARKET_AMMS = ["lmsr", "cp", "parimutuel"] as const;
export type MarketAmm = (typeof MARKET_AMMS)[number];

export const MARKET_STATUSES = ["preview", "open", "halted", "resolved", "void"] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type QuoteAsset = {
  symbol: string;
  mint: string;
  name: string;
  kind: "native" | "stable" | "stock" | "crypto";
  decimals: number;
  depthUsd?: number | null;
  allowed: boolean;
  awaitingAllowlist?: boolean;
};

export type MarketSpec = {
  question: string;
  deadlineUnix: number;
  resolver: ResolverKind;
  feedId?: string;
  threshold?: string;
  amm: MarketAmm;
  seedCollateral?: string;
};

export type RewardsPolicy = {
  track: RewardsTrack;
  epochSeconds?: number;
  lockBoost?: boolean;
  predictBoost?: boolean;
};

export type LaunchIntent = {
  type: LaunchType;
  quoteMint: string;
  quoteSymbol: string;
  name: string;
  symbol: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  vanityPrefix: string;
  vanitySuffix: string;
  vanityCaseInsensitive: boolean;
  customMintSecret?: string;
  customMintPubkey?: string;
  holderRewards: boolean;
  bagwork: boolean;
  mayhem: boolean;
  firstBuySol: number;
  graduationDest: GraduationDest;
  style: LaunchStyle;
  delayOpenUnix?: number;
  antiSnipeBlocks: number;
  perWalletCapSol: number;
  rewards: RewardsPolicy;
  market?: MarketSpec;
  geoAttest: boolean;
  geoCountry: string;
};

export type LaunchIntentV2 = {
  name: string;
  symbol: string;
  uri: string;
  launchType: LaunchType;
  quoteMint: string;
  vanity?: { prefix?: string; suffix?: string };
  mintSecretB58?: string;
  firstBuyQuoteAmount?: string;
  graduationDest: GraduationDest;
  style: LaunchStyle;
  delayOpenUnix?: number;
  rewards: RewardsPolicy;
  market?: MarketSpec;
};

export type LaunchIdentity = {
  x_user_id: string | null;
  x_handle: string | null;
  x_avatar: string | null;
  wallet_pubkey: string | null;
};

export type IntentIssue = { field: string; message: string };

export const STOCK_LEGAL =
  "Tokenized stocks are issued by third parties (Backed / Sunrise / etc.). This pad does not issue equities, does not custody shares, and the meme coin is not the stock. Pairing is permanent.";

export const PREDICT_LEGAL =
  "Yes/No markets are event contracts. They stay off in the US until legal review. You must be 18+, self-attest, and accept that unresolved markets void after grace. This is not financial advice.";

export const REWARDS_LEGAL =
  "Rewards are not an APR promise. Track A (Pump holderReward) auto-pays holders above ~$20. Track B (epoch vault) is not live until audit. Never displayed as guaranteed yield.";
