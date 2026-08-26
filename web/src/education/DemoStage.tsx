import { useMemo, useState } from "react";
import type { DemoKind, EduStep } from "./types";

const FLAG = "DEMO — NO REAL TRANSACTION";

const DEMOS: Record<Exclude<DemoKind, "none">, { rows: string[]; explain: string[] }> = {
  scanner: {
    rows: ["Token", "Holders", "Wallet", "Smart money", "Risk", "Trade"],
    explain: [
      "Open the mint on Intel scan. You are looking at a research desk, not a buy button.",
      "Holder concentration and linked wallets. High concentration is a risk signal — not a trade signal.",
      "A wallet page shows holdings and flows. Past activity is not a promise of future buys.",
      "Smart money here means official OrbitX KOL / whale desks — not invented labels.",
      "Mint, freeze, LP, and clone flags. Incomplete data means you do not size up.",
      "If you still want to act, leave the demo and open DEX or Trade. You will sign in your wallet.",
    ],
  },
  dex: {
    rows: ["Search mint", "Read panel", "Set size", "Set slippage", "Sign", "Portfolio"],
    explain: [
      "Paste a CA or pick from the DEX list. This mock does not quote live prices.",
      "Chart and liquidity widgets can lag. Treat them as research.",
      "You choose the SOL size. Nothing here sizes a position for you.",
      "Slippage is your setting. Price impact is a quote, not a profit forecast.",
      "A real swap only completes after your wallet prompt. Reject anything you did not start.",
      "Confirmed balances show after the chain lands — not instantly in this demo.",
    ],
  },
  launch: {
    rows: ["Name", "Symbol", "Supply", "Decimals", "Authorities", "Launch"],
    explain: [
      "Name is public metadata. Keep it honest — this is on-chain forever.",
      "Ticker is short. OrbitX does not reserve tickers globally.",
      "Supply is fixed at create for the chosen lane. Read the live create form.",
      "Decimals are part of Token-2022 / pump config. Do not copy numbers from this demo.",
      "Mint / freeze / update authorities are security. Revoke what you intend to revoke before you launch.",
      "Launch spends SOL from the connected wallet. This click does nothing on-chain.",
    ],
  },
  claim: {
    rows: ["Open claim", "Same wallet", "Review split", "Sign withdraw", "Confirm"],
    explain: [
      "Creator fees are claimed at /orbitxlaunch/claim — not from Education.",
      "You must connect the same wallet that created the token.",
      "Live split is 98.7% creator / 1.3% platform of the 0.45% trade fee. Confirm on the claim page.",
      "Withdraw is a signed transaction. Pump and custom Token-2022 lanes differ — read the live UI.",
      "Explorer confirmation is the source of truth, not this mock.",
    ],
  },
  telegram: {
    rows: ["/screen", "/token", "/scan", "/login", "/buy", "Sign in browser"],
    explain: [
      "Groups are intel. /screen is a pulse, not a signal.",
      "/token <CA> returns a research card. It is not a buy.",
      "/scan overlays forensics. Treat flags as information.",
      "/login in DM links via orbitx.world/telegram. Groups cannot trade.",
      "/buy prepares a quote. Auto-sign is paused — you still sign in the browser.",
      "The wallet prompt is the real control. This demo never submits a swap.",
    ],
  },
  mcp: {
    rows: ["Connect /agent", "orbitx_search", "orbitx_get_token", "prepare_buy", "You sign", "Shop access"],
    explain: [
      "MCP is a tool bridge for Claude / ChatGPT / Grok. OrbitX does not run your keys.",
      "Search finds a mint. It is a lookup, not a recommendation.",
      "get_token / scan / xray return research payloads.",
      "prepare_buy builds a transaction you still have to sign.",
      "No MCP tool completes a swap without your wallet.",
      "Some tools need a Shop burn for timed access. That is access, not alpha.",
    ],
  },
  wallet: {
    rows: ["Paste address", "Holdings", "Flows", "Open on-chain", "Do not copy-trade"],
    explain: [
      "Wallet research starts with a public address. Never a seed.",
      "Holdings are a snapshot. They can change before you finish reading.",
      "Inflows and outflows are history. History is not a strategy.",
      "/on-chain and /intel/wallet/:address are the live desks.",
      "Copy-trading someone else's bag is not an OrbitX feature and is not advice.",
    ],
  },
  workflow: {
    rows: ["Discover", "Research", "Holders", "Wallets", "Risk", "Execute"],
    explain: [
      "Discovery: DEX lists, Intel trending, Telegram /screen.",
      "Research: token page + Intel scan. You are collecting facts.",
      "Holders: concentration and linked wallets.",
      "Wallets: who is in the top set, not who will buy next.",
      "Risk: mint/freeze/LP/clone. Unclear picture → do not size up.",
      "Execute only on DEX or Trade with a signature you intend.",
    ],
  },
};

export default function DemoStage({ kind, steps }: { kind: DemoKind; steps?: EduStep[] }) {
  const pack = kind === "none" ? null : DEMOS[kind];
  const rows = pack?.rows ?? steps?.map((s) => s.title) ?? [];
  const explain = pack?.explain ?? steps?.map((s) => s.body) ?? [];
  const [active, setActive] = useState(0);
  const caption = useMemo(() => explain[active] ?? "", [explain, active]);

  if (!rows.length) return null;

  return (
    <section className="ox-edu__demo" aria-label="Interactive demo">
      <div className="ox-edu__demo-flag">{FLAG}</div>
      <div className="ox-edu__mock">
        <div className="ox-edu__mock-bar">
          <span>OrbitX practice desk</span>
          <span>{kind === "none" ? "guide" : kind}</span>
        </div>
        {rows.map((row, i) => (
          <button
            key={row}
            type="button"
            className={`ox-edu__mock-row${i === active ? " on" : ""}`}
            onClick={() => setActive(i)}
          >
            <span>
              <span className="ox-edu__hot">{String(i + 1).padStart(2, "0")}</span>
              {row}
            </span>
            <span>{i === active ? "OPEN" : "TRY"}</span>
          </button>
        ))}
      </div>
      {caption ? <p className="ox-edu__tip">{caption}</p> : null}
    </section>
  );
}
