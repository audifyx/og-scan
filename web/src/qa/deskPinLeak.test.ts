import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const RETIRED = String.fromCharCode(48, 49, 50, 57);
const SKIP_DIR = new Set(["node_modules", "dist", ".git", "coverage"]);
const SCAN_EXT = new Set([".js", ".ts", ".tsx", ".md", ".html", ".css"]);

function walkSource(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkSource(full, out);
    else if (SCAN_EXT.has(name.slice(name.lastIndexOf("."))) && !name.includes("midtown-buildings")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * CIRCUIT — the desk PIN must never ship in the browser bundle.
 * Unlock is POST /api/orbitx-desk-unlock against ADMIN_AUTH
 * on Vercel project rork-og-meme-coin-tracker.
 */
const CLIENT_FILES = [
  resolve(__dirname, "../lib/ownerDesk.ts"),
  resolve(__dirname, "../components/AdminPassGate.tsx"),
  resolve(__dirname, "../components/AdminRoute.tsx"),
  resolve(__dirname, "../pages/AuthWallet.tsx"),
  resolve(__dirname, "../hooks/useAdmin.tsx"),
  resolve(__dirname, "../../ogdex/src/components/OwnerDeskGate.tsx"),
  resolve(__dirname, "../../ogdex/src/pages/Admin.tsx"),
  resolve(__dirname, "../../shared/desk-unlock-client.js"),
  resolve(__dirname, "../pages/Hub.tsx"),
  resolve(__dirname, "../components/admin/sections/AdminAppsSection.tsx"),
  resolve(__dirname, "../components/MaintenanceLock.tsx"),
  resolve(__dirname, "../../ogdex/src/components/PasswordGate.tsx"),
] as const;

describe("desk PIN is Vercel-locked", () => {
  it("does not hardcode a desk PIN or OWNER_DESK_CODE in client gates", () => {
    for (const file of CLIENT_FILES) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/OWNER_DESK_CODE\s*=\s*["']/);
      expect(src, file).not.toMatch(/DESK_API_PASS\s*=\s*["']/);
      expect(src, file).not.toMatch(/VITE_ADMIN_PASS/);
      expect(src, file).not.toMatch(/VITE_REDESIGN_PASS/);
      expect(src, file).not.toMatch(/import\.meta\.env\.VITE_ADMIN/);
    }
  });

  it("deploys only Vercel project rork-og-meme-coin-tracker", () => {
    const cfg = readFileSync(resolve(__dirname, "../../vercel.json"), "utf8");
    const gate = readFileSync(resolve(__dirname, "../../../scripts/vercel-only-rork.sh"), "utf8");
    expect(cfg).toContain("vercel-only-rork.sh");
    expect(gate).toContain("rork-og-meme-coin-tracker");
    expect(gate).toContain("Skipping leftover Vercel project og-scan");
  });

  it("keeps the unlock route at top-level /api/orbitx-desk-unlock", () => {
    const api = readFileSync(resolve(__dirname, "../../api/orbitx-desk-unlock.js"), "utf8");
    expect(api).toContain("ADMIN_AUTH");
    expect(api).toContain("requireOwnerUser");
    expect(api).toContain("not_configured");
    expect(api).not.toMatch(/\|\|\s*["']\d{4,}["']/);
    expect(api).toContain('purpose === "maintenance"');
  });

  it("does not bind MCP identity from a raw publicKey", () => {
    const hub = readFileSync(resolve(__dirname, "../../api/orbitx-hub.js"), "utf8");
    const start = hub.indexOf("async function enrichAuth");
    const end = hub.indexOf("function wwwAuthenticate");
    const fn = hub.slice(start, end);
    expect(fn).toContain("never a login");
    expect(fn).not.toContain("resolveAgentByWallet");
  });

  it("does not keep the retired client PIN in source", () => {
    const quoted = new RegExp(`["'\`]${RETIRED}["'\`]`);
    const files = [
      ...walkSource(resolve(__dirname, "../..")),
      ...walkSource(resolve(__dirname, "../../../docs")),
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(quoted);
    }
  });

  it("does not grant MCP hold from raw tool-arg wallets", () => {
    const hub = readFileSync(resolve(__dirname, "../../api/orbitx-hub.js"), "utf8");
    const start = hub.indexOf("function holdCandidateWallets");
    const end = hub.indexOf("async function getUserId");
    const fn = hub.slice(start, end);
    expect(fn).toContain("auth?.walletAddress");
    expect(fn).not.toContain("args.publicKey");
    expect(fn).not.toContain("args.wallet");
  });
});
