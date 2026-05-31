/**
 * Invite Tab — Referral contest with on-chain OGS holder verification.
 *
 * Rules:
 *  - Both referrer AND referred must hold ≥ threshold OGS (Week 1: $6.50, Week 2: $10, Last days: $15)
 *  - Top 8 referrers split $100 pool (tiered: $25, $20, $15, $10, $10, $8, $7, $5)
 *  - 2-week contest window
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Copy, Check, ExternalLink, Trophy, Users, Wallet,
  Gift, Star, Share2, Loader2, ShieldCheck, X, Timer,
  Crown, Medal, ArrowUpRight, Sparkles, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { OGSCAN_TOKEN_MINT, HELIUS_RPC, shortAddr } from "@/lib/og";

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */

const OGS_MINT = OGSCAN_TOKEN_MINT;
const SOL_MINT = "So11111111111111111111111111111111111111112";
/** Dynamic holding threshold — increases each week of the contest */
function getMinHoldingUsd(): number {
  const now = Date.now();
  const week1End = new Date("2026-06-06T00:00:00Z").getTime(); // end of week 1
  const week2End = new Date("2026-06-13T00:00:00Z").getTime(); // end of week 2
  if (now < week1End) return 6.5;   // Week 1: $6.50
  if (now < week2End) return 10;    // Week 2: $10
  return 15;                        // Last days: $15
}

const MIN_HOLDING_USD = getMinHoldingUsd();
const BUY_AMOUNT_USD = 15;

/** Prize tiers for the top 8 */
const PRIZE_TIERS = [
  { rank: 1, prize: 25, emoji: "🥇", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  { rank: 2, prize: 20, emoji: "🥈", color: "text-gray-300",   bg: "bg-gray-300/10 border-gray-300/20" },
  { rank: 3, prize: 15, emoji: "🥉", color: "text-amber-600",  bg: "bg-amber-600/10 border-amber-600/20" },
  { rank: 4, prize: 10, emoji: "4",  color: "text-white/60",   bg: "bg-white/[0.04] border-white/[0.06]" },
  { rank: 5, prize: 10, emoji: "5",  color: "text-white/60",   bg: "bg-white/[0.04] border-white/[0.06]" },
  { rank: 6, prize: 8,  emoji: "6",  color: "text-white/50",   bg: "bg-white/[0.03] border-white/[0.05]" },
  { rank: 7, prize: 7,  emoji: "7",  color: "text-white/50",   bg: "bg-white/[0.03] border-white/[0.05]" },
  { rank: 8, prize: 5,  emoji: "8",  color: "text-white/40",   bg: "bg-white/[0.02] border-white/[0.04]" },
];

/** Contest 1 dates — 2 weeks */
const CONTEST_START = new Date("2026-05-30T00:00:00Z");
const CONTEST_END = new Date("2026-06-17T12:00:00Z");
const CONTEST_NAME = "OG Scan Referral Sprint #1";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface LeaderboardEntry {
  rank: number;
  username: string;
  userId: string;
  qualifiedReferrals: number;
  totalReferrals: number;
  prize: number;
}

/* ═══════════════════════════════════════════════════════════════════
   On-chain Verification
   ═══════════════════════════════════════════════════════════════════ */

async function getOgsBalance(walletAddress: string): Promise<number> {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: "ogs-balance",
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: OGS_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
    });
    const data = await res.json();
    const accounts = data?.result?.value || [];
    let total = 0;
    for (const acc of accounts) {
      const info = acc.account?.data?.parsed?.info;
      if (info) {
        total += parseFloat(info.tokenAmount?.uiAmountString || "0");
      }
    }
    return total;
  } catch {
    return 0;
  }
}

