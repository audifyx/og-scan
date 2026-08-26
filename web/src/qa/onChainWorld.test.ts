import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatPrice } from "../pages/onchain-world/lib/orbitx/format";
import { eventKind, liveToSnapshot, toBreakdown, toLiveEvent } from "../pages/onchain-world/lib/mapLive";
import type { ChainEvent, LivePayload } from "../pages/onchain-world/api";

const WEB = resolve(__dirname, "../..");
const REPO = resolve(WEB, "..");

describe("OrbitX /on-chain world", () => {
  it("exposes the living world as a public route and keeps /onchain proof owner-only", () => {
    const app = readFileSync(resolve(WEB, "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/on-chain" element={<OnChainWorld />} />');
    expect(app).toContain('<Route path="/onchain" element={<OwnerPreviewRoute><OnChainProofPage /></OwnerPreviewRoute>} />');
  });

  it("routes API paths and cron through the on-chain indexer", () => {
    const vercel = readFileSync(resolve(WEB, "vercel.json"), "utf8");
    expect(vercel).toContain('"/api/on-chain/(.*)"');
    expect(vercel).toContain('"/api/on-chain?path=ingest&force=1"');
    expect(vercel).toContain('"api/on-chain.js"');
    const api = readFileSync(resolve(WEB, "api/on-chain.js"), "utf8");
    for (const path of ["live", "events", "wallet", "token", "transaction", "orbitx", "search", "flows", "ingest", "status", "kols", "districts", "trending"]) {
      expect(api).toContain(path);
    }
    expect(api).toContain("activeOrbitxKols");
    expect(api).toContain("assigned_kols");
    expect(api).toContain("handleTrending");
    expect(api).toContain("banner");
    expect(api).not.toContain("sbp_");
  });

  it("mounts a DEX-style 250-coin desk around a 3D galaxy", () => {
    const shell = readFileSync(resolve(WEB, "src/pages/onchain-world/OnChainWorldApp.tsx"), "utf8");
    expect(shell).toContain("useOnChainFeed");
    expect(shell).toContain("<Dashboard />");
    const dash = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/Dashboard.tsx"), "utf8");
    expect(dash).toContain("ox-dash");
    expect(dash).toContain("fixed inset-0");
    expect(dash).toContain("lg:grid-cols-[280px_minmax(0,1fr)_300px]");
    expect(dash).toContain("LiveEvents");
    expect(dash).toContain("WalletPanel");
    expect(dash).toContain("TokenPanel");
    expect(dash).toContain("TrendingFeed");
    expect(dash).toContain("BottomPanel");
    expect(dash).toContain("MobileNav");
    const world = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/WorldView.tsx"), "utf8");
    expect(world).toContain("WorldCanvas");
    expect(world).not.toContain("world-city.jpg");
    expect(world).toContain("tokenLabel");
    const feed = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/TrendingFeed.tsx"), "utf8");
    expect(feed).toContain("Show more");
    expect(feed).toContain("tokenLabel");
    expect(feed).not.toContain("t.mint.slice");
    const tokenPanel = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/TokenPanel.tsx"), "utf8");
    expect(tokenPanel).toContain("banner");
    expect(tokenPanel).toContain("tokenLabel");
    expect(tokenPanel).not.toMatch(/\?\?[^;\n]*\|\|/);
    const nav = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/MobileNav.tsx"), "utf8");
    expect(nav).toContain("World");
    expect(nav).toContain("Feed");
    expect(nav).toContain("Events");
    expect(nav).toContain("Tx");
    expect(nav).toContain("Wallet");
    expect(nav).toContain("lg:hidden");
    const wallet = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/WalletPanel.tsx"), "utf8");
    expect(wallet).toContain("KOL directory");
    expect(wallet).toContain("TRACKED");
    expect(wallet).toContain("Wallet intelligence");
    const breakdown = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/EventBreakdown.tsx"), "utf8");
    expect(breakdown).toContain("Event breakdown");
    const bottom = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/BottomPanel.tsx"), "utf8");
    expect(bottom).toContain("Recent transactions");
    expect(bottom).toContain("OrbitX activity");
    expect(bottom).toContain("Whale movements");
    expect(bottom).toContain("KOL activity");
    const map = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/views/MapView.tsx"), "utf8");
    expect(map).toContain("WORLD_NODES");
    expect(map).toContain("city.kols");
    expect(readFileSync(resolve(WEB, "src/components/theme/OrbitAtmosphereLayer.tsx"), "utf8")).toContain('"/on-chain"');
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/LiveEvents.tsx"), "utf8")).toContain("INDEXING DELAY");
    const oxView = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/views/OrbitxTokenView.tsx"), "utf8");
    expect(oxView).toContain("districts.orbitx");
    expect(oxView).toContain("formatPrice");
    const wallets = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/views/WalletsView.tsx"), "utf8");
    expect(wallets).toContain("city.kols");
    expect(wallets).toContain("Assigned KOLs");
    const analytics = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/views/AnalyticsView.tsx"), "utf8");
    expect(analytics).toContain("districts.tokens");
    expect(analytics).toContain("tokenLabel");
    const hook = readFileSync(resolve(WEB, "src/pages/onchain-world/useOnChainFeed.ts"), "utf8");
    expect(hook).toContain("fetchOrbitx");
    expect(hook).toContain("fetchTrending");
    expect(hook).toContain("getSlot");
    expect(hook).toContain("loadCityDistricts");
    const top = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/TopBar.tsx"), "utf8");
    expect(top).toContain("Search 250 trending");
  });

  it("renders a 3D galaxy of token nodes, official KOLs, holders, and swaps", () => {
    const canvas = readFileSync(resolve(WEB, "src/pages/onchain-world/WorldCanvas.tsx"), "utf8");
    expect(canvas).toContain("function Agent");
    expect(canvas).toContain("function TokenStar");
    expect(canvas).toContain("function Transit");
    expect(canvas).toContain("function OrbitXCore");
    expect(canvas).toContain("function galaxyPos");
    expect(canvas).toContain("DEX_HUBS");
    expect(canvas).toContain("followWallet");
    expect(canvas).toContain("tokenLabel");
    expect(canvas).toContain("EffectComposer");
    expect(canvas).toContain("holderPos");
    expect(canvas).not.toContain("<Line");
    expect(canvas).not.toContain("<Html");
    expect(canvas).not.toContain("world-city.jpg");
    const cssCity = readFileSync(resolve(WEB, "src/pages/onchain-world/CssCity.tsx"), "utf8");
    expect(cssCity).toContain("ORBITX");
    expect(cssCity).toContain("JUPITER DEX");
    expect(cssCity).toContain("RAYDIUM DEX");
    expect(cssCity).toContain("PUMP.FUN");
    const districts = readFileSync(resolve(WEB, "shared/orbitx-chain-districts.js"), "utf8");
    expect(districts).toContain("frontend-api-v3.pump.fun");
    expect(districts).toContain("api.dexscreener.com");
    expect(districts).toContain("TRENDING_LIMIT = 250");
    expect(districts).toContain("token-profiles/latest");
    expect(districts).toContain("toptraded/24h");
  });

  it("stores a rebuildable chain cache instead of replacing ox_onchain_events", () => {
    const sql = readFileSync(resolve(REPO, "supabase/migrations/20260825042130_orbitx_chain_world.sql"), "utf8");
    expect(sql).toContain("ox_chain_events");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on public.ox_chain_events from anon, authenticated");
    expect(sql).toContain("13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9");
    expect(readFileSync(resolve(REPO, "supabase/migrations/20260822140000_orbitx_onchain_index.sql"), "utf8")).toContain("ox_onchain_events");
  });

  it("maps confirmed indexer events without inventing USD or KOL labels", () => {
    const ev = {
      event_id: "e1",
      signature: "sig",
      slot: 1,
      block_time: "2026-08-25T00:00:00.000Z",
      event_type: "SOL_TRANSFER",
      status: "confirmed",
      source: null,
      attribution: "chain",
      wallet: "Abcdefghijklmnopqrstuvwxyz123456789",
      counterparty: null,
      source_wallet: null,
      destination_wallet: null,
      token_ca: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      token_symbol: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      token_name: "OrbitX",
      token_image: null,
      amount: null,
      sol_amount: 2,
      usd_value: null,
      market_cap: null,
      orbitx_related: false,
      kol_related: false,
      whale_related: false,
      importance: 1,
      confidence: "confirmed",
      description: null,
    } satisfies ChainEvent;
    expect(eventKind(ev)).toBe("sol_transfer");
    expect(eventKind({ ...ev, kol_related: true, event_type: "BUY" })).toBe("kol_buy");
    expect(toLiveEvent(ev).token).toBe("OrbitX");
    expect(toLiveEvent({ ...ev, token_name: ev.token_ca, token_symbol: ev.token_ca }).token).toBeUndefined();
    const idle: LivePayload = {
      ok: true,
      live: false,
      live_label: "INDEXING DELAY",
      live_reason: "Waiting for the first confirmed index run.",
      chain_slot: null,
      last_slot: null,
      lag_slots: null,
      last_ingest_at: null,
      websocket_status: "polling",
      sol_usd: null,
      stats: { events_per_sec: 0, transactions_per_min: 0, orbitx_buys: 0, orbitx_burned: 0, whale_usd: 0, active_wallets: 0 },
      events: [],
    };
    const snap = liveToSnapshot(idle);
    expect(snap.ticker.eventsPerSec).toBeNull();
    expect(snap.events).toEqual([]);
    expect(snap.network.liveLabel).toBe("INDEXING DELAY");
    expect(toBreakdown([]).every((s) => s.pct === 0)).toBe(true);
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(0.00000966)).toMatch(/^\$0\.000009/);
  });
});
