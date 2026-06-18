/**
 * IntelScan — OG Scan Intelligence (spec sections 5 & 6, wired end-to-end).
 * Input -> auto chain detect -> preflight -> live token data (DexScreener public API)
 * -> explainable 4-tier classification -> append-only Supabase log -> live public metrics.
 */
import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, Activity, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassificationCard } from "@/components/scanner-20x/ClassificationCard";
import { ShareScanCard } from "@/components/intel/ShareScanCard";
import { IntelNav } from "@/components/intel/IntelNav";
import { classifyToken, type ClassificationInput, type OgClassification } from "@/lib/classification";
import { logScan, getPublicMetrics, getTopScanned, type PublicMetrics, type TopScannedRow } from "@/lib/scanLog";

type Chain = "solana" | "ethereum" | "base" | "bsc" | "unknown";

function detectChain(addr: string): Chain {
  const a = addr.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return "ethereum"; // EVM-style; DexScreener resolves exact chain
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "solana";
  return "unknown";
}

type DexPair = {
  chainId?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  pairCreatedAt?: number;
  fdv?: number;
  baseToken?: { name?: string; symbol?: string };
  info?: { socials?: unknown[]; websites?: unknown[] };
};

async function fetchTokenInput(addr: string): Promise<{ input: ClassificationInput; symbol?: string; name?: string; chain: string }> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const json = (await res.json()) as { pairs?: DexPair[] };
  const pairs = json.pairs ?? [];
  if (pairs.length === 0) {
    return { input: { hasName: false, hasSymbol: false }, chain: detectChain(addr) };
  }
  const best = pairs.slice().sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const liquidityUsd = best.liquidity?.usd ?? 0;
  const fdv = best.fdv ?? 0;
  const ageHours = best.pairCreatedAt ? (Date.now() - best.pairCreatedAt) / 3.6e6 : undefined;
  const hasSocials = Boolean((best.info?.socials?.length ?? 0) > 0 || (best.info?.websites?.length ?? 0) > 0);
  const input: ClassificationInput = {
    liquidityUsd,
    volume24hUsd: best.volume?.h24,
    ageHours,
    hasName: Boolean(best.baseToken?.name),
    hasSymbol: Boolean(best.baseToken?.symbol),
    hasSocials,
    // heuristic: liquidity that has collapsed relative to FDV looks like a pulled pool
    lpPulled: fdv > 0 && liquidityUsd > 0 ? liquidityUsd / fdv < 0.0005 : undefined,
  };
  return { input, symbol: best.baseToken?.symbol, name: best.baseToken?.name, chain: best.chainId ?? detectChain(addr) };
}

export default function IntelScan() {
  const [addr, setAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OgClassification | null>(null);
  const [symbol, setSymbol] = useState<string | undefined>();
  const [scannedMint, setScannedMint] = useState<string | undefined>();
  const [scanId, setScanId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [top, setTop] = useState<TopScannedRow[]>([]);

  const refreshStats = useCallback(async () => {
    const [m, t] = await Promise.all([getPublicMetrics(), getTopScanned(10)]);
    setMetrics(m);
    setTop(t);
  }, []);

  useEffect(() => { void refreshStats(); }, [refreshStats]);

  const chain = addr ? detectChain(addr) : "unknown";
  const valid = chain !== "unknown";

  async function runScan() {
    if (!valid) { setError("Enter a valid Solana or EVM contract address."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const { input, symbol: sym, name, chain: resolvedChain } = await fetchTokenInput(addr.trim());
      const classification = classifyToken(input);
      setResult(classification);
      setSymbol(sym);
      const id = await logScan({ mint: addr.trim(), chain: resolvedChain, symbol: sym, name }, classification);
      setScannedMint(addr.trim());
      setScanId(id);
      await refreshStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <IntelNav />
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-emerald-400" /> OG Scan Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">
          Explainable 4-tier classification with an immutable, public scan trail.
        </p>
      </div>

      {/* Input module */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Scan a token</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="Paste a contract address (Solana or EVM)"
              onKeyDown={(e) => { if (e.key === "Enter") void runScan(); }}
            />
            <Button onClick={() => void runScan()} disabled={loading || !valid}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1.5">Scan</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Chain:</span>
            <span className={valid ? "text-emerald-400" : "text-muted-foreground"}>
              {addr ? (valid ? chain : "unrecognised") : "auto-detect"}
            </span>
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classification module */}
      {result && <ClassificationCard result={result} symbol={symbol} className="mb-6" />}
      {result && scannedMint && (
        <ShareScanCard mint={scannedMint} symbol={symbol} result={result} scanId={scanId} className="mb-6" />
      )}

      {/* Public transparency metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Public scan activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total scans" value={metrics.total_scans} />
              <Stat label="Tokens" value={metrics.unique_tokens} />
              <Stat label="24h scans" value={metrics.scans_24h} />
              <Stat label="OG found" value={metrics.og_count} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          )}

          {top.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Most scanned</div>
              <ul className="divide-y divide-border/50">
                {top.map((t) => (
                  <li key={t.mint} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate font-medium">{t.symbol || t.mint.slice(0, 8)}</span>
                    <span className="text-muted-foreground">{t.scan_count} scans · {t.common_tier?.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="text-2xl font-bold">{value ?? 0}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
