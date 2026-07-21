// OrbitX Launchpad — Portfolio. Wallet-native: reads the connected wallet's SPL
// holdings straight from Helius RPC, prices them via Jupiter, and shows live value.
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { HELIUS_RPC, jupPrice, jupGetTokens } from "@/lib/og";
import { fmtCompactUsd } from "./lpx";
import { shortAddr, TokenLogo } from "./_shared";
import { Wallet, Loader2, Rocket, Briefcase } from "lucide-react";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(HELIUS_RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error?.message || "rpc error");
  return j.result;
}

export default function LaunchpadPortfolio() {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();

  const { data, isLoading } = useQuery({
    queryKey: ["orbitx-portfolio", addr],
    enabled: !!addr,
    refetchInterval: 60_000,
    queryFn: async () => {
      const grab = async (program: string) => {
        try {
          const res = await rpc("getTokenAccountsByOwner", [addr, { programId: program }, { encoding: "jsonParsed" }]);
          return (res?.value ?? []).map((a: { account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number; decimals: number } } } } } }) => {
            const info = a.account.data.parsed.info;
            return { mint: info.mint, amount: Number(info.tokenAmount?.uiAmount ?? 0) };
          });
        } catch { return []; }
      };
      const all = [...(await grab(TOKEN_PROGRAM)), ...(await grab(TOKEN_2022))].filter((h) => h.amount > 0).slice(0, 80);
      const mints = all.map((h) => h.mint);
      const [prices, metas] = await Promise.all([
        jupPrice(mints).catch(() => ({} as Record<string, { usdPrice: number }>)),
        jupGetTokens(mints).catch(() => [] as { id?: string; name?: string; symbol?: string; icon?: string }[]),
      ]);
      const metaMap = new Map((metas as { id?: string }[]).map((m) => [m.id, m]));
      const holdings = all.map((h) => {
        const price = (prices as Record<string, { usdPrice?: number }>)[h.mint]?.usdPrice ?? 0;
        const m = metaMap.get(h.mint) as { name?: string; symbol?: string; icon?: string } | undefined;
        return { ...h, price, value: h.amount * price, name: m?.name, symbol: m?.symbol, icon: m?.icon };
      }).sort((a, b) => b.value - a.value);
      const total = holdings.reduce((a, b) => a + b.value, 0);
      return { holdings, total };
    },
  });

  if (!connected || !addr) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="pf-card flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-green))]/15"><Wallet className="h-7 w-7 text-[hsl(var(--pf-green))]" /></div>
          <div>
            <div className="text-lg font-black text-[hsl(var(--pf-ink))]">Connect your wallet</div>
            <div className="mx-auto mt-1 max-w-sm text-sm text-[hsl(var(--pf-muted))]">Your portfolio reads holdings straight from your connected wallet. Connect up top to see your positions and live value.</div>
          </div>
        </div>
      </div>
    );
  }

  const holdings = data?.holdings ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-[hsl(var(--pf-green))]" />
        <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">Portfolio</h1>
      </div>

      <div className="pf-card mb-4 p-5">
        <div className="pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Total value</div>
        <div className="mt-1 text-3xl font-black text-[hsl(var(--pf-green))]">{isLoading ? "…" : fmtCompactUsd(data?.total ?? 0)}</div>
        <div className="mt-1 pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{shortAddr(addr, 6)} · {holdings.length} token{holdings.length === 1 ? "" : "s"}</div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> reading wallet…</div>
      ) : holdings.length === 0 ? (
        <div className="pf-card flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-sm font-bold text-[hsl(var(--pf-muted))]">No token holdings found</div>
          <Link to="/orbitxlaunch" className="pf-btn"><Rocket className="h-4 w-4" /> Discover tokens</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {holdings.map((h) => (
            <Link key={h.mint} to={`/orbitxlaunch/token/${h.mint}`} className="pf-card flex items-center gap-3 p-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
                <TokenLogo src={h.icon} symbol={h.symbol || h.mint} className="h-full w-full text-xs" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-[hsl(var(--pf-ink))]">{h.name || shortAddr(h.mint, 5)}</div>
                <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{h.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {h.symbol ? `$${h.symbol}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="pf-mono text-sm font-bold text-[hsl(var(--pf-ink))]">{h.value > 0 ? fmtCompactUsd(h.value) : "—"}</div>
                <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{h.price > 0 ? `$${h.price < 0.01 ? h.price.toPrecision(2) : h.price.toFixed(4)}` : ""}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
