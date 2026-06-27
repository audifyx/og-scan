import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Zap, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { fmtUsd, compact } from "../lib/api";

const OG_MINT = "HEivoBHhWT939vcaevGgZBtoArS4CAywCMjdVBTSpump";
const PRO_THRESHOLD = 10_000; // minimum OG tokens for Pro

interface ProState {
  checked: boolean;
  balance: number;
  isPro: boolean;
}

export function useProGate(): ProState {
  const { address } = useWallet();
  const [state, setState] = useState<ProState>({ checked: false, balance: 0, isPro: false });

  useEffect(() => {
    if (!address) { setState({ checked: true, balance: 0, isPro: false }); return; }
    fetch(`/api/ogdex/balance?owner=${address}&mint=${OG_MINT}`)
      .then((r) => r.json())
      .then((d) => {
        const bal = d?.token?.uiAmount ?? 0;
        setState({ checked: true, balance: bal, isPro: bal >= PRO_THRESHOLD });
      })
      .catch(() => setState({ checked: true, balance: 0, isPro: false }));
  }, [address]);

  return state;
}

interface ProGateProps {
  children: React.ReactNode;
  feature?: string;
}

export default function ProGate({ children, feature }: ProGateProps) {
  const { address, connect } = useWallet();
  const { checked, balance, isPro } = useProGate();

  if (!checked) {
    return (
      <div className="grid place-items-center py-8 text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (isPro) return <>{children}</>;

  return (
    <div className="card p-6 text-center space-y-4 border border-accent/20 bg-accent/5">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 grid place-items-center">
        <ShieldCheck className="w-6 h-6 text-accent" />
      </div>
      <div>
        <div className="text-base font-black text-white mb-1">Pro Feature</div>
        <p className="text-xs text-muted">
          {feature ? `${feature} requires` : "This feature requires"} holding{" "}
          <span className="text-accent font-bold">{compact(PRO_THRESHOLD)} OG tokens</span>.
          {address && balance > 0 && (
            <> You currently hold <span className="text-white font-semibold">{compact(balance)}</span>.</>
          )}
        </p>
      </div>
      {!address ? (
        <button onClick={connect}
          className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5 mx-auto">
          <Zap className="w-4 h-4" /> Connect Wallet
        </button>
      ) : (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href={`https://jup.ag/swap/SOL-${OG_MINT}`}
            target="_blank" rel="noreferrer"
            className="btn bg-accent text-black font-bold inline-flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4" /> Get OG Tokens
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <Link to="/token/HEivoBHhWT939vcaevGgZBtoArS4CAywCMjdVBTSpump"
            className="btn bg-panel2 text-muted hover:text-white text-xs">
            View OG Token
          </Link>
        </div>
      )}
      <p className="text-[10px] text-muted/50">
        OG token gate is non-custodial. Your tokens stay in your wallet — we only verify your balance.
      </p>
    </div>
  );
}