async function getOgsPrice(): Promise<number> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${OGS_MINT}`);
    const d = await r.json();
    const pair = (d.pairs || []).filter((p: any) => p.chainId === "solana")[0];
    return parseFloat(pair?.priceUsd || "0");
  } catch {
    return 0;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function getTimeLeft(end: Date): { days: number; hours: number; minutes: number; seconds: number; expired: boolean } {
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

function getContestStatus(): "upcoming" | "active" | "ended" {
  const now = Date.now();
  if (now < CONTEST_START.getTime()) return "upcoming";
  if (now > CONTEST_END.getTime()) return "ended";
  return "active";
}

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

const Invite = () => {
  const { user } = useAuth();
  const { publicKey, connected, wallets, select, connect, disconnect } = useWallet();

  /* State */
  const [profile, setProfile] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [ogsBalance, setOgsBalance] = useState<number | null>(null);
  const [ogsPrice, setOgsPrice] = useState(0);
  const [holdingUsd, setHoldingUsd] = useState(0);
  const [isHolder, setIsHolder] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(CONTEST_END));
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [myInvites, setMyInvites] = useState<{ username: string; qualified: boolean; createdAt: string }[]>([]);
  const [myStats, setMyStats] = useState<{ invited: number; qualified: number; rank: number | null }>({
    invited: 0, qualified: 0, rank: null,
  });
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [solPrice, setSolPrice] = useState(0);

  const contestStatus = useMemo(() => getContestStatus(), []);
  const referralCode = (profile as any)?.referral_code;
  const inviteLink = referralCode ? `https://ogscan.fun?ref=${referralCode}` : "";

  /* Countdown timer */
  useEffect(() => {
    const iv = setInterval(() => setTimeLeft(getTimeLeft(CONTEST_END)), 1000);
    return () => clearInterval(iv);
  }, []);

  /* Fetch SOL price for buy button */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`);
        const d = await r.json();
        const pair = (d.pairs || []).find((p: any) => p.chainId === "solana" && parseFloat(p.liquidity?.usd || "0") > 100000);
        if (pair) setSolPrice(parseFloat(pair.priceUsd || "0"));
      } catch { /* fallback stays 0 */ }
    })();
  }, []);

  /* Load profile */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (data) setProfile(data);
    })();
  }, [user]);

  /* Verify OGS holdings when wallet connected */
  useEffect(() => {
    if (!publicKey) {
      setOgsBalance(null);
      setHoldingUsd(0);
      setIsHolder(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setVerifying(true);
      const [balance, price] = await Promise.all([
        getOgsBalance(publicKey.toString()),
        getOgsPrice(),
      ]);
      if (cancelled) return;
      const usd = balance * price;
      setOgsBalance(balance);
      setOgsPrice(price);
      setHoldingUsd(usd);
      setIsHolder(usd >= MIN_HOLDING_USD);
      setVerifying(false);
    })();
    return () => { cancelled = true; };
  }, [publicKey]);

  /* Load leaderboard — uses profiles.referred_by as source of truth */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingBoard(true);
      try {
        // Get all profiles that were referred by someone (referred_by is set)
        const { data: referredProfiles } = await supabase
          .from("profiles")
          .select("user_id, referred_by, sol_wallet, wallet_address, created_at")
          .not("referred_by", "is", null);

        if (!referredProfiles || cancelled) { setLoadingBoard(false); return; }

        // For active/upcoming contests, count all referrals (people invited before kickoff still count)
        // For ended contests, only count referrals created before contest end
        const contestRefs = referredProfiles.filter((p) => {
          const created = new Date(p.created_at);
          return created <= CONTEST_END;
        });

        // Check which invitees hold ≥ $10 OGS (batch check wallets)
        const qualifiedInvitees = new Set<string>();
        const currentOgsPrice = ogsPrice > 0 ? ogsPrice : await getOgsPrice();

        if (currentOgsPrice > 0) {
          const walletsToCheck = contestRefs
            .filter((p) => p.sol_wallet || p.wallet_address)
            .map((p) => ({ userId: p.user_id, wallet: (p.sol_wallet || p.wallet_address) as string }));

          const batchSize = 10;
          for (let i = 0; i < walletsToCheck.length; i += batchSize) {
            if (cancelled) return;
            const batch = walletsToCheck.slice(i, i + batchSize);
            await Promise.allSettled(
              batch.map(async ({ userId, wallet }) => {
                const balance = await getOgsBalance(wallet);
                if (balance * currentOgsPrice >= MIN_HOLDING_USD) {
                  qualifiedInvitees.add(userId);
                }
              })
            );
          }
        }

        // Count referrals per inviter — total and qualified
        const totalCounts = new Map<string, number>();
        const qualifiedCounts = new Map<string, number>();
        for (const r of contestRefs) {
          const inviterId = r.referred_by as string;
          totalCounts.set(inviterId, (totalCounts.get(inviterId) || 0) + 1);
          if (qualifiedInvitees.has(r.user_id)) {
            qualifiedCounts.set(inviterId, (qualifiedCounts.get(inviterId) || 0) + 1);
          }
        }

        // Get all unique inviter IDs to check if THEY also hold ≥$10 OGS
        const allInviterIds = [...new Set(contestRefs.map((r) => r.referred_by as string))];
        const { data: inviterProfiles } = await supabase
          .from("profiles")
          .select("user_id, username, sol_wallet, wallet_address")
          .in("user_id", allInviterIds.length > 0 ? allInviterIds : ["__none__"]);

        // Check which inviters are themselves holders
        const qualifiedInviters = new Set<string>();
        if (inviterProfiles && currentOgsPrice > 0) {
          const inviterWallets = inviterProfiles
            .filter((p) => p.sol_wallet || p.wallet_address)
            .map((p) => ({ userId: p.user_id, wallet: (p.sol_wallet || p.wallet_address) as string }));
          const batchSize2 = 10;
          for (let i = 0; i < inviterWallets.length; i += batchSize2) {
            if (cancelled) return;
            const batch = inviterWallets.slice(i, i + batchSize2);
            await Promise.allSettled(
              batch.map(async ({ userId, wallet }) => {
                const balance = await getOgsBalance(wallet);
                if (balance * currentOgsPrice >= MIN_HOLDING_USD) {
                  qualifiedInviters.add(userId);
                }
              })
            );
          }
        }

        // Build name map from inviter profiles
        const nameMap = new Map((inviterProfiles || []).map((p: any) => [p.user_id, p.username || "Anonymous"]));

        // Leaderboard: only users who have ≥1 qualified invite AND are holders themselves
        // Sort by qualified count desc, tiebreak by total
        const sorted = Array.from(totalCounts.entries())
          .map(([userId, total]) => ({ userId, total, qualified: qualifiedCounts.get(userId) || 0 }))
          .filter((e) => e.qualified > 0 && qualifiedInviters.has(e.userId))
          .sort((a, b) => b.qualified - a.qualified || b.total - a.total)
          .slice(0, 20);

        const board: LeaderboardEntry[] = sorted.map((entry, i) => ({
          rank: i + 1,
          username: nameMap.get(entry.userId) || "Anonymous",
          userId: entry.userId,
          qualifiedReferrals: entry.qualified,
          totalReferrals: entry.total,
          prize: i < PRIZE_TIERS.length ? PRIZE_TIERS[i].prize : 0,
        }));

        if (!cancelled) {
          setLeaderboard(board);

          // Find user's stats
          const myEntry = board.find((e) => e.userId === user.id);
          const myTotalRefs = totalCounts.get(user.id) || 0;
          const myQualifiedRefs = qualifiedCounts.get(user.id) || 0;
          setMyStats({
            invited: myTotalRefs,
            qualified: myQualifiedRefs,
            rank: myEntry?.rank || null,
          });

          // Build individual invite list for current user
          const myRefs = contestRefs.filter((p) => p.referred_by === user.id);
          const inviteeIds = myRefs.map((r) => r.user_id);
          let inviteeNames = new Map<string, string>();
          if (inviteeIds.length > 0) {
            const { data: invProfs } = await supabase
              .from("profiles")
              .select("user_id, username")
              .in("user_id", inviteeIds);
            inviteeNames = new Map((invProfs || []).map((p: any) => [p.user_id, p.username || "Anonymous"]));
          }
          const inviteList = myRefs.map((r) => ({
            username: inviteeNames.get(r.user_id) || "Anonymous",
            qualified: qualifiedInvitees.has(r.user_id),
            createdAt: r.created_at,
          }));
          inviteList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setMyInvites(inviteList);
        }
      } catch (err) {
        console.error("Failed to load leaderboard", err);
      }
      if (!cancelled) setLoadingBoard(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  /* Copy invite link */
  const copyLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: "Invite link copied! 🔗" });
  }, [inviteLink]);

  /* Share invite link */
  const shareLink = useCallback(async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join OG Scan",
          text: `Join OG Scan — the Solana meme coin trading terminal. Sign up and buy ${MIN_HOLDING_USD === 6.5 ? "$6.50" : `$${MIN_HOLDING_USD}`} of OGS to join the referral contest!`,
          url: inviteLink,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }, [inviteLink, copyLink]);

  /* Open Phantom to buy $15 of OGS — pre-filled amount */
  const buyOgs = useCallback(() => {
    let url = `https://phantom.app/ul/swap/${SOL_MINT}/${OGS_MINT}`;
    if (solPrice > 0) {
      // Calculate $15 worth of SOL in lamports (SOL has 9 decimals)
      const solAmount = BUY_AMOUNT_USD / solPrice;
      const lamports = Math.ceil(solAmount * 1e9);
      url += `?amount=${lamports}`;
    }
    window.open(url, "_blank");
  }, [solPrice]);

  /* ── Wallet Picker Overlay ── */
  const WalletPickerOverlay = () => {
    if (!showWalletPicker) return null;
    const available = wallets.filter((w) => ["Phantom", "Solflare"].includes(w.adapter.name));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setShowWalletPicker(false)}>
        <div className="bg-[#13132a] border border-white/[0.1] rounded-2xl p-6 w-[340px] max-w-[90vw] space-y-4"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Connect Wallet</h3>
            <button onClick={() => setShowWalletPicker(false)} className="text-white/30 hover:text-white/60">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-white/40">Connect to verify your OGS holdings and join the contest.</p>
          <div className="space-y-2">
            {available.map((w) => (
              <button
                key={w.adapter.name}
                onClick={() => {
                  select(w.adapter.name as any);
                  setTimeout(() => { connect().catch(() => {}); setShowWalletPicker(false); }, 150);
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] hover:border-[#ab9ff2]/40 transition-all group"
              >
                {w.adapter.icon && <img src={w.adapter.icon} alt={w.adapter.name} className="w-8 h-8 rounded-lg" />}
                <span className="font-semibold text-sm">{w.adapter.name}</span>
                <span className="ml-auto text-[10px] text-white/30 group-hover:text-[#ab9ff2]">Connect →</span>
              </button>
            ))}
            {available.length === 0 && (
              <div className="text-center py-6">
                <Wallet className="h-8 w-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/40 mb-2">No wallet detected</p>
                <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-[#ab9ff2] text-xs underline">Install Phantom →</a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <AppLayout>
      <WalletPickerOverlay />
      <div className="min-h-screen pb-24 lg:pb-8">
        {/* Hero header */}
        <div className="relative overflow-hidden border-b border-white/[0.07]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ab9ff2]/10 via-transparent to-[#6c63ff]/5" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#ab9ff2]/5 rounded-full blur-[120px]" />
          <div className="relative px-4 sm:px-6 py-8 sm:py-12 max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-[#ab9ff2]/15 text-[#ab9ff2] border-[#ab9ff2]/20 text-[10px] font-bold uppercase tracking-widest">
                <Trophy className="h-3 w-3 mr-1" />
                Referral Contest
              </Badge>
              <Badge className="text-[10px] font-bold uppercase tracking-widest bg-amber-500/15 text-amber-400 border-amber-400/20">
                ⏳ Coming Soon
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
              Invite & <span className="text-[#ab9ff2]">Earn</span>
            </h1>
            <p className="text-white/50 text-sm sm:text-base max-w-xl">
              Bring new holders to OG Scan. Top 8 referrers split a <span className="font-bold text-white">$100 prize pool</span>.
              Every signup via your link is tracked. Referrals qualify when they connect a wallet holding ≥ ${MIN_HOLDING_USD === 6.5 ? "$6.50" : `$${MIN_HOLDING_USD}`} of OGS.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 max-w-5xl mx-auto space-y-6 mt-6">

          {/* ── Contest countdown ── */}
          <Card className="glass-card border border-white/[0.07] overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="h-5 w-5 text-[#ab9ff2]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">{CONTEST_NAME}</h2>
              </div>

              {/* Timer boxes */}
              <div className="flex gap-3 sm:gap-4 justify-center my-4">
                {[
                  { label: "Days", value: timeLeft.days },
                  { label: "Hours", value: timeLeft.hours },
                  { label: "Mins", value: timeLeft.minutes },
                  { label: "Secs", value: timeLeft.seconds },
                ].map((unit) => (
                  <div key={unit.label} className="text-center">
                    <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums">
                        {String(unit.value).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1.5">{unit.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4 text-[11px] text-white/30 mt-3">
                <span>Starts: {CONTEST_START.toLocaleDateString()}</span>
                <span className="text-white/10">|</span>
                <span>Ends: {CONTEST_END.toLocaleDateString()}</span>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* ── Left column: Invite link + verification ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Wallet verification */}
              <Card className="glass-card border border-white/[0.07] overflow-hidden">
                <div className="p-5">
                  <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-[#ab9ff2]" />
                    Holder Verification
                  </h3>

                  {!connected ? (
                    <div className="text-center py-4">
                      <Wallet className="h-10 w-10 text-white/15 mx-auto mb-3" />
                      <p className="text-xs text-white/40 mb-4">Connect your wallet to verify you hold ≥ {MIN_HOLDING_USD === 6.5 ? "$6.50" : `$${MIN_HOLDING_USD}`} of OGS</p>
                      <Button onClick={() => setShowWalletPicker(true)} className="bg-[#ab9ff2] hover:bg-[#9b8fe2] text-black font-semibold">
                        <Wallet className="h-4 w-4 mr-2" />
                        Connect Wallet
                      </Button>
                    </div>
                  ) : verifying ? (
                    <div className="text-center py-6">
                      <Loader2 className="h-8 w-8 animate-spin text-[#ab9ff2] mx-auto mb-2" />
                      <p className="text-xs text-white/40">Verifying on-chain balance…</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Connected wallet */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                        <div className={`w-2.5 h-2.5 rounded-full ${isHolder ? "bg-green-400" : "bg-red-400"}`} />
                        <span className="text-xs font-mono text-white/60">{shortAddr(publicKey!.toString(), 6)}</span>
                        <button onClick={() => disconnect()} className="ml-auto text-[10px] text-white/25 hover:text-white/50">
                          Disconnect
                        </button>
                      </div>

                      {/* Balance info */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                          <p className="text-[10px] text-white/30 uppercase tracking-widest">OGS Balance</p>
                          <p className="text-sm font-bold font-mono mt-0.5">
                            {ogsBalance !== null ? ogsBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                          <p className="text-[10px] text-white/30 uppercase tracking-widest">USD Value</p>
                          <p className={`text-sm font-bold font-mono mt-0.5 ${isHolder ? "text-green-400" : "text-red-400"}`}>
                            ${holdingUsd.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Status */}
                      {isHolder ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                          <ShieldCheck className="h-4 w-4 text-green-400" />
                          <span className="text-xs font-semibold text-green-400">Verified OGS Holder ✓</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                            <X className="h-4 w-4 text-red-400" />
                            <span className="text-xs text-red-400">Need ≥ $10 OGS to qualify</span>
                          </div>
                          <Button onClick={buyOgs} variant="outline"
                            className="w-full border-[#ab9ff2]/30 text-[#ab9ff2] hover:bg-[#ab9ff2]/10 text-xs">
                            <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
                            Buy $15 of OGS on Phantom
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* Your invite link */}
              <Card className="glass-card border border-white/[0.07] overflow-hidden">
                <div className="p-5">
                  <h3 className="font-bold text-sm flex items-center gap-2 mb-1">
                    <Gift className="h-4 w-4 text-og-cyan" />
                    Your Invite Link
                  </h3>
                  <p className="text-[11px] text-white/35 mb-4">
                    Share this link. Every signup counts as an invite — they qualify when they hold $10 OGS.
                  </p>

                  {referralCode ? (
                    <>
                      <div className="flex gap-2 mb-3">
                        <Input
                          value={inviteLink}
                          readOnly
                          className="font-mono text-[11px] bg-white/[0.03] border-white/[0.08] h-10"
                        />
                        <Button variant="outline" size="icon" onClick={copyLink}
                          className="shrink-0 border-white/10 hover:border-[#ab9ff2]/40 h-10 w-10">
                          {copiedLink ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={shareLink} variant="outline"
                          className="flex-1 border-white/10 text-white/60 hover:text-white text-xs">
                          <Share2 className="h-3.5 w-3.5 mr-1.5" />
                          Share
                        </Button>
                        <Button
                          onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join OG Scan — the Solana meme coin trading terminal 🔥\n\nSign up, hold $10 OGS, and compete for the $100 referral contest!\n\n${inviteLink}`)}`, "_blank")}
                          variant="outline"
                          className="flex-1 border-white/10 text-white/60 hover:text-white text-xs"
                        >
                          <span className="mr-1.5">𝕏</span>
                          Post
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-white/20 mx-auto mb-2" />
                      <p className="text-xs text-white/30">Loading your invite link…</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Your stats */}
              <Card className="glass-card border border-white/[0.07] overflow-hidden">
                <div className="p-5">
                  <h3 className="font-bold text-sm flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Your Stats
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xl font-black text-white">{myStats.invited}</p>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">Referred</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xl font-black text-green-400">{myStats.qualified}</p>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">Qualified</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xl font-black text-[#ab9ff2]">{myStats.rank ? `#${myStats.rank}` : "—"}</p>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">Rank</p>
                    </div>
                  </div>
                </div>

              </Card>
            </div>

            {/* ── Right column: Your Invites + Leaderboard + How it works ── */}
            <div className="lg:col-span-3 space-y-4">

              {/* Your Invites — scrollable list */}
              {myInvites.length > 0 && (
                <Card className="glass-card border border-white/[0.07] overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#ab9ff2]" />
                        Your Invites
                      </h3>
                      <Badge className="bg-white/[0.05] text-white/40 border-white/[0.08] text-[10px]">
                        {myInvites.filter((i) => i.qualified).length}/{myInvites.length} qualified
                      </Badge>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      {myInvites.map((inv, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/50">
                              {inv.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-white/80">{inv.username}</p>
                              <p className="text-[10px] text-white/25">
                                {new Date(inv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                          {inv.qualified ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <Check className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase">Qualified</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-400/60">
                              <X className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase">Not qualified</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Leaderboard */}
              <Card className="glass-card border border-white/[0.07] overflow-hidden">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-black flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-400" />
                      Leaderboard
                    </h2>
                    <Badge className="bg-[#ab9ff2]/10 text-[#ab9ff2] border-[#ab9ff2]/20 text-[10px]">
                      Top 8 win
                    </Badge>
                  </div>

                  {loadingBoard ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-white/20" />
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="text-center py-12">
                      <Trophy className="h-12 w-12 text-white/10 mx-auto mb-3" />
                      <p className="text-sm text-white/40 font-semibold mb-1">No referrals yet</p>
                      <p className="text-xs text-white/25">Be the first to invite someone and claim #1!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-white/25 uppercase tracking-widest font-bold">
                        <span className="col-span-1">#</span>
                        <span className="col-span-5">User</span>
                        <span className="col-span-3 text-center">Qualified</span>
                        <span className="col-span-3 text-right">Prize</span>
                      </div>

                      {/* Prize tiers (always show 8 rows) */}
                      {PRIZE_TIERS.map((tier, i) => {
                        const entry = leaderboard[i];
                        const isMe = entry?.userId === user?.id;
                        return (
                          <div
                            key={tier.rank}
                            className={`grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl border transition-colors ${
                              isMe
                                ? "bg-[#ab9ff2]/10 border-[#ab9ff2]/20"
                                : tier.bg
                            }`}
                          >
                            {/* Rank */}
                            <div className="col-span-1">
                              {tier.rank <= 3 ? (
                                <span className="text-lg">{tier.emoji}</span>
                              ) : (
                                <span className="text-xs font-bold text-white/30 ml-0.5">{tier.emoji}</span>
                              )}
                            </div>

                            {/* Username */}
                            <div className="col-span-5">
                              {entry ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/50">
                                    {entry.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className={`text-xs font-semibold ${isMe ? "text-[#ab9ff2]" : "text-white/80"}`}>
                                      {entry.username}
                                      {isMe && <span className="text-[10px] text-[#ab9ff2]/60 ml-1">(you)</span>}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-white/15 italic">Unclaimed</span>
                              )}
                            </div>

                            {/* Qualified count */}
                            <div className="col-span-3 text-center">
                              <span className="text-sm font-bold font-mono text-green-400">
                                {entry ? entry.qualifiedReferrals : "—"}
                              </span>
                            </div>

                            {/* Prize */}
                            <div className="col-span-3 text-right">
                              <span className={`text-sm font-black ${tier.rank <= 3 ? tier.color : "text-white/40"}`}>
                                ${tier.prize}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Your position if outside top 8 */}
                      {myStats.rank && myStats.rank > 8 && (
                        <>
                          <div className="flex items-center gap-2 px-3 py-1">
                            <span className="text-white/10 text-xs">···</span>
                          </div>
                          <div className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl bg-[#ab9ff2]/10 border border-[#ab9ff2]/20">
                            <div className="col-span-1">
                              <span className="text-xs font-bold text-white/30">{myStats.rank}</span>
                            </div>
                            <div className="col-span-5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[#ab9ff2]/20 flex items-center justify-center text-[10px] font-bold text-[#ab9ff2]">
                                  {profile?.username?.charAt(0).toUpperCase() || "Y"}
                                </div>
                                <p className="text-xs font-semibold text-[#ab9ff2]">
                                  {profile?.username || "You"} <span className="text-[10px] text-[#ab9ff2]/60">(you)</span>
                                </p>
                              </div>
                            </div>
                            <div className="col-span-3 text-center">
                              <span className="text-sm font-bold font-mono text-green-400">{myStats.qualified}</span>
                            </div>
                            <div className="col-span-3 text-right">
                              <span className="text-xs text-white/25">Outside top 8</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* How it works */}
              <Card className="glass-card border border-white/[0.07] overflow-hidden">
                <div className="p-5 sm:p-6">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Star className="h-4 w-4 text-amber-400" />
                    How It Works
                  </h3>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      {
                        step: "1",
                        title: "Connect & Verify",
                        desc: "Connect your Solana wallet. You must hold ≥ $10 of OGS tokens to participate.",
                        icon: Wallet,
                      },
                      {
                        step: "2",
                        title: "Get Your Link",
                        desc: "Copy your unique invite link and share it on Twitter, Telegram, Discord — everywhere.",
                        icon: Share2,
                      },
                      {
                        step: "3",
                        title: "Friends Sign Up",
                        desc: "Anyone who signs up via your link counts as an invite. They become qualified when they hold ≥ $10 OGS.",
                        icon: Users,
                      },
                      {
                        step: "4",
                        title: "Win Prizes",
                        desc: "Top 8 referrers at the end of 2 weeks split $100. First place takes $25!",
                        icon: Trophy,
                      },
                    ].map((item) => (
                      <div key={item.step} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ab9ff2]/10 border border-[#ab9ff2]/20">
                          <item.icon className="h-4 w-4 text-[#ab9ff2]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                            <span className="text-[10px] text-[#ab9ff2] font-mono">0{item.step}</span>
                            {item.title}
                          </p>
                          <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Prize breakdown */}
              <Card className="glass-card border border-white/[0.07] overflow-hidden">
                <div className="p-5 sm:p-6">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Medal className="h-4 w-4 text-yellow-400" />
                    Prize Pool — $100
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {PRIZE_TIERS.map((tier) => (
                      <div key={tier.rank}
                        className={`text-center p-3 rounded-xl border ${tier.bg}`}>
                        <p className="text-lg">{tier.rank <= 3 ? tier.emoji : `#${tier.rank}`}</p>
                        <p className={`text-sm font-black ${tier.color} mt-1`}>${tier.prize}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Rules */}
              <Card className="glass-card border border-white/[0.07] overflow-hidden">
                <div className="p-5">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-white/40" />
                    Contest Rules
                  </h3>
                  <ul className="space-y-2 text-[11px] text-white/40 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-[#ab9ff2] shrink-0 mt-0.5" />
                      All signups via your link are tracked as "Invited" — no holding required to count.
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-[#ab9ff2] shrink-0 mt-0.5" />
                      An invite becomes "Qualified" when the referred person connects their wallet and holds ≥ $10 USD of OGS.
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-[#ab9ff2] shrink-0 mt-0.5" />
                      Leaderboard ranks by qualified count only — each qualified invite = 1 point toward your rank.
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-[#ab9ff2] shrink-0 mt-0.5" />
                      Only referrals made during the 2-week contest window count.
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-[#ab9ff2] shrink-0 mt-0.5" />
                      Self-referrals or duplicate accounts will be disqualified.
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-[#ab9ff2] shrink-0 mt-0.5" />
                      Prizes are paid out manually within 48 hours of contest end.
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-[#ab9ff2] shrink-0 mt-0.5" />
                      OG Scan team reserves the right to adjust rules if abuse is detected.
                    </li>
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Invite;
