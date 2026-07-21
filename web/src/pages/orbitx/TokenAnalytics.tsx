// OrbitX Launchpad — Token Analytics Terminal.
// A pro trading-terminal panel for the token page: real on-chain supply +
// mint/freeze authority + top-holder distribution (via Helius RPC), and a
// live buy/sell trade feed (via GeckoTerminal pool trades). All fail soft.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Users, ShieldCheck, ShieldAlert, Coins, ArrowUpRight, ArrowDownRight,
  ExternalLink, Flame, Loader2,
} from "lucide-react";
import { HELIUS_RPC } from "@/lib/og";
import { fmtCompactUsd } from "./lpx";
import { shortAddr, timeAgo, SectionLabel } from "./_shared";

async function heliusRpc(method: string, params: unknown[]) {
  const r = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error?.message || "rpc error");
  return j.result;
}

type Holder = { address: string; uiAmount: number; pct: number };

function fmtAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function AuthPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 pf-mono text-[10px] font-bold ${ok ? "border-[hsl(var(--pf-green))] text-[hsl(var(--pf-green))]" : "border-[hsl(var(--pf-gold))] text-[hsl(var(--pf-gold))]"}`}>
      {ok ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />} {label}
    </span>
  );
}

export default function TokenAnalytics({ mint, pairAddress, holderCount }: { mint: string; pairAddress: string | null; holderCount?: number | null }) {
  const [tradeFilter, setTradeFilter] = useState<"all" | "buy" | "sell">("all");

  const onchain = useQuery({
    queryKey: ["obx-onchain", mint],
    enabled: !!mint,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [supplyRes, largest, acct] = await Promise.all([
        heliusRpc("getTokenSupply", [mint]),
        heliusRpc("getTokenLargestAccounts", [mint]),
        heliusRpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]),
      ]);
      const decimals = supplyRes?.value?.decimals ?? 0;
      const supplyUi = Number(supplyRes?.value?.uiAmount ?? 0);
      const info = acct?.value?.data?.parsed?.info ?? {};
      const raw = (largest?.value ?? []).map((h: { address: string; uiAmount: number }) => ({ address: h.address, uiAmount: Number(h.uiAmount ?? 0) }));
      const total = supplyUi || raw.reduce((a: number, b: { uiAmount: number }) => a + b.uiAmount, 0) || 1;
      const holders: Holder[] = raw.map((h: { address: string; uiAmount: number }) => ({ ...h, pct: (h.uiAmount / total) * 100 }));
      const top10 = holders.slice(0, 10).reduce((a, b) => a + b.pct, 0);
      return {
        decimals,
        supplyUi,
        mintRevoked: !info.mintAuthority,
        freezeRevoked: !info.freezeAuthority,
        holders,
        top10,
      };
    },
  });

  const trades = useQuery({
    queryKey: ["obx-trades", pairAddress],
    enabled: !!pairAddress,
    refetchInterval: 15_000,
    queryFn: async () => {
      const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pairAddress}/trades`);
      if (!r.ok) return [];
      const j = await r.json();
      return (j.data ?? []).map((d: { attributes: Record<string, unknown> }) => {
        const a = d.attributes;
        return {
          kind: (a.kind as string) === "sell" ? "sell" : "buy",
          usd: Number(a.volume_in_usd ?? 0),
          ts: a.block_timestamp as string,
          tx: a.tx_hash as string,
          wallet: a.tx_from_address as string,
        };
      }).slice(0, 40);
    },
  });

  const d = onchain.data;
  const allTrades = trades.data ?? [];
  const shown = allTrades.filter((t: { kind: string }) => tradeFilter === "all" || t.kind === tradeFilter);
  const buyVol = allTrades.filter((t: { kind: string }) => t.kind === "buy").reduce((a: number, b: { usd: number }) => a + b.usd, 0);
  const sellVol = allTrades.filter((t: { kind: string }) => t.kind === "sell").reduce((a: number, b: { usd: number }) => a + b.usd, 0);
  const flowTotal = buyVol + sellVol || 1;

  return (
    <div className="mt-4">
      <SectionLabel>Analytics terminal</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* on-chain vitals */}
        <div className="pf-card p-4">
          <div className="mb-3 flex items-center gap-2 pf-mono text-[10px] font-black uppercase tracking-widest text-[hsl(var(--pf-muted))]">
            <Coins className="h-3.5 w-3.5 text-[hsl(var(--pf-green))]" /> On-chain
          </div>
          {onchain.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> reading chain…</div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs"><span className="text-[hsl(var(--pf-muted))]">Supply</span><span className="pf-mono font-bold text-[hsl(var(--pf-ink))]">{d ? fmtAmount(d.supplyUi) : "—"}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-[hsl(var(--pf-muted))]">Decimals</span><span className="pf-mono font-bold text-[hsl(var(--pf-ink))]">{d?.decimals ?? "—"}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-[hsl(var(--pf-muted))]">Holders</span><span className="pf-mono font-bold text-[hsl(var(--pf-ink))]">{holderCount != null ? holderCount.toLocaleString() : "—"}</span></div>
              <div className="flex items-center justify-between gap-2 pt-1"><span className="text-xs text-[hsl(var(--pf-muted))]">Mint authority</span>{d && <AuthPill ok={d.mintRevoked} label={d.mintRevoked ? "Revoked" : "Active"} />}</div>
              <div className="flex items-center justify-between gap-2"><span className="text-xs text-[hsl(var(--pf-muted))]">Freeze authority</span>{d && <AuthPill ok={d.freezeRevoked} label={d.freezeRevoked ? "Revoked" : "Active"} />}</div>
            </div>
          )}
        </div>

        {/* holder distribution */}
        <div className="pf-card p-4">
          <div className="mb-3 flex items-center gap-2 pf-mono text-[10px] font-black uppercase tracking-widest text-[hsl(var(--pf-muted))]">
            <Users className="h-3.5 w-3.5 text-[hsl(var(--pf-blue))]" /> Top holders
          </div>
          {onchain.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading…</div>
          ) : !d || d.holders.length === 0 ? (
            <div className="py-6 text-center text-xs text-[hsl(var(--pf-muted))]">No holder data yet</div>
          ) : (
            <div className="space-y-2">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">
                <span>Top 10 concentration</span>
                <span className={d.top10 > 50 ? "font-bold text-[hsl(var(--pf-red))]" : "font-bold text-[hsl(var(--pf-green))]"}>{d.top10.toFixed(1)}%</span>
              </div>
              {d.holders.slice(0, 8).map((h, i) => (
                <div key={h.address} className="space-y-1">
                  <div className="flex items-center justify-between pf-mono text-[10px]">
                    <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noreferrer" className="text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-blue))]">#{i + 1} {shortAddr(h.address, 4)}</a>
                    <span className="font-bold text-[hsl(var(--pf-ink))]">{h.pct.toFixed(2)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--pf-bg-2))]">
                    <div className="h-full rounded-full bg-[hsl(var(--pf-green))]" style={{ width: `${Math.min(100, h.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* live trades */}
        <div className="pf-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 pf-mono text-[10px] font-black uppercase tracking-widest text-[hsl(var(--pf-muted))]">
              <Activity className="h-3.5 w-3.5 text-[hsl(var(--pf-green))]" /> Live trades
            </div>
            <div className="flex gap-1">
              {(["all", "buy", "sell"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setTradeFilter(f)}
                  className={`rounded-full px-2 py-0.5 pf-mono text-[9px] font-bold uppercase tracking-wider transition ${tradeFilter === f ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))]"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {/* buy/sell flow bar */}
          <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--pf-bg-2))]">
            <div className="h-full bg-[hsl(var(--pf-green))]" style={{ width: `${(buyVol / flowTotal) * 100}%` }} />
            <div className="h-full bg-[hsl(var(--pf-red))]" style={{ width: `${(sellVol / flowTotal) * 100}%` }} />
          </div>
          <div className="mb-2 flex items-center justify-between pf-mono text-[10px]">
            <span className="text-[hsl(var(--pf-green))]">buy {fmtCompactUsd(buyVol)}</span>
            <span className="text-[hsl(var(--pf-red))]">{fmtCompactUsd(sellVol)} sell</span>
          </div>
          {trades.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> streaming…</div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center text-xs text-[hsl(var(--pf-muted))]"><Flame className="h-5 w-5 opacity-50" /> No trades yet</div>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {shown.map((t: { kind: string; usd: number; ts: string; tx: string; wallet: string }, i: number) => (
                <a key={t.tx + i} href={`https://solscan.io/tx/${t.tx}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between rounded-md border border-[hsl(var(--pf-border))] px-2 py-1 pf-mono text-[10px] transition hover:border-[hsl(var(--pf-green))]">
                  <span className={`inline-flex items-center gap-1 font-bold ${t.kind === "buy" ? "text-[hsl(var(--pf-green))]" : "text-[hsl(var(--pf-red))]"}`}>
                    {t.kind === "buy" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {t.kind}
                  </span>
                  <span className="text-[hsl(var(--pf-ink))]">{fmtCompactUsd(t.usd)}</span>
                  <span className="text-[hsl(var(--pf-muted))]">{shortAddr(t.wallet, 3)}</span>
                  <span className="text-[hsl(var(--pf-muted))]">{t.ts ? timeAgo(t.ts) : ""}</span>
                  <ExternalLink className="h-3 w-3 text-[hsl(var(--pf-muted))]" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
