/**
 * Vercel serverless-function guard.
 *
 * The `orbitx` project deploys on Vercel's Hobby plan: max 12 Serverless
 * Functions per deployment. Every file under web/api/ with no "_"-prefixed
 * path segment becomes a function. Exceeding the limit fails EVERY deploy at
 * patchBuild with exceeded_serverless_functions_per_deployment (2026-09-26:
 * three straight ERRORs after standalone copy-hook/copy-admin/copy-dashboard
 * functions were added).
 *
 * This test fails the suite if the count exceeds 11, so we never reach the
 * hard limit. To add a route: hang it off an existing dispatcher
 * (orbitx-hub ?path=...) — never a new file directly under web/api/.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// vitest runs with cwd = web/
const API_DIR = join(process.cwd(), "api");
const HARD_LIMIT = 12;
const GUARD_AT = 11;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(API_DIR, full).split("\\").join("/"));
  }
  return out;
}

// Mirror Vercel: a file counts as a function unless some path segment
// (dirs or the file itself) starts with "_".
function isFunction(rel) {
  return !rel.split("/").some((seg) => seg.startsWith("_"));
}

describe("vercel function limit guard", () => {
  it(`web/api deploys at most ${GUARD_AT} functions (Hobby limit is ${HARD_LIMIT})`, () => {
    const fns = walk(API_DIR).filter(isFunction).sort();
    expect(
      fns.length,
      `web/api/ would deploy ${fns.length} serverless functions (limit ${HARD_LIMIT}): ${fns.join(", ")}. ` +
        `Add the route behind an existing dispatcher (orbitx-hub ?path=...) instead of a new file under web/api/.`
    ).toBeLessThanOrEqual(GUARD_AT);
  });
});
