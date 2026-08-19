/**
 * OrbitX City Burn Store — Jupiter buy ORBITX, burn supply, unlock in-game items.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { ExternalLink, Flame, Heart, Loader2, Shirt, Store, Wand2, Megaphone, ListPlus, Crown } from "lucide-react";
import { toast } from "sonner";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { OGSCAN_TOKEN_MINT } from "@/lib/og";
import {
  CITY_SHOP_ITEMS,
  CITY_SHOP_MINT,
  applyShopAppearance,
  equipPurchase,
  getShopItem,
  loadPurchases,
  ownsItem,
  type ShopCategory,
  type ShopPurchase,
} from "@/lib/orbitxcity/cityShop";
import { buyAndBurnShopItem, quoteShopItem } from "@/lib/orbitxcity/cityShopCheckout";
import { fetchTokenDetail } from "@/lib/orbitxcity/tokenApi";
import { fmtUsd } from "@/lib/orbitxcity/marketData";
import { loadWishlist, shopRarity, toggleWishlist } from "@/lib/orbitxcity/metaverseHub";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const TABS: Array<{ id: ShopCategory; label: string; icon: typeof Shirt }> = [
  { id: "wear", label: "Wear", icon: Shirt },
  { id: "character", label: "Characters", icon: Wand2 },
  { id: "ads", label: "Ads", icon: Megaphone },
  { id: "listing", label: "Listings", icon: ListPlus },
  { id: "perk", label: "Perks", icon: Crown },
];

export function CityShopPanel() {
  const { avatar, setAvatar, refreshShop } = useCity();
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction, wallet, connect, connecting } = useWallet();
  const walletKey = publicKey?.toBase58() ?? "";
  const [tab, setTab] = useState<ShopCategory>("wear");
  const [purchases, setPurchases] = useState<ShopPurchase[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listingMint, setListingMint] = useState("");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [wishlist, setWishlist] = useState<string[]>(() => loadWishlist());

  useEffect(() => {
    setPurchases(loadPurchases(walletKey));
  }, [walletKey]);

  const price = useQuery({
    queryKey: ["oxc-orbitx-price"],
    queryFn: () => fetchTokenDetail(CITY_SHOP_MINT),
    refetchInterval: 20_000,
  });

  const items = useMemo(() => CITY_SHOP_ITEMS.filter((i) => i.category === tab), [tab]);
  const orbitxPx = price.data?.priceUsd ?? 0;

  const ensureWallet = async (): Promise<boolean> => {
    if (connected && publicKey && signTransaction) return true;
    if (wallet && !connected) {
      try {
        await connect();
        return Boolean(wallet.adapter.publicKey);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reconnect wallet");
        return false;
      }
    }
    toast.error("Connect a Solana wallet — Jupiter only");
    return false;
  };

  const buy = async (itemId: string) => {
    const item = getShopItem(itemId);
    if (!item) return;
    if (item.category === "listing" && listingMint.trim().length < 32) {
      toast.error("Paste a Solana mint to list");
      return;
    }
    const ok = await ensureWallet();
    if (!ok || !signTransaction) return;
    const pk = publicKey ?? wallet?.adapter.publicKey;
    if (!pk) {
      toast.error("Wallet has no public key yet");
      return;
    }
    setBusyId(itemId);
    try {
      const quote = await quoteShopItem(itemId);
      const purchase = await buyAndBurnShopItem({
        connection,
        wallet: {
          publicKey: pk,
          signSwap: (tx) => signTransaction(tx as VersionedTransaction) as Promise<VersionedTransaction>,
          signLegacy: (tx) => signTransaction(tx as Transaction) as Promise<Transaction>,
        },
        quote,
        listingMint: item.category === "listing" ? listingMint.trim() : undefined,
        bannerTitle: item.category === "ads" ? bannerTitle.trim() || item.name : undefined,
        bannerSubtitle: item.category === "ads" ? bannerSubtitle.trim() || "ORBITX CITY" : undefined,
      });
      const next = loadPurchases(pk.toBase58());
      setPurchases(next);
      if (purchase.equipped && item.appearance) {
        setAvatar(applyShopAppearance(avatar, next));
      }
      refreshShop();
      toast.success(`Burned ${purchase.orbitxBurned.toFixed(2)} ORBITX · unlocked ${item.name}`, {
        description: `swap ${purchase.swapSig.slice(0, 8)}… · burn ${purchase.burnSig.slice(0, 8)}…`,
        action: {
          label: "Burn tx",
          onClick: () => window.open(`https://solscan.io/tx/${purchase.burnSig}`, "_blank"),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Shop purchase failed");
    } finally {
      setBusyId(null);
    }
  };

  const equip = (itemId: string) => {
    if (!walletKey) return;
    const next = equipPurchase(walletKey, itemId);
    setPurchases(next);
    setAvatar(applyShopAppearance(avatar, next));
    refreshShop();
    toast.success("Equipped — look is live in the city");
  };

  return (
    <div className="oxc-stack oxc-shop">
      <div className="oxc-hero-tile launch">
        <Store className="h-5 w-5" />
        <div>
          <div className="oxc-tile-title">Burn Store · Jupiter only</div>
          <p className="oxc-muted">
            Buy the USD amount in $ORBITX, burn it, unlock the item. Clothes and characters apply in-world.
            Ads go on building faces. Listings hit the city tape.
          </p>
        </div>
      </div>

      <div className="oxc-stat-row dense">
        <div>
          <small>ORBITX</small>
          <b>{fmtUsd(orbitxPx)}</b>
        </div>
        <div>
          <small>MINT</small>
          <b>13H4…PX9</b>
        </div>
        <div>
          <small>OWNED</small>
          <b>{purchases.length}</b>
        </div>
        <div>
          <small>RAILS</small>
          <b>Jupiter</b>
        </div>
      </div>

      {!connected && (
        <div className="oxc-tile on">
          <div className="oxc-tile-title">Wallet required</div>
          <p className="oxc-muted">Phantom / Solflare signs the Jupiter swap, then the burn. No other DEX.</p>
          <div className="oxc-actions" style={{ marginTop: "0.6rem" }}>
            <WalletConnectButton />
          </div>
        </div>
      )}

      <div className="oxc-store-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" className={`oxc-store-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "listing" && (
        <label className="oxc-field">
          Token mint to list
          <input value={listingMint} onChange={(e) => setListingMint(e.target.value)} placeholder="Solana mint address" />
        </label>
      )}
      {tab === "ads" && (
        <>
          <label className="oxc-field">
            Banner title
            <input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="YOUR PROJECT" />
          </label>
          <label className="oxc-field">
            Banner subtitle
            <input value={bannerSubtitle} onChange={(e) => setBannerSubtitle(e.target.value)} placeholder="TRADE · CHILL · BUILD" />
          </label>
        </>
      )}

      <div className="oxc-shop-grid">
        {items.map((item) => {
          const owned = ownsItem(purchases, item.id);
          const equipped = purchases.some((p) => p.itemId === item.id && p.equipped);
          const burnEst = orbitxPx > 0 ? (item.priceUsd / orbitxPx) * 1.03 : 0;
          return (
            <article key={item.id} className={`oxc-shop-card ${owned ? "is-owned" : ""}`} style={{ ["--shop" as string]: item.accent }}>
              <div className="oxc-shop-card-top">
                <span className="oxc-inv-kind">{item.category}</span>
                <span className={`oxc-rarity oxc-rarity-${shopRarity(item.priceUsd)}`}>{shopRarity(item.priceUsd)}</span>
                <strong>{fmtUsd(item.priceUsd)}</strong>
              </div>
              <h3>{item.name}</h3>
              <p>{item.blurb}</p>
              <div className="oxc-muted">
                Burn ~{burnEst > 0 ? burnEst.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} ORBITX
              </div>
              <div className="oxc-actions">
                <button
                  type="button"
                  className={`oxc-btn ghost compact ${wishlist.includes(item.id) ? "on" : ""}`}
                  onClick={() => setWishlist(toggleWishlist(item.id))}
                  aria-label={wishlist.includes(item.id) ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart className="h-3.5 w-3.5" fill={wishlist.includes(item.id) ? "currentColor" : "none"} />
                </button>
                {owned && (item.category === "wear" || item.category === "character") && (
                  <button type="button" className="oxc-btn ghost compact" onClick={() => equip(item.id)} disabled={equipped}>
                    {equipped ? "Equipped" : "Wear in city"}
                  </button>
                )}
                <button
                  type="button"
                  className="oxc-btn primary compact"
                  onClick={() => void buy(item.id)}
                  disabled={Boolean(busyId) || (owned && item.category !== "ads" && item.category !== "listing")}
                >
                  {busyId === item.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Burning…
                    </>
                  ) : owned && item.category !== "ads" && item.category !== "listing" ? (
                    "Owned"
                  ) : (
                    <>
                      <Flame className="h-3.5 w-3.5" /> Buy & burn
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <a className="oxc-btn ghost" href={`https://solscan.io/token/${OGSCAN_TOKEN_MINT}`} target="_blank" rel="noreferrer">
        ORBITX mint <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {connecting && <div className="oxc-muted">Reconnecting wallet…</div>}
    </div>
  );
}
