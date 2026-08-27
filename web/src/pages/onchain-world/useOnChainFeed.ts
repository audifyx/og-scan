import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { allOrbitxKols } from "../../../shared/orbitx-kol-directory.js";
import { loadCityDistricts } from "../../../shared/orbitx-chain-districts.js";
import type { KolCard, WalletPayload } from "./api";
import { fetchDistricts, fetchEvents, fetchKols, fetchLive, fetchOrbitx, fetchStatus, fetchToken, fetchTrending, fetchTx, fetchWallet } from "./api";
import { liveToSnapshot, mergeChainEvents, toWalletSnapshot } from "./lib/mapLive";
import { tallyActivity } from "./activityStats";
import { ORBITX_MINT } from "../../../shared/orbitx-chain-intel.js";
import { keepTicker, mergeDistricts, tokenCatalogSize } from "./mergeDistricts";
import { useOrbitxStore } from "./lib/orbitx/store";

const DIRECTORY_KOLS: KolCard[] = allOrbitxKols().map((k) => ({
  address: k.address,
  name: k.name,
  twitter: k.twitter,
  status: k.status,
  hits: 0,
  last_type: null,
  last_token: null,
  last_mint: null,
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

async function fetchChainSlot(): Promise<number | null> {
  try {
    const status = await withTimeout(fetchStatus(), 4000);
    const slot = Number(status?.chain_slot ?? (status?.state as { chain_slot?: number } | undefined)?.chain_slot);
    if (Number.isFinite(slot) && slot > 0) return slot;
  } catch {
    /* public RPC is a last resort */
  }
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(id);
        reject(err);
      },
    );
  });
}

