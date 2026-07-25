/**
 * Terminal Portfolio — live wallet balances via Solana DAS.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink } from "lucide-react";
import { getAssets, type TokenAsset } from "@/lib/solana-api";

function amountUi(a: TokenAsset) {
  const bal = a.token_info?.balance ?? 0;
  const dec = a.token_info?.decimals ?? 0;
  return bal / Math.pow(10, dec || 0);
}

export default function TerminalPortfolio() {
  const { publicKey, connected } = useWallet();
  const [assets, setAssets] = useState<TokenAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAssets(publicKey.toBase58())
      .then((res) => {
        if (!cancelled) setAssets(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const totalValue = assets.reduce((sum, a) => sum + (a.token_info?.price_info?.total_price ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-black/50 border border-green-500/20 rounded p-4">
          <div className="text-xs text-gray-500 uppercase mb-2">Portfolio Value</div>
          <div className="text-2xl font-bold text-green-400">
            {connected ? (loading ? "…" : `$${totalValue.toFixed(2)}`) : "—"}
          </div>
        </div>
        <div className="bg-black/50 border border-green-500/20 rounded p-4">
          <div className="text-xs text-gray-500 uppercase mb-2">Positions</div>
          <div className="text-2xl font-bold text-amber-400">{connected ? assets.length : "—"}</div>
        </div>
        <div className="bg-black/50 border border-green-500/20 rounded p-4">
          <div className="text-xs text-gray-500 uppercase mb-2">Intel</div>
          <Link to="/intel/portfolio" className="text-sm text-green-400 hover:underline">
            Open Intel portfolio →
          </Link>
        </div>
      </div>

      {!connected && (
        <div className="bg-black/50 border border-green-500/20 rounded p-6 text-sm text-gray-400">
          Connect a wallet to load live holdings.
        </div>
      )}

      {connected && (
        <div className="bg-black/50 border border-green-500/20 rounded overflow-hidden">
          <div className="grid grid-cols-10 gap-4 p-4 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-green-500/10">
            <div className="col-span-3">Token</div>
            <div className="col-span-3">Amount</div>
            <div className="col-span-2">Value</div>
            <div className="col-span-2">Action</div>
          </div>

          {loading && <div className="p-4 text-xs text-gray-500">Loading balances…</div>}
          {!loading && assets.length === 0 && (
            <div className="p-4 text-xs text-gray-500">No SPL balances found.</div>
          )}

          {assets.map((pos) => {
            const symbol = pos.content?.metadata?.symbol || "???";
            const name = pos.content?.metadata?.name || "";
            const value = pos.token_info?.price_info?.total_price ?? 0;
            return (
              <div
                key={pos.id}
                className="grid grid-cols-10 gap-4 p-4 items-center text-xs border-b border-green-500/10 hover:bg-green-500/5 transition"
              >
                <div className="col-span-3">
                  <div className="font-bold text-green-400">{symbol}</div>
                  <div className="text-gray-600 text-[10px]">{name}</div>
                </div>
                <div className="col-span-3 text-white">
                  {amountUi(pos).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                <div className="col-span-2 text-white">${value.toFixed(2)}</div>
                <div className="col-span-2 flex gap-2">
                  <Link to={`/intel/scan/${pos.id}`} className="text-green-400 hover:underline">
                    Scan
                  </Link>
                  <a
                    href={`https://solscan.io/token/${pos.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-500 hover:text-green-400"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
