import { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TradingTerminal } from "@/components/trading/TradingTerminal";

export default function TradeDeskPage() {
  const navigate = useNavigate();
  const { mint: mintParam } = useParams<{ mint?: string }>();
  const [search] = useSearchParams();
  const mint = mintParam || search.get("mint") || undefined;

  const onMintChange = useCallback(
    (next: string) => {
      if (!next || next === mintParam) return;
      navigate(`/trade/desk/${next}`, { replace: true });
    },
    [navigate, mintParam],
  );

  return (
    <div className="h-full min-h-0">
      <TradingTerminal initialMint={mint} onMintChange={onMintChange} />
    </div>
  );
}
