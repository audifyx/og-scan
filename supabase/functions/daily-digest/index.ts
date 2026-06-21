// daily-digest — scheduled (pg_cron). Sends a daily market digest (trending +
// pump.fun migrations + headlines) to every enabled alert chat whose bot has
// digest_enabled. verify_jwt=false (called by cron).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

function fmtUsd(n: any) { const v = Number(n); if (!isFinite(v) || !v) return "?"; if (v >= 1e9) return "$" + (v/1e9).toFixed(2)+"B"; if (v>=1e6) return "$"+(v/1e6).toFixed(2)+"M"; if (v>=1e3) return "$"+(v/1e3).toFixed(1)+"K"; return "$"+v.toFixed(2); }
const esc = (s: string) => (s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const dec = (s: string) => (s||"").replace(/&#(\d+);/g,(_m,n)=>String.fromCharCode(+n)).replace(/&amp;/g,"&").replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCharCode(parseInt(n,16)));

async function buildDigest(): Promise<string> {
  const parts: string[] = [`\uD83C\uDF05 <b>OG Scan Daily Digest</b>`];
  // Trending
  try {
    const r = await fetch("https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=5", { signal: AbortSignal.timeout(8000) });
    const arr = await r.json();
    if (Array.isArray(arr) && arr.length) {
      parts.push("\n\uD83D\uDD25 <b>Trending (24h)</b>\n" + arr.slice(0,5).map((t:any,i:number)=>{
        const ch=t.stats24h?.priceChange; const c=ch==null?"":` (${ch>=0?"+":""}${Number(ch).toFixed(0)}%)`;
        return `${i+1}. $${esc(t.symbol||"?")} \u00B7 ${fmtUsd(t.mcap)}${c}`;
      }).join("\n"));
    }
  } catch { /* ignore */ }
  // Migrations
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pumpfun-migrations`, { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${SERVICE_ROLE}`, apikey:SERVICE_ROLE }, body: JSON.stringify({ hours:24, limit:5 }), signal: AbortSignal.timeout(10000) });
    const j = await r.json(); const migs = j.migrations || [];
    if (migs.length) parts.push("\n\uD83D\uDE80 <b>Pump.fun migrations (24h)</b>\n" + migs.slice(0,5).map((m:any,i:number)=>`${i+1}. $${esc(m.symbol||m.mint.slice(0,5))} \u00B7 MC ${fmtUsd(m.marketCap)}`).join("\n"));
  } catch { /* ignore */ }
  // News
  try {
    const { data } = await admin.from("crypto_news").select("title, sentiment").order("published_at",{ ascending:false, nullsFirst:false }).limit(3);
    if (data && data.length) parts.push("\n\uD83D\uDCF0 <b>Headlines</b>\n" + data.map((n:any,i:number)=>{ const e=(n.sentiment||"").toLowerCase().includes("bull")?"\uD83D\uDFE2":(n.sentiment||"").toLowerCase().includes("bear")?"\uD83D\uDD34":"\u26AA"; return `${i+1}. ${e} ${esc(dec(n.title||""))}`; }).join("\n"));
  } catch { /* ignore */ }
  parts.push("\n<i>Powered by OG Scan \u00B7 /help for commands</i>");
  return parts.join("\n");
}

Deno.serve(async () => {
  try {
    const text = await buildDigest();
    const { data: bots } = await admin.from("telegram_bots").select("id, bot_token");
    const botMap: Record<string, any> = {}; for (const b of bots || []) botMap[b.id] = b;
    const { data: chats } = await admin.from("telegram_alert_chats").select("bot_id, chat_id, enabled, digest_enabled").eq("enabled", true).eq("digest_enabled", true);
    let sent = 0;
    for (const c of chats || []) {
      const b = botMap[c.bot_id]; if (!b) continue;
      await fetch(`https://api.telegram.org/bot${b.bot_token}/sendMessage`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ chat_id: c.chat_id, text, parse_mode:"HTML", disable_web_page_preview:true }) }).catch(()=>{});
      sent++;
    }
    return json({ ok: true, sent });
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
