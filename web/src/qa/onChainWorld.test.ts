import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatPrice } from "../pages/onchain-world/lib/orbitx/format";
import { eventKind, isOrbitxChainEvent, liveToSnapshot, toBreakdown, toLiveEvent } from "../pages/onchain-world/lib/mapLive";
import type { ChainEvent, LivePayload } from "../pages/onchain-world/api";

const WEB = resolve(__dirname, "../..");
const REPO = resolve(WEB, "..");

describe("OrbitX /on-chain world", () => {
  it("exposes the living world as a public route and keeps /onchain proof owner-only", () => {
    const app = readFileSync(resolve(WEB, "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/on-chain" element={<OnChainWorld />} />');
    expect(app).toContain('<Route path="/world" element={<Navigate to="/on-chain" replace />} />');
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
    expect(api).toContain("handleMedia");
    expect(api).toContain("rpcFallback: true");
    expect(api).toContain("orbitx_buys_24h");
    expect(api).toContain("refreshCityDistricts");
    expect(api).toContain("peekCityDistricts");
    expect(api).toContain("void cityDistricts(");
    expect(api).toContain("void ingestNow(sb)");
    expect(api).not.toContain("const city = await cityDistricts([mint])");
    expect(api).not.toContain("const districts = await cityDistricts(extraMints)");
    expect(api).toContain("dexTokenImage");
    expect(api).toContain("publicEvent");
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
    expect(world).toContain("viewOptions");
    expect(world).toContain("WorldJoystick");
    expect(world).toContain("stick={stick}");
    expect(world).toContain("onCamConsumed");
    expect(world).toContain("spin={follow}");
    expect(world).toContain("cinematic={false}");
    expect(world).toContain("onContextLost");
    expect(world).toContain("<MapView");
    expect(world).toContain("Spin");
    expect(world).not.toContain(">Orbit</");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/WorldCanvas.tsx"), "utf8")).toContain("stick");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/WorldJoystick.tsx"), "utf8")).toContain("WASD");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/WorldJoystick.tsx"), "utf8")).toContain("SHIFT BOOST");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/useOnChainFeed.ts"), "utf8")).toContain("mergeChainEvents");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/useOnChainFeed.ts"), "utf8")).toContain("fetchEvents");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/useOnChainFeed.ts"), "utf8")).toContain("orbitxEvents");
    const feed = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/TrendingFeed.tsx"), "utf8");
    expect(feed).toContain("Show more");
    expect(feed).toContain("tokenLabel");
    expect(feed).not.toContain("t.mint.slice");
    const tokenPanel = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/TokenPanel.tsx"), "utf8");
    expect(tokenPanel).toContain("banner");
    expect(tokenPanel).toContain("tokenLabel");
    expect(tokenPanel).toContain("tokenActivity");
    expect(tokenPanel).toContain("KOL interactions");
    expect(tokenPanel).toContain("24h buys");
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
    expect(map).toContain("layoutUniverse");
    expect(map).toContain("layoutBounds");
    expect(map).toContain("projectToMap");
    expect(map).toContain("DEX_HUBS");
    expect(map).toContain("CLUSTER_META");
    expect(map).not.toContain('clipPath="circle(50%)"');
    expect(map).not.toContain("pos[0] * 0.26");
    expect(map).toContain("city.kols");
    expect(map).toContain("slice(0, 250)");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/views/TerminalView.tsx"), "utf8")).toContain("decoded rows");
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/BottomPanel.tsx"), "utf8")).toContain("isOrbitxChainEvent");
    expect(readFileSync(resolve(WEB, "src/components/theme/OrbitAtmosphereLayer.tsx"), "utf8")).toContain('"/on-chain"');
    expect(readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/LiveEvents.tsx"), "utf8")).toContain("INDEXING DELAY");
    const oxView = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/views/OrbitxTokenView.tsx"), "utf8");
    expect(oxView).toContain("districts.orbitx");
    expect(oxView).toContain("formatPrice");
    expect(oxView).toContain("24h buys (Jupiter)");
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
    expect(hook).toContain("fetchStatus");
    expect(hook).toContain("withTimeout");
    expect(hook).not.toContain("loseContext");
    expect(hook).toContain("loadCityDistricts");
    expect(hook).toContain("allOrbitxKols");
    expect(hook).toContain("mergeDistricts");
    expect(hook).toContain("tokenCatalogSize");
    const top = readFileSync(resolve(WEB, "src/pages/onchain-world/dashboard/TopBar.tsx"), "utf8");
    expect(top).toContain("Search 250 trending");
    expect(top).toContain('label="OX 24h Buys"');
    expect(top).toContain('label="OX 24h Sells"');
    expect(top).toContain('label="Buys"');
    expect(top).toContain('label="Swaps"');
    expect(top).not.toContain("OrbitX Buys");
  });

  it("renders a 3D galaxy of token nodes, official KOLs, holders, and swaps", () => {
    const canvas = readFileSync(resolve(WEB, "src/pages/onchain-world/WorldCanvas.tsx"), "utf8");
    expect(canvas).toContain("function Agent");
    expect(canvas).toContain("function TokenStar");
    expect(canvas).toContain("usePlanetTexture");
    expect(canvas).toContain("map={map}");
    expect(canvas).toContain("viewOptions");
    expect(canvas).toContain("NebulaField");
    expect(canvas).toContain("ACESFilmicToneMapping");
    expect(canvas).toContain("function Transit");
    expect(canvas).toContain("function OrbitXCore");
    expect(canvas).toContain("export { galaxyPos }");
    expect(canvas).toContain("layoutUniverse");
    expect(canvas).toContain("CLUSTER_META");
    expect(canvas).toContain("autoRotate={false}");
    expect(canvas).toContain("speed={0}");
    expect(canvas).toContain("detectLiteGpu");
    expect(canvas).toContain("absolute inset-0");
    expect(canvas).toContain("webglcontextlost");
    expect(canvas).toContain("lite ? 22 : 28");
    expect(canvas).not.toContain("[0, 48, 168]");
    expect(canvas).toContain("spread * 0.18");
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
    expect(districts).toContain("fetchJupiterToken");
    expect(districts).toContain("fetchCoinGeckoContract");
    expect(districts).toContain("api.coingecko.com");
    expect(districts).toContain("dexTokenImage");
    expect(districts).toContain("dd.dexscreener.com/ds-data/tokens/solana");
    const planet = readFileSync(resolve(WEB, "src/pages/onchain-world/planetTexture.ts"), "utf8");
    expect(planet).toContain("planetMediaSrc");
    expect(planet).toContain("/api/on-chain/media");
    expect(planet).toContain("CanvasTexture");
    expect(readFileSync(resolve(REPO, "supabase/migrations/20260826061200_ox_chain_tokens_banner.sql"), "utf8")).toContain("banner");
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
    expect(eventKind({ ...ev, event_type: "ORBITX_SELL", orbitx_related: true, token_name: "OrbitX" })).toBe("orbitx_sell");
    expect(eventKind({ ...ev, event_type: "ORBITX_BUY", orbitx_related: true, token_name: "OrbitX" })).toBe("orbitx_buy");
    expect(eventKind({ ...ev, event_type: "BUY", orbitx_related: false, token_name: "OrbitX" })).toBe("orbitx_buy");
    expect(eventKind({ ...ev, event_type: "SELL", orbitx_related: false, token_name: "OrbitX" })).toBe("orbitx_sell");
    expect(isOrbitxChainEvent({ ...ev, event_type: "BUY", orbitx_related: false })).toBe(true);
    expect(eventKind({ ...ev, event_type: "BUY", token_name: "Jupiter", token_symbol: "JUP", token_ca: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" })).toBe("token_buy");
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
      stats: { events_per_sec: 0, transactions_per_min: 0, buys: 0, sells: 0, swaps: 0, transfers: 0, orbitx_buys: 0, orbitx_burned: 0, whale_usd: 0, active_wallets: 0 },
      events: [],
    };
    const snap = liveToSnapshot(idle);
    expect(snap.ticker.eventsPerSec).toBeNull();
    expect(snap.events).toEqual([]);
    expect(snap.network.liveLabel).toBe("INDEXING DELAY");
    expect(snap.network.ws).toBe("disconnected");
    const liveOx = liveToSnapshot({
      ...idle,
      live: true,
      live_label: "LIVE",
      live_reason: null,
      chain_slot: 441800000,
      websocket_status: "polling",
      stats: { ...idle.stats, orbitx_buys_24h: 44, orbitx_sells_24h: 44, orbitx_traders_24h: 59 },
      districts: {
        orbitx: { mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9", buys_24h: 44, sells_24h: 44, traders_24h: 59 },
        tokens: [],
      },
    });
    expect(liveOx.ticker.orbitxBuys24h).toBe(44);
    expect(liveOx.ticker.orbitxSells24h).toBe(44);
    expect(liveOx.network.rpc).toBe("healthy");
    expect(liveOx.network.ws).toBe("connected");
    expect(toBreakdown([]).every((s) => s.pct === 0)).toBe(true);
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(0.00000966)).toMatch(/^\$0\.000009/);
  });

  it("classifies universe clusters and tallies real event kinds", async () => {
    const { classifyToken } = await import("../pages/onchain-world/universeLayout");
    const { tallyActivity, buySellRatio } = await import("../pages/onchain-world/activityStats");
    expect(classifyToken({ mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9", market_cap: 1 })).toBe("orbitx");
    expect(classifyToken({ mint: "Aaa1111111111111111111111111111111111111111", market_cap: 80_000_000, volume_24h: 1 })).toBe("big_dawgs");
    expect(classifyToken({ mint: "Bbb1111111111111111111111111111111111111111", market_cap: 2_000_000, volume_24h: 1 })).toBe("mid_cap");
    expect(classifyToken({ mint: "Ccc1111111111111111111111111111111111111111", market_cap: 20_000, volume_24h: 400_000 })).toBe("mini_dawgs");
    const totals = tallyActivity([
      { event_id: "1", signature: "s", slot: 1, block_time: new Date().toISOString(), event_type: "BUY", status: "confirmed", source: null, attribution: "chain", wallet: "w1", counterparty: null, source_wallet: null, destination_wallet: null, token_ca: "m", token_symbol: "AAA", token_name: "Alpha", token_image: null, amount: 1, sol_amount: null, usd_value: null, market_cap: null, orbitx_related: false, kol_related: true, whale_related: false, importance: 1, confidence: "confirmed", description: null },
      { event_id: "2", signature: "s2", slot: 1, block_time: new Date().toISOString(), event_type: "ORBITX_BUY", status: "confirmed", source: null, attribution: "chain", wallet: "w2", counterparty: null, source_wallet: null, destination_wallet: null, token_ca: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9", token_symbol: "ORBITX", token_name: "OrbitX", token_image: null, amount: 1, sol_amount: null, usd_value: null, market_cap: null, orbitx_related: true, kol_related: false, whale_related: false, importance: 1, confidence: "confirmed", description: null },
      { event_id: "3", signature: "s3", slot: 1, block_time: new Date().toISOString(), event_type: "SWAP", status: "confirmed", source: null, attribution: "chain", wallet: "w3", counterparty: null, source_wallet: null, destination_wallet: null, token_ca: "m", token_symbol: "AAA", token_name: "Alpha", token_image: null, amount: 1, sol_amount: null, usd_value: null, market_cap: null, orbitx_related: false, kol_related: false, whale_related: false, importance: 1, confidence: "confirmed", description: null },
    ]);
    expect(totals.buys).toBe(2);
    expect(totals.swaps).toBe(1);
    expect(totals.orbitx).toBe(1);
    expect(totals.kol).toBe(1);
    expect(buySellRatio(totals)).toBe("100 / 0");
  });

  it("fits cluster positions onto the 0-100 map and never wipes a loaded catalog", async () => {
    const { layoutUniverse, layoutBounds, projectToMap, CLUSTER_META } = await import("../pages/onchain-world/universeLayout");
    const { mergeDistricts, tokenCatalogSize } = await import("../pages/onchain-world/mergeDistricts");
    const tokens = [
      { mint: "Aaa1111111111111111111111111111111111111111", market_cap: 80_000_000, volume_24h: 1_000_000 },
      { mint: "Bbb1111111111111111111111111111111111111111", market_cap: 2_000_000, volume_24h: 50_000 },
      { mint: "Ccc1111111111111111111111111111111111111111", market_cap: 20_000, volume_24h: 400_000 },
    ];
    const layout = layoutUniverse(tokens);
    const bounds = layoutBounds(layout);
    const mapped = [...layout.values()].map((n) => projectToMap(n.pos, bounds));
    expect(mapped.every((p) => p.x >= 6 && p.x <= 94 && p.y >= 6 && p.y <= 94)).toBe(true);
    const dawgs = projectToMap(CLUSTER_META.big_dawgs.center, bounds);
    expect(dawgs.x).toBeGreaterThan(50);
    const kept = mergeDistricts(
      { orbitx: { mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9", buys_24h: 44, sells_24h: 44 }, tokens: [] },
      { tokens: tokens as never },
    );
    expect(tokenCatalogSize(kept)).toBe(3);
    expect(kept.orbitx?.buys_24h).toBe(44);
    expect(mergeDistricts({ tokens: [] }, { tokens: tokens as never }).tokens).toHaveLength(3);
  });
});
