import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clipboard, Loader2, LockKeyhole, ShieldCheck, Sparkles, WalletCards, XCircle, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";

type TradeResult = {
  ok?: boolean;
  status?: string;
  message?: string;
  error?: string;
  warning?: string;
  requiresSignature?: boolean;
  openUrl?: string;
  signUrl?: string;
  autoSignUrl?: string;
  action?: string;
  mint?: string;
  amount?: string | number;
  amountUsd?: number | null;
  solUsd?: number | null;
  slippage?: number;
  pool?: string;
  via?: string | null;
};

type Props = {
  walletAddress: string | null;
  onOpenWallet: () => void;
};

const EXAMPLES = [
  { label: "$1 ORBITX", value: "Buy $1 of $ORBITX" },
  { label: "Exact CA", value: "Buy $1 of TOKEN_SYMBOL with CA YOUR_TOKEN_CONTRACT_ADDRESS" },
  { label: "Sell 25%", value: "Sell 25% of YOUR_TOKEN_CONTRACT_ADDRESS" },
];

function shortAddress(value: string | null | undefined) {
  if (!value) return "Not connected";
  return `${value.slice(0, 5)}…${value.slice(-4)}`;
}

export function TradeDesk({ walletAddress, onOpenWallet }: Props) {
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canRun = useMemo(() => command.trim().length >= 8 && !busy, [busy, command]);

  const runCommand = async () => {
    if (!canRun) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      const response = await fetch("/api/orbitx-agent/command", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: command.trim(), walletAddress }),
      });
      const payload = (await response.json().catch(() => ({}))) as TradeResult;
      if (!response.ok || payload.ok === false) {
        throw new Error(String(payload.message || payload.error || "Command could not be prepared"));
      }
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command could not be prepared");
    } finally {
      setBusy(false);
    }
  };

  const copyCommand = async () => {
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="supercomputer-trade-desk">
      <section className="supercomputer-command-card">
        <div className="supercomputer-command-card__top">
          <div>
            <p className="supercomputer-eyebrow"><Zap size={13} /> COMMAND TRADE</p>
            <h3>Say exactly what you want to buy.</h3>
            <p>Use a dollar amount and the contract address. OrbitX prepares the matching transaction and shows the route before you sign.</p>
          </div>
          <span className={`supercomputer-command-state ${walletAddress ? "is-ready" : "is-pending"}`}>
            <i />{walletAddress ? "Wallet ready" : "Wallet needed"}
          </span>
        </div>

        <div className="supercomputer-command-input-wrap">
          <span className="supercomputer-command-prefix">/</span>
          <textarea
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void runCommand();
            }}
            placeholder="Buy $1 of $ORBITX with CA …"
            rows={3}
            aria-label="Trade command"
          />
          <div className="supercomputer-command-input-actions">
            <button type="button" className="supercomputer-icon-button" onClick={() => void copyCommand()} disabled={!command} aria-label="Copy command">
              {copied ? <CheckCircle2 size={15} /> : <Clipboard size={15} />}
            </button>
            <button type="button" className="supercomputer-button supercomputer-button--primary" onClick={() => void runCommand()} disabled={!canRun}>
              {busy ? <Loader2 size={15} className="supercomputer-spin" /> : <Sparkles size={15} />}
              {busy ? "Preparing" : "Prepare trade"}
            </button>
          </div>
        </div>

        <div className="supercomputer-command-examples" aria-label="Command examples">
          {EXAMPLES.map((example) => (
            <button type="button" key={example.label} onClick={() => setCommand(example.value)}>{example.label}</button>
          ))}
        </div>

        <div className="supercomputer-command-safety">
          <ShieldCheck size={15} />
          <span>Exact CA, amount, route, and slippage are shown before any wallet action.</span>
          <LockKeyhole size={14} />
        </div>
      </section>

      {!walletAddress ? (
        <section className="supercomputer-trade-notice supercomputer-trade-notice--warning">
          <WalletCards size={18} />
          <div><strong>Connect the wallet that should trade.</strong><p>The linked wallet is the only wallet eligible to receive the prepared transaction.</p></div>
          <button type="button" className="supercomputer-button supercomputer-button--quiet" onClick={onOpenWallet}>Open wallet</button>
        </section>
      ) : null}

      {error ? (
        <section className="supercomputer-trade-result is-error">
          <XCircle size={18} />
          <div><strong>Trade not prepared</strong><p>{error}</p></div>
        </section>
      ) : null}

      {result ? (
        <section className={`supercomputer-trade-result ${result.ok === false ? "is-error" : "is-success"}`}>
          {result.ok === false ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          <div className="supercomputer-trade-result__copy">
            <div className="supercomputer-trade-result__heading"><strong>{result.ok === false ? "Trade not prepared" : "Trade prepared"}</strong><span>{result.status || "ready"}</span></div>
            <p>{result.message || result.warning || "Review the transaction details below."}</p>
            {result.mint ? <div className="supercomputer-trade-receipt"><span>Contract</span><code>{shortAddress(result.mint)}</code><span>Amount</span><code>{result.amountUsd ? `$${result.amountUsd}` : `${result.amount ?? "—"} SOL`}</code><span>Slippage</span><code>{result.slippage ?? 10}%</code></div> : null}
            {result.requiresSignature && (result.openUrl || result.signUrl) ? (
              <a className="supercomputer-button supercomputer-button--primary supercomputer-trade-open" href={result.openUrl || result.signUrl}>
                Open secure sign page <ArrowUpRight size={15} />
              </a>
            ) : null}
            {result.requiresSignature ? <small className="supercomputer-trade-disclaimer">Your connected wallet must approve the transaction. OrbitX never receives or stores your private key.</small> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default TradeDesk;
