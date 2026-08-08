import { useCallback, useEffect, useState } from "react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createXMcpPurchase,
  fetchXMcpCreditHistory,
  fetchXMcpCreditPackages,
  fetchXMcpCredits,
  verifyXMcpPurchase,
  type XMcpCreditLedgerEntry,
  type XMcpCreditPackage,
  type XMcpCredits,
} from "@/lib/xMcp";

const money = (value: number) => `$${value.toFixed(2)}`;
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });

type PhantomProvider = { connect: () => Promise<{ publicKey: { toString(): string } }>; signAndSendTransaction: (transaction: unknown) => Promise<{ signature: string }> };

declare global { interface Window { solana?: PhantomProvider & { isPhantom?: boolean } } }

export default function XMcpCreditsPanel() {
  const [credits, setCredits] = useState<XMcpCredits | null>(null);
  const [packages, setPackages] = useState<XMcpCreditPackage[]>([]);
  const [history, setHistory] = useState<XMcpCreditLedgerEntry[]>([]);
  const [selected, setSelected] = useState<XMcpCreditPackage | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [balance, catalog, ledger] = await Promise.all([fetchXMcpCredits(), fetchXMcpCreditPackages(), fetchXMcpCreditHistory()]);
      setCredits(balance); setPackages(catalog); setHistory(ledger);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load OrbitX credits"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const buy = async () => {
    if (!selected) return;
    if (!window.solana?.isPhantom) { setError("Install or unlock Phantom to buy credits with SOL."); return; }
    setBuying(true); setError(null);
    try {
      const connected = await window.solana.connect();
      const walletAddress = connected.publicKey.toString();
      setWallet(walletAddress);
      const order = await createXMcpPurchase(selected.id, walletAddress) as { purchaseId: string; expectedSol: number; treasuryWallet: string };
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const latest = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({ recentBlockhash: latest.blockhash, feePayer: new PublicKey(walletAddress) }).add(SystemProgram.transfer({ fromPubkey: new PublicKey(walletAddress), toPubkey: new PublicKey(order.treasuryWallet), lamports: Math.ceil(order.expectedSol * 1_000_000_000) }));
      const sent = await window.solana.signAndSendTransaction(transaction);
      await verifyXMcpPurchase(order.purchaseId, sent.signature);
      await load(); setSelected(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Purchase was not completed"); }
    finally { setBuying(false); }
  };

  return <section className="xh__card xh__credits" aria-label="OrbitX Usage and Credits">
    <div className="xh__card-h"><div><div className="xh__card-title">Usage & Credits</div><div className="xh__card-meta">Prepaid real API usage · 1 credit = $0.01</div></div><button type="button" className="ox-agent__btn" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
    {error && <div className="xh__credits-error" role="alert">{error}</div>}
    {loading && !credits ? <p className="xh__card-meta">Loading your balance…</p> : credits && <>
      <div className="xh__credits-balance"><strong>{number(credits.balanceCredits)}</strong><span>credits available</span><b>{money(credits.balanceUsd)}</b></div>
      <div className="xh__credits-stats"><div><span>Free remaining</span><strong>{number(credits.freeCreditsRemaining)}</strong></div><div><span>Purchased remaining</span><strong>{number(credits.purchasedCreditsRemaining)}</strong></div><div><span>Used this month</span><strong>{number(credits.monthCreditsUsed)}</strong></div><div><span>Lifetime used</span><strong>{number(credits.lifetimeCreditsUsed)}</strong></div></div>
    </>}
    <div className="xh__credits-store"><div className="xh__card-title">Buy credits with SOL</div><div className="xh__card-meta">Choose a package. Phantom sends payment to the OrbitX treasury and the backend verifies it before crediting your account.</div><div className="xh__credit-packages">{packages.length ? packages.map((item) => <button type="button" key={item.id} className={`xh__credit-package${selected?.id === item.id ? " is-selected" : ""}`} onClick={() => setSelected(item)}><strong>{item.name}</strong><span>{number(item.credits)} credits</span><b>{money(item.usdValue)}</b></button>) : <span className="xh__card-meta">Credit packages are loading…</span>}</div>{selected && <div className="xh__credits-checkout"><span>Selected: <strong>{selected.name}</strong> · {number(selected.credits)} credits for {money(selected.usdValue)}</span><button type="button" className="ox-agent__btn ox-agent__btn--primary" onClick={() => void buy()} disabled={buying}>{buying ? "Confirming in Phantom…" : wallet ? "Pay with Phantom" : "Connect Phantom & Buy"}</button></div>}</div>
    <div className="xh__credits-history"><div className="xh__card-title">Recent usage</div>{history.length ? history.slice(0, 5).map((entry) => <div className="xh__credits-entry" key={entry.id}><span><strong>{entry.action}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></span><span className={entry.credits < 0 ? "is-negative" : ""}>{entry.credits < 0 ? "-" : "+"}{number(Math.abs(entry.credits))} credits<br /><small>{money(Math.abs(entry.usdValue))}</small></span></div>) : <div className="xh__card-meta">Your MCP usage will appear here after the first action.</div>}</div>
  </section>;
}
