/**
 * ChartsWidget — Embedded multi-token DexScreener charts.
 * URL: /charts?tokens=addr1,addr2,addr3
 * Shows up to 4 DexScreener embeds in a responsive grid.
 */
import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function ChartsWidget() {
  const [params] = useSearchParams();
  const tokens = useMemo(() => {
    const raw = params.get("tokens") || params.get("token") || "";
    return raw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4);
  }, [params]);

  if (tokens.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold">OrbitX Charts</h1>
          <p className="mt-2 text-white/50 text-sm">
            Add token addresses to the URL: <code className="text-blue-300">/charts?tokens=addr1,addr2</code>
          </p>
          <Link to="/" className="mt-4 inline-block text-blue-400 hover:underline text-sm">
            Back to OrbitX
          </Link>
        </div>
      </div>
    );
  }

  const gridClass = tokens.length === 1
    ? "grid-cols-1"
    : tokens.length === 2
    ? "grid-cols-1 lg:grid-cols-2"
    : "grid-cols-1 lg:grid-cols-2";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="font-bold text-lg">OrbitX Charts</h1>
        <span className="text-xs text-white/40">{tokens.length} token{tokens.length > 1 ? "s" : ""}</span>
      </div>
      <div className={`grid ${gridClass} gap-2 p-2`}>
        {tokens.map((addr) => (
          <div key={addr} className="rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
            <div className="flex items-center justify-between px-3 py-2 bg-white/5">
              <code className="text-xs text-white/60 truncate">{addr.slice(0, 8)}…{addr.slice(-6)}</code>
              <a
                href={`https://dexscreener.com/solana/${addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline shrink-0 ml-2"
              >
                Open ↗
              </a>
            </div>
            <iframe
              src={`https://dexscreener.com/solana/${addr}?embed=1&theme=dark&trades=0&info=0`}
              className="w-full"
              style={{ height: "420px", border: 0 }}
              title={`Chart ${addr}`}
              allowFullScreen
            />
          </div>
        ))}
      </div>
    </div>
  );
}
