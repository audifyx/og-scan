import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CIRCUIT guard — ensures multi-team surfaces stay wired after merges.
 */
describe("OrbitX route manifest", () => {
  const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");

  it("keeps OS, Play, Intel, Social HQ, and City routes", () => {
    expect(app).toContain('path="/os/*"');
    expect(app).toContain('path="/play/*"');
    expect(app).toContain('path="/intel"');
    expect(app).toContain('path="/hq"');
    expect(app).toContain('path="/Orbitxcity"');
  });

  it("lazy-loads team apps", () => {
    expect(app).toContain("./os/OsApp");
    expect(app).toContain("./gaming/PlayApp");
    expect(app).toContain("./crypto/pages/IntelLayout");
    expect(app).toContain("./social/pages/SocialLayout");
  });

  it("redirects legacy social aliases to HQ", () => {
    expect(app).toContain('path="/social"');
    expect(app).toContain('Navigate to="/hq"');
  });
});
