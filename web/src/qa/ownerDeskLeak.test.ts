import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CIRCUIT guard — public desk / auth gates must never print the owner email
 * or "sign in with this address" copy. Anyone who finds /ox-desk-m4k9q
 * (or the DEX desk) used to see audifyx@gmail.com after entering the UI code.
 */
const PUBLIC_GATES = [
  resolve(__dirname, "../components/AdminRoute.tsx"),
  resolve(__dirname, "../components/AdminPassGate.tsx"),
  resolve(__dirname, "../pages/Admin.tsx"),
  resolve(__dirname, "../pages/AuthWallet.tsx"),
  resolve(__dirname, "../pages/Hub.tsx"),
  resolve(__dirname, "../components/admin/sections/AdminAppsSection.tsx"),
  resolve(__dirname, "../../ogdex/src/components/OwnerDeskGate.tsx"),
] as const;

const FORBIDDEN = [
  "audifyx@gmail.com",
  "Owner account required",
  "Sign in with email (",
  "or an owner wallet",
];

describe("owner desk public gates hide owner identity", () => {
  it("does not print the owner email or invite copy on public gates", () => {
    for (const file of PUBLIC_GATES) {
      const src = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) {
        expect(src, `${file} must not contain ${needle}`).not.toContain(needle);
      }
    }
  });

  it("404s non-owners instead of asking them to sign in as owner", () => {
    const route = readFileSync(resolve(__dirname, "../components/AdminRoute.tsx"), "utf8");
    expect(route).toContain("isOwnerIdentity");
    expect(route).toContain("NotFound");
    expect(route).not.toContain("OWNER_EMAIL");
  });
});
