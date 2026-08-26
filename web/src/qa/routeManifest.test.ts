import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CIRCUIT guard — ensures multi-team surfaces stay wired after merges.
 */
describe("OrbitX route manifest", () => {
  const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");

  it("keeps OS, Play, Intel, Social, City, and AI routes", () => {
    expect(app).toContain('path="/os/*"');
    expect(app).toContain('path="/play/*"');
    expect(app).toContain('path="/intel"');
    expect(app).toContain('path="/orbitx-social"');
    expect(app).toContain('path="/Orbitxcity"');
    expect(app).toContain('path="/ai"');
    expect(app).toContain('path="/AI"');
    expect(app).toContain('Navigate to="/ai"');
    expect(app).toContain('path="/telegram"');
    expect(app).toContain('import TelegramOrbitX from "./pages/TelegramOrbitX"');
    expect(app).toContain('path="/onchain"');
    expect(app).toContain('import OnChainProofPage from "./pages/OnChainProofPage"');
    expect(app).toContain('path="/on-chain"');
    expect(app).toContain('import OnChainWorld from "./pages/OnChainWorld"');
    expect(app).toContain('path="/education"');
    expect(app).toContain('import Education from "./pages/Education"');
  });

  it("loads team apps and keeps OrbitX AI eager for route reliability", () => {
    expect(app).toContain("./os/OsApp");
    expect(app).toContain("./gaming/PlayApp");
    expect(app).toContain("./crypto/pages/IntelLayout");
    expect(app).toContain("./pages/SocialAppPage");
    expect(app).toContain('import OrbitXAI from "./pages/OrbitXAI"');
    expect(app).not.toContain('lazyWithRetry(() => import("./pages/OrbitXAI"))');
  });

  it("redirects legacy social aliases to live social app", () => {
    expect(app).toContain('path="/social"');
    expect(app).toContain('Navigate to="/orbitx-social"');
  });
});
