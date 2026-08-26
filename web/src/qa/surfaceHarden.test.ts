import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB = resolve(__dirname, "../..");
const REPO = resolve(WEB, "..");

describe("surface harden + leak scan", () => {
  it("hides unfinished /app surfaces from the public catalog", () => {
    const src = readFileSync(resolve(WEB, "src/lib/orbitxPlatforms.tsx"), "utf8");
    expect(src).toContain('visibility: "admin"');
    expect(src).toContain("export function visiblePlatformApps");
    expect(src).toContain("export function publicPlatformApps");
  });

  it("404s unfinished product routes for everyone except the owner email", () => {
    const app = readFileSync(resolve(WEB, "src/App.tsx"), "utf8");
    expect(app).toContain("OwnerPreviewRoute");
    expect(app).toContain("<Route path=\"/terminal\" element={<OwnerPreviewRoute>");
    expect(app).toContain("<Route path=\"/vamp\" element={<OwnerPreviewRoute>");
    expect(app).toContain("<Route path=\"/x\" element={<OwnerPreviewRoute>");
    expect(app).toContain("<Route path=\"/:toolSlug\" element={<OwnerPreviewRoute>");
    expect(app).toContain("to=\"/orbitx-social\"");
    expect(app).toContain("<Route path=\"/support\" element={<SupportCenter />} />");
    expect(app).toContain("<Route path=\"/on-chain\" element={<OnChainWorld />} />");
    expect(app).toContain("<Route path=\"/education\" element={<Education />} />");
    expect(app).not.toContain("<Route path=\"/education\" element={<OwnerPreviewRoute>");
    expect(app).not.toContain("<Route path=\"/on-chain\" element={<OwnerPreviewRoute>");
  });

  it("does not ship a hardcoded Supabase anon JWT", () => {
    const lib = readFileSync(resolve(WEB, "api/ogdex/_lib.js"), "utf8");
    expect(lib).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
    expect(lib).toContain('export const ANON = process.env.SUPABASE_ANON_KEY || ""');
    expect(lib).not.toContain("ffjipnkhcebjvttliptb.supabase.co");
  });

  it("requires an MCP session for image/video tools", () => {
    const hub = readFileSync(resolve(WEB, "api/orbitx-hub.js"), "utf8");
    expect(hub).toContain('"orbitx_generate_image"');
    expect(hub).toContain('"orbitx_generate_video"');
    expect(hub).toContain('"orbitx_media_status"');
    const sessionBlock = hub.slice(hub.indexOf("const SESSION_TOOLS"), hub.indexOf("async function getProfileForUser"));
    expect(sessionBlock).toContain("orbitx_generate_image");
    expect(sessionBlock).toContain("orbitx_generate_video");
    expect(sessionBlock).toContain("orbitx_media_status");
  });

  it("does not let signed-in users tweet as the official X account", () => {
    const fn = readFileSync(resolve(REPO, "supabase/functions/post-to-x/index.ts"), "utf8");
    expect(fn).not.toContain("official_account");
    expect(fn).not.toContain("on ogscan.fun");
    expect(fn).toContain("X not connected. Go to Settings → Connections.");
  });

  it("keeps X MCP repo reads behind auth", () => {
    const mcp = readFileSync(resolve(WEB, "api/x-mcp.js"), "utf8");
    const publicBlock = mcp.slice(mcp.indexOf("const publicTools = new Set(["), mcp.indexOf("if (!auth?.userId && !publicTools.has(name))"));
    expect(publicBlock).toContain("x_auth_link");
    expect(publicBlock).not.toContain("x_repo_read");
    expect(publicBlock).not.toContain("x_repo_context");
  });
});
