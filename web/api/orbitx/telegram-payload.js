/**
 * Shared Telegram payload helpers — no menus, no hub imports.
 */
import { hasMarketSnapshot, hasTokenIdentity, hydrateKnownMint } from "./telegram-token-snapshot.js";

export const CA_RE = /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/;

export function extractMint(text) {
  const m = String(text || "").match(CA_RE);
  return m ? m[1] : "";
}

export function tgEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function fmtUsd(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs === 0) return "$0";
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${v.toFixed(4).replace(/\.?0+$/, "")}`;
  if (abs >= 1e-4) return `$${v.toPrecision(4)}`;
  return `$${v.toExponential(2)}`;
}

/** Price column — more digits for micro-caps, never invent. */
export function fmtPrice(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs === 0) return "$0";
  if (abs >= 1) return `$${v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  if (abs >= 1e-2) return `$${v.toFixed(4)}`;
  if (abs >= 1e-6) return `$${v.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${v.toExponential(2)}`;
}

export function fmtPct(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

export function fmtInt(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n)).toLocaleString("en-US");
}

export function fmtSupply(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function mediaEtaSeconds(kind) {
  return String(kind || "").includes("video") ? 240 : 180;
}

export function shortAddr(addr) {
  const s = String(addr || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function unwrapToolPayload(result) {
  if (result == null) return result;
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return result;
      }
    }
    return result;
  }
  if (typeof result !== "object") return result;
  if (Array.isArray(result.content) && result.content[0]?.text) {
    const inner = unwrapToolPayload(result.content[0].text);
    if (inner && typeof inner === "object") return inner;
  }
  if (result.structuredContent && typeof result.structuredContent === "object") {
    const inner = unwrapToolPayload(result.structuredContent);
    if (inner && typeof inner === "object" && (inner.token || inner.mint || inner.meta)) return inner;
  }
  if (
    result.result &&
    typeof result.result === "object" &&
    (result.result.token || result.result.mint || result.result.meta)
  ) {
    return result.result;
  }
  return result;
}

export function asTokenRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const token = value.token && typeof value.token === "object" ? value.token : value;
  const mint = String(token.mint || value.mint || token.ca || value.ca || "").trim();
  const known = hydrateKnownMint(mint);
  const symbol = token.symbol || value.symbol || token.ticker || value.meta?.symbol || known?.symbol;
  const name = token.name || value.name || value.meta?.name || known?.name;
  if (!mint && !symbol && !name) return null;
  if (mint && !CA_RE.test(mint) && !symbol && !name) return null;
  if (value.holdings && Array.isArray(value.holdings) && (value.address || value.publicKey || value.sol != null)) {
    return null;
  }
  const record = {
    ...value,
    ...token,
    mint,
    symbol,
    name,
    meta: value.meta || token.meta,
    tags: Array.isArray(token.tags) && token.tags.length ? token.tags : known?.tags || token.tags,
    tokenProgram: token.tokenProgram || known?.tokenProgram,
    chain: token.chain || value.chain || value.meta?.chain || known?.chain,
  };
  if (!hasTokenIdentity(record) && !hasMarketSnapshot(record)) return null;
  return record;
}

export function kolRows(holders) {
  if (!Array.isArray(holders)) return [];
  return holders.filter((h) => {
    const blob = `${h.label || ""} ${h.tag || ""} ${(h.tags || []).join(" ")} ${h.name || ""} ${h.twitter || h.handle || ""}`.toLowerCase();
    return /\bkol\b|twitter|k(?:o|0)l|influencer|@/.test(blob) && !/whale|pool|lp/.test(h.label || "");
  });
}

export function telegramMessageParts(formatted) {
  if (formatted && typeof formatted === "object" && formatted.text) {
    return {
      text: String(formatted.text),
      reply_markup: formatted.reply_markup || undefined,
    };
  }
  return { text: String(formatted || ""), reply_markup: undefined };
}
