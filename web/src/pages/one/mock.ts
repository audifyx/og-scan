import type { BountyTask } from "./supabase";

export const MOCK_BOUNTIES: BountyTask[] = [
  {
    id: "b1", title: "Chart a new Solana meme launch", active: true, sort_order: 1,
    description: "Post a full technical breakdown of a token launched in the last 48h: liquidity, holder spread, dev wallet activity. Min 300 words with screenshots.",
    reward_usdc: 25, difficulty: "easy", category: "Research",
  },
  {
    id: "b2", title: "Rug-check video explainer (60s)", active: true, sort_order: 2,
    description: "Record a 60-second vertical video explaining how to spot a honeypot on Solana. Post it and link the URL as proof.",
    reward_usdc: 40, difficulty: "medium", category: "Content",
  },
  {
    id: "b3", title: "Onboard 3 traders to OrbitX One", active: true, sort_order: 3,
    description: "Refer three active traders who connect a wallet and complete one swap. Submit their wallet addresses as proof.",
    reward_usdc: 60, difficulty: "medium", category: "Growth",
  },
  {
    id: "b4", title: "Build a Dune-style holder dashboard", active: true, sort_order: 4,
    description: "Ship a public dashboard tracking top-50 holders of any Solana meme over 7 days. Must update daily and include whale alerts.",
    reward_usdc: 150, difficulty: "hard", category: "Dev",
  },
  {
    id: "b5", title: "Meme design pack: OrbitX One", active: true, sort_order: 5,
    description: "Design 5 original memes/templates for the OrbitX One brand. Must be usable across X and TikTok. Submit a drive link.",
    reward_usdc: 30, difficulty: "easy", category: "Design",
  },
  {
    id: "b6", title: "KOL wallet deep-dive thread", active: true, sort_order: 6,
    description: "Pick a top-100 FOMO leaderboard wallet and publish a thread dissecting their last 20 trades: entries, exits, win rate. Min 8 tweets.",
    reward_usdc: 75, difficulty: "hard", category: "Research",
  },
];

export interface NftCollection {
  id: string;
  name: string;
  floorSol: number;
  volumeSol: number;
  items: number;
  glyph: string;
  art: string; // css gradient
  perk: string;
  change24h: number;
}

export const MOCK_NFTS: NftCollection[] = [
  {
    id: "n1", name: "Orbitals", floorSol: 2.4, volumeSol: 18400, items: 3333, glyph: "🛰️",
    art: "linear-gradient(135deg,#0bd63f,#043d17)", perk: "Unlocks Tier-2 bounties (+40% rewards)",
    change24h: 12.4,
  },
  {
    id: "n2", name: "Green Circuit", floorSol: 1.1, volumeSol: 9200, items: 5555, glyph: "🟢",
    art: "linear-gradient(135deg,#17ff4d,#0a4d1f)", perk: "0.15% trading fee rebate on DEX",
    change24h: -3.2,
  },
  {
    id: "n3", name: "Bag Runners", floorSol: 4.8, volumeSol: 31200, items: 1111, glyph: "🎒",
    art: "linear-gradient(135deg,#b07bff,#2a1450)", perk: "Priority review on all submissions",
    change24h: 28.9,
  },
  {
    id: "n4", name: "Neon Scouts", floorSol: 0.6, volumeSol: 4100, items: 8888, glyph: "🔭",
    art: "linear-gradient(135deg,#4da3ff,#0a2440)", perk: "Early access to new bounty drops",
    change24h: 5.7,
  },
  {
    id: "n5", name: "Vault Keys", floorSol: 9.9, volumeSol: 67000, items: 555, glyph: "🗝️",
    art: "linear-gradient(135deg,#ffb224,#4d2c05)", perk: "2x rep multiplier on everything",
    change24h: 41.3,
  },
  {
    id: "n6", name: "Static Bloom", floorSol: 0.32, volumeSol: 1800, items: 10000, glyph: "🌸",
    art: "linear-gradient(135deg,#ff5470,#3d0a14)", perk: "Profile badge + leaderboard flair",
    change24h: -8.1,
  },
];

export interface LeaderRow {
  rank: number;
  wallet: string;
  earned: number;   // USDC from bounties
  pnl: number;      // trading P&L USD
  nfts: number;     // NFTs held
  rep: number;      // unified rep score
}

export const MOCK_LEADERBOARD: LeaderRow[] = [
  { rank: 1, wallet: "7xKp…9Q2m", earned: 2840, pnl: 12480, nfts: 14, rep: 9840 },
  { rank: 2, wallet: "3mTz…8WqL", earned: 1960, pnl: 8930, nfts: 9, rep: 8120 },
  { rank: 3, wallet: "9vBn…4XcV", earned: 3120, pnl: 4210, nfts: 22, rep: 7980 },
  { rank: 4, wallet: "2qWe…7YuI", earned: 1240, pnl: 15230, nfts: 5, rep: 7640 },
  { rank: 5, wallet: "5tGb…1OpL", earned: 2210, pnl: 6890, nfts: 11, rep: 7310 },
  { rank: 6, wallet: "8yHn…3KjM", earned: 980, pnl: 5420, nfts: 7, rep: 5890 },
  { rank: 7, wallet: "4rFd…6TgB", earned: 1750, pnl: 2980, nfts: 4, rep: 5120 },
  { rank: 8, wallet: "6uJm…9NhB", earned: 640, pnl: 7140, nfts: 3, rep: 4870 },
  { rank: 9, wallet: "1oIk…5PzX", earned: 1120, pnl: 1870, nfts: 8, rep: 4340 },
  { rank: 10, wallet: "0pLk…2MnB", earned: 480, pnl: 3210, nfts: 2, rep: 3560 },
];

export const shortWallet = (w: string | null | undefined) =>
  !w ? "—" : w.length <= 8 ? w : `${w.slice(0, 4)}…${w.slice(-4)}`;
