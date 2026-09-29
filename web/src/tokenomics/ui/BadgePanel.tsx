/**
 * Profile tokenomics panel (#6, #10, #12b).
 * Verified badge mint, vanity handle claim, custom profile URL — all
 * burn ORBITX. Also shows the holder fee-discount tier.
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { useFeeDiscount } from "../gating";
import { BurnButton, BillingBanner } from "./BurnButton";
import { ORBITX_PRICES, formatOrbitx, spendReason } from "../constants";

const BADGE_KEY = "orbitx.billing.verifiedBadge.v1";
const HANDLE_KEY = "orbitx.billing.vanityHandle.v1";
const URL_KEY = "orbitx.billing.profileUrl.v1";

function readKey(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function writeKey(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

export function ProfileTokenomicsPanel(): JSX.Element {
  const { ready } = useOrbitxBilling();
  const { discountPct, balance } = useFeeDiscount();
  const [badgeSig, setBadgeSig] = useState<string | null>(() => readKey(BADGE_KEY));
  const [handle, setHandle] = useState("");
  const [handleSig, setHandleSig] = useState<string | null>(() => readKey(HANDLE_KEY));
  const [slug, setSlug] = useState("");
  const [slugSig, setSlugSig] = useState<string | null>(() => readKey(URL_KEY));

  return (
    <div className="flex flex-col gap-4 p-4">
      <BillingBanner />
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="text-sm font-bold text-white mb-1">Fee discount — {discountPct}% off</div>
        <p className="text-xs text-white/40 m-0">
          Holding {formatOrbitx(balance ?? 0)} in your in-app wallet. Discounts apply platform-wide
          (1k+ → 5%, 5k+ → 10%, 25k+ → 15%, 100k+ → 25%).
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-sm font-bold text-white mb-1">✓ Verified badge</div>
        <p className="text-xs text-white/40 mb-3">Mint a verified badge on your profile. Burn {formatOrbitx(ORBITX_PRICES.verifiedBadge)}.</p>
        {badgeSig ? (
          <a href={`https://solscan.io/tx/${badgeSig}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-400">
            Badge minted ✓ — view burn
          </a>
        ) : (
          <BurnButton
            amount={ORBITX_PRICES.verifiedBadge}
            reason={spendReason.verifiedBadge()}
            label={`Mint badge — burn ${formatOrbitx(ORBITX_PRICES.verifiedBadge)}`}
            disabled={!ready}
            onDone={(sig) => {
              writeKey(BADGE_KEY, sig);
              setBadgeSig(sig);
            }}
          />
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-sm font-bold text-white mb-1">Vanity handle</div>
        <p className="text-xs text-white/40 mb-3">Claim a custom @handle. Burn {formatOrbitx(ORBITX_PRICES.vanityHandle)}.</p>
        {handleSig ? (
          <div className="text-xs text-emerald-400">@{readKey(HANDLE_KEY + ":name") || handle} claimed ✓</div>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            <input value={handle} onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
              placeholder="@handle" className="px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm text-white w-40" />
            <BurnButton
              amount={ORBITX_PRICES.vanityHandle}
              reason={spendReason.vanityHandle(handle || "handle")}
              label="Claim handle"
              disabled={!ready || handle.length < 3}
              onDone={(sig) => {
                writeKey(HANDLE_KEY, sig);
                writeKey(HANDLE_KEY + ":name", handle);
                setHandleSig(sig);
              }}
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-sm font-bold text-white mb-1">Custom profile URL</div>
        <p className="text-xs text-white/40 mb-3">orbitx.world/u/<em>you</em>. Burn {formatOrbitx(ORBITX_PRICES.profileUrl)}.</p>
        {slugSig ? (
          <div className="text-xs text-emerald-400">orbitx.world/u/{readKey(URL_KEY + ":slug")} reserved ✓</div>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            <input value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, "").slice(0, 24))}
              placeholder="your-slug" className="px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm text-white w-40" />
            <BurnButton
              amount={ORBITX_PRICES.profileUrl}
              reason={spendReason.profileUrl(slug || "slug")}
              label="Reserve URL"
              disabled={!ready || slug.length < 3}
              onDone={(sig) => {
                writeKey(URL_KEY, sig);
                writeKey(URL_KEY + ":slug", slug);
                setSlugSig(sig);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
