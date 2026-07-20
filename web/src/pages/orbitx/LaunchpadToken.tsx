// Orbitx Launchpad — token detail page (/orbitxlaunch/token/:mint).
// Same "dex platform" data model as the rest of the app: registry row
// (when the token was launched here) blended with live Jupiter +
// DexScreener data (works for ANY Solana mint, registered or not — this
// is what makes the official OrbitX token, or any external token,
// resolve correctly even though it has no orbitx_tokens row). Includes
// a real Buy/Sell panel (Jupiter quote, execute via Phantom) and fixes
// per-token page title / Open Graph tags.
import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/orbitx/registry";
import { shortAddr, timeAgo, SectionLabel, Pill, useDocumentMeta, fmtMc, GRADUATION_MC_USD } from "./_shared";
import { useMarketMap, fmtCompactUsd } from "./lpx";
import { jupGetTokens, jupQuote, SOL_MINT, fmtPct } from "@/lib/og";
import {
  Loader2, Copy, Check, ExternalLink, ShieldCheck, ShieldAlert, Droplets, Flame,
  ArrowLeft, Coins, ArrowDownUp, Zap, BadgeCheck, TrendingUp, TrendingDown,
} from "lucide-react";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--pf-border))] py-2.5 last:border-0">
      <span className="pf-mono text-[11px] uppercase tracking-wider text-[hsl(var(--pf-muted))]">{label}</span>
      <span className="text-right pf-mono text-sm font-medium text-[hsl(var(--pf-ink))]">{children}</span>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="pf-card p-3 text-center">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">{label}</div>
      <div className={`mt-1 text-base font-black ${tone === "up" ? "text-[hsl(var(--pf-green-dark))]" : tone === "down" ? "text-[hsl(var(--pf-red))]" : "text-[hsl(var(--pf-ink))]"}`}>{value}</div>
    </div>
  );
}

