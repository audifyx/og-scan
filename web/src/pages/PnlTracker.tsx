import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/* ── formatting ── */
const fmtUsd = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n); const s = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${s}$${(a / 1_000).toFixed(2)}K`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  return `${s}$${a.toFixed(a < 0.01 ? 6 : 4)}`;
};
const fmtNum = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1_000_000) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1_000) return `${(n / 1e3).toFixed(2)}K`;
  return `${Math.round(n)}`;
};
const fmtMc = (n: number | null | undefined) => (n == null ? "—" : fmtUsd(n));

interface Trade { ts: number; type: "buy" | "sell"; tokens: number; sol: number; priceUsd: number; mc: number | null; }
interface Scan {
  token: { symbol: string; name: string; priceUsd: number; marketCap: number; supply: number | null; image: string | null };
  solUsd: number; truncated: boolean; trades: Trade[];
  stats: {
    boughtTok: number; boughtSol: number; soldTok: number; soldSol: number; remainingTok: number;
    avgBuyPriceUsd: number; avgSellPriceUsd: number; avgBuyMc: number | null; avgSellMc: number | null;
    realizedPnlUsd: number; unrealizedPnlUsd: number; totalPnlUsd: number; investedUsd: number; roi: number;
    remainingValueUsd: number; soldSupplyWorthNow: number; missedGainsUsd: number; jeeted: boolean;
    currentPriceUsd: number; currentMc: number;
  };
  scenarios: { mult: number; mc: number; remainingValue: number }[];
}

export default function PnlTracker() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState("");
  const [ca, setCa] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<Scan | null>(null);
  const cardRef = useRef<HTMLCanvasElement>(null);

  const scan = async () => {
    const w = wallet.trim(), m = ca.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) { setError("Enter a valid wallet address."); return; }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)) { setError("Enter a valid token contract address."); return; }
    setError(""); setLoading(true); setData(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("pnl-scan", { body: { wallet: w, mint: m } });
      if (err) throw err;
      if (!res?.ok) throw new Error(res?.error || "Scan failed");
      setData(res as Scan);
    } catch (e: any) { setError(e?.message || "Scan failed. Try again."); }
    finally { setLoading(false); }
  };

  const green = "#34d399", red = "#fb7185", accent = "#F97316";

  /* ── shareable PNG card ── */
  const downloadCard = () => {
    if (!data) return;
    const s = data.stats, W = 1200, H = 630;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0a0e17"); g.addColorStop(1, "#05070c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // accent glow
    const rg = ctx.createRadialGradient(W - 200, 120, 40, W - 200, 120, 420);
    rg.addColorStop(0, "rgba(249,115,22,0.28)"); rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    const up = s.totalPnlUsd >= 0;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "bold 26px system-ui";
    ctx.fillText("PNL TRACKER · ogscan.fun", 60, 54);
    ctx.fillStyle = "#fff"; ctx.font = "900 64px system-ui";
    ctx.fillText(`$${data.token.symbol}`, 60, 110);
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "500 24px system-ui";
    ctx.fillText(`${data.wallet ? data.wallet.slice(0, 4) + "…" + data.wallet.slice(-4) : ""}`, 60, 190);
    // big PnL
    ctx.fillStyle = up ? green : red; ctx.font = "900 120px system-ui";
    ctx.fillText(`${up ? "+" : "-"}${fmtUsd(Math.abs(s.totalPnlUsd)).replace("-", "")}`, 58, 250);
    ctx.fillStyle = up ? green : red; ctx.font = "800 40px system-ui";
    ctx.fillText(`${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1)}% ROI`, 62, 388);
    // stat row
    const stats: [string, string][] = [
      ["Invested", fmtUsd(s.investedUsd)],
      ["Sold for", fmtUsd(s.soldSol * data.solUsd)],
      ["Holding", fmtUsd(s.remainingValueUsd)],
      ["Sold now worth", fmtUsd(s.soldSupplyWorthNow)],
    ];
    let x = 62; const y = 468;
    for (const [k, v] of stats) {
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "700 20px system-ui"; ctx.fillText(k.toUpperCase(), x, y);
      ctx.fillStyle = "#fff"; ctx.font = "900 34px system-ui"; ctx.fillText(v, x, y + 26);
      x += 275;
    }
    // faded watermark
    ctx.globalAlpha = 0.06; ctx.fillStyle = "#fff"; ctx.font = "900 200px system-ui";
    ctx.fillText("PNL", 720, 360); ctx.globalAlpha = 1;
    ctx.fillStyle = s.jeeted ? red : green; ctx.font = "800 26px system-ui";
    ctx.fillText(s.jeeted ? "🩸 Jeeted early" : "💎 Diamond hands", 62, 600);
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png"); a.download = `pnl-${data.token.symbol}.png`; a.click();
  };

  /* ── printable full report (save as PDF) ── */
  const printReport = () => {
    if (!data) return; const s = data.stats;
    const row = (k: string, v: string) => `<tr><td style="padding:6px 10px;color:#9aa;border-bottom:1px solid #1c2230">${k}</td><td style="padding:6px 10px;color:#fff;font-weight:700;text-align:right;border-bottom:1px solid #1c2230">${v}</td></tr>`;
    const tr = data.trades.map((t) => `<tr><td style="padding:5px 8px;color:${t.type === "buy" ? "#34d399" : "#fb7185"};font-weight:700">${t.type.toUpperCase()}</td><td style="padding:5px 8px;color:#ccc">${new Date(t.ts).toLocaleString()}</td><td style="padding:5px 8px;color:#ccc;text-align:right">${fmtNum(t.tokens)}</td><td style="padding:5px 8px;color:#ccc;text-align:right">${t.sol.toFixed(3)} SOL</td><td style="padding:5px 8px;color:#ccc;text-align:right">${fmtMc(t.mc)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf8"><title>PNL Report — ${data.token.symbol}</title></head>
    <body style="margin:0;background:#05070c;color:#fff;font-family:system-ui;padding:32px">
      <h1 style="margin:0;font-size:26px">PNL Report · $${data.token.symbol}</h1>
      <div style="color:#9aa;font-size:13px;margin-top:4px">Wallet ${data.wallet} · ${new Date().toLocaleString()} · ogscan.fun</div>
      <h2 style="margin:24px 0 8px;font-size:16px">Summary</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${row("Total PNL", fmtUsd(s.totalPnlUsd) + ` (${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1)}% ROI)`)}
        ${row("Realized PNL", fmtUsd(s.realizedPnlUsd))}
        ${row("Unrealized PNL", fmtUsd(s.unrealizedPnlUsd))}
        ${row("Invested", fmtUsd(s.investedUsd))}
        ${row("Bought", `${fmtNum(s.boughtTok)} ${data.token.symbol} · ${s.boughtSol.toFixed(3)} SOL`)}
        ${row("Sold", `${fmtNum(s.soldTok)} ${data.token.symbol} · ${s.soldSol.toFixed(3)} SOL`)}
        ${row("Still holding", `${fmtNum(s.remainingTok)} ${data.token.symbol} · ${fmtUsd(s.remainingValueUsd)}`)}
        ${row("Avg buy MC", fmtMc(s.avgBuyMc))}
        ${row("Avg sell MC", fmtMc(s.avgSellMc))}
        ${row("Current MC", fmtMc(s.currentMc))}
        ${row("Sold supply worth now", fmtUsd(s.soldSupplyWorthNow))}
        ${row("Verdict", s.jeeted ? `Jeeted early — left ${fmtUsd(s.missedGainsUsd)} on the table` : "Held strong")}
      </table>
      <h2 style="margin:24px 0 8px;font-size:16px">Trades (${data.trades.length})${data.truncated ? " — partial history" : ""}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="color:#9aa"><th style="text-align:left;padding:5px 8px">Type</th><th style="text-align:left;padding:5px 8px">Time</th><th style="text-align:right;padding:5px 8px">Tokens</th><th style="text-align:right;padding:5px 8px">SOL</th><th style="text-align:right;padding:5px 8px">MC</th></tr>
        ${tr}
      </table>
      <script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
    </body></html>`;
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
  };

  const s = data?.stats;

  /* ── chart geometry ── */
  const chart = (() => {
    if (!data || data.trades.length === 0) return null;
    const pts = data.trades.filter((t) => t.mc != null) as (Trade & { mc: number })[];
    if (pts.length === 0) return null;
    const mcs = [...pts.map((p) => p.mc), data.stats.currentMc].filter((v) => v > 0);
    const min = Math.min(...mcs), max = Math.max(...mcs);
    const lg = (v: number) => Math.log10(Math.max(v, 1));
    const y = (v: number) => 100 - ((lg(v) - lg(min)) / Math.max(0.0001, lg(max) - lg(min))) * 92 - 4;
    const x = (i: number) => (pts.length === 1 ? 50 : (i / (pts.length - 1)) * 96 + 2);
    return { pts, x, y, curY: y(data.stats.currentMc) };
  })();

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#F97316]/10 blur-[130px]" />
        <div className="absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-[#9945FF]/10 blur-[130px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => navigate("/app")} className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white">← Hub</button>

        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#F97316] to-[#B45309] text-[22px] shadow-[0_10px_30px_-8px_rgba(249,115,22,0.55)]">📈</div>
          <div>
            <h1 className="text-[26px] font-black leading-none tracking-tight">PNL Tracker</h1>
            <p className="mt-1 text-[13px] text-white/45">Drop a wallet + token — scan the chain for your real PnL.</p>
          </div>
        </div>

        {/* form */}
        <div className="mt-5 space-y-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Wallet address" spellCheck={false}
            className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#F97316]/60" />
          <input value={ca} onChange={(e) => setCa(e.target.value)} placeholder="Token contract address (CA)" spellCheck={false}
            className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#F97316]/60" />
          <button onClick={scan} disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#F97316] to-[#f59e0b] py-2.5 text-[15px] font-black text-black transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60">
            {loading ? "Scanning the chain…" : "Scan PNL"}
          </button>
          {error && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-[13px] font-semibold text-rose-300">{error}</div>}
        </div>

        {data && s && (
          <div className="mt-6 space-y-5">
            {/* hero pnl */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5">
              <div className="flex items-center gap-2">
                {data.token.image && <img src={data.token.image} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />}
                <span className="text-[16px] font-black text-white">${data.token.symbol}</span>
                <span className="text-[12px] text-white/40">MC {fmtMc(s.currentMc)}</span>
                <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-black ${s.jeeted ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}>{s.jeeted ? "🩸 Jeeted early" : "💎 Held strong"}</span>
              </div>
              <div className={`mt-3 text-[40px] font-black leading-none ${s.totalPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {s.totalPnlUsd >= 0 ? "+" : "-"}{fmtUsd(Math.abs(s.totalPnlUsd)).replace("-", "")}
              </div>
              <div className={`mt-1.5 text-[15px] font-black ${s.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{s.roi >= 0 ? "+" : ""}{s.roi.toFixed(1)}% ROI</div>
              {data.truncated && <div className="mt-2 text-[11px] text-amber-300/80">⚠ Deep history — showing the most recent ~800 swaps.</div>}
            </div>

            {/* stat grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Realized PNL", fmtUsd(s.realizedPnlUsd), s.realizedPnlUsd >= 0],
                ["Unrealized PNL", fmtUsd(s.unrealizedPnlUsd), s.unrealizedPnlUsd >= 0],
                ["Invested", fmtUsd(s.investedUsd), null],
                ["Bought", `${fmtNum(s.boughtTok)}`, null],
                ["Sold", `${fmtNum(s.soldTok)}`, null],
                ["Still holding", fmtUsd(s.remainingValueUsd), null],
                ["Avg buy MC", fmtMc(s.avgBuyMc), null],
                ["Avg sell MC", fmtMc(s.avgSellMc), null],
                ["Sold supply worth now", fmtUsd(s.soldSupplyWorthNow), null],
              ].map(([k, v, good]) => (
                <div key={k as string} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-widest text-white/35">{k}</div>
                  <div className={`mt-1 text-[17px] font-black tabular-nums ${good == null ? "text-white" : good ? "text-emerald-400" : "text-rose-400"}`}>{v}</div>
                </div>
              ))}
            </div>

            {/* jeet callout */}
            {s.jeeted && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                <div className="text-[14px] font-black text-rose-300">Did you jeet early? Yeah. 🩸</div>
                <div className="mt-1 text-[13px] text-white/60">
                  You sold at ~{fmtMc(s.avgSellMc)} avg; it's now {fmtMc(s.currentMc)}. The supply you sold would be worth <span className="font-black text-white">{fmtUsd(s.soldSupplyWorthNow)}</span> today — about <span className="font-black text-rose-300">{fmtUsd(s.missedGainsUsd)}</span> left on the table.
                </div>
              </div>
            )}

            {/* chart */}
            {chart && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-black text-white">Where you traded vs current MC</span>
                  <span className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="text-emerald-400">● buy</span><span className="text-rose-400">● sell</span><span className="text-[#F97316]">— now</span>
                  </span>
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-44 w-full">
                  <line x1="0" y1={chart.curY} x2="100" y2={chart.curY} stroke="#F97316" strokeWidth="0.5" strokeDasharray="2 1.5" />
                  {chart.pts.map((p, i) => (
                    <circle key={i} cx={chart.x(i)} cy={chart.y(p.mc)} r="1.4" fill={p.type === "buy" ? green : red} />
                  ))}
                </svg>
                <div className="mt-1 flex justify-between text-[10px] text-white/35"><span>first trade</span><span>latest</span></div>
              </div>
            )}

            {/* MC scenarios */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="mb-2 text-[13px] font-black text-white">Your remaining bag at higher MCs</div>
              <div className="grid grid-cols-4 gap-2">
                {data.scenarios.map((sc) => (
                  <div key={sc.mult} className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5 text-center">
                    <div className="text-[10px] font-bold text-white/40">{sc.mult}x · {fmtMc(sc.mc)}</div>
                    <div className="mt-1 text-[15px] font-black text-emerald-400">{fmtUsd(sc.remainingValue)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* exports */}
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadCard} className="flex-1 rounded-xl bg-gradient-to-r from-[#F97316] to-[#f59e0b] py-2.5 text-[14px] font-black text-black transition hover:brightness-110 active:scale-[0.99]">⬇ Shareable card (PNG)</button>
              <button onClick={printReport} className="flex-1 rounded-xl border border-white/15 bg-white/[0.05] py-2.5 text-[14px] font-black text-white transition hover:bg-white/[0.1] active:scale-[0.99]">📄 Full report (PDF)</button>
            </div>
            <canvas ref={cardRef} className="hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
