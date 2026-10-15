/**
 * social-trade.tsx — Feed superpowers for the OrbitX Social Center.
 *
 * 1. One-tap trade (buy/sell) on any post with a $cashtag
 * 2. Tip button ($1–$10) on every post
 * 3. Copy-trade on verifiable $cashtag calls
 * 4. Rug siren helpers (flag → 5 distinct flaggers → siren alert post)
 *
 * WALLET LAW: everything goes through backend-signed MCP tools
 * (orbitx_app_buy / orbitx_app_sell / orbitx_app_tip) via callSupercomputerTool
 * + getBillingAuthCode(). No wallet-adapter, no client signing, no popups.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  X as XIcon, Loader2, Gift, Check, ExternalLink,
  AlertTriangle, TrendingUp, TrendingDown, ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";
import { findWalletPnlToken } from "@/trade/tradeApi";

/* ═══════════ $cashtag → mint (same localStorage map the feed seeds) ═══════════ */
const CASHTAG_MINTS_KEY = "orbitx-cashtag-mints";

function mintForCashtag(symbol: string): string | null {
  try {
    const raw = localStorage.getItem(CASHTAG_MINTS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, string>;
    return obj[symbol.toUpperCase()] || null;
  } catch {
    return null;
  }
}

export interface CallToken { symbol: string; mint: string; }

/** Extract tradable $cashtags (with known mints) from post text. */
export function extractCallTokens(content: string, max = 2): CallToken[] {
  const out: CallToken[] = [];
  const seen = new Set<string>();
  const re = /\$([A-Za-z][A-Za-z0-9]{1,14})/g;
  let m: RegExpExecArray | null;
  const text = content || "";
  while ((m = re.exec(text)) !== null) {
    const sym = m[1].toUpperCase();
    if (seen.has(sym)) continue;
    seen.add(sym);
    const mint = mintForCashtag(sym);
    if (mint) out.push({ symbol: sym, mint });
    if (out.length >= max) break;
  }
  return out;
}

/* ═══════════ Copy-trade max setting (profile settings, localStorage) ═══════════ */
const COPY_MAX_KEY = "orbitx-copytrade-max-usd";
export const COPY_MAX_DEFAULT = 25;
export const COPY_MAX_HARD_CAP = 250;

export function getMaxCopyUsd(): number {
  try {
    const v = Number(localStorage.getItem(COPY_MAX_KEY));
    if (Number.isFinite(v) && v > 0) return Math.min(COPY_MAX_HARD_CAP, Math.max(1, Math.round(v)));
  } catch { /* ignore */ }
  return COPY_MAX_DEFAULT;
}
export function setMaxCopyUsd(v: number): number {
  const clamped = Math.min(COPY_MAX_HARD_CAP, Math.max(1, Math.round(Number(v) || COPY_MAX_DEFAULT)));
  try { localStorage.setItem(COPY_MAX_KEY, String(clamped)); } catch { /* ignore */ }
  return clamped;
}

/* ═══════════ Formatting ═══════════ */
export function fmtUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a > 0 && a < 0.01) return "$" + v.toExponential(1);
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: a < 1 ? 4 : a < 100 ? 2 : 0 });
}
export function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}
function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ═══════════ Live quote + poster-entry price + position ═══════════ */
export interface TokenQuote {
  mint: string; symbol: string | null; name: string | null; icon: string | null;
  priceUsd: number | null; change24h: number | null;
}

