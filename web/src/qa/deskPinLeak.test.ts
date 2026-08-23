import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CIRCUIT — the desk PIN must never ship in the browser bundle.
 * Unlock is POST /api/orbitx-desk-unlock against Vercel OWNER_DESK_CODE.
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
] as const;

describe("desk PIN is Vercel-locked", () => {
  it("does not hardcode 0129 or OWNER_DESK_CODE in client gates", () => {
    for (const file of CLIENT_FILES) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toContain("0129");
      expect(src, file).not.toMatch(/OWNER_DESK_CODE\s*=\s*["']/);
      expect(src, file).not.toMatch(/DESK_API_PASS\s*=\s*["']/);
    }
  });

  it("keeps the unlock route at top-level /api/orbitx-desk-unlock", () => {
    const api = readFileSync(resolve(__dirname, "../../api/orbitx-desk-unlock.js"), "utf8");
    expect(api).toContain("OWNER_DESK_CODE");
    expect(api).toContain("not_configured");
    expect(api).not.toMatch(/\|\|\s*["']0129["']/);
  });
});
