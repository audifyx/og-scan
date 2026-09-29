/**
 * Theme marketplace (#17).
 *
 * Buy/sell device themes in ORBITX. The theme REGISTRY (web/src/themes) is
 * read-only — this UI only reads it and never edits it. Listings live in
 * localStorage until the backend marketplace ships (BLOCKED: no backend
 * listing/order infra). Platform takes a burn cut on every sale.
 */
import { useState } from "react";
import { ACCENTS, BACKGROUND_THEMES, DEVICE_THEMES } from "../../themes/themes";
import { useDeviceTheme } from "../../themes/DeviceThemeProvider";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { BillingBanner } from "../ui/BurnButton";
import {
  ORBITX_PRICES,
  THEME_LISTINGS_KEY,
  formatOrbitx,
  spendReason,
} from "../constants";

type ThemeKind = "device" | "background" | "accent";
type Listing = {
  id: string;
  themeId: string;
  kind: ThemeKind;
  name: string;
  price: number;
  seller: string;
  signature: string;
  at: number;
};

function readListings(): Listing[] {
  try {
    const raw = localStorage.getItem(THEME_LISTINGS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeListings(list: Listing[]): void {
  try {
    localStorage.setItem(THEME_LISTINGS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const OWNED_KEY = "orbitx.billing.ownedThemes.v1";
function readOwned(): string[] {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function addOwned(themeId: string): void {
  try {
    const owned = readOwned();
    if (!owned.includes(themeId)) localStorage.setItem(OWNED_KEY, JSON.stringify([...owned, themeId]));
  } catch {
    /* ignore */
  }
}

type CatalogItem = { themeId: string; kind: ThemeKind; name: string; blurb: string };

const CATALOG: CatalogItem[] = [
  ...DEVICE_THEMES.map((t) => ({ themeId: t.id, kind: "device" as ThemeKind, name: t.name, blurb: t.blurb })),
  ...BACKGROUND_THEMES.map((t) => ({ themeId: t.id, kind: "background" as ThemeKind, name: t.name, blurb: t.blurb })),
  ...ACCENTS.map((t) => ({ themeId: t.id, kind: "accent" as ThemeKind, name: t.name, blurb: `Accent color ${t.value}` })),
];

export function ThemeMarketplace(): JSX.Element {
  const { ready, wallet, spend } = useOrbitxBilling();
  const { setDeviceTheme, setBackground, setAccent } = useDeviceTheme();
  const [listings, setListings] = useState<Listing[]>(() => readListings());
  const [owned, setOwned] = useState<string[]>(() => readOwned());
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setListings(readListings());
    setOwned(readOwned());
  };

  const applyTheme = (kind: ThemeKind, themeId: string) => {
    if (kind === "device") setDeviceTheme(themeId);
    else if (kind === "background") setBackground(themeId);
    else setAccent(themeId);
  };

  const listForSale = async (item: CatalogItem) => {
    const price = Math.floor(Number(prices[item.themeId] || 0));
    if (!Number.isFinite(price) || price <= 0) {
      setError("Set a sale price first.");
      return;
    }
    setBusy(item.themeId);
    setError(null);
    try {
      // Listing fee is burned up front.
      const { signature } = await spend({
        amount: ORBITX_PRICES.themeListingFee,
        reason: spendReason.themeListing(item.themeId),
      });
      const listing: Listing = {
        id: `lst-${Date.now()}`,
        themeId: item.themeId,
        kind: item.kind,
        name: item.name,
        price,
        seller: wallet || "you",
        signature,
        at: Date.now(),
      };
      writeListings([listing, ...readListings()]);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const buy = async (listing: Listing) => {
    setBusy(listing.id);
    setError(null);
    try {
      const cut = Math.ceil((listing.price * ORBITX_PRICES.themePlatformCutBps) / 10_000);
      // Buyer burns full price; platform cut is a second tagged burn.
      const buyRes = await spend({ amount: listing.price, reason: spendReason.themeBuy(listing.themeId) });
      void buyRes;
      await spend({ amount: cut, reason: spendReason.themePlatformCut(listing.themeId) });
      addOwned(listing.themeId);
      applyTheme(listing.kind, listing.themeId);
      writeListings(readListings().filter((l) => l.id !== listing.id));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BillingBanner />
      <div>
        <h3 style={{ margin: "0 0 4px" }}>Theme marketplace</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
          Buy and sell device themes in ORBITX. Listing fee {formatOrbitx(ORBITX_PRICES.themeListingFee)} burned ·{" "}
          {ORBITX_PRICES.themePlatformCutBps / 100}% platform burn cut on every sale.
        </p>
      </div>

      {listings.length > 0 ? (
        <div>
          <h4 style={{ margin: "0 0 8px" }}>For sale now</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {listings.map((l) => (
              <div key={l.id} style={{ border: "1px solid #374151", borderRadius: 10, padding: 12, background: "#0b0f16" }}>
                <div style={{ fontWeight: 700 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{l.kind} · seller {String(l.seller).slice(0, 8)}…</div>
                <div style={{ fontWeight: 700, color: "#fbbf24", margin: "6px 0" }}>{formatOrbitx(l.price)}</div>
                <button
                  type="button"
                  disabled={!ready || busy === l.id}
                  onClick={() => buy(l)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {busy === l.id ? "Burning…" : "Buy & apply"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h4 style={{ margin: "0 0 8px" }}>All themes</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {CATALOG.map((item) => (
            <div key={`${item.kind}:${item.themeId}`} style={{ border: "1px solid #1f2937", borderRadius: 10, padding: 12, background: "#0b0f16" }}>
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>{item.kind} · {item.blurb}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {owned.includes(item.themeId) ? (
                  <button
                    type="button"
                    onClick={() => applyTheme(item.kind, item.themeId)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #4b5563", background: "#1f2937", color: "#fff", cursor: "pointer" }}
                  >
                    Apply
                  </button>
                ) : (
                  <>
                    <input
                      value={prices[item.themeId] || ""}
                      onChange={(e) => setPrices((p) => ({ ...p, [item.themeId]: e.target.value.replace(/[^0-9]/g, "") }))}
                      placeholder="Price"
                      inputMode="numeric"
                      style={{ width: 80, padding: "6px 8px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff" }}
                      aria-label={`Sale price for ${item.name}`}
                    />
                    <button
                      type="button"
                      disabled={!ready || busy === item.themeId}
                      onClick={() => listForSale(item)}
                      style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#b45309", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                    >
                      {busy === item.themeId ? "…" : "List"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? <div style={{ fontSize: 12, color: "#f87171" }}>{error}</div> : null}
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Listing escrow is local for now — on-chain theme licenses ship with the backend marketplace.
      </div>
    </div>
  );
}
