// watch-checker — scheduled (pg_cron). Alerts watchlist chats when a watched
// token moves >= threshold since last alert. verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const THRESHOLD = 25; // percent move to trigger an alert

async function prices(mints: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < mints.length; i += 50) {
    const batch = mints.slice(i, i + 50);
    try {
      const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${batch.join(",")}`, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      for (const m of batch) { const p = j[m]?.usdPrice; if (p != null) out[m] = Number(p); }
    } catch { /* ignore */ }
  }
  return out;
}

Deno.serve(async () => {
  try {
    const { data: watches } = await admin.from("telegram_watchlist").select("*");
    if (!watches || !watches.length) return json({ ok: true, checked: 0 });
    const mints = [...new Set(watches.map((w: any) => w.mint))];
    const px = await prices(mints);
    const { data: bots } = await admin.from("telegram_bots").select("id, bot_token");
    const botMap: Record<string, any> = {}; for (const b of bots || []) botMap[b.id] = b;
    let alerts = 0;
    for (const w of watches) {
      const cur = px[w.mint]; if (cur == null) continue;
      const base = Number(w.last_price);
      if (!base || !isFinite(base)) { await admin.from("telegram_watchlist").update({ last_price: cur }).eq("id", w.id); continue; }
      const change = ((cur - base) / base) * 100;
      if (Math.abs(change) >= THRESHOLD) {
        const b = botMap[w.bot_id];
        if (b) {
          const arrow = change >= 0 ? "\uD83D\uDFE2 \u25B2" : "\uD83D\uDD34 \u25BC";
          const text = `${arrow} <b>$${(w.symbol||"?")}</b> ${change>=0?"+":""}${change.toFixed(1)}%\nNow $${cur.toPrecision(4)} (was $${base.toPrecision(4)})\n<code>${w.mint}</code>`;
          await fetch(`https://api.telegram.org/bot${b.bot_token}/sendMessage`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ chat_id: w.chat_id, text, parse_mode:"HTML", disable_web_page_preview:true }) }).catch(()=>{});
          alerts++;
        }
        await admin.from("telegram_watchlist").update({ last_price: cur }).eq("id", w.id);
      }
    }
    return json({ ok: true, checked: watches.length, alerts });
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
