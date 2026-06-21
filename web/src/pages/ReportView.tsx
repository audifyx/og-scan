import { useEffect, useMemo, useState, useCallback, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase, SUPABASE_URL } from "@/lib/supabase";

type ReportMeta = {
  id: string; instructions: string | null; token_name: string | null;
  token_symbol: string | null; token_mint: string | null; created_at: string;
};
type Live = {
  name?: string; symbol?: string; image?: string | null;
  priceUsd?: number | null; mcap?: number | null; liquidity?: number | null;
  holderCount?: number | null; momentum?: number | null; priceChange24h?: number | null;
  score?: number | null; verdict?: string | null;
};

const fmtUsd = (n: any) => {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "--";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  if (v >= 1) return "$" + v.toFixed(2);
  return "$" + v.toPrecision(3);
};
const fmtNum = (n: any) => { const v = Number(n); return isFinite(v) ? v.toLocaleString() : "--"; };
const scoreColor = (s: number) => s >= 80 ? "#22e38a" : s >= 60 ? "#b6f23d" : s >= 40 ? "#fbbf24" : "#f87171";

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [error, setError] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  // report HTML
  useEffect(() => {
    if (!id) return;
    let on = true;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/report-view?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error();
        const text = await res.text();
        if (on) setHtml(text);
      } catch { if (on) setError(true); }
    })();
    return () => { on = false; };
  }, [id]);

  // report metadata
  useEffect(() => {
    if (!id) return;
    let on = true;
    (async () => {
      const { data } = await supabase.from("reports")
        .select("id, instructions, token_name, token_symbol, token_mint, created_at")
        .eq("id", id).maybeSingle();
      if (on && data) setMeta(data as ReportMeta);
    })();
    return () => { on = false; };
  }, [id]);

  const loadLive = useCallback(async (mint: string) => {
    try {
      const { data } = await supabase.functions.invoke("og-scan-token", { body: { query: mint, source: "report-page" } });
      if (data?.ok && data.token) {
        setLive({
          name: data.token.name, symbol: data.token.symbol, image: data.token.image || data.token.icon,
          priceUsd: data.token.priceUsd, mcap: data.token.mcap, liquidity: data.token.liquidity,
          holderCount: data.token.holderCount, momentum: data.token.momentum, priceChange24h: data.token.priceChange24h,
          score: data.score?.total ?? null, verdict: data.verdict ?? null,
        });
        setUpdatedAt(Date.now());
      }
    } catch { /* ignore */ }
  }, []);

  // live stats + auto-refresh every 45s
  useEffect(() => {
    const mint = meta?.token_mint;
    if (!mint) return;
    loadLive(mint);
    const t = setInterval(() => loadLive(mint), 45000);
    return () => clearInterval(t);
  }, [meta?.token_mint, loadLive]);

  // dynamic SEO meta
  useEffect(() => {
    const sym = live?.symbol || meta?.token_symbol;
    const name = live?.name || meta?.token_name;
    if (!name && !sym) return;
    document.title = `${name || sym} ${sym ? `($${sym})` : ""} — OG Scan report`;
    const setMetaTag = (attr: string, key: string, val: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.content = val;
    };
    const desc = `OG Scan intelligence report for ${name || sym}${live?.score != null ? ` — Grim score ${live.score}/100` : ""}. Live price, market cap, holders and AI analysis.`;
    setMetaTag("name", "description", desc);
    setMetaTag("property", "og:title", `${name || sym} — OG Scan report`);
    setMetaTag("property", "og:description", desc);
  }, [live, meta]);

  const rerun = useCallback(async () => {
    const mint = meta?.token_mint; if (!mint) return;
    setRerunning(true);
    try {
      const { data } = await supabase.functions.invoke("og-report-pdf", { body: { query: mint, instructions: meta?.instructions || "" } });
      const url = data?.public_url || data?.url;
      const newId = url ? url.split("/r/")[1]?.split(/[?#]/)[0] : null;
      if (newId) { window.location.href = `/r/${newId}`; return; }
      // fallback: refresh current report html
      const res = await fetch(`${SUPABASE_URL}/functions/v1/report-view?id=${id}`);
      setHtml(await res.text());
    } finally { setRerunning(false); }
  }, [meta, id]);

  const ago = useMemo(() => {
    if (!updatedAt) return "";
    const s = Math.floor((Date.now() - updatedAt) / 1000);
    return s < 5 ? "just now" : `${s}s ago`;
  }, [updatedAt]);

  if (error) return <Centered>Report not found.</Centered>;

  const sym = live?.symbol || meta?.token_symbol || "";
  const name = live?.name || meta?.token_name || "Token";
  const change = live?.priceChange24h;
  const up = (change ?? 0) >= 0;
  const score = live?.score ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#07080b", color: "#e8edf2", display: "flex", flexDirection: "column", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Living header */}
      <div style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(900px 240px at 12% -40%, rgba(182,242,61,0.16), transparent), radial-gradient(700px 200px at 90% -60%, rgba(34,211,238,0.12), transparent)" }} />
        <div style={{ position: "relative", maxWidth: 1100, margin: "0 auto", padding: "16px 18px" }}>
          {/* top row: brand + actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ height: 26, width: 26, borderRadius: 8, border: "1px solid rgba(182,242,61,0.5)", background: "rgba(182,242,61,0.1)", display: "grid", placeItems: "center", color: "#b6f23d", fontWeight: 900, fontSize: 13 }}>OG</div>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>OG SCAN</span>
            </a>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn onClick={rerun} primary disabled={rerunning}>{rerunning ? "Re-running…" : "↻ Re-run AI take"}</Btn>
              <a href="/app" style={btnStyle(false)}>Scan your own →</a>
            </div>
          </div>

          {/* token identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {live?.image ? (
              <img src={live.image} alt={sym} style={{ height: 56, width: 56, borderRadius: 14, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
            ) : (
              <div style={{ height: 56, width: 56, borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>{name}</h1>
                {sym ? <span style={{ color: "#8b94a0", fontWeight: 700, fontSize: 14 }}>${sym}</span> : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{fmtUsd(live?.priceUsd)}</span>
                {change != null && (
                  <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 999, color: up ? "#22e38a" : "#f87171", background: up ? "rgba(34,227,138,0.12)" : "rgba(248,113,113,0.12)" }}>
                    {up ? "▲" : "▼"} {Math.abs(Number(change)).toFixed(1)}% 24h
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6b7280", marginLeft: 4 }}>
                  <span style={{ height: 7, width: 7, borderRadius: 999, background: "#22e38a", boxShadow: "0 0 8px #22e38a", display: "inline-block" }} />
                  LIVE {ago && `· ${ago}`}
                </span>
              </div>
            </div>
            {score != null && (
              <div style={{ marginLeft: "auto", textAlign: "center", padding: "8px 16px", borderRadius: 14, border: `1px solid ${scoreColor(score)}55`, background: `${scoreColor(score)}14` }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 9, color: "#8b94a0", fontWeight: 700, letterSpacing: 1, marginTop: 2 }}>GRIM SCORE</div>
              </div>
            )}
          </div>

          {/* stat tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 16 }}>
            <Stat label="Market Cap" value={fmtUsd(live?.mcap)} />
            <Stat label="Liquidity" value={fmtUsd(live?.liquidity)} />
            <Stat label="Holders" value={fmtNum(live?.holderCount)} />
            <Stat label="Momentum" value={live?.momentum != null ? `${live.momentum}/100` : "--"} />
          </div>
          {meta?.instructions ? (
            <div style={{ marginTop: 12, fontSize: 12, color: "#8b94a0", fontStyle: "italic" }}>“{meta.instructions}”</div>
          ) : null}
        </div>
      </div>

      {/* report body */}
      <div style={{ flex: 1, minHeight: "60vh", background: "#fff" }}>
        {html == null ? (
          <Centered>Loading report…</Centered>
        ) : (
          <iframe title="OG Scan report" srcDoc={html} sandbox="allow-scripts allow-popups allow-same-origin"
            style={{ border: "none", width: "100%", height: "100%", minHeight: "70vh", display: "block" }} />
        )}
      </div>

      {/* footer CTA */}
      <div style={{ textAlign: "center", padding: "18px", borderTop: "1px solid rgba(255,255,255,0.07)", fontSize: 13, color: "#8b94a0" }}>
        Generated by <a href="/" style={{ color: "#b6f23d", textDecoration: "none", fontWeight: 700 }}>OG Scan</a> — AI token intelligence for Solana. <a href="/app" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>Scan any token →</a>
      </div>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
    <div style={{ fontSize: 9, color: "#6b7280", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 3 }}>{value}</div>
  </div>
);

const btnStyle = (primary: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10,
  fontSize: 12, fontWeight: 800, textDecoration: "none", cursor: "pointer",
  border: primary ? "none" : "1px solid rgba(255,255,255,0.12)",
  background: primary ? "#b6f23d" : "rgba(255,255,255,0.04)", color: primary ? "#07080b" : "#e8edf2",
});
const Btn = ({ children, onClick, primary, disabled }: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled} style={{ ...btnStyle(!!primary), opacity: disabled ? 0.6 : 1 }}>{children}</button>
);
const Centered = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "#8b94a0", font: "15px system-ui", background: "#07080b" }}>{children}</div>
);
