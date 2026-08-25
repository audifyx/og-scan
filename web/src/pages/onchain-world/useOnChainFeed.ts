import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";
import { loadCityDistricts } from "../../../shared/orbitx-chain-districts.js";
import type { KolCard, WalletPayload } from "./api";
import { fetchDistricts, fetchKols, fetchLive, fetchOrbitx, fetchToken, fetchTx, fetchWallet } from "./api";
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

async function fetchConfirmedSlot(): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [{ commitment: "confirmed" }],
      }),
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    const j = (await r.json()) as { result?: number };
    return typeof j.result === "number" ? j.result : null;
  } catch {
    return null;
  }
}

function detectWebgl(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    const gl =
      c.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
      c.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    const ok = Boolean(gl);
    const lose = gl && "getExtension" in gl ? gl.getExtension("WEBGL_lose_context") : null;
    lose?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

export function useOnChainFeed() {
  const params = useParams();
  const paused = useOrbitxStore((s) => s.paused);
  const selectedWallet = useOrbitxStore((s) => s.selectedWallet);
  const setSnapshot = useOrbitxStore((s) => s.setSnapshot);
  const patchSnapshot = useOrbitxStore((s) => s.patchSnapshot);
  const patchCity = useOrbitxStore((s) => s.patchCity);
  const trackWallet = useOrbitxStore((s) => s.trackWallet);

  useEffect(() => {
    patchCity({
      kols: DIRECTORY_KOLS,
      webglOk: detectWebgl(),
    });
  }, [patchCity]);

  const loadLive = useCallback(async () => {
    if (paused) return;
    try {
      const [data, roster, city, orbitx, slot] = await Promise.all([
        fetchLive({
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
        }),
        fetchKols().catch(() => null),
        fetchDistricts().catch(() => null),
        fetchOrbitx().catch(() => null),
        fetchConfirmedSlot(),
      ]);
      const kols =
        roster?.ok && roster.kols.length
          ? roster.kols
          : data.kols?.length
            ? data.kols
            : DIRECTORY_KOLS;
      const districts = city?.ok || city?.tokens || city?.orbitx ? city : data.districts;
      const prevWallet = useOrbitxStore.getState().snapshot.wallet;
      const liveEvents = data.ok && data.events?.length ? data.events : [];
      const orbitxEvents = orbitx?.ok && orbitx.events?.length ? orbitx.events : [];
      const events = liveEvents.length ? liveEvents : orbitxEvents;
      const payload = data.ok ? { ...data, events } : { ...data, events, live: false };
      if (payload.chain_slot == null && slot != null) payload.chain_slot = slot;
      const snapshot = liveToSnapshot(payload, null);
      if (snapshot.ticker.block == null && slot != null) snapshot.ticker.block = slot;
      if (snapshot.network.lastIndexedBlock == null && slot != null) {
        snapshot.network.lastIndexedBlock = slot;
      }
      if (slot != null) snapshot.network.rpc = "healthy";
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
        districts: districts || useOrbitxStore.getState().city.districts,
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
    void loadCityDistricts()
      .then((city) => {
        if (city?.orbitx || city?.tokens?.length) patchCity({ districts: city });
      })
      .catch(() => undefined);
  }, [patchCity]);

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
