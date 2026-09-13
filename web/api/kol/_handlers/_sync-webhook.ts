import type { VercelRequest, VercelResponse } from "@vercel/node";

// Manage the Helius webhook's tracked addresses.
// GET  /api/kol/sync-webhook            -> webhook status (url, address count)
// POST /api/kol/sync-webhook { add?: string[], remove?: string[], replace?: string[] }
//   Updates the webhook's accountAddresses (dedup, base58-validated).
const HELIUS_KEY =
  process.env.HELIUS_SECRET || process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || process.env.REACT_APP_HELIUS_KEY || "";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_ADDRESSES = 25_000;

async function getWebhooks() {
  const r = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_KEY}`);
  if (!r.ok) throw new Error(`Helius webhooks list ${r.status}`);
  return (await r.json()) as any[];
}

function pickWebhook(hooks: any[]) {
  if (!Array.isArray(hooks) || !hooks.length) return null;
  // Prefer a webhook pointed at our receiver; else the first one.
  return hooks.find((h) => String(h?.webhookURL || "").includes("/api/kol/webhook")) || hooks[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!HELIUS_KEY) return res.status(500).json({ ok: false, error: "Helius API key not configured (set HELIUS_SECRET in Vercel env)" });

  try {
    const hooks = await getWebhooks();
    const hook = pickWebhook(hooks);

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        webhook: hook
          ? { id: hook.webhookID, url: hook.webhookURL, type: hook.webhookType, addressCount: (hook.accountAddresses || []).length, transactionTypes: hook.transactionTypes || [] }
          : null,
        totalWebhooks: hooks.length,
      });
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "GET or POST only" });
    if (!hook) return res.status(404).json({ ok: false, error: "No Helius webhook found on this API key. Create one in the Helius dashboard first (URL: https://<your-domain>/api/kol/webhook)." });

    const body = (req.body || {}) as { add?: string[]; remove?: string[]; replace?: string[] };
    const clean = (arr?: string[]) => Array.from(new Set((arr || []).map((w) => String(w).trim()).filter((w) => BASE58.test(w))));

    let next: string[];
    if (body.replace) {
      next = clean(body.replace);
    } else {
      const current = new Set<string>((hook.accountAddresses || []).map((w: string) => String(w)));
      for (const w of clean(body.remove)) current.delete(w);
      for (const w of clean(body.add)) current.add(w);
      next = Array.from(current);
    }
    if (next.length > MAX_ADDRESSES) return res.status(400).json({ ok: false, error: `too many addresses (${next.length} > ${MAX_ADDRESSES})` });

    const upd = await fetch(`https://api.helius.xyz/v0/webhooks/${hook.webhookID}?api-key=${HELIUS_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookURL: hook.webhookURL,
        transactionTypes: hook.transactionTypes?.length ? hook.transactionTypes : ["SWAP", "TRANSFER"],
        accountAddresses: next,
        webhookType: hook.webhookType || "enhanced",
        ...(hook.authHeader ? { authHeader: hook.authHeader } : {}),
      }),
    });
    if (!upd.ok) {
      const detail = await upd.text();
      return res.status(502).json({ ok: false, error: `Helius update ${upd.status}`, detail: detail.slice(0, 300) });
    }
    return res.status(200).json({ ok: true, webhookId: hook.webhookID, addressCount: next.length });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
