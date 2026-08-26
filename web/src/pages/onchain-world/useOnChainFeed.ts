import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";
import type { KolCard, WalletPayload } from "./api";
import { fetchKols, fetchLive, fetchOrbitx, fetchToken, fetchTx, fetchWallet } from "./api";
import { liveToSnapshot, toWalletSnapshot } from "./lib/mapLive";
import { useOrbitxStore } from "./lib/orbitx/store";

const DIRECTORY_KOLS: KolCard[] = activeOrbitxKols().map((k) => ({
  address: k.address,
  name: k.name,
  twitter: k.twitter,
  status: k.status,
  hits: 0,
  last_type: null,
  last_token: null,
  last_usd: null,
  last_at: null,
}));

useOrbitxStore.getState().patchCity({ kols: DIRECTORY_KOLS });

const LIVE_FILTERS = {
  type: "",
  orbitx: false,
  whale: false,
  kol: false,
  tracked: false,
  minUsd: "",
  source: "",
  token: "",
  wallet: "",
  window: "live",
};

function seedWallet(address: string, roster: KolCard[]): WalletPayload {
  const known = roster.find((k) => k.address === address);
  return {
    ok: false,
    address,
    kol: known ? { address: known.address, name: known.name, twitter: known.twitter, status: known.status } : null,
    assigned_kol: Boolean(known),
    label: known?.name || null,
    label_kind: known ? "KOL" : "Wallet",
  };
}

export function useOnChainFeed() {
  const params = useParams();
  const paused = useOrbitxStore((s) => s.paused);
  const selectedWallet = useOrbitxStore((s) => s.selectedWallet);
  const setSnapshot = useOrbitxStore((s) => s.setSnapshot);
  const patchSnapshot = useOrbitxStore((s) => s.patchSnapshot);
  const patchCity = useOrbitxStore((s) => s.patchCity);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);

  const loadLive = useCallback(async () => {
    if (paused) return;
    try {
      const [data, roster, orbitx] = await Promise.all([
        fetchLive(LIVE_FILTERS),
        fetchKols().catch(() => null),
        fetchOrbitx().catch(() => null),
      ]);
      const kols =
        roster?.ok && roster.kols.length
          ? roster.kols
          : data.kols?.length
            ? data.kols
            : DIRECTORY_KOLS;
      const prevWallet = useOrbitxStore.getState().snapshot.wallet;
      const liveEvents = data.ok && data.events?.length ? data.events : [];
      const orbitxEvents = orbitx?.ok && orbitx.events?.length ? orbitx.events : [];
      const events = liveEvents.length ? liveEvents : orbitxEvents;
      const snapshot = liveToSnapshot({ ...data, events }, null);
      if (orbitx?.ok && orbitx.totals) {
        const hasOx = Boolean(orbitx.burns?.length || orbitx.buys?.length || orbitx.events?.length);
        if (snapshot.ticker.orbitxBurned == null && orbitx.totals.burned) {
          snapshot.ticker.orbitxBurned = orbitx.totals.burned;
        }
        if (snapshot.ticker.activeWallets == null && hasOx && orbitx.totals.unique_wallets) {
          snapshot.ticker.activeWallets = orbitx.totals.unique_wallets;
        }
      }
      setSnapshot({ ...snapshot, wallet: prevWallet });
      patchCity({
        live: Boolean(data.ok && data.live),
        liveLabel: data.live_label || "INDEXING DELAY",
        liveReason: data.live_reason || (data.ok ? null : "Live feed failed."),
        kols,
        rawEvents: events,
        flows: data.flows || [],
      });
    } catch (err) {
      patchCity({
        liveReason: err instanceof Error ? err.message : "Live feed failed.",
      });
    }
  }, [paused, patchCity, setSnapshot]);

  useEffect(() => {
    void loadLive();
    const id = window.setInterval(() => void loadLive(), 5000);
    return () => window.clearInterval(id);
  }, [loadLive]);

  useEffect(() => {
    if (params.signature) {
      void fetchTx(params.signature).catch(() => undefined);
      return;
    }
    if (params.address && location.pathname.includes("/wallet/")) {
      trackWallet(params.address);
      return;
    }
    if (params.address && location.pathname.includes("/token/")) {
      void fetchToken(params.address).catch(() => undefined);
    }
  }, [params.address, params.signature, trackWallet]);

  useEffect(() => {
    if (!selectedWallet) {
      patchSnapshot({ wallet: null });
      return;
    }
    const roster = useOrbitxStore.getState().city.kols;
    patchSnapshot({ wallet: toWalletSnapshot(seedWallet(selectedWallet, roster)) });
    void fetchWallet(selectedWallet)
      .then((data) => {
        if (data?.address) patchSnapshot({ wallet: toWalletSnapshot(data) });
      })
      .catch(() => undefined);
  }, [selectedWallet, patchSnapshot]);

  return { directory: DIRECTORY_KOLS };
}
