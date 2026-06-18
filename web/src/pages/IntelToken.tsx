/** Token Intelligence View — drill-down (spec section 5[3], 7). Route /intel-token/:mint */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Search, Activity, GitBranch, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { IntelNav } from "@/components/intel/IntelNav";
import { ClassificationCard } from "@/components/scanner-20x/ClassificationCard";
import { ShareScanCard } from "@/components/intel/ShareScanCard";
import { classifyToken, type OgClassification } from "@/lib/classification";
import { trendVelocityScore, reconstructLifecycle, hypeDecayScore, liquidityStabilityIndex, whyExists, type LifecycleStage } from "@/lib/intelligence";
import { fetchTokenSnapshot, type TokenSnapshot } from "@/lib/tokenData";
import { logScan, captureTrendSnapshot, getScanHistoryForMint } from "@/lib/scanLog";

const STAGES: LifecycleStage[] = ["launch", "expansion", "peak", "decline"];

export default function IntelToken() {
  const { mint } = useParams();
  const navigate = useNavigate();
  const [addr, setAddr] = useState(mint ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<TokenSnapshot | null>(null);
  const [result, setResult] = useState<OgClassification | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getScanHistoryForMint>>>([]);

  const analyze = useCallback(async (address: string) => {
    if (!address) return;
    setLoading(true); setError(null); setResult(null); setSnap(null);
    try {
      const s = await fetchTokenSnapshot(address.trim());
      const classification = classifyToken(s.input);
      setSnap(s); setResult(classification);
      const velocity = trendVelocityScore(s.series);
      await logScan({ mint: address.trim(), chain: s.chain, symbol: s.symbol, name: s.name }, classification);
      await captureTrendSnapshot(address.trim(), { priceUsd: s.priceUsd, volume24h: s.volume24hUsd, liquidityUsd: s.liquidityUsd, velocity });
      setHistory(await getScanHistoryForMint(address.trim(), 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (mint) void analyze(mint); }, [mint, analyze]);

  function submit() {
    if (!addr.trim()) return;
    navigate(`/intel-token/${addr.trim()}`);
    void analyze(addr);
  }

  const velocity = snap ? trendVelocityScore(snap.series) : 0;
  const lifecycle = snap ? reconstructLifecycle(snap.series) : null;
  const decay = snap ? hypeDecayScore(snap.series) : 0;
  const stability = snap ? liquidityStabilityIndex(snap.series.map((p) => p.liquidity ?? snap.liquidityUsd)) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <IntelNav />
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="h-6 w-6 text-primary" /> Token Intelligence
      </h1>

      <div className="mb-6 flex gap-2">
        <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Contract address" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <Button onClick={submit} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-1.5">Analyze</span>
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {result && snap && (
        <div className="space-y-6">
          <ClassificationCard result={result} symbol={snap.symbol} />

          {/* Why this exists */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" /> Why this exists</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {whyExists({ name: snap.name, symbol: snap.symbol, isOg: result.tier === "OG_TOKEN" })}
            </CardContent>
          </Card>

          {/* Trend + lifecycle */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Trend & lifecycle</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Meter label="Trend velocity" value={velocity} />
              <Meter label="Liquidity stability" value={stability} />
              <Meter label="Hype decay risk" value={decay} />
              {lifecycle && (
                <div>
                  <div className="mb-2 flex gap-1">
                    {STAGES.map((st) => (
                      <Badge key={st} variant={lifecycle.stage === st ? "default" : "outline"} className="capitalize">{st}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{lifecycle.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <ShareScanCard mint={snap.mint} symbol={snap.symbol} name={snap.name} result={result} />

          {/* Scan history */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Scan history</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prior scans recorded.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{(h.tier as string).replace("_", " ")}</span>
                      <span className="text-muted-foreground">{h.confidence}% · {new Date(h.created_at as string).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{Math.round(value)}/100</span></div>
      <Progress value={value} className="h-2" />
    </div>
  );
}
