// track-record — refreshes current prices for recently-scanned tokens and
// updates each scan_log row's peak market cap + peak multiple (Grim's track
// record). Also auto-posts big wins (>=5x) to opted-in X accounts.
// Cron every ~30 min. Deploy --no-verify-jwt.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const H = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" };

const fmtUsd = (n: any) => {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "$?";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
};

async function rest(path: string): Promise<any[]> {
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H }); return await r.json(); }
  catch { return []; }
}

// DexScreener marketCap/price for up to 30 mints at once.
async function priceBatch(mints: string[]): Promise<Record<string, { price: number; mcap: number }>> {
  const out: Record<string, { price: number; mcap: number }> = {};
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints.join(",")}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const byMint: Record<string, any[]> = {};
    for (const p of j.pairs || []) {
      const m = p.baseToken?.address;
      if (!m) continue;
      (byMint[m] ||= []).push(p);
    }
    for (const [m, pairs] of Object.entries(byMint)) {
      const top = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const mcap = Number(top.marketCap ?? top.fdv ?? 0);
      const price = Number(top.priceUsd ?? 0);
      if (mcap > 0 || price > 0) out[m] = { price, mcap };
    }
  } catch { /* ignore */ }
  return out;
}

Deno.serve(async () => {
  try {
    const since = new Date(Date.now() - 45 * 86400_000).toISOString();
    const stale = new Date(Date.now() - 25 * 60_000).toISOString();
    // Rows needing a refresh; dedupe to distinct mints (cap the run).
    const rows = await rest(`scan_log?select=mint&created_at=gte.${since}&or=(last_checked_at.is.null,last_checked_at.lt.${stale})&order=last_checked_at.asc.nullsfirst&limit=600`);
    const mints = [...new Set(rows.map((r: any) => r.mint))].slice(0, 90);
    if (!mints.length) return json({ ok: true, updated: 0, note: "nothing stale" });

    let priced = 0;
    const updates: { mint: string; price: number; mcap: number }[] = [];
    for (let i = 0; i < mints.length; i += 30) {
      const batch = mints.slice(i, i + 30);
      const map = await priceBatch(batch);
      for (const m of batch) if (map[m]) { updates.push({ mint: m, price: map[m].price, mcap: map[m].mcap }); priced++; }
    }
    if (updates.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_scan_prices`, { method: "POST", headers: H, body: JSON.stringify({ updates }) }).catch(() => {});
    }

    // Auto-post big wins (>=5x) once, to opted-in X accounts.
    let winsPosted = 0;
    const wins = await rest(`scan_log?select=id,mint,symbol,market_cap,peak_market_cap,peak_multiple&win_posted=eq.false&peak_multiple=gte.5&market_cap=gte.5000&order=peak_multiple.desc&limit=10`);
    if (wins.length) {
      const xAccts = await rest(`x_accounts?select=user_id&enabled=eq.true&auto_reports=eq.true`);
      for (const w of wins) {
        if (xAccts.length) {
          const mult = Number(w.peak_multiple).toFixed(1);
          const text = `\u{1F480} Grim called $${w.symbol || w.mint.slice(0, 6)} at ${fmtUsd(w.market_cap)} mcap \u2014 now ${fmtUsd(w.peak_market_cap)} (${mult}x).\nhttps://dexscreener.com/solana/${w.mint}`;
          for (const x of xAccts) {
            await fetch(`${SUPABASE_URL}/functions/v1/x-poster`, { method: "POST", headers: H, body: JSON.stringify({ action: "post", user_id: x.user_id, text, imageUrl: `${SUPABASE_URL}/functions/v1/og-card?mint=${w.mint}` }) }).catch(() => {});
            winsPosted++;
          }
        }
        await fetch(`${SUPABASE_URL}/rest/v1/scan_log?id=eq.${w.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ win_posted: true }) }).catch(() => {});
      }
    }

    return json({ ok: true, mints: mints.length, priced, updates: updates.length, winsPosted });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
