/** NFT → launchpad token handoff. Persist identity so Create Token can auto-fill. */
export type TokenCreatePrefill = {
  name: string;
  symbol: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  /** data:image/...;base64,... — preferred when just minted */
  imageDataUrl?: string | null;
  /** Remote image URL — used when launching later from a collection page */
  imageUrl?: string | null;
  /** If set, successful pump launch will link coin_mint on this collection */
  collectionId?: string | null;
  source?: "nft" | "collection" | "telegram";
  telegramUserId?: string | null;
  telegramChatId?: string | null;
  confirmNonce?: string | null;
};

const KEY = "orbitx_token_create_prefill";

export function saveTokenCreatePrefill(draft: TokenCreatePrefill): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      ...draft,
      name: draft.name.trim(),
      symbol: draft.symbol.trim().toUpperCase(),
      description: draft.description?.trim() ?? "",
      website: draft.website?.trim() ?? "",
      twitter: draft.twitter?.trim() ?? "",
      telegram: draft.telegram?.trim() ?? "",
      telegramUserId: draft.telegramUserId || null,
      telegramChatId: draft.telegramChatId || null,
      confirmNonce: draft.confirmNonce || null,
    }));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function peekTokenCreatePrefill(): TokenCreatePrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenCreatePrefill;
    if (!parsed?.name || !parsed?.symbol) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Read once and clear so a refresh doesn't keep re-applying stale drafts. */
export function consumeTokenCreatePrefill(): TokenCreatePrefill | null {
  const draft = peekTokenCreatePrefill();
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return draft;
}

export function clearTokenCreatePrefill(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function buildCreateTokenHref(lane: "pump" | "custom" = "pump"): string {
  return `/orbitxlaunch/create/${lane}?from=nft`;
}

export async function dataUrlToFile(dataUrl: string, filename = "token-logo.png"): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = blob.type || "image/png";
  const ext = type.includes("jpeg") || type.includes("jpg") ? "jpg"
    : type.includes("webp") ? "webp"
    : type.includes("gif") ? "gif"
    : "png";
  const name = filename.includes(".") ? filename : `${filename}.${ext}`;
  return new File([blob], name, { type });
}

export async function urlToFile(url: string, filename = "token-logo.png"): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const type = blob.type || "image/png";
    const ext = type.includes("jpeg") || type.includes("jpg") ? "jpg"
      : type.includes("webp") ? "webp"
      : type.includes("gif") ? "gif"
      : "png";
    const name = filename.includes(".") ? filename : `${filename}.${ext}`;
    return new File([blob], name, { type });
  } catch {
    return null;
  }
}
