import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase, SUPABASE_URL } from "@/lib/supabase";
import { toast } from "sonner";
import { FileText, ExternalLink, Loader2, RefreshCw, Sparkles, Download, Eye, X } from "lucide-react";

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

// CORS-enabled raw HTML source (for fetch/srcDoc + download).
const sourceUrl = (r: Report) => `${SUPABASE_URL}/functions/v1/report-view?id=${r.id}`;
// Shareable, rendered link on our own domain.
const shareUrl = (r: Report) => `/r/${r.id}`;

const fileName = (r: Report) => {
  const base = (r.token_symbol || r.token_name || "report").replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return `${base || "report"}_report.html`;
};
const titleOf = (r: Report) => `${r.token_name || r.token_symbol || "Report"}${r.token_symbol ? ` ($${r.token_symbol})` : ""}`;

type Scan = { mint: string; symbol: string | null; name: string | null; og_score: number | null; market_cap: number | null; price_usd: number | null; source: string | null; created_at: string };
const fmtUsd = (n: any) => { const v = Number(n); if (!isFinite(v) || v === 0) return "--"; if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "M"; if (v >= 1e3) return "$" + (v/1e3).toFixed(1) + "K"; return "$" + v.toFixed(2); };
const scoreColor = (s: any) => { const v = Number(s); return v >= 80 ? "#22e38a" : v >= 60 ? "#b6f23d" : v >= 40 ? "#fbbf24" : "#f87171"; };

function ScansGrid({ scans, loading }: { scans: Scan[]; loading: boolean }) {
  if (loading && !scans.length) return <div className="flex items-center gap-2 text-white/40 text-[13px] p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading scans…</div>;
  if (!scans.length) return <div className="text-white/30 text-[13px] p-4">No scans yet. Send a contract address to the bot, or scan one in the app.</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {scans.map((s) => (
        <Link key={s.mint} to={`/t/${s.mint}`} className="block">
          <Card className="glass-card p-4 hover:border-white/20 transition h-full">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-bold text-white/90 text-[14px] truncate">{s.name || s.symbol || "Token"}{s.symbol ? ` ($${s.symbol})` : ""}</span>
              {s.og_score != null && <span className="ml-auto rounded-lg px-2 py-0.5 text-[11px] font-black shrink-0" style={{ color: scoreColor(s.og_score), background: `${scoreColor(s.og_score)}1a` }}>{s.og_score}</span>}
            </div>
            <div className="text-white/40 text-[11px]">MC {fmtUsd(s.market_cap)} · {ago(s.created_at)}{s.source ? ` · ${s.source}` : ""}</div>
            <div className="text-white/25 text-[10px] font-mono truncate mt-1">{s.mint}</div>
            <div className="mt-2 flex items-center gap-1 text-og-lime text-[11px] font-bold">Open report <ExternalLink className="h-3 w-3" /></div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [view, setView] = useState<"scans" | "reports">("scans");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [preview, setPreview] = useState<Report | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data }, { data: sc }] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(60),
        supabase.from("scan_log").select("mint,symbol,name,og_score,market_cap,price_usd,source,created_at").order("created_at", { ascending: false }).limit(150),
      ]);
      setReports((data as Report[]) || []);
      const seen = new Set<string>(); const uniq: Scan[] = [];
      for (const row of ((sc as Scan[]) || [])) { if (!row.mint || seen.has(row.mint)) continue; seen.add(row.mint); uniq.push(row); if (uniq.length >= 60) break; }
      setScans(uniq);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Fetch report HTML for the live preview modal.
  useEffect(() => {
    if (!preview) { setPreviewHtml(null); return; }
    let alive = true;
    setPreviewHtml(null);
    (async () => {
      try {
        const res = await fetch(sourceUrl(preview));
        const text = await res.text();
        if (alive) setPreviewHtml(text);
      } catch {
        if (alive) setPreviewHtml("<p style='font:16px system-ui;padding:24px'>Failed to load report.</p>");
      }
    })();
    return () => { alive = false; };
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const download = async (r: Report) => {
    setDownloading(r.id);
    try {
      const res = await fetch(sourceUrl(r));
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      const url = URL.createObjectURL(new Blob([text], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url; a.download = fileName(r);
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch {
      toast.error("Download failed");
    } finally { setDownloading(null); }
  };

  return (
    <AppLayout>
      <PageHeader title="Reports" description="Live token scans + AI-generated reports from the bot" />
      <div className="px-4 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-2">
          {([["scans","Scans"],["reports","AI Reports"]] as const).map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition ${view===v ? "bg-primary text-primary-foreground" : "border border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-24 max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-white/40 text-[12px]">{view === "scans" ? `${scans.length} scan${scans.length===1?"":"s"}` : `${reports.length} report${reports.length===1?"":"s"}`}</div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {view === "scans" ? (
          <ScansGrid scans={scans} loading={loading} />
        ) : loading && !reports.length ? (
          <div className="flex items-center gap-2 text-white/40 text-[13px] p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports…</div>
        ) : reports.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reports.map((r) => (
              <Card key={r.id} className="glass-card p-4 flex flex-col">
                <button onClick={() => setPreview(r)} className="text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="h-4 w-4 text-og-lime shrink-0" />
                    <span className="font-semibold text-white/90 text-[14px] truncate">{titleOf(r)}</span>
                    <Badge variant="outline" className="ml-auto text-[9px] uppercase shrink-0">{r.source || "bot"}</Badge>
                  </div>
                  {r.instructions ? (
                    <div className="text-white/45 text-[11px] flex items-start gap-1 mb-1.5"><Sparkles className="h-3 w-3 mt-0.5 text-og-cyan shrink-0" /><span className="line-clamp-2">{r.instructions}</span></div>
                  ) : null}
                  {r.token_mint ? <div className="text-white/25 text-[10px] font-mono truncate">{r.token_mint}</div> : null}
                  <div className="text-white/30 text-[10px] mt-0.5 mb-3">{ago(r.created_at)}</div>
                </button>

                <div className="flex items-center gap-2 mt-auto">
                  <Button size="sm" onClick={() => setPreview(r)}
                    className="flex-1 rounded-xl bg-og-lime/90 text-black hover:bg-og-lime font-bold">
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                  </Button>
                  <Button size="sm" variant="outline" disabled={downloading === r.id} onClick={() => download(r)} title="Download" className="rounded-xl">
                    {downloading === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </Button>
                  <a href={shareUrl(r)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="rounded-xl" title="Open in new tab"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-white/30 text-[13px] p-4">No reports yet. Generate one with <code className="text-white/50">/report &lt;ca&gt;</code> in the bot.</div>
        )}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between gap-2 px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <div className="text-white font-semibold text-[14px] truncate">{titleOf(preview)}</div>
              {preview.instructions ? <div className="text-white/40 text-[11px] truncate">“{preview.instructions}”</div> : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => download(preview)} className="rounded-xl"><Download className="h-3.5 w-3.5 mr-1.5" /> Download</Button>
              <a href={shareUrl(preview)} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="rounded-xl"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
              <Button size="sm" variant="outline" onClick={() => setPreview(null)} className="rounded-xl"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex-1 mx-2 mb-2 rounded-xl overflow-hidden bg-white relative" onClick={(e) => e.stopPropagation()}>
            {previewHtml == null ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white text-black/50 text-[13px]"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading report…</div>
            ) : (
              <iframe title="report-preview" srcDoc={previewHtml} className="w-full h-full" sandbox="allow-scripts allow-popups allow-same-origin" />
            )}
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
