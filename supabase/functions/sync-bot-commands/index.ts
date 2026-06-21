// sync-bot-commands — pushes the full command menu to EVERY connected bot
// (base commands + each bot's custom commands), so all bots come pre-installed
// with every command. Safe to run anytime; also scheduled weekly via pg_cron.
// verify_jwt=false (called by cron / admin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

const BASE_COMMANDS = [
  { command: "chat", description: "Chat with the AI analyst" },
  { command: "scan", description: "Full token risk report" },
  { command: "report", description: "PDF intelligence report" },
  { command: "wallet", description: "Wallet portfolio snapshot" },
  { command: "pnl", description: "Wallet PnL (last 100 txns)" },
  { command: "holders", description: "Top holder distribution" },
  { command: "watch", description: "Watch a token for price moves" },
  { command: "watchlist", description: "Show your watchlist" },
  { command: "trending", description: "Top trending tokens (24h)" },
  { command: "price", description: "Price + stats for any coin" },
  { command: "btc", description: "Bitcoin price" },
  { command: "eth", description: "Ethereum price" },
  { command: "sol", description: "Solana price" },
  { command: "global", description: "Global market cap + dominance" },
  { command: "fear", description: "Crypto Fear & Greed index" },
  { command: "tvl", description: "DeFi TVL by chain" },
  { command: "news", description: "Latest crypto headlines" },
  { command: "alpha", description: "Community alpha callouts" },
  { command: "migrations", description: "Pump.fun graduations (last 24h)" },
  { command: "alerts", description: "Migration alerts: on | off" },
  { command: "digest", description: "Daily digest: on | off" },
  { command: "help", description: "Show commands" },
];

Deno.serve(async () => {
  try {
    const { data: bots } = await admin.from("telegram_bots").select("id, bot_token");
    let synced = 0, failed = 0;
    for (const b of bots || []) {
      try {
        const { data: customs } = await admin
          .from("telegram_custom_commands")
          .select("command, description, enabled")
          .eq("bot_id", b.id).eq("enabled", true).limit(50);
        const extra = (customs || []).map((c: any) => ({ command: c.command, description: (c.description || "Custom command").slice(0, 256) }));
        const commands = [...BASE_COMMANDS, ...extra].slice(0, 100);
        const r = await fetch(`https://api.telegram.org/bot${b.bot_token}/setMyCommands`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commands }),
        });
        const j = await r.json();
        if (j.ok) synced++; else failed++;
      } catch { failed++; }
    }
    return json({ ok: true, bots: (bots || []).length, synced, failed });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
