import { vanityEta, vanityPatternLength } from "./intent";

export type VanityGrindOpts = {
  prefix?: string;
  suffix?: string;
  caseInsensitive?: boolean;
};

export type VanityGrindResult = {
  publicKey: string;
  secretKey: string;
  attempts: number;
  timeMs: number;
};

export function normalizeVanityPattern(opts: VanityGrindOpts): { prefix: string; suffix: string; chars: number } {
  const prefix = (opts.prefix || "").replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
  const suffix = (opts.suffix || "").replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
  return { prefix, suffix, chars: prefix.length + suffix.length };
}

export function vanityWorkerPayload(opts: VanityGrindOpts): { suffix?: string; prefix?: string; caseInsensitive: boolean } | { error: string } {
  const { prefix, suffix, chars } = normalizeVanityPattern(opts);
  if (chars > 5) return { error: "Vanity pattern max 5 characters" };
  if (chars === 0) return { error: "Enter a prefix or suffix" };
  return {
    prefix: prefix || undefined,
    suffix: suffix || undefined,
    caseInsensitive: opts.caseInsensitive !== false,
  };
}

export async function grindMint(opts: VanityGrindOpts): Promise<VanityGrindResult> {
  const payload = vanityWorkerPayload(opts);
  if ("error" in payload) throw new Error(payload.error);
  const { chars } = normalizeVanityPattern(opts);
  const eta = vanityEta(chars);
  if (eta.disabled) throw new Error(eta.label);

  const res = await fetch("/api/vanity-mint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix: payload.prefix,
      suffix: payload.suffix ?? "obx",
      caseInsensitive: payload.caseInsensitive,
      maxIterations: chars >= 5 ? 8_000_000 : 5_000_000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "grind failed" }));
    throw new Error(err.error || "grind failed");
  }
  return res.json();
}
