import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CIRCUIT — the desk PIN must never ship in the browser bundle.
 * Unlock is POST /api/orbitx-desk-unlock against Vercel ADMIN_AUTH.
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
  it("does not hardcode 0129 or OWNER_DESK_CODE in client gates", () => {
    for (const file of CLIENT_FILES) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toContain("0129");
      expect(src, file).not.toMatch(/OWNER_DESK_CODE\s*=\s*["']/);
      expect(src, file).not.toMatch(/DESK_API_PASS\s*=\s*["']/);
      expect(src, file).not.toMatch(/VITE_ADMIN_PASS/);
      expect(src, file).not.toMatch(/VITE_REDESIGN_PASS/);
      expect(src, file).not.toMatch(/import\.meta\.env\.VITE_ADMIN/);
    }
  });

  it("keeps the unlock route at top-level /api/orbitx-desk-unlock", () => {
    const api = readFileSync(resolve(__dirname, "../../api/orbitx-desk-unlock.js"), "utf8");
    expect(api).toContain("ADMIN_AUTH");
    expect(api).toContain("requireOwnerUser");
    expect(api).toContain("not_configured");
    expect(api).not.toMatch(/\|\|\s*["']0129["']/);
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
