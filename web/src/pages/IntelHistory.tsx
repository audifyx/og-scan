/** History Explorer — public, immutable scan trail + attribution (spec section 10). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, Loader2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntelNav } from "@/components/intel/IntelNav";
import { getRecentScans, getScannerLeaderboard, type LeaderboardRow } from "@/lib/scanLog";

export default function IntelHistory() {
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof getRecentScans>>>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [r, b] = await Promise.all([getRecentScans(50), getScannerLeaderboard(15)]);
      setRecent(r); setBoard(b); setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <IntelNav />
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold"><History className="h-6 w-6 text-primary" /> History Explorer</h1>
      <p className="mb-6 text-sm text-muted-foreground">Every scan is recorded in an append-only, publicly auditable log.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> Top scanners</CardTitle></CardHeader>
            <CardContent>
              {board.length === 0 ? <p className="text-sm text-muted-foreground">No scans yet.</p> : (
                <ul className="divide-y divide-border/50">
                  {board.map((row, i) => (
                    <li key={row.handle} className="flex items-center justify-between py-2 text-sm">
                      <span className="flex items-center gap-2"><span className="w-5 text-muted-foreground">{i + 1}.</span> {row.handle}</span>
                      <span className="text-muted-foreground">{row.og_finds} OG · {row.total_scans} scans</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent scans</CardTitle></CardHeader>
            <CardContent>
              {recent.length === 0 ? <p className="text-sm text-muted-foreground">No scans yet.</p> : (
                <ul className="divide-y divide-border/50">
                  {recent.map((s) => (
                    <li key={s.id as string} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link to={`/intel-token/${s.mint}`} className="min-w-0 truncate font-medium hover:underline">
                        {(s.symbol as string) || (s.mint as string).slice(0, 10)}
                      </Link>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{(s.tier as string).replace("_", " ")}</Badge>
                        <span className="text-muted-foreground">{s.confidence as number}%</span>
                      </span>
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
