export const LAUNCH_TYPES = ["normal", "vanity", "custom_ca", "rewards", "bagwork"] as const;
export type LaunchType = (typeof LAUNCH_TYPES)[number];

export const GRADUATION_DESTS = ["pumpswap", "raydium", "meteora"] as const;
export type GraduationDest = (typeof GRADUATION_DESTS)[number];

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
