/**
 * OrbitX MCP Skills (SEP-2640 subset, OpenAI import).
 *
 * Serves the 5 OrbitX skill playbooks via skills/list + skills/get +
 * resources/read (skill:// URIs). Each skill is one SKILL.md file; the
 * registry parses its frontmatter (name + description) and hashes the
 * UTF-8 bytes for the digest OpenAI verifies at import time.
 *
 * SKILL.md files are read with literal relative paths so Vercel's file
 * tracer (@vercel/nft) bundles them into the serverless function. If you
 * add a skill: add its directory + a literal readFileSync line below, and
 * keep it within the import limits (SKILL.md <= 256 KiB, <= 5 skills total).
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_SLUG = "orbitx";
const MAX_SKILL_MD_BYTES = 256 * 1024;

const SKILL_DIRS = [
  "orbitx-crypto-analysis",
  "orbitx-trading",
  "orbitx-token-launcher",
  "orbitx-web-designer",
  "orbitx-city-agents",
];

/** NOTE: literal paths (not a loop) so @vercel/nft traces each SKILL.md. */
function loadSkillTexts() {
  return {
    "orbitx-crypto-analysis": readFileSync(join(HERE, "orbitx-crypto-analysis", "SKILL.md"), "utf8"),
    "orbitx-trading": readFileSync(join(HERE, "orbitx-trading", "SKILL.md"), "utf8"),
    "orbitx-token-launcher": readFileSync(join(HERE, "orbitx-token-launcher", "SKILL.md"), "utf8"),
    "orbitx-web-designer": readFileSync(join(HERE, "orbitx-web-designer", "SKILL.md"), "utf8"),
    "orbitx-city-agents": readFileSync(join(HERE, "orbitx-city-agents", "SKILL.md"), "utf8"),
  };
}

function parseFrontmatter(text) {
  const m = String(text || "").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function buildCatalog() {
  const texts = loadSkillTexts();
  const skills = [];
  for (const dir of SKILL_DIRS) {
    try {
      const text = texts[dir];
      if (typeof text !== "string" || !text) continue;
      if (Buffer.byteLength(text, "utf8") > MAX_SKILL_MD_BYTES) continue;
      const fm = parseFrontmatter(text);
      // The directory containing SKILL.md must match the skill name.
      if (!fm || fm.name !== dir || !fm.description) continue;
      const uri = `skill://${SERVER_SLUG}/${dir}/SKILL.md`;
      const digest = `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
      skills.push({
        dir,
        text,
        entry: {
          uri,
          frontmatter: { name: fm.name, description: fm.description },
          resources: [{ uri, digest }],
        },
      });
    } catch (e) {
      // A broken skill must never take down the MCP server — skip it.
      console.warn(`[skills] skipping ${dir}: ${String(e?.message || e)}`);
    }
  }
  return skills;
}

let _catalog = null;
function catalog() {
  if (!_catalog) _catalog = buildCatalog();
  return _catalog;
}

/** skills/list payload — single page (5 skills, no nextCursor). */
export function listSkills() {
  return { skills: catalog().map((s) => s.entry) };
}

/** skills/get payload for one URI, or null when unknown. */
export function getSkill(uri) {
  const s = catalog().find((x) => x.entry.uri === String(uri || ""));
  return s ? { skill: s.entry } : null;
}

/**
 * resources/read payload for a skill:// URI, or null when unknown.
 * Returns exactly one content item whose URI matches the request.
 * Only catalog URIs are served — no path traversal, no arbitrary files.
 */
export function readSkillResource(uri) {
  const s = catalog().find((x) => x.entry.uri === String(uri || ""));
  if (!s) return null;
  return {
    contents: [
      {
        uri: s.entry.uri,
        mimeType: "text/markdown",
        text: s.text,
      },
    ],
  };
}
