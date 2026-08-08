import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchXMcpCreditPackages, createXMcpPurchase, type XMcpCreditPackage } from "@/lib/xMcp";
import "./x-hub.css";

type SolanaProvider = { publicKey?: { toString(): string }; connect(): Promise<{ publicKey: { toString(): string } }>; signAndSendTransaction(transaction: unknown): Promise<{ signature: string }> };

declare global { interface Window { solana?: SolanaProvider } }

export default function XMcpCreditsShop() {
  const [packages, setPackages] = useState<XMcpCreditPackage[]>([]);
  const [selected, setSelected] = useState<XMcpCreditPackage | null>(null);
  const [status, setStatus] = useState("Select a package to add prepaid MCP usage.");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchXMcpCreditPackages().then(setPackages).catch(() => setStatus("Credit packages are temporarily unavailable.")); }, []);

  async function buyCredits(pkg: XMcpCreditPackage) {
    if (!window.solana) { setStatus("Install or open Phantom to purchase credits."); return; }
    setBusy(true); setSelected(pkg); setStatus("Connecting Phantom…");
    try {
      const connected = await window.solana.connect();
      const wallet = connected.publicKey.toString();
      const order = await createXMcpPurchase(pkg.id, wallet) as { expectedSol: number; treasuryWallet: string };
      setStatus(`Order created. Send ${order.expectedSol.toFixed(6)} SOL to the OrbitX treasury in Phantom.`);
      const sent = await window.solana.signAndSendTransaction({ to: order.treasuryWallet, amountSol: order.expectedSol });
      setStatus(`Payment submitted: ${sent.signature}. Credits will appear after verification.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Purchase could not be completed."); }
    finally { setBusy(false); }
  }

  return <main className="xh__page xh__credits-shop">
    <header className="xh__topbar"><div><p className="xh__eyebrow">ORBITX X MCP</p><h1>Credit store</h1><p>Prepaid usage for posts, DMs, reads, text, images, and video. 1 credit = $0.01.</p></div><Link className="ox-agent__btn" to="/x">Back to X MCP</Link></header>
    <section className="xh__card xh__credits-shop__intro"><strong>100 free credits</strong><span>New MCP accounts start with $1.00 of usage.</span></section>
    <section className="xh__card"><div className="xh__card-title">Choose a package</div><div className="xh__credit-packages">{packages.map((pkg) => <button key={pkg.id} className={`xh__credit-package ${selected?.id === pkg.id ? "is-selected" : ""}`} onClick={() => setSelected(pkg)} type="button"><b>{pkg.name}</b><strong>{pkg.credits.toLocaleString()} credits</strong><span>${pkg.usdValue.toFixed(2)} USD value</span></button>)}</div>{selected && <div className="xh__credits-checkout"><span><b>{selected.name}</b> · {selected.credits.toLocaleString()} credits · ${selected.usdValue.toFixed(2)}</span><button className="ox-agent__btn ox-agent__btn--primary" type="button" disabled={busy} onClick={() => buyCredits(selected)}>{busy ? "Processing…" : "Buy with Phantom"}</button></div>}<p className="xh__credits-status">{status}</p></section>
  </main>;
}