export async function fetchTokenQuote(mint: string): Promise<TokenQuote | null> {
  try {
    const r = await fetch(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`);
    const d = await r.json();
    const t = d?.token;
    if (!t) return null;
    return {
      mint,
      symbol: t.symbol ?? null,
      name: t.name ?? null,
      icon: t.icon ?? null,
      priceUsd: t.priceUsd != null ? Number(t.priceUsd) : null,
      change24h: t.priceChange24h != null ? Number(t.priceChange24h) : t.change24h != null ? Number(t.change24h) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Poster entry price, verified: the 15m candle containing the post timestamp.
 * Returns null when the post is older than chart coverage (not verifiable).
 */
export async function fetchEntryPrice(mint: string, postIso: string): Promise<number | null> {
  try {
    const postMs = new Date(postIso).getTime();
    if (!Number.isFinite(postMs)) return null;
    const r = await fetch(`/api/ogdex/chart?mint=${encodeURIComponent(mint)}&interval=15m&limit=288`);
    const d = await r.json();
    const candles = (d?.candles || []) as any[];
    if (!candles.length) return null;
    const IV = 15 * 60 * 1000;
    for (const k of candles) {
      const t = new Date(k.time ?? k[0]).getTime();
      const close = Number(k.close ?? k[4]);
      if (!Number.isFinite(t) || !Number.isFinite(close) || close <= 0) continue;
      if (t <= postMs && postMs < t + IV) return close;
    }
    return null;
  } catch {
    return null;
  }
}

export interface PositionInfo {
  valueUsd: number | null;
  tokens: number | null;
  costUsd: number | null;
  unrealizedUsd: number | null;
  unrealizedPct: number | null;
}

/** Read the user's position for one mint from the same /wallet path the trade app uses. */
export async function fetchPositionInfo(mint: string, address: string): Promise<PositionInfo | null> {
  try {
    const r = await fetch(`/api/ogdex/wallet?address=${encodeURIComponent(address)}`);
    const w = await r.json();
    if (!w?.ok) return null;
    const row = findWalletPnlToken(w, mint);
    if (row) {
      return {
        valueUsd: numOrNull(row.holdingUsd ?? row.potUsd ?? row.curValueUsd),
        tokens: numOrNull(row.holdingAmount ?? row.tokens),
        costUsd: numOrNull(row.costUsd),
        unrealizedUsd: numOrNull(row.unrealizedUsd),
        unrealizedPct: numOrNull(row.unrealizedPct),
      };
    }
    const h = (w.holdings || []).find((x: any) => String(x?.mint) === mint);
    if (!h) return null;
    return {
      valueUsd: numOrNull(h.usdValue ?? h.valueUsd),
      tokens: numOrNull(h.uiAmount ?? h.amount),
      costUsd: null, unrealizedUsd: null, unrealizedPct: null,
    };
  } catch {
    return null;
  }
}

/* ═══════════ Bottom sheet shell (mobile-first) ═══════════ */
function SheetShell({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  return (
    <div className="osc-tradesheet" role="dialog" aria-label={label}>
      <div className="osc-tradesheet__backdrop" onClick={onClose} />
      <div className="osc-tradesheet__panel x-fade-in">
        <div className="osc-sheet__grab" />
        {children}
      </div>
    </div>
  );
}

/* ═══════════ Trade sheet: buy / sell / copy ═══════════ */
export type TradeMode = "buy" | "sell" | "copy";

interface SheetPost { id: string; username: string | null; created_at: string; }

interface TradeSheetProps {
  mint: string;
  symbol: string;
  mode: TradeMode;
  post: SheetPost | null;
  onClose: () => void;
}

const TITLES: Record<TradeMode, string> = { buy: "Buy", sell: "Sell", copy: "Copy trade" };

export function TradeSheet({ mint, symbol, mode, post, onClose }: TradeSheetProps) {
  const { address, ready } = useActiveTradingWallet();
  const [quote, setQuote] = useState<TokenQuote | null>(null);
  const [entry, setEntry] = useState<number | null | undefined>(undefined); // undefined = loading
  const [position, setPosition] = useState<PositionInfo | null | undefined>(undefined);
  const maxCopy = getMaxCopyUsd();
  const [amountUsd, setAmountUsd] = useState<number>(mode === "copy" ? Math.min(10, maxCopy) : 5);
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");

  const sliderMax = mode === "copy" ? maxCopy : mode === "sell"
    ? Math.max(10, Math.ceil(position?.valueUsd || 0) || 100)
    : 100;

  useEffect(() => {
    let on = true;
    void fetchTokenQuote(mint).then((q) => { if (on) setQuote(q); });
    if (post) void fetchEntryPrice(mint, post.created_at).then((e) => { if (on) setEntry(e); });
    else setEntry(null);
    if (ready && address) void fetchPositionInfo(mint, address).then((p) => { if (on) setPosition(p); });
    else setPosition(null);
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint]);

  const price = quote?.priceUsd ?? null;
  const estTokens = price && price > 0 ? amountUsd / price : null;
  const sinceCall = entry != null && price != null && entry > 0 ? ((price - entry) / entry) * 100 : null;
  const up = (sinceCall ?? 0) >= 0;

  const clampedAmount = Math.min(amountUsd, sliderMax);

  const confirm = async () => {
    if (busy) return;
    const authCode = getBillingAuthCode();
    if (!authCode) {
      toast.error("Link your in-app wallet first", {
        action: { label: "Wallet", onClick: () => { window.location.href = "/app?tab=wallet"; } },
      });
      return;
    }
    if (!price || price <= 0) { toast.error("No live price yet — try again in a moment"); return; }
    const usd = mode === "copy" ? Math.min(clampedAmount, maxCopy) : clampedAmount;
    if (!(usd > 0)) { toast.error("Enter an amount"); return; }
    setBusy(true);
    try {
      let res;
      if (mode === "sell") {
        const tokens = Math.floor(usd / price);
        if (tokens <= 0) throw new Error("Amount too small for a sell");
        res = await callSupercomputerTool("orbitx_app_sell", { authCode, mint, amount: tokens, slippageBps: 300 });
      } else {
        res = await callSupercomputerTool("orbitx_app_buy", {
          authCode, mint, usd, slippageBps: mode === "copy" ? 500 : 300,
        });
      }
      if (!res.ok) throw new Error(res.message || res.error || "Trade failed");
      setSig(String(res.signature || ""));
      toast.success(mode === "sell" ? `Sold $${usd} of $${symbol}` : `Bought $${usd} of $${symbol}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  };

  const chips = mode === "copy" ? [1, 5, 10, maxCopy].filter((v, i, a) => a.indexOf(v) === i) : [1, 5, 10, 25, 50, 100];

  return (
    <SheetShell onClose={onClose} label={`${TITLES[mode]} $${symbol}`}>
      <div className="osc-ts__head">
        <div className="flex items-center gap-2.5">
          {quote?.icon ? (
            <img src={quote.icon} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#3b82f6]/15 text-[13px] font-extrabold text-[#60a5fa]">{symbol.slice(0, 2)}</span>
          )}
          <div>
            <div className="flex items-center gap-1.5 text-[16px] font-extrabold text-white">
              {mode === "copy" && <ArrowLeftRight className="h-4 w-4 text-[#f0c75e]" />}
              {TITLES[mode]} <span className="text-[#60a5fa]">${symbol}</span>
            </div>
            <div className="text-[12px] text-white/40">
              {price != null ? <span className="font-bold text-white/70">{fmtUsd(price)}</span> : "loading price…"}
              {quote?.change24h != null && (
                <span className={cn("ml-1.5 font-bold", quote.change24h >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {quote.change24h >= 0 ? "▲" : "▼"}{Math.abs(quote.change24h).toFixed(1)}% 24h
                </span>
              )}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white" aria-label="Close">
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {sig ? (
        <div className="osc-ts__done x-fade-in">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40">
            <Check className="h-7 w-7 text-emerald-400" />
          </span>
          <div className="mt-3 text-[17px] font-extrabold text-white">
            {mode === "sell" ? "Sold" : "Bought"} ${clampedAmount} of ${symbol}
          </div>
          <div className="mt-1 text-[12.5px] text-white/45">Backend-signed · no popups</div>
          {sig && (
            <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="osc-ts__siglink">
              View on Solscan <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button type="button" onClick={onClose} className="osc-btn-primary mt-4 w-full">Done</button>
        </div>
      ) : (
        <>
          {/* Poster entry + my position (the 10x block) */}
          <div className="osc-ts__grid">
            <div className="osc-ts__stat">
              <div className="osc-ts__k">Poster entry</div>
              {entry === undefined ? (
                <div className="x-shim h-4 w-16 rounded" />
              ) : entry != null ? (
                <>
                  <div className="osc-ts__v">{fmtUsd(entry)}</div>
                  <div className={cn("osc-ts__d", up ? "text-emerald-400" : "text-rose-400")}>
                    {sinceCall != null ? fmtPct(sinceCall) + " since call" : ""}
                  </div>
                </>
              ) : (
                <div className="osc-ts__d">not verifiable</div>
              )}
              {post?.username && <div className="osc-ts__d">@{post.username} · {new Date(post.created_at).toLocaleDateString()}</div>}
            </div>
            <div className="osc-ts__stat">
              <div className="osc-ts__k">Your position</div>
              {position === undefined ? (
                <div className="x-shim h-4 w-16 rounded" />
              ) : position ? (
                <>
                  <div className="osc-ts__v">{fmtUsd(position.valueUsd)}</div>
                  <div className={cn("osc-ts__d", (position.unrealizedUsd ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {position.unrealizedUsd != null ? `${position.unrealizedUsd >= 0 ? "+" : ""}${fmtUsd(position.unrealizedUsd)} P&L` : ""}
                    {position.unrealizedPct != null ? ` (${fmtPct(position.unrealizedPct)})` : ""}
                  </div>
                </>
              ) : (
                <div className="osc-ts__d">no position</div>
              )}
              {!ready && <div className="osc-ts__d">wallet not linked</div>}
            </div>
          </div>

          {/* Amount */}
          <div className="osc-ts__amt">
            <div className="flex items-baseline justify-between">
              <span className="osc-ts__k">Amount (USD)</span>
              <span className="text-[22px] font-extrabold text-white">${clampedAmount}</span>
            </div>
            <input
              type="range" min={1} max={sliderMax} step={1}
              value={Math.min(amountUsd, sliderMax)}
              onChange={(e) => setAmountUsd(Number(e.target.value))}
              className="osc-ts__slider"
              aria-label="Amount in USD"
            />
            <div className="osc-ts__chips">
              {chips.map((c) => (
                <button key={c} type="button" onClick={() => setAmountUsd(Math.min(c, sliderMax))}
                  className={cn("osc-chip", Math.min(amountUsd, sliderMax) === Math.min(c, sliderMax) && "osc-chip--on")}>
                  ${c}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[12.5px] text-white/45">
              <span>You {mode === "sell" ? "receive ≈" : "get ≈"}</span>
              <span className="font-bold text-white/75">
                {estTokens != null ? `${estTokens < 1 ? estTokens.toExponential(1) : estTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} $${symbol}` : "—"}
              </span>
            </div>
          </div>

          {mode === "copy" && (
            <div className="osc-ts__warn">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <div className="text-[12px] leading-relaxed text-white/60">
                This mirrors their trade at the <b className="text-white/85">current price</b>, not their entry
                {entry != null && price != null ? ` (${fmtUsd(entry)} → ${fmtUsd(price)})` : ""}.
                Calls move fast — up to 5% slippage allowed. Capped at ${maxCopy}/copy.
              </div>
            </div>
          )}

          <button
            type="button" onClick={confirm} disabled={busy || (mode === "sell" && !position)}
            className={cn("osc-btn-primary osc-ts__confirm", mode === "sell" && "osc-ts__confirm--sell")}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>{mode === "sell" ? <TrendingDown className="h-4 w-4" /> : mode === "copy" ? <ArrowLeftRight className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {mode === "sell" ? `Sell $${clampedAmount}` : mode === "copy" ? `Copy buy $${clampedAmount}` : `Buy $${clampedAmount}`} ${symbol}</>
            )}
          </button>
          <div className="osc-ts__fine">Backend-signed by your in-app wallet · no popups</div>
        </>
      )}
    </SheetShell>
  );
}

/* ═══════════ Tip sheet: $1–$10, hard-enforced ═══════════ */
export const TIP_MIN = 1;
export const TIP_MAX = 10;

interface TipSheetProps {
  post: { id: string; user_id: string; username: string | null };
  onClose: () => void;
  onTipped: (amount: number) => void;
}

export function TipSheet({ post, onClose, onTipped }: TipSheetProps) {
  const [amount, setAmount] = useState(2);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    // Hard enforce $1–$10 regardless of what the UI sent.
    const amt = Math.min(TIP_MAX, Math.max(TIP_MIN, Math.round(Number(amount) * 2) / 2));
    const authCode = getBillingAuthCode();
    if (!authCode) {
      toast.error("Link your in-app wallet first", {
        action: { label: "Wallet", onClick: () => { window.location.href = "/app?tab=wallet"; } },
      });
      return;
    }
    setBusy(true);
    try {
      const res = await callSupercomputerTool("orbitx_app_tip", {
        authCode,
        recipient_user_id: post.user_id,
        amount_usd: amt,
      });
      if (!res.ok) throw new Error(res.message || res.error || "Tip failed");
      onTipped(amt);
      toast.success(`Tipped $${amt} to @${post.username || "anon"}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tip failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetShell onClose={onClose} label="Tip this post">
      <div className="osc-ts__head">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f0c75e]/15 ring-1 ring-[#f0c75e]/30">
            <Gift className="h-5 w-5 text-[#f0c75e]" />
          </span>
          <div>
            <div className="text-[16px] font-extrabold text-white">Tip @{post.username || "anon"}</div>
            <div className="text-[12px] text-white/40">Sent from your in-app wallet · backend-signed</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white" aria-label="Close">
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="osc-ts__amt">
        <div className="flex items-baseline justify-between">
          <span className="osc-ts__k">Amount</span>
          <span className="text-[26px] font-extrabold text-[#f0c75e]">${amount}</span>
        </div>
        <input
          type="range" min={TIP_MIN} max={TIP_MAX} step={0.5}
          value={Math.min(TIP_MAX, Math.max(TIP_MIN, amount))}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="osc-ts__slider osc-ts__slider--gold"
          aria-label="Tip amount in USD"
        />
        <div className="flex justify-between text-[11px] font-bold text-white/35"><span>$1 min</span><span>$10 max</span></div>
      </div>

      <button type="button" onClick={confirm} disabled={busy} className="osc-btn-primary osc-ts__confirm">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Gift className="h-4 w-4" /> Tip ${Math.min(TIP_MAX, Math.max(TIP_MIN, amount))}</>}
      </button>
      <div className="osc-ts__fine">Tips are final and go straight to the author's in-app wallet</div>
    </SheetShell>
  );
}

/* ═══════════ Rug siren: helpers + DB access ═══════════ */
export const SIREN_PREFIX = "[RUGSIREN]";
export const RUG_SIREN_THRESHOLD = 5;

export function isSirenContent(content: string): boolean {
  return (content || "").trimStart().startsWith(SIREN_PREFIX);
}

export interface SirenInfo { symbol: string | null; flags: number | null; origId: string | null; }

export function parseSiren(content: string): SirenInfo {
  const c = content || "";
  const sym = /\$([A-Za-z][A-Za-z0-9]{1,14})/.exec(c);
  const fl = /flagged by (\d+)/i.exec(c);
  const orig = /\[ORIG:([A-Za-z0-9-]+)\]/.exec(c);
  return {
    symbol: sym?.[1]?.toUpperCase() ?? null,
    flags: fl ? Number(fl[1]) : null,
    origId: orig?.[1] ?? null,
  };
}

/** Distinct flaggers for a post. Returns null when the rug_flags table is unreachable. */
export async function fetchRugFlaggers(postId: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.from("rug_flags").select("flagger_user_id").eq("post_id", postId);
    if (error) return null;
    return [...new Set(((data as { flagger_user_id: string }[]) || []).map((f) => f.flagger_user_id))];
  } catch {
    return null;
  }
}

/** Has the current user already flagged this post? */
export async function hasFlagged(postId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("rug_flags").select("id").eq("post_id", postId).eq("flagger_user_id", userId).limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export function SirenCard({ content, onOpenOrig }: { content: string; onOpenOrig?: (id: string) => void }) {
  const info = parseSiren(content);
  return (
    <article className="osc-siren x-fade-in">
      <span className="osc-siren__pulse" aria-hidden>🚨</span>
      <div className="min-w-0 flex-1">
        <div className="osc-siren__title">
          RUG SIREN{info.symbol ? `: $${info.symbol}` : ""}
        </div>
        <div className="osc-siren__sub">
          Flagged as a potential rug by <b>{info.flags ?? RUG_SIREN_THRESHOLD}+ users</b>. Trade with extreme caution — do your own research.
        </div>
        {info.origId && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenOrig?.(info.origId as string); }}
            className="osc-siren__btn"
          >
            View flagged post <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

/* ═══════════ Call receipt badge — provable $cashtag P&L on every post ═══════════
 * Entry = the 15m candle containing the post timestamp (verified, can't be faked).
 * Shows live P&L vs now. This is what X can never do: receipts, not screenshots. */
export function CallPnlBadge({ mint, symbol, postIso }: { mint: string; symbol: string; postIso: string }) {
  const [entry, setEntry] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    setEntry(null);
    setNow(null);
    fetchEntryPrice(mint, postIso).then((v) => { if (on) setEntry(v); });
    fetchTokenQuote(mint).then((q) => { if (on) setNow(q?.priceUsd ?? null); });
    return () => { on = false; };
  }, [mint, postIso]);
  if (entry == null || !entry || now == null || !now) return null;
  const pct = ((now - entry) / entry) * 100;
  if (!Number.isFinite(pct)) return null;
  const up = pct >= 0;
  const fmt = (v: number) =>
    v === 0 ? "$0" : v < 0.0001 ? "$" + v.toExponential(1) : "$" + v.toLocaleString(undefined, { maximumFractionDigits: v < 1 ? 4 : 2 });
  return (
    <span
      className={cn("osc-callbadge", up ? "osc-callbadge--up" : "osc-callbadge--down")}
      title={`$${symbol} called at ${fmt(entry)} · now ${fmt(now)} — verified entry, can't be edited`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct >= 1000 ? (pct / 100).toFixed(1) + "x" : pct.toFixed(pct >= 100 ? 0 : 1) + "%"}
    </span>
  );
}
