import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    for (const path of ["live", "events", "wallet", "token", "transaction", "orbitx", "search", "flows", "ingest", "status", "kols", "districts"]) {
      expect(api).toContain(path);
    }
    expect(api).toContain("activeOrbitxKols");
    expect(api).toContain("assigned_kols");
    expect(api).not.toContain("sbp_");
  });

  it("renders wallets as characters and tokens as districts in the 3D world", () => {
    const canvas = readFileSync(resolve(WEB, "src/pages/onchain-world/WorldCanvas.tsx"), "utf8");
    expect(canvas).toContain("function Agent");
    expect(canvas).toContain("function TokenBuilding");
    expect(canvas).toContain("function Transit");
    expect(canvas).toContain("function OrbitXTower");
    expect(canvas).toContain("function CityFill");
    expect(canvas).toContain("DEX_HUBS");
    expect(canvas).toContain("followWallet");
    const app = readFileSync(resolve(WEB, "src/pages/onchain-world/OnChainWorldApp.tsx"), "utf8");
    expect(app).toContain("KOL directory");
    expect(app).toContain("LivingMap");
    expect(app).toContain("activeOrbitxKols");
    expect(app).toContain("Event breakdown");
    expect(app).toContain("Wallet intelligence");
    expect(readFileSync(resolve(WEB, "shared/orbitx-chain-districts.js"), "utf8")).toContain("frontend-api-v3.pump.fun");
    expect(readFileSync(resolve(WEB, "shared/orbitx-chain-districts.js"), "utf8")).toContain("api.dexscreener.com");
  });

  it("stores a rebuildable chain cache instead of replacing ox_onchain_events", () => {
    const sql = readFileSync(resolve(REPO, "supabase/migrations/20260825042130_orbitx_chain_world.sql"), "utf8");
    expect(sql).toContain("ox_chain_events");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on public.ox_chain_events from anon, authenticated");
    expect(sql).toContain("13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9");
    expect(readFileSync(resolve(REPO, "supabase/migrations/20260822140000_orbitx_onchain_index.sql"), "utf8")).toContain("ox_onchain_events");
  });
});
