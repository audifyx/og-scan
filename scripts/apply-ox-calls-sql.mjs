#!/usr/bin/env node
/**
 * Apply ox_calls_* DDL to production project ffjipnkhcebjvttliptb.
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-ox-calls-sql.mjs
 */
import { CALLS_DDL, CALLS_PROJECT_REF } from "../web/api/orbitx/calls-schema.js";

const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const ref = String(process.env.SUPABASE_PROJECT_REF || CALLS_PROJECT_REF).trim();

if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (Supabase PAT). Tables are optional: /calls falls back to storage KV.");
  process.exit(1);
}

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({ query: CALLS_DDL }),
});
const txt = await r.text();
if (!r.ok) {
  console.error(r.status, txt.slice(0, 800));
  process.exit(1);
}
console.log("ox_calls_* applied on", ref);
if (txt) console.log(txt.slice(0, 400));
