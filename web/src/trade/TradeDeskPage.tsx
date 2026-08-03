import { useCallback, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TradingTerminal } from "@/components/trading/TradingTerminal";

const LAST_MINT_KEY = "orbitx.trade.lastMint";

export default function TradeDeskPage() {
  const navigate = useNavigate();
  const { mint: mintParam } = useParams<{ mint?: string }>();
  const [search] = useSearchParams();
  const mint = mintParam || search.get("mint") || undefined;

  useEffect(() => {
    if (!mint) {
      try {
        const last = sessionStorage.getItem(LAST_MINT_KEY);
        if (last && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(last)) {
          navigate(`/trade/desk/${last}`, { replace: true });
        }
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.setItem(LAST_MINT_KEY, mint);
    } catch {
      /* ignore */
    }
  }, [mint, navigate]);

  const onMintChange = useCallback(
    (next: string) => {
      if (!next || next === mintParam) return;
      try {
        sessionStorage.setItem(LAST_MINT_KEY, next);
      } catch {
        /* ignore */
      }
      navigate(`/trade/desk/${next}`, { replace: true });
    },
    [navigate, mintParam],
  );

  if (!mint) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <p className="text-lg font-bold">Pick a coin to trade</p>
        <p className="max-w-xs text-sm text-white/40">
          Open Home, tap a token, then hit Trade — or browse markets first.
        </p>
        <Link
          to="/trade"
          className="mt-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-black"
        >
          Browse markets
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <TradingTerminal initialMint={mint} onMintChange={onMintChange} mode="desk" />
    </div>
  );
}