function detectWebgl(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    const gl =
      c.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
      c.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    const ok = Boolean(gl);
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
  const setCamCommand = useOrbitxStore((s) => s.setCamCommand);
  const setTokenDetail = useOrbitxStore((s) => s.setTokenDetail);
  const selectedToken = useOrbitxStore((s) => s.selectedToken);
  const liveInflight = useRef(false);
  const catalogInflight = useRef(false);

  useEffect(() => {
    patchCity({
      kols: DIRECTORY_KOLS,
      webglOk: detectWebgl(),
    });
  }, [patchCity]);

  const applyCatalog = useCallback(
    (
      trending: Awaited<ReturnType<typeof fetchTrending>> | null,
      city: Awaited<ReturnType<typeof fetchDistricts>> | null,
      liveDistricts?: Parameters<typeof mergeDistricts>[0],
    ) => {
      const districts = mergeDistricts(
        trending?.ok && trending.tokens?.length
          ? {
              orbitx: trending.orbitx || city?.orbitx || liveDistricts?.orbitx,
              hubs: city?.hubs || liveDistricts?.hubs,
              tokens: trending.tokens,
              trending_count: trending.count,
              window: trending.window,
            }
          : null,
        tokenCatalogSize(city) ? city : null,
        liveDistricts,
        useOrbitxStore.getState().city.districts,
      );
      if (tokenCatalogSize(districts) || districts.orbitx) {
        patchCity({ districts });
        const ticker = useOrbitxStore.getState().snapshot.ticker;
        if (districts.orbitx?.buys_24h != null || districts.orbitx?.sells_24h != null) {
          patchSnapshot({
            ticker: {
              ...ticker,
              orbitxBuys24h: districts.orbitx?.buys_24h ?? ticker.orbitxBuys24h,
              orbitxSells24h: districts.orbitx?.sells_24h ?? ticker.orbitxSells24h,
              orbitxTraders24h: districts.orbitx?.traders_24h ?? ticker.orbitxTraders24h,
            },
          });
        }
      }
      return districts;
    },
    [patchCity, patchSnapshot],
  );

  const loadCatalog = useCallback(async () => {
    if (catalogInflight.current) return;
    catalogInflight.current = true;
    try {
      const [trending, city] = await Promise.all([
        fetchTrending().catch(() => null),
        fetchDistricts().catch(() => null),
      ]);
      applyCatalog(trending, city);
    } catch {
      /* keep whatever catalog is already on screen */
    } finally {
      catalogInflight.current = false;
    }
  }, [applyCatalog]);

  const loadLive = useCallback(async () => {
    if (paused) return;
    // The 5s interval must not stack. Catalog and live are independent so a
    // slow /live poll cannot drop the 250-coin universe.
    if (liveInflight.current) return;
    liveInflight.current = true;
    try {
      const [data, roster, orbitx, orbitxPage, oxToken, slot] = await Promise.all([
        withTimeout(
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
          8000,
        ).catch(() => null),
        fetchKols().catch(() => null),
        fetchOrbitx().catch(() => null),
        fetchEvents("orbitx=1&limit=200").catch(() => null),
        fetchToken(ORBITX_MINT).catch(() => null),
        fetchChainSlot(),
      ]);
      const kols =
        roster?.ok && roster.kols.length
          ? roster.kols
          : data?.kols?.length
            ? data.kols
            : DIRECTORY_KOLS;
      const districts = mergeDistricts(
        data?.districts,
        useOrbitxStore.getState().city.districts,
      );
      const prev = useOrbitxStore.getState().snapshot;
      const liveEvents = data?.ok && data.events?.length ? data.events : [];
      const orbitxEvents = mergeChainEvents(
        orbitx?.ok ? orbitx.events : [],
        orbitx?.ok ? orbitx.buys : [],
        orbitx?.ok ? orbitx.sells : [],
        orbitx?.ok ? orbitx.burns : [],
        orbitxPage?.ok ? orbitxPage.events : [],
        oxToken?.ok ? oxToken.events : [],
      );
      const events = mergeChainEvents(liveEvents, orbitxEvents, roster?.ok ? roster.events : []);
      const payload = data?.ok ? { ...data, events } : { ...(data || {}), events, live: false, ok: false };
      if (payload.chain_slot == null && slot != null) payload.chain_slot = slot;
      const snapshot = liveToSnapshot(payload, null);
      snapshot.ticker = keepTicker(prev.ticker, snapshot.ticker);
      if (snapshot.ticker.block == null && slot != null) snapshot.ticker.block = slot;
      if (snapshot.network.lastIndexedBlock == null && slot != null) {
        snapshot.network.lastIndexedBlock = slot;
      }
      if (slot != null) snapshot.network.rpc = "healthy";
      if (orbitx?.ok || orbitxEvents.length) {
        const oxBuys = (orbitx?.buys || []).length || orbitxEvents.filter((e) => /BUY/i.test(e.event_type || "")).length;
        const oxSells = (orbitx?.sells || []).length || orbitxEvents.filter((e) => /SELL/i.test(e.event_type || "")).length;
        if (oxBuys) snapshot.ticker.orbitxBuys = oxBuys;
        if (oxSells) snapshot.ticker.orbitxSells = oxSells;
        if (orbitx?.totals?.burned) snapshot.ticker.orbitxBurned = orbitx.totals.burned;
      }
      const oxDistrict = districts?.orbitx || data?.districts?.orbitx;
      if (oxDistrict?.buys_24h != null) snapshot.ticker.orbitxBuys24h = oxDistrict.buys_24h;
      if (oxDistrict?.sells_24h != null) snapshot.ticker.orbitxSells24h = oxDistrict.sells_24h;
      if (oxDistrict?.traders_24h != null) snapshot.ticker.orbitxTraders24h = oxDistrict.traders_24h;
      const activity = tallyActivity(events);
      if (activity.total) {
        snapshot.ticker.buys = activity.buys;
        snapshot.ticker.sells = activity.sells;
        snapshot.ticker.swaps = activity.swaps;
        snapshot.ticker.transfers = activity.transfers;
        snapshot.ticker.burns = activity.burns;
        snapshot.ticker.kolEvents = activity.kol;
        snapshot.ticker.activeWallets = new Set(events.map((e) => e.wallet).filter(Boolean)).size;
      }
      setSnapshot({ ...snapshot, wallet: prev.wallet });
      patchCity({
        live: Boolean(data?.ok && data.live),
        liveLabel: data?.live_label || "INDEXING DELAY",
        liveReason: data?.live_reason || (data?.ok ? null : "Live feed delayed."),
        kols,
        districts,
        rawEvents: events,
        orbitxEvents,
        orbitxTotals: orbitx?.ok ? orbitx.totals || null : useOrbitxStore.getState().city.orbitxTotals,
        flows: data?.flows || [],
      });
    } catch (err) {
      patchCity({
        liveReason: err instanceof Error ? err.message : "Live feed failed.",
      });
    } finally {
      liveInflight.current = false;
    }
  }, [paused, patchCity, setSnapshot]);

  useEffect(() => {
    void loadCatalog();
    void loadLive();
    const liveId = window.setInterval(() => void loadLive(), 5000);
    const catalogId = window.setInterval(() => void loadCatalog(), 60_000);
    return () => {
      window.clearInterval(liveId);
      window.clearInterval(catalogId);
    };
  }, [loadCatalog, loadLive]);

  useEffect(() => {
    void loadCityDistricts()
      .then((city) => {
        if (city?.orbitx || city?.tokens?.length) {
          patchCity({
            districts: mergeDistricts(useOrbitxStore.getState().city.districts, city),
          });
          const ticker = useOrbitxStore.getState().snapshot.ticker;
          if (city.orbitx?.buys_24h != null || city.orbitx?.sells_24h != null) {
            patchSnapshot({
              ticker: {
                ...ticker,
                orbitxBuys24h: city.orbitx?.buys_24h ?? ticker.orbitxBuys24h,
                orbitxSells24h: city.orbitx?.sells_24h ?? ticker.orbitxSells24h,
                orbitxTraders24h: city.orbitx?.traders_24h ?? ticker.orbitxTraders24h,
              },
            });
          }
        }
      })
      .catch(() => undefined);
  }, [patchCity, patchSnapshot]);

  useEffect(() => {
    if (params.signature) {
      void fetchTx(params.signature).catch(() => undefined);
      return;
    }
    if (params.address && location.pathname.includes("/wallet/")) {
      trackWallet(params.address);
      setCamCommand({ kind: "wallet", address: params.address });
      return;
    }
    if (params.address && location.pathname.includes("/token/")) {
      selectToken(params.address);
      setCamCommand({ kind: "token", mint: params.address });
      void fetchToken(params.address)
        .then((data) => {
          if (data?.mint) setTokenDetail(data);
        })
        .catch(() => undefined);
    }
  }, [params.address, params.signature, trackWallet, selectToken, setCamCommand, setTokenDetail]);

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
