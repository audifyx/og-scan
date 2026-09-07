/**
 * Parse mint + intent from a raw CA, ticker, GMGN prefix, or explorer URL.
 * Never invent a mint — return empty when nothing matches.
 */

export const SOLANA_CA_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
export const EVM_CA_RE = /0x[a-fA-F0-9]{40}/;
export const GMGN_PREFIX_RE = /^([A-Za-z0-9]{2,16})_([1-9A-HJ-NP-Za-km-z]{32,44})$/;

const INTEL_HOSTS = [
  "gmgn.ai",
  "www.gmgn.ai",
  "dexscreener.com",
  "www.dexscreener.com",
  "pump.fun",
  "www.pump.fun",
  "solscan.io",
  "www.solscan.io",
  "birdeye.so",
  "www.birdeye.so",
  "jup.ag",
  "www.jup.ag",
];

export function stripGmgnPrefix(raw) {
  const s = String(raw || "").trim();
  const m = s.match(GMGN_PREFIX_RE);
  return m ? m[2] : s;
}

export function isIntelExplorerUrl(text) {
  const s = String(text || "");
  return /gmgn\.ai|dexscreener\.com|pump\.fun|solscan\.io|birdeye\.so|jup\.ag\/tokens/i.test(s);
}

function pathTokens(pathname) {
  return String(pathname || "")
    .split("/")
    .map((p) => decodeURIComponent(p || "").trim())
    .filter(Boolean);
}

function pickCaFromToken(token) {
  const t = stripGmgnPrefix(String(token || "").split("?")[0].split("#")[0]);
  if (EVM_CA_RE.test(t) && t.length === 42) return t;
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) return t;
  const prefixed = t.match(GMGN_PREFIX_RE);
  if (prefixed) return prefixed[2];
  return "";
}

export function extractMintFromUrl(text) {
  const s = String(text || "").trim();
  const urlMatch = s.match(/https?:\/\/[^\s<>"']+/i) || s.match(/\b(?:www\.)?(?:gmgn\.ai|dexscreener\.com|pump\.fun|solscan\.io|birdeye\.so|jup\.ag)\/[^\s<>"']+/i);
  if (!urlMatch) return "";
  let href = urlMatch[0];
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const parts = pathTokens(u.pathname);
    if (host === "gmgn.ai") {
      const idx = parts.findIndex((p) => p === "token" || p === "address");
      if (idx >= 0 && parts[idx + 1]) return pickCaFromToken(parts[idx + 1]);
      for (const p of [...parts].reverse()) {
        const ca = pickCaFromToken(p);
        if (ca) return ca;
      }
    }
    if (host === "dexscreener.com") {
      for (const p of [...parts].reverse()) {
        const ca = pickCaFromToken(p);
        if (ca) return ca;
      }
    }
    if (host === "pump.fun") {
      for (const p of [...parts].reverse()) {
        const ca = pickCaFromToken(p);
        if (ca) return ca;
      }
    }
    if (host === "solscan.io") {
      const idx = parts.findIndex((p) => p === "token" || p === "account" || p === "address");
      if (idx >= 0 && parts[idx + 1]) return pickCaFromToken(parts[idx + 1]);
    }
    if (host === "birdeye.so") {
      const idx = parts.findIndex((p) => p === "token");
      if (idx >= 0 && parts[idx + 1]) return pickCaFromToken(parts[idx + 1]);
    }
    if (host === "jup.ag") {
      const idx = parts.findIndex((p) => p === "tokens" || p === "token");
      if (idx >= 0 && parts[idx + 1]) return pickCaFromToken(parts[idx + 1].split("-").pop());
    }
    if (INTEL_HOSTS.includes(u.hostname.toLowerCase()) || INTEL_HOSTS.includes(host)) {
      for (const p of [...parts].reverse()) {
        const ca = pickCaFromToken(p);
        if (ca) return ca;
      }
    }
  } catch {
    /* fall through */
  }
  return "";
}

export function extractMintFromText(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  const fromUrl = extractMintFromUrl(s);
  if (fromUrl) return fromUrl;
  const prefixed = s.match(/\b([A-Za-z0-9]{2,16})_([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  if (prefixed) return prefixed[2];
  const evm = s.match(/\b(0x[a-fA-F0-9]{40})\b/);
  if (evm) return evm[1];
  const sol = s.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  return sol ? sol[1] : "";
}

export function parseIntelIntent(text) {
  const t = String(text || "").toLowerCase();
  let depth = "max";
  if (/\bquick\b/.test(t)) depth = "quick";
  else if (/\bstandard\b/.test(t)) depth = "standard";
  const pdf = /\bpdf\b/.test(t);
  const bundleOnly = /bundle[- ]only|bundles? only/.test(t);
  const socialOnly = /social[- ]only|socials? only/.test(t);
  const full =
    pdf ||
    bundleOnly ||
    socialOnly ||
    /\b(full report|full intel|dossier|intel report|xray|tell me about)\b/.test(t) ||
    isIntelExplorerUrl(text);
  return { depth, pdf, bundleOnly, socialOnly, full };
}

export function looksLikeMint(value) {
  const s = String(value || "").trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return true;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}
