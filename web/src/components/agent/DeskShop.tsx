import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { sendWalletTransaction } from "@/lib/orbitx/sendWalletTx";
import {
  ORBITX_SHOP_CATEGORIES,
  ORBITX_SHOP_GC,
  ORBITX_SHOP_SKUS,
  formatShopTeamMessage,
  usdToShopSol,
} from "@/lib/orbitx/desk-shop-catalog";

type ShopSku = {
  sku: string;
  kind: string;
  name: string;
  blurb: string;
  usd: number;
  hours?: number;
  category: string;
  needsMint?: boolean;
};

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function hoursLabel(hours?: number) {
  if (!hours) return "Stays on this wallet";
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)} days`;
}

export function DeskShop() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction, connected, wallet: adapterWallet } = useWallet();
  const { pickable, signInWith, busy: connectBusy } = useWalletSignIn();
  const wallet = publicKey?.toBase58() || "";

  const [mint, setMint] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [details, setDetails] = useState("");
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(ORBITX_SHOP_CATEGORIES[0]?.id || "board");
  const [busySku, setBusySku] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [solUsd, setSolUsd] = useState(0);

  useEffect(() => {
    fetch("/api/orbitx/shop", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const px = Number(d?.solUsd || 0);
        if (px > 1) setSolUsd(px);
      })
      .catch(() => undefined);
  }, []);

  const mintOk = MINT_RE.test(mint.trim());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ORBITX_SHOP_SKUS;
    return ORBITX_SHOP_SKUS.filter((s) =>
      `${s.name} ${s.blurb} ${s.sku} ${s.kind} ${s.category}`.toLowerCase().includes(q),
    );
  }, [query]);

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const s of filtered) next[s.category] = (next[s.category] || 0) + 1;
    return next;
  }, [filtered]);

  const onBuy = async (item: ShopSku) => {
    setError(null);
    setReceipt(null);
    setCopied(false);
    if (!connected || !wallet) {
      setError("Connect Phantom to check out.");
      return;
    }
    if (item.needsMint && !mintOk) {
      setError("Paste a CA in the listing dock to list or spotlight.");
      document.getElementById("shop-listing-dock")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if ((item.needsMint || item.sku === "year-stack") && mintOk && (!name.trim() || !ticker.trim())) {
      setError("Name and ticker are required to list a token.");
      return;
    }
    setBusySku(item.sku);
    try {
      const prepRes = await fetch("/api/orbitx/shop/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          sku: item.sku,
          mint: mintOk ? mint.trim() : undefined,
        }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok || !prep.ok || !prep.transaction) {
        throw new Error(prep.message || prep.error || "Could not build buy-and-burn");
      }
      const bytes = Uint8Array.from(atob(prep.transaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(bytes);
      const signature = await sendWalletTransaction(
        connection,
        {
          sendTransaction: sendTransaction ?? undefined,
          signTransaction: signTransaction ?? undefined,
          walletName: adapterWallet?.adapter?.name ?? null,
          preferJupiter: /jupiter/i.test(String(adapterWallet?.adapter?.name || "")),
        },
        tx,
        { skipPreflight: true },
      );
      const confirmRes = await fetch("/api/orbitx/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          sku: item.sku,
          signature,
          mint: mintOk ? mint.trim() : undefined,
          name: name.trim(),
          ticker: ticker.trim(),
          details: details.trim(),
          sol: prep.sol,
          solUsd: prep.solUsd,
          orbitxBurned: prep.orbitxBurned,
        }),
      });
      const confirmed = await confirmRes.json();
      const note =
        confirmed.receipt ||
        formatShopTeamMessage({
          usd: item.usd,
          sol: prep.sol,
          orbitxBurned: prep.orbitxBurned,
          itemName: item.name,
          sku: item.sku,
          signature,
          mint: mintOk ? mint.trim() : undefined,
          name: name.trim(),
          ticker: ticker.trim(),
          wallet,
          details: details.trim(),
        });
      setReceipt(note);
      if (!confirmRes.ok && !confirmed.ok) {
        setError(confirmed.message || "Burn landed. Copy the note and send it to the group.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not buy");
    } finally {
      setBusySku(null);
    }
  };

  const copyReceipt = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(receipt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="ox-desk-shop">
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">OrbitX shop</h1>
        <p className="ox-agent__lead">
          You are not paying the desk. One Phantom sign, Jupiter swap buys $ORBITX, and that supply
          burns. Same catalog as the Solana-betting shop — {ORBITX_SHOP_SKUS.length} utilities.
        </p>
      </div>

      <section id="shop-listing-dock" className={`ox-agent__panel${mintOk ? " is-ok" : ""}`}>
        <div className="ox-agent__panel-h">
          <h2 className="ox-agent__panel-title">Listing dock</h2>
          <span className="ox-agent__panel-hint">{mintOk ? "CA ready" : "Needed for listings"}</span>
        </div>
        <div className="ox-agent__panel-b">
          <p className="ox-agent__note" style={{ marginTop: 0 }}>
            Paste a CA once. Spotlight, featured, and creator cards read this dock. After you burn,
            copy the note and send it to the team.
          </p>
          <div className="ox-desk-shop__dock">
            <input
              className="ox-agent__input"
              value={mint}
              onChange={(e) => setMint(e.target.value.trim())}
              placeholder="Contract address"
              autoComplete="off"
              spellCheck={false}
            />
            <input
              className="ox-agent__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
            <input
              className="ox-agent__input"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="TICKER"
            />
          </div>
          <label className="ox-agent__label" htmlFor="ox-shop-details">
            Project details (goes in the copy-paste note)
          </label>
          <textarea
            id="ox-shop-details"
            className="ox-agent__input ox-desk-shop__details"
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Links, thesis, what you want featured…"
          />
        </div>
      </section>

      <div className="ox-desk-shop__jump">
        <input
          className="ox-agent__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a category, flare, rail, or SKU"
        />
        <div className="ox-desk-shop__pills">
          {ORBITX_SHOP_CATEGORIES.map((cat) => {
            const n = counts[cat.id] || 0;
            if (!n) return null;
            return (
              <button
                key={cat.id}
                type="button"
                className={`ox-desk-shop__pill${activeCat === cat.id ? " is-on" : ""}`}
                onClick={() => {
                  setActiveCat(cat.id);
                  document.getElementById(`shop-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {cat.title}
                <span>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!wallet && (
        <div className="ox-agent__btn-row">
          {pickable.slice(0, 3).map((w) => (
            <button
              key={w.name}
              type="button"
              className="ox-agent__btn"
              disabled={connectBusy === w.name}
              onClick={() => void signInWith(w.name, { replaceEmailSession: true })}
            >
              {connectBusy === w.name ? "Connecting…" : `Connect ${w.name}`}
            </button>
          ))}
        </div>
      )}

      {ORBITX_SHOP_CATEGORIES.map((cat) => {
        const items = filtered.filter((s) => s.category === cat.id);
        if (!items.length) return null;
        return (
          <section key={cat.id} id={`shop-${cat.id}`} className="ox-agent__panel">
            <div className="ox-agent__panel-h">
              <h2 className="ox-agent__panel-title">{cat.title}</h2>
              <span className="ox-agent__panel-hint">
                {cat.kicker} · {items.length}
              </span>
            </div>
            <div className="ox-agent__panel-b">
              <div className="ox-desk-shop__track">
                {items.map((item) => {
                  const sol = usdToShopSol(item.usd, solUsd);
                  const busy = busySku === item.sku;
                  return (
                    <article key={item.sku} className="ox-desk-shop__card">
                      <p className="ox-desk-shop__kind">{item.kind}</p>
                      <p className="ox-desk-shop__price">
                        ${item.usd}
                        <span>{sol} SOL</span>
                      </p>
                      <h3>{item.name}</h3>
                      <p className="ox-desk-shop__blurb">{item.blurb}</p>
                      <p className="ox-desk-shop__meta">{hoursLabel(item.hours)} · one Jupiter tx</p>
                      <button
                        type="button"
                        className="ox-agent__btn ox-agent__btn--primary"
                        disabled={Boolean(busySku)}
                        onClick={() => void onBuy(item)}
                      >
                        {busy ? "Jupiter swap…" : `Burn $${item.usd} · ${sol} SOL`}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {error && <div className="ox-agent__alert">{error}</div>}

      {receipt && (
        <section className="ox-agent__panel ox-desk-shop__receipt">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Send this to us</h2>
            <span className="ox-agent__panel-hint">copy · paste</span>
          </div>
          <div className="ox-agent__panel-b">
            <p className="ox-agent__note" style={{ marginTop: 0 }}>
              Fill any extra project detail under the 👇 line, then paste it in{" "}
              <a href={ORBITX_SHOP_GC} target="_blank" rel="noreferrer">
                t.me/orbitxwrld
              </a>
              .
            </p>
            <textarea className="ox-agent__input ox-desk-shop__details" rows={12} readOnly value={receipt} />
            <div className="ox-agent__btn-row">
              <button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => void copyReceipt()}>
                {copied ? "Copied" : "Copy message"}
              </button>
              <a className="ox-agent__btn" href={ORBITX_SHOP_GC} target="_blank" rel="noreferrer">
                Open group
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
