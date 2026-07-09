/**
 * Offline vanity-mint grinder — fills the `vanity_mint_pool` table.
 *
 * Use this for suffixes too expensive to grind live in the serverless route
 * (notably "orbit", ~82M keypairs each). Runs one worker per CPU core and
 * inserts each match into Supabase as it's found.
 *
 * Usage (from the web/ directory, where @solana/web3.js is installed):
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/grind-vanity.mjs --suffix orbit --count 25 --case-insensitive
 *
 * Flags:
 *   --suffix <s>          suffix to grind (default: orbit)
 *   --count <n>           how many keypairs to add to the pool (default: 10)
 *   --case-insensitive    match suffix ignoring case (recommended)
 *   --workers <n>         worker threads (default: os.cpus().length)
 *   --dry-run             grind + print, do NOT write to Supabase
 *
 * Solana-CLI alternative (no DB write):  solana-keygen grind --ends-with orbit:1
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import os from "node:os";
import { Keypair } from "@solana/web3.js";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function parseArgs(argv) {
  const a = { suffix: "orbit", count: 10, caseInsensitive: false, workers: os.cpus().length, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--suffix") a.suffix = argv[++i];
    else if (k === "--count") a.count = Number(argv[++i]);
    else if (k === "--workers") a.workers = Number(argv[++i]);
    else if (k === "--case-insensitive") a.caseInsensitive = true;
    else if (k === "--dry-run") a.dryRun = true;
  }
  return a;
}

function badChars(suffix, ci) {
  const bad = [];
  for (const ch of suffix) {
    const variants = ci ? [...new Set([ch.toLowerCase(), ch.toUpperCase()])] : [ch];
    if (!variants.some((v) => BASE58.includes(v))) bad.push(ch);
  }
  return bad;
}

/* ─── Worker: grind forever, post matches to the parent ──────────────── */
if (!isMainThread) {
  const { suffix, caseInsensitive } = workerData;
  const target = caseInsensitive ? suffix.toLowerCase() : suffix;
  let attempts = 0;
  while (true) {
    const kp = Keypair.generate();
    const addr = kp.publicKey.toBase58();
    attempts++;
    const tail = caseInsensitive ? addr.toLowerCase() : addr;
    if (tail.endsWith(target)) {
      parentPort.postMessage({ address: addr, secret: Array.from(kp.secretKey), attempts });
      attempts = 0;
    }
    if (attempts % 500000 === 0) parentPort.postMessage({ progress: 500000 });
  }
}

/* ─── Main: spawn workers, collect matches, insert into Supabase ─────── */
async function insertToPool(match, suffix) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run).");
  const res = await fetch(`${url}/rest/v1/vanity_mint_pool`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify({ address: match.address, suffix: suffix.toLowerCase(), secret_key: match.secret }),
  });
  if (!res.ok) throw new Error(`Supabase insert failed (${res.status}): ${await res.text()}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bad = badChars(args.suffix, args.caseInsensitive);
  if (bad.length) {
    console.error(`❌ Suffix "${args.suffix}" has non-base58 chars: ${bad.join(", ")} (base58 excludes 0 O I l).`);
    process.exit(1);
  }

  console.log(`⛏  Grinding "...${args.suffix}" (${args.caseInsensitive ? "case-insensitive" : "exact"}) — target ${args.count}, ${args.workers} workers`);
  const t0 = Date.now();
  let found = 0;
  let totalAttempts = 0;
  const workers = [];

  await new Promise((resolve) => {
    for (let i = 0; i < args.workers; i++) {
      const w = new Worker(new URL(import.meta.url), {
        workerData: { suffix: args.suffix, caseInsensitive: args.caseInsensitive },
      });
      workers.push(w);
      w.on("message", async (msg) => {
        if (msg.progress) { totalAttempts += msg.progress; return; }
        if (found >= args.count) return;
        found++;
        totalAttempts += msg.attempts;
        const rate = Math.round(totalAttempts / ((Date.now() - t0) / 1000));
        console.log(`✅ [${found}/${args.count}] ${msg.address}  (~${rate.toLocaleString()} keys/s)`);
        try {
          if (!args.dryRun) await insertToPool(msg, args.suffix);
        } catch (e) {
          console.error("   insert error:", e.message);
        }
        if (found >= args.count) {
          for (const wk of workers) wk.terminate();
          resolve();
        }
      });
      w.on("error", (e) => console.error("worker error:", e));
    }
  });

  console.log(`\n🎉 Done: ${found} keypairs in ${((Date.now() - t0) / 1000).toFixed(1)}s${args.dryRun ? " (dry-run, nothing written)" : " → vanity_mint_pool"}`);
  process.exit(0);
}

if (isMainThread) main();
