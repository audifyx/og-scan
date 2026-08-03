/**
 * Local trading wallet manager — import / export / default / remove.
 * Separate from Phantom connect and OrbitX login identity.
 */

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocalTradingWallets } from "@/hooks/useLocalTradingWallets";
import { shortAddr } from "./tradeFmt";

type Panel = "list" | "import" | "export";

export default function TradeWalletManager() {
  const { connection } = useConnection();
  const {
    wallets,
    defaultId,
    mode,
    setMode,
    importWallet,
    createWallet,
    setDefault,
    remove,
    exportSecret,
  } = useLocalTradingWallets();

  const [panel, setPanel] = useState<Panel>("list");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [exportId, setExportId] = useState<string | null>(null);
  const [exportConfirm, setExportConfirm] = useState("");
  const [exported, setExported] = useState("");
  const [copied, setCopied] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    const next: Record<string, number | null> = {};
    await Promise.all(
      wallets.slice(0, 12).map(async (w) => {
        try {
          const lamports = await connection.getBalance(new PublicKey(w.publicKey));
          next[w.id] = lamports / 1e9;
        } catch {
          next[w.id] = null;
        }
      }),
    );
    setBalances(next);
  }, [connection, wallets]);

  useEffect(() => {
    if (wallets.length) void loadBalances();
    else setBalances({});
  }, [wallets, loadBalances]);

  const onImport = async () => {
    setErr("");
    setBusy(true);
    try {
      await importWallet(secret, label);
      setSecret("");
      setLabel("");
      setPanel("list");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    setErr("");
    setBusy(true);
    try {
      await createWallet(label || undefined);
      setLabel("");
      setPanel("list");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not create wallet");
    } finally {
      setBusy(false);
    }
  };

  const startExport = (id: string) => {
    setExportId(id);
    setExportConfirm("");
    setExported("");
    setErr("");
    setPanel("export");
  };

  const onExport = async () => {
    if (!exportId) return;
    if (exportConfirm.trim().toUpperCase() !== "EXPORT") {
      setErr('Type EXPORT to confirm');
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const s = await exportSecret(exportId);
      setExported(s);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const copyExport = () => {
    if (!exported) return;
    void navigator.clipboard.writeText(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const closeExport = () => {
    setExported("");
    setExportConfirm("");
    setExportId(null);
    setPanel("list");
  };

  const onRemove = (id: string) => {
    if (removeId !== id) {
      setRemoveId(id);
      return;
    }
    remove(id);
    setRemoveId(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#060606] px-4 py-4">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h1
            className="text-[26px] font-black tracking-tight"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}
          >
            Trading wallets
          </h1>
          <p className="mt-0.5 text-[12px] text-white/40">
            Local key wallets for Trade — separate from login / Phantom
          </p>
        </div>
        <Link
          to="/trade/profile"
          className="mt-1 shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-[11px] text-white/50 hover:text-white"
        >
          Back
        </Link>
      </div>

      {/* Mode toggle */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setMode("connected")}
            className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${
              mode === "connected" ? "bg-white text-black" : "text-white/45 hover:text-white/70"
            }`}
          >
            Connected wallet
          </button>
          <button
            type="button"
            onClick={() => setMode("local")}
            className={`rounded-xl py-2.5 text-xs font-semibold transition-colors ${
              mode === "local" ? "bg-white text-black" : "text-white/45 hover:text-white/70"
            }`}
          >
            Local trading wallets
          </button>
        </div>
        <p className="mt-2 px-2 pb-1 text-[10px] leading-relaxed text-white/35">
          {mode === "local"
            ? "Buy/Sell signs with your default imported key in this browser."
            : "Buy/Sell uses Phantom / Jupiter (extension). Local wallets stay available for later."}
        </p>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-[11px] leading-relaxed text-amber-100/75">
          Imported keys are stored encrypted in this browser only. Use dedicated trading wallets —
          never import a main vault or cold wallet.
        </p>
      </div>

      {panel === "list" && (
        <>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setErr("");
                setPanel("import");
              }}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white text-sm font-bold text-black"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/15 text-sm font-semibold"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </div>

          {err && <p className="mt-3 text-center text-[11px] text-red-400">{err}</p>}

          {!wallets.length ? (
            <div className="mt-8 text-center">
              <KeyRound className="mx-auto h-9 w-9 text-white/20" />
              <p className="mt-3 text-sm text-white/45">No local trading wallets yet</p>
              <p className="mt-1 text-[11px] text-white/30">Import a secret key or create one</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {wallets.map((w) => {
                const isDefault = w.id === defaultId;
                return (
                  <li
                    key={w.id}
                    className={`rounded-2xl border px-3 py-3 ${
                      isDefault
                        ? "border-white/25 bg-white/[0.06]"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 shrink-0 text-white/35" />
                          <p className="truncate text-sm font-semibold">{w.label}</p>
                          {isDefault && (
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-400">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-white/40">
                          {shortAddr(w.publicKey, 6)}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-white/55">
                          {balances[w.id] == null
                            ? "SOL …"
                            : `${balances[w.id]!.toFixed(3)} SOL`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => setDefault(w.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/12 px-2.5 text-[11px] font-semibold text-white/70 hover:text-white"
                        >
                          <Star className="h-3 w-3" />
                          Set default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startExport(w.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/12 px-2.5 text-[11px] font-semibold text-white/70 hover:text-white"
                      >
                        <Download className="h-3 w-3" />
                        Export
                      </button>
                      <Link
                        to={`/trade/wallet/${w.publicKey}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/12 px-2.5 text-[11px] font-semibold text-white/70 hover:text-white"
                      >
                        Portfolio
                      </Link>
                      <button
                        type="button"
                        onClick={() => onRemove(w.id)}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold ${
                          removeId === w.id
                            ? "border-red-500/50 bg-red-500/15 text-red-300"
                            : "border-white/12 text-white/50 hover:text-red-300"
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                        {removeId === w.id ? "Confirm remove" : "Remove"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {panel === "import" && (
        <div className="mt-4 space-y-3">
          <p className="text-[12px] text-white/45">
            Paste a Solana secret key (base58) or a JSON byte array. Never share this elsewhere.
          </p>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-sm outline-none focus:border-white/30"
          />
          <textarea
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Secret key…"
            rows={4}
            autoComplete="off"
            spellCheck={false}
            className="w-full resize-none rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 font-mono text-[12px] outline-none focus:border-white/30"
          />
          {err && <p className="text-[11px] text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSecret("");
                setErr("");
                setPanel("list");
              }}
              className="h-11 flex-1 rounded-2xl border border-white/15 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !secret.trim()}
              onClick={() => void onImport()}
              className="h-11 flex-1 rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
            >
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Import wallet"}
            </button>
          </div>
        </div>
      )}

      {panel === "export" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-2xl border border-red-500/35 bg-red-500/[0.1] px-3 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-200">Danger — secret export</p>
              <p className="mt-1 text-[11px] leading-relaxed text-red-100/70">
                Anyone with this key can steal funds. Only export to a secure backup. Clear your
                clipboard after pasting.
              </p>
            </div>
          </div>
          {!exported ? (
            <>
              <p className="text-[12px] text-white/45">
                Type <span className="font-mono font-bold text-white/80">EXPORT</span> to reveal the
                secret key for{" "}
                <span className="font-mono text-white/70">
                  {shortAddr(wallets.find((w) => w.id === exportId)?.publicKey || "", 6)}
                </span>
              </p>
              <input
                type="text"
                value={exportConfirm}
                onChange={(e) => setExportConfirm(e.target.value)}
                placeholder="Type EXPORT"
                className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3 font-mono text-sm outline-none focus:border-red-400/40"
              />
              {err && <p className="text-[11px] text-red-400">{err}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeExport}
                  className="h-11 flex-1 rounded-2xl border border-white/15 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onExport()}
                  className="h-11 flex-1 rounded-2xl bg-red-500 text-sm font-bold text-white disabled:opacity-40"
                >
                  {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Reveal secret"}
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                readOnly
                value={exported}
                rows={3}
                className="w-full resize-none rounded-xl border border-red-500/30 bg-black/50 px-3 py-2.5 font-mono text-[11px] text-red-100"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyExport}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/15 text-sm font-semibold"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={closeExport}
                  className="h-11 flex-1 rounded-2xl bg-white text-sm font-bold text-black"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
