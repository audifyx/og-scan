/** Discovery Hub — segmented feeds with explainable ranking (spec section C & 8). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Loader2, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IntelNav } from "@/components/intel/IntelNav";
import { buildFeeds, FEED_LABEL, type FeedCandidate, type FeedKind, type RankedItem } from "@/lib/discovery";
import type { OgTier } from "@/lib/classification";
import { getTopScanned, getTrendingScans } from "@/lib/scanLog";

const TIERS: Record<string, OgTier> = {
  OG_TOKEN: "OG_TOKEN", SAFE_CLONE: "SAFE_CLONE", RISKY_TOKEN: "RISKY_TOKEN", DANGEROUS_TOKEN: "DANGEROUS_TOKEN",
};
const ORDER: FeedKind[] = ["trending_og", "trending_safe", "emerging", "risky"];

export default function IntelDiscovery() {
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState<ReturnType<typeof buildFeeds> | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [top, trending] = await Promise.all([getTopScanned(100), getTrendingScans(100)]);
      const scans24h = new Map(trending.map((t) => [t.mint, t.scans_24h]));
      const candidates: FeedCandidate[] = top.map((t) => {
        const s24 = scans24h.get(t.mint) ?? 0;
        return {
          mint: t.mint,
          symbol: t.symbol,
          name: t.name,
          tier: TIERS[t.common_tier] ?? "SAFE_CLONE",
          velocity: Math.min(100, s24 * 10 + (t.avg_confidence ?? 0) * 0.3),
          liquidityStability: 50,
          scans24h: s24,
        };
      });
      setFeeds(buildFeeds(candidates, 25));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <IntelNav />
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold"><Compass className="h-6 w-6 text-primary" /> Discovery Hub</h1>

      {loading || !feeds ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Building feeds…</div>
      ) : (
        <Tabs defaultValue="trending_og">
          <TabsList className="mb-4 flex flex-wrap">
            {ORDER.map((k) => (
              <TabsTrigger key={k} value={k}>{FEED_LABEL[k]} ({feeds[k].length})</TabsTrigger>
            ))}
          </TabsList>
          {ORDER.map((k) => (
            <TabsContent key={k} value={k} className="space-y-2">
              {feeds[k].length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing here yet — scan more tokens to populate this feed.</p>
              ) : feeds[k].map((item) => <FeedRow key={item.mint} item={item} />)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function FeedRow({ item }: { item: RankedItem }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{item.symbol || item.mint.slice(0, 8)}</span>
            {item.tier && <Badge variant="outline" className="text-xs">{item.tier.replace("_", " ")}</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{item.explanation}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold">{Math.round(item.rankScore)}</div>
            <div className="text-[10px] uppercase text-muted-foreground">rank</div>
          </div>
          <Link to={`/intel-token/${item.mint}`} className="text-primary hover:underline"><ArrowUpRight className="h-4 w-4" /></Link>
        </div>
      </CardContent>
    </Card>
  );
}
