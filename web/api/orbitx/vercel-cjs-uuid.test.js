import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "../..");

function read(rel) {
  return readFileSync(join(webRoot, rel), "utf8");
}

const TOP_LEVEL_SOLANA = /^import\s+[\s\S]*?from\s+["']@solana\/(?:web3\.js|spl-token)["']/m;

describe("Vercel CJS uuid / rpc-websockets crash", () => {
  it("pins uuid to CJS 9.0.1 so rpc-websockets can require() it", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.overrides?.uuid).toBe("9.0.1");
    expect(pkg.pnpm?.overrides?.uuid).toBe("9.0.1");
  });

  it("keeps hub / MCP serverless files free of top-level Solana imports", () => {
    const files = [
      "api/orbitx-hub.js",
      "api/x-mcp.js",
      "api/orbitx/mcp-ops.js",
      "api/orbitx/mcp-burn-access.js",
      "api/orbitx/x-credits.js",
    ];
    for (const file of files) {
      expect(read(file), file).not.toMatch(TOP_LEVEL_SOLANA);
    }
  });
});
