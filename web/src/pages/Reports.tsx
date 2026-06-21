import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { FileText, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";

type Report = {
  id: string; query: string | null; instructions: string | null;
  token_name: string | null; token_symbol: string | null; token_mint: string | null;
  source: string | null; public_url: string | null; created_at: string;
};

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
};

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Report | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(60);
      setReports((data as Report[]) || []);
      setActive((prev) => prev || (data && data[0]) || null);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <AppLayout>
      <PageHeader title="Reports" description="Every AI-generated OG Scan report from the bot" />
      <div className="px-4 pb-24 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-white/40 text-[12px]">{reports.length} report{reports.length === 1 ? "" : "s"}</div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* list */}
          <div className="space-y-2 lg:max-h-[78vh] lg:overflow-y-auto pr-1">
            {loading && !reports.length ? (
              <div className="flex items-center gap-2 text-white/40 text-[13px] p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports…</div>
            ) : reports.length ? reports.map((r) => (
              <button key={r.id} onClick={() => setActive(r)}
                className={`w-full text-left rounded-xl border p-3 transition ${active?.id === r.id ? "border-og-lime/40 bg-og-lime/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-3.5 w-3.5 text-og-lime shrink-0" />
                  <span className="font-semibold text-white/85 text-[13px] truncate">{r.token_name || r.token_symbol || "Report"}{r.token_symbol ? ` ($${r.token_symbol})` : ""}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] uppercase">{r.source || "bot"}</Badge>
                </div>
                {r.instructions ? (
                  <div className="text-white/45 text-[11px] flex items-start gap-1"><Sparkles className="h-3 w-3 mt-0.5 text-og-cyan shrink-0" /><span className="line-clamp-2">{r.instructions}</span></div>
                ) : null}
                <div className="text-white/25 text-[10px] mt-1 font-mono truncate">{r.token_mint}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{ago(r.created_at)}</div>
              </button>
            )) : (
              <div className="text-white/30 text-[13px] p-4">No reports yet. Generate one with <code className="text-white/50">/report &lt;ca&gt;</code> in the bot.</div>
            )}
          </div>
          {/* preview */}
          <Card className="glass-card overflow-hidden min-h-[60vh]">
            {active ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-2 p-3 border-b border-white/[0.06]">
                  <div className="min-w-0">
                    <div className="text-white/85 font-semibold text-[14px] truncate">{active.token_name || "Report"}{active.token_symbol ? ` ($${active.token_symbol})` : ""}</div>
                    {active.instructions ? <div className="text-white/40 text-[11px] truncate">“{active.instructions}”</div> : null}
                  </div>
                  {active.public_url ? (
                    <a href={active.public_url} target="_blank" rel="noreferrer">
                      <Button size="sm" className="rounded-xl bg-og-lime/90 text-black hover:bg-og-lime font-bold">Open <ExternalLink className="h-3.5 w-3.5 ml-1" /></Button>
                    </a>
                  ) : null}
                </div>
                {active.public_url ? (
                  <iframe title="report" src={active.public_url} className="w-full flex-1 min-h-[60vh] bg-white" />
                ) : (
                  <div className="text-white/30 text-[13px] p-6">No preview available for this report.</div>
                )}
              </div>
            ) : (
              <div className="text-white/30 text-[13px] p-6">Select a report to preview.</div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