/* ── compact Buy / Sell panel — Jupiter quote, execute via Phantom deep link ── */
function BuySellPanel({ mint, symbol, decimals }: { mint: string; symbol: string; decimals: number }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.5");

  const inputMint = side === "buy" ? SOL_MINT : mint;
  const outputMint = side === "buy" ? mint : SOL_MINT;
  const inDecimals = side === "buy" ? 9 : decimals;

  const rawAmount = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "0";
    return Math.floor(n * 10 ** inDecimals).toString();
  }, [amount, inDecimals]);

  const { data: quote, isFetching, error } = useQuery({
    queryKey: ["token-page-quote", inputMint, outputMint, rawAmount],
    queryFn: () => jupQuote(inputMint, outputMint, rawAmount, 100),
    enabled: rawAmount !== "0",
    refetchInterval: 12_000,
    retry: 1,
  });

  const outDecimals = side === "buy" ? decimals : 9;
  const outAmount = quote ? (Number(quote.outAmount) / 10 ** outDecimals).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "";
  const impact = quote ? Number(quote.priceImpactPct) * 100 : null;
  const swapUrl = `https://phantom.app/ul/swap?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}`;

  return (
    <div className="pf-card p-4">
      <div className="mb-3 flex gap-1 rounded-full border border-[hsl(var(--pf-border))] p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)}
            className={`flex-1 rounded-full py-2 text-xs font-black uppercase tracking-wide transition ${
              side === "buy"
                ? (s === "buy" ? "bg-[hsl(var(--pf-green))] text-white" : "text-[hsl(var(--pf-muted))]")
                : (s === "sell" ? "bg-[hsl(var(--pf-red))] text-white" : "text-[hsl(var(--pf-muted))]")
            } ${side === s ? "" : "hover:text-[hsl(var(--pf-ink))]"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          {side === "buy" ? "You pay (SOL)" : `You pay ($${symbol})`}
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          placeholder="0.0"
          className="mt-1 w-full bg-transparent text-2xl font-black text-[hsl(var(--pf-ink))] outline-none"
        />
      </div>
      <div className="my-1 flex justify-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg-2))]"><ArrowDownUp className="h-3.5 w-3.5 text-[hsl(var(--pf-muted))]" /></div>
      </div>
      <div className="rounded-xl border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          {side === "buy" ? `You receive ($${symbol})` : "You receive (SOL)"}
        </div>
        <div className="mt-1 text-2xl font-black text-[hsl(var(--pf-green-dark))]">
          {isFetching ? <Loader2 className="h-5 w-5 animate-spin" /> : error ? "—" : outAmount || "0.0"}
        </div>
      </div>

      {quote && (
        <div className="mt-2 flex items-center justify-between pf-mono text-[10px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">
          <span>Price impact</span>
          <span className={impact != null && impact > 1 ? "text-[hsl(var(--pf-red))]" : "text-[hsl(var(--pf-green-dark))]"}>{impact != null ? fmtPct(impact) : "—"}</span>
        </div>
      )}

      <a
        href={swapUrl}
        target="_blank"
        rel="noreferrer"
        className={`pf-btn mt-3 w-full justify-center ${side === "sell" ? "!bg-[hsl(var(--pf-red))] !shadow-[0_3px_0_hsl(0_65%_35%)]" : ""}`}
      >
        <Zap className="h-4 w-4" /> {side === "buy" ? "Buy" : "Sell"} on Phantom
      </a>
      <p className="mt-2 text-center text-[10px] text-[hsl(var(--pf-muted))]">Routed live through Jupiter · executes in your Phantom wallet · 1% slippage</p>
    </div>
  );
}

export default function LaunchpadToken() {
  const { mint } = useParams<{ mint: string }>();

  const [copied, setCopied] = useState(false);
  const { data: t, isLoading: registryLoading } = useQuery({
    queryKey: ["orbitx-token", mint],
    queryFn: () => getToken(mint!),
    enabled: !!mint,
  });

  // Live data works for ANY mint — registered on this launchpad or not.
  const { data: jupTokens, isLoading: jupLoading } = useQuery({
    queryKey: ["orbitx-token-jup", mint],
    queryFn: () => jupGetTokens([mint!]),
    enabled: !!mint,
    staleTime: 20_000,
  });
  const jup = jupTokens?.[0];

  const marketQ = useMarketMap(mint ? [mint] : []);
  const market = mint ? marketQ.data?.[mint] : undefined;

  const isLoading = registryLoading || jupLoading;

  // Blend: registry (launch-native metadata) wins where present, live
  // Jupiter data fills in name/symbol/logo/decimals for external tokens.
  const name = t?.name ?? jup?.name;
  const ticker = t?.ticker ?? jup?.symbol;
  const logo = t?.logo_url ?? jup?.icon ?? null;
  const decimals = t?.decimals ?? jup?.decimals ?? 9;
  const mcap = market?.mcap ?? jup?.mcap ?? jup?.fdv ?? null;
  const liq = market?.liq ?? jup?.liquidity ?? null;
  const jupVol = jup?.stats24h ? (jup.stats24h.buyVolume ?? 0) + (jup.stats24h.sellVolume ?? 0) : null;
  const vol24 = market?.vol24 ?? jupVol;
  const ch24 = market?.ch24 ?? jup?.stats24h?.priceChange ?? null;
  const priceUsd = jup?.usdPrice ?? null;

  useDocumentMeta(
    name
      ? {
          title: `${name} ($${ticker}) — OrbitX Launchpad`,
          description: `${name} ($${ticker}) on OrbitX — ${mcap ? `${fmtCompactUsd(mcap)} market cap, ` : ""}live price, chart and Phantom buy/sell. CA: ${mint}`,
          image: logo,
        }
      : null,
  );

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-24 pf-mono text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-5 w-5 animate-spin" /> loading token…</div>;

  if (!t && !jup)
    return (
      <div className="pf-card mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <div className="text-lg font-black text-[hsl(var(--pf-ink))]">Token not found</div>
        <div className="max-w-sm text-sm text-[hsl(var(--pf-muted))]">No launch or live Solana mint matches <span className="pf-mono text-[hsl(28_80%_32%)]">{shortAddr(mint, 6)}</span>.</div>
        <Link to="/orbitxlaunch" className="pf-btn"><ArrowLeft className="h-4 w-4" /> Back to launchpad</Link>
      </div>
    );

  const graduated = !!t?.lp_pool_address || (liq ?? 0) > 0;
  const isOfficial = mint === "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
  const cluster = t?.cluster ?? "mainnet-beta";
  const explorer = `https://solscan.io/token/${mint}${cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`;
  const pct = graduated ? 100 : mcap && mcap > 0 ? Math.max(2, Math.min(99, Math.round((mcap / GRADUATION_MC_USD) * 100))) : 3;

  const copy = () => {
    if (!mint) return;
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/orbitxlaunch" className="mb-4 inline-flex items-center gap-1.5 pf-mono text-xs uppercase tracking-wider text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]"><ArrowLeft className="h-4 w-4" /> Launchpad</Link>

      <div className="pf-card p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
            {logo ? <img src={logo} alt={ticker} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl font-black text-[hsl(var(--pf-muted))]">{ticker?.slice(0, 2).toUpperCase()}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-[hsl(var(--pf-ink))]">{name}</h1>
              <span className="rounded-full bg-[hsl(var(--pf-ink))/0.06] px-2 py-0.5 pf-mono text-xs font-bold text-[hsl(28_80%_32%)]">${ticker}</span>
              {isOfficial && <Pill tone="gold"><BadgeCheck className="h-3 w-3" /> Official OrbitX token</Pill>}
              {t && <Pill tone={t.launch_type === "pump" ? "cyan" : "gold"}>{t.launch_type === "pump" ? "Pump launch" : "Custom launch"}</Pill>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {graduated
                ? <Pill tone="lime"><Droplets className="h-3 w-3" /> Graduated</Pill>
                : <Pill tone="cyan"><Flame className="h-3 w-3" /> Fresh</Pill>}
              {t ? (
                t.is_vamp
                  ? <Pill tone="blood"><ShieldAlert className="h-3 w-3" /> Vamp · fees → {t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route}</Pill>
                  : <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Verified unique</Pill>
              ) : jup?.isVerified ? (
                <Pill tone="muted"><ShieldCheck className="h-3 w-3" /> Verified on Jupiter</Pill>
              ) : null}
              {ch24 != null && (
                <Pill tone={ch24 >= 0 ? "lime" : "blood"}>{ch24 >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {fmtPct(ch24)} 24h</Pill>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-lg border border-[hsl(var(--pf-border))] bg-[hsl(var(--pf-bg))] px-3 py-2.5">
          <Coins className="h-4 w-4 shrink-0 text-[hsl(28_80%_32%)]" />
          <span className="min-w-0 flex-1 truncate pf-mono text-sm text-[hsl(var(--pf-ink))]">{mint}</span>
          <button onClick={copy} className="shrink-0 rounded-lg border border-[hsl(var(--pf-border))] p-1.5 hover:bg-[hsl(var(--pf-ink))/0.06]" title="Copy CA">{copied ? <Check className="h-4 w-4 text-[hsl(var(--pf-green-dark))]" /> : <Copy className="h-4 w-4" />}</button>
          <a href={explorer} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-[hsl(var(--pf-border))] p-1.5 hover:bg-[hsl(var(--pf-ink))/0.06]" title="View on Solscan"><ExternalLink className="h-4 w-4" /></a>
        </div>
      </div>

      {/* market stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="Price" value={priceUsd ? `$${priceUsd < 0.01 ? priceUsd.toExponential(2) : priceUsd.toFixed(4)}` : "—"} />
        <StatBox label="Market cap" value={fmtCompactUsd(mcap)} />
        <StatBox label="Liquidity" value={fmtCompactUsd(liq)} />
        <StatBox label="24h volume" value={fmtCompactUsd(vol24)} />
      </div>

      {!graduated && (
        <div className="pf-card mt-4 p-4">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--pf-muted))]">
            <span>Bonding curve</span>
            <span className="text-[hsl(var(--pf-green-dark))]">{pct}% to graduation</span>
          </div>
          <div className="pf-progress"><div className="pf-progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {/* buy / sell + details */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <BuySellPanel mint={mint!} symbol={ticker ?? "TOKEN"} decimals={decimals} />

        <div className="pf-card p-6">
          <SectionLabel>Token details</SectionLabel>
          <div className="grid gap-x-8 gap-y-0">
            {t ? (
              <>
                <Row label="Supply">{Number(t.supply).toLocaleString()}</Row>
                <Row label="Decimals">{t.decimals}</Row>
                <Row label="DEX">{t.dex || "—"}</Row>
                <Row label="Fee routing">{t.fee_route === "orbitx_buyback" ? "OBX buyback" : t.fee_route === "og" ? "Original token" : "Creator"}</Row>
                <Row label="Creator">{shortAddr(t.creator_wallet, 5)}</Row>
                <Row label="Launched">{timeAgo(t.created_at)}</Row>
                {t.lp_pool_address && <Row label="LP pool">{shortAddr(t.lp_pool_address, 5)}</Row>}
                {t.mint_signature && <Row label="Mint tx"><a className="text-[hsl(var(--pf-blue))] hover:underline" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${t.mint_signature}${cluster !== "mainnet-beta" ? "?cluster=devnet" : ""}`}>{shortAddr(t.mint_signature, 5)}</a></Row>}
              </>
            ) : (
              <>
                <Row label="Decimals">{decimals}</Row>
                <Row label="Holders">{jup?.holderCount != null ? jup.holderCount.toLocaleString() : "—"}</Row>
                <Row label="Mint authority">{jup?.audit?.mintAuthorityDisabled ? "Revoked" : "Active"}</Row>
                <Row label="Freeze authority">{jup?.audit?.freezeAuthorityDisabled ? "Revoked" : "Active"}</Row>
                <div className="pt-2 text-xs text-[hsl(var(--pf-muted))]">
                  External Solana token — not launched through OrbitX. Live price and liquidity verified via Jupiter and DexScreener.
                </div>
              </>
            )}
            {market?.url && (
              <div className="pt-3">
                <a href={market.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 pf-mono text-xs font-bold text-[hsl(var(--pf-blue))] hover:underline">
                  View chart on DexScreener <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
