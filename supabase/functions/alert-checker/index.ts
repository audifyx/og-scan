// alert-checker — scheduled (pg_cron). Evaluates alert_rules and delivers to
// Discord or custom webhooks. verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const DISCORD_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const COOLDOWN_MS = 45 * 60 * 1000;

function fUsd(n: any) { const v = Number(n); if (!isFinite(v) || !v) return "?"; if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B"; if (v>=1e6) return "$"+(v/1e6).toFixed(2)+"M"; if (v>=1e3) return "$"+(v/1e3).toFixed(1)+"K"; return "$"+v.toFixed(2); }

async function scan(mint: string): Promise<any> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/og-scan-token`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE }, body: JSON.stringify({ query: mint }), signal: AbortSignal.timeout(20000) });
    return await r.json();
  } catch { return null; }
}
async function migrations(): Promise<any[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pumpfun-migrations`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE }, body: JSON.stringify({ hours: 1, limit: 30 }), signal: AbortSignal.timeout(20000) });
    const j = await r.json(); return j.migrations || [];
  } catch { return []; }
}

async function deliver(rule: any, title: string, lines: string[], url?: string) {
  const isDiscord = rule.channel_type === "discord" || DISCORD_RE.test(rule.webhook_url);
  const body = isDiscord
    ? { username: "OG Scan Alerts", embeds: [{ title, description: lines.join("\n"), color: 3329330, url: url || undefined, footer: { text: "OG Scan \u00b7 NFA" } }] }
    : { source: "ogscan", event: "alert", title, message: lines.join("\n"), url: url || null, ts: new Date().toISOString() };
  try { await fetch(rule.webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch (e) { console.error("deliver", e); }
}

function evalToken(rule: any, t: any): { fired: boolean; reasons: string[]; newState: any } {
  const last = rule.last_value || {};
  const reasons: string[] = [];
  const state: any = { price: t.priceUsd, mcap: t.mcap, liquidity: t.liquidity, holders: t.holderCount, maxMcap: Math.max(last.maxMcap || 0, t.mcap || 0) };
  const cur: Record<string, any> = { price: t.priceUsd, mcap: t.mcap, liquidity: t.liquidity, holders: t.holderCount };
  for (const c of (rule.conditions || [])) {
    try {
      if (c.metric === "price_change_pct") {
        const map: Record<string, any> = { "5m": t.priceChange5m, "1h": t.priceChange1h, "6h": t.priceChange6h, "24h": t.priceChange24h };
        const ch = Number(map[c.window || "24h"]);
        if (!isFinite(ch)) continue;
        if (c.direction === "down" && ch <= -Math.abs(c.value)) reasons.push(`${c.window || "24h"} down ${ch.toFixed(1)}% (\u2264 -${c.value}%)`);
        else if ((c.direction || "up") === "up" && ch >= Math.abs(c.value)) reasons.push(`${c.window || "24h"} up +${ch.toFixed(1)}% (\u2265 ${c.value}%)`);
      } else if (["mcap", "price", "liquidity", "holders"].includes(c.metric)) {
        const v = Number(cur[c.metric]); const lv = Number(last[c.metric]); const thr = Number(c.value);
        if (!isFinite(v)) continue;
        if (c.op === "above" && v >= thr && (!isFinite(lv) || lv < thr)) reasons.push(`${c.metric} crossed above ${c.metric === "holders" ? thr : fUsd(thr)} (now ${c.metric === "holders" ? v : fUsd(v)})`);
        if (c.op === "below" && v <= thr && (!isFinite(lv) || lv > thr)) reasons.push(`${c.metric} dropped below ${c.metric === "holders" ? thr : fUsd(thr)} (now ${c.metric === "holders" ? v : fUsd(v)})`);
      } else if (c.metric === "new_ath") {
        if ((t.mcap || 0) > (last.maxMcap || 0) && (last.maxMcap || 0) > 0) reasons.push(`new ATH market cap ${fUsd(t.mcap)}`);
      }
    } catch { /* skip */ }
  }
  return { fired: reasons.length > 0, reasons, newState: state };
}

Deno.serve(async () => {
  try {
    const { data: rules } = await admin.from("alert_rules").select("*").eq("enabled", true);
    if (!rules || !rules.length) return json({ ok: true, checked: 0 });
    const now = Date.now();
    let fired = 0;
    // group token rules by mint to scan once
    const mintSet = [...new Set(rules.filter((r: any) => r.type === "token" && r.mint).map((r: any) => r.mint))];
    const scans: Record<string, any> = {};
    await Promise.all(mintSet.map(async (m: string) => { const s = await scan(m); if (s?.ok) scans[m] = s.token; }));
    const migs = rules.some((r: any) => r.type === "migrations") ? await migrations() : [];

    for (const rule of rules) {
      const cooled = !rule.last_fired_at || (now - new Date(rule.last_fired_at).getTime()) > COOLDOWN_MS;
      if (rule.type === "migrations") {
        const lastTs = rule.last_value?.lastTs ? new Date(rule.last_value.lastTs).getTime() : (now - 6 * 60 * 1000);
        const fresh = migs.filter((m: any) => new Date(m.migratedAt).getTime() > lastTs).slice(0, 5);
        if (fresh.length) {
          for (const m of fresh) await deliver(rule, "\uD83D\uDE80 Pump.fun migration", [`$${m.symbol || m.mint.slice(0,6)} \u00b7 MC ${fUsd(m.marketCap)} \u00b7 Liq ${fUsd(m.liquidityUsd)}`, m.mint], m.dexUrl);
          const maxTs = Math.max(...migs.map((m: any) => new Date(m.migratedAt).getTime()));
          await admin.from("alert_rules").update({ last_fired_at: new Date().toISOString(), last_value: { lastTs: new Date(maxTs).toISOString() } }).eq("id", rule.id);
          fired += fresh.length;
        } else if (!rule.last_value?.lastTs && migs.length) {
          const maxTs = Math.max(...migs.map((m: any) => new Date(m.migratedAt).getTime()));
          await admin.from("alert_rules").update({ last_value: { lastTs: new Date(maxTs).toISOString() } }).eq("id", rule.id);
        }
        continue;
      }
      // token
      const t = scans[rule.mint]; if (!t) continue;
      const { fired: hit, reasons, newState } = evalToken(rule, t);
      if (hit && cooled) {
        await deliver(rule, `\uD83D\uDD14 $${t.symbol || rule.symbol || "token"} alert`, [...reasons, `Price ${t.priceUsd != null ? "$" + Number(t.priceUsd).toPrecision(4) : "?"} \u00b7 MC ${fUsd(t.mcap)}`, t.mint], t.dexUrl);
        await admin.from("alert_rules").update({ last_fired_at: new Date().toISOString(), last_value: newState }).eq("id", rule.id);
        fired++;
      } else {
        await admin.from("alert_rules").update({ last_value: newState }).eq("id", rule.id);
      }
    }
    return json({ ok: true, rules: rules.length, fired });
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
