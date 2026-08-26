import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { activeOrbitxKols } from "../../../shared/orbitx-kol-directory.js";
import { loadCityDistricts } from "../../../shared/orbitx-chain-districts.js";
import type { KolCard, WalletPayload } from "./api";
import { fetchDistricts, fetchEvents, fetchKols, fetchLive, fetchOrbitx, fetchToken, fetchTrending, fetchTx, fetchWallet } from "./api";
import { liveToSnapshot, mergeChainEvents, toWalletSnapshot } from "./lib/mapLive";
import { ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
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
  const selectToken = useOrbitxStore((s) => s.selectToken);
  const setTokenDetail = useOrbitxStore((s) => s.setTokenDetail);
  const selectedToken = useOrbitxStore((s) => s.selectedToken);

  useEffect(() => {
    patchCity({
      kols: DIRECTORY_KOLS,
      webglOk: detectWebgl(),
    });
  }, [patchCity]);

  const loadLive = useCallback(async () => {
    if (paused) return;
    try {
      const [data, roster, city, orbitx, orbitxPage, oxToken, trending, slot] = await Promise.all([
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
        fetchEvents("orbitx=1&limit=200").catch(() => null),
        fetchToken(ORBITX_MINT).catch(() => null),
        fetchTrending().catch(() => null),
        fetchConfirmedSlot(),
      ]);
      const kols =
        roster?.ok && roster.kols.length
          ? roster.kols
          : data.kols?.length
            ? data.kols
            : DIRECTORY_KOLS;
      const districts =
        trending?.ok && trending.tokens?.length
          ? { orbitx: trending.orbitx || city?.orbitx || data.districts?.orbitx, hubs: city?.hubs || data.districts?.hubs, tokens: trending.tokens, trending_count: trending.count, window: trending.window }
          : city?.ok || city?.tokens || city?.orbitx
            ? city
            : data.districts;
      const prevWallet = useOrbitxStore.getState().snapshot.wallet;
      const liveEvents = data.ok && data.events?.length ? data.events : [];
      const orbitxEvents = mergeChainEvents(
        orbitx?.ok ? orbitx.events : [],
        orbitx?.ok ? orbitx.buys : [],
        orbitx?.ok ? orbitx.sells : [],
        orbitx?.ok ? orbitx.burns : [],
        orbitxPage?.ok ? orbitxPage.events : [],
        oxToken?.ok ? oxToken.events : [],
      );
      const events = mergeChainEvents(liveEvents, orbitxEvents);
      const payload = data.ok ? { ...data, events } : { ...data, events, live: false };
      if (payload.chain_slot == null && slot != null) payload.chain_slot = slot;
      const snapshot = liveToSnapshot(payload, null);
      if (snapshot.ticker.block == null && slot != null) snapshot.ticker.block = slot;
      if (snapshot.network.lastIndexedBlock == null && slot != null) {
        snapshot.network.lastIndexedBlock = slot;
      }
      if (slot != null) snapshot.network.rpc = "healthy";
      if (orbitx?.ok || orbitxEvents.length) {
        const oxBuys = (orbitx?.buys || []).length || orbitxEvents.filter((e) => /BUY/i.test(e.event_type || "")).length;
        if (oxBuys) snapshot.ticker.orbitxBuys = oxBuys;
        if (orbitx?.totals?.burned) snapshot.ticker.orbitxBurned = orbitx.totals.burned;
        if (orbitx?.totals?.unique_wallets) snapshot.ticker.activeWallets = orbitx.totals.unique_wallets;
      }
      setSnapshot({ ...snapshot, wallet: prevWallet });
      patchCity({
        live: Boolean(data.ok && data.live),
        liveLabel: data.live_label || "INDEXING DELAY",
        liveReason: data.live_reason || (data.ok ? null : "Live feed failed."),
        kols,
        districts: districts || useOrbitxStore.getState().city.districts,
        rawEvents: events,
        orbitxEvents,
        orbitxTotals: orbitx?.ok ? orbitx.totals || null : useOrbitxStore.getState().city.orbitxTotals,
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
      selectToken(params.address);
      void fetchToken(params.address)
        .then((data) => {
          if (data?.mint) setTokenDetail(data);
        })
        .catch(() => undefined);
    }
  }, [params.address, params.signature, trackWallet, selectToken, setTokenDetail]);

  useEffect(() => {
    if (!selectedToken) return;
    if (params.address === selectedToken) return;
    void fetchToken(selectedToken)
      .then((data) => {
        if (data?.mint) setTokenDetail(data);
      })
      .catch(() => undefined);
  }, [selectedToken, params.address, setTokenDetail]);

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
