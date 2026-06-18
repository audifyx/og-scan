/** Analytics Panel — aggregated public metrics (spec section 10, Admin/Analytics). */
import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntelNav } from "@/components/intel/IntelNav";
import { getPublicMetrics, getTopScanned, type PublicMetrics, type TopScannedRow } from "@/lib/scanLog";

export default function IntelAnalytics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [top, setTop] = useState<TopScannedRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [m, t] = await Promise.all([getPublicMetrics(), getTopScanned(15)]);
      setMetrics(m); setTop(t); setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <IntelNav />
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold"><BarChart3 className="h-6 w-6 text-primary" /> Analytics</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-6">
          {metrics && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total scans" value={metrics.total_scans} />
              <Stat label="Unique tokens" value={metrics.unique_tokens} />
              <Stat label="24h scans" value={metrics.scans_24h} />
              <Stat label="OG found" value={metrics.og_count} />
              <Stat label="Safe" value={metrics.safe_count} />
              <Stat label="Risky" value={metrics.risky_count} />
              <Stat label="Dangerous" value={metrics.dangerous_count} />
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Most scanned tokens</CardTitle></CardHeader>
            <CardContent>
              {top.length === 0 ? <p className="text-sm text-muted-foreground">No scans yet.</p> : (
                <ul className="divide-y divide-border/50">
                  {top.map((t) => (
                    <li key={t.mint} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate font-medium">{t.symbol || t.mint.slice(0, 10)}</span>
                      <span className="text-muted-foreground">{t.scan_count} scans · {(t.common_tier || "").replace("_", " ")} · {t.avg_confidence}%</span>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="text-2xl font-bold">{value ?? 0}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
