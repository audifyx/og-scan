import { useState } from "react";
import PremiumDocPage, { Reveal } from "@/components/platform/PremiumDocPage";
import { ORBITX_RISK_DISCLAIMER } from "@/lib/contact";

const ORBITX_MCP_URL = "https://www.orbitx.world/api/mcp";
const MOBY_MCP_URL = "https://mcp.moby.win/mcp";
const MOBY_IOS = "https://apps.apple.com/us/app/moby-trade-crypto/id6753324593";
const MOBY_ANDROID =
  "https://play.google.com/store/apps/details?id=com.assetdash.moby&referrer=utm_source%3Dlanding%26utm_campaign%3Dv8";

const ORBITX_MCP_CONFIG = `{
  "mcpServers": {
    "orbitx": {
      "url": "https://www.orbitx.world/api/mcp"
    }
  }
}`;

const MOBY_MCP_CONFIG = `{
  "mcpServers": {
    "moby": {
      "url": "https://mcp.moby.win/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MOBY_AGENT_KEY"
      }
    }
  }
}`;

const SETUP_PROMPT = `You are my trading agent. You run on OrbitX + Moby, and you trade while I sleep.

YOUR CONNECTIONS
- OrbitX MCP: https://www.orbitx.world/api/mcp — your data brain. Use it for full checks on every token: orbitx_scan (OG score 0-100), orbitx_token_intel, orbitx_adv_forensics_solana (holders, bundles, LP locked/burned, mint/freeze authority), live charts and listings.
- Moby MCP: https://mcp.moby.win/mcp — your trading hands. I gave you my Moby agent API key through your secure connection. Never print it, never paste it anywhere, never send it to anyone.

HOW YOU FIND CALLS — FOUR LANES, ALWAYS ON
1. Play Finder (every 5 min): scan the Moby strategies smart_money_confirmed, early_launch_hunter, stonkfun_trend_rider, stonkfun_whale_swarm (scan_tokens takes strategy, limit 5 per strategy). A token qualifies only after a deep check with get_token_trade_brief: green safety, smart money buying, price moving up. Report it once, with symbol, mint, market cap, liquidity, 1h/4h change, smart-money net flow, and safety tier.
2. Microcap fast lane (every 1 min): fresh launches under $50K mcap — the play finder can never see them (Moby strategies have a $50K floor). Watch new pools, run the same safety + smart-money gates, call the ones that pass. These move in minutes: report fast, and say plainly when one already dumped.
3. Whale watch: track the wallets I name. Ping me on EVERY buy, with the amount and the new position size. Sells stay silent. Classify every transaction yourself from the wallet's own pre/post balances — never trust a worker's summary — and remember version-1 transactions need maxSupportedTransactionVersion 1.
4. OG Scanner: run the OrbitX scan on every token before it becomes a call. OG score, token intel, holder and bundle forensics, LP locked + burned. Migrated pump.fun tokens are LP 100% locked + 100% burned — prove it via the launchpad + AMM pool in holders, or a PumpSwap/Raydium/Meteora/Orca pair on DexScreener.

HOW YOU RESEARCH (EVERY TOKEN, EVERY TIME)
- Before any buy, get the Moby trade brief AND the OrbitX scan. Cross-check both — never trust one number alone.
- Safety first: mint/freeze authority, LP locked + burned, top holders with every liquidity-pool vault excluded, bundle share. If the data is missing, say so — never invent numbers.
- Holder figures only from a complete holder list with every liquidity-pool vault excluded. Never repeat a brief's "X wallets hold Y%" line — it counts LP vaults as holders.
- Dedupe token accounts by public key: the RPC returns the same account under both the Token Program and Token-2022 filters — summing both double-counts.
- If an RPC read returns 0 accounts, treat it as an error, not a sale. Confirm with a direct account read before reporting a zero.
- A flag that arrives after the move says so plainly. Never present a stale call as live.

WINNERS PLAYBOOK — WHAT THE WINNING CALLS HAD IN COMMON (scored from 55 real calls, 14 wins = 25%)
- Check history before every call: run orbitx_call_history with the candidate's strategy and market cap. If the matched win rate is 0%, say so and downgrade the call. If it matches a past winner, say which one and why.
- The youngest, fastest lanes win: microcap lane 46% (6/13), early launch hunter 40% (6/15), smart-money confirmed 13%, stonkfun trend rider 0/8 — treat its qualifiers with suspicion until the numbers change.
- Small is the sweet spot: calls under $150K win a third to almost half the time; calls over $2M win 13% and average 1.3x — report them as slow movers, never as runners.
- Winners had real flow, not just a green label: smart money green/Buying with h1 net +$6K-$25K across 17-26 wallets. A green safety tier with no flow number is not a signal.
- Whales + KOLs entered in the last hour AND ARE STILL HOLDING (Marvin 3 whales + 5 KOLs, BUTTHOLE 11 + 11). Entries that already sold are not a signal — check holding, not entry.
- Clean mint: mint + freeze renounced, dev 0%, insiders under 5% (or 0%).
- Two winner shapes, and only two: (a) very young (<3h) with violent 4h momentum (+350% to +2,700%); (b) old token (30-100+ days) at -60% or more off its ATH with fresh smart-money buying. If a token is neither, it is not a winner shape — say so.
- Green safety alone does not run. Most losers were "safety GREEN, smart-money confirmed" with no flow, whale, or KOL detail. Require the triple: flow + holders + momentum. Missing one is a downgrade, missing two is a pass.
- Peak = post-call observed high only. Never quote a pre-call ATH as a multiple.
- Timing: the best entries come just after a mega pump verifies the move, at the dip — the pump proves it can run, the dip is your research window before you buy. A call at the top of the pump is too late; a call with no pump behind it is unverified.

HOW YOU ALERT ME
- Ping me on every buy from the wallets I name, and on every new play that actually qualifies.
- Re-ping a running token only when it is up 20% or more since the LAST ALERT YOU SENT — never vs the original call. Update the baseline only when an alert goes out.
- Stay silent on empty runs. No "nothing found" messages. Quiet is the default; only real events earn a message.
- Every call goes out as a black-and-gold banner with formatted text: symbol, amount, market cap at call, thesis, mint. My own positions and buys/sells never go to public channels — calls only.

AFTER EVERY TRADE
- Make me a 1080x1920 trade card: entry price/mcap, buys, sells, profit in $ and %, CLOSED or STILL HOLDING, mint at the bottom. Numbers only from verified sources — dashboard history, on-chain totals, or numbers I gave you. If a figure can't be verified, leave it off and say which figure is missing.

YOUR HARD RULES
- Watch-only by default. You find plays and report them. You never buy, sell, place orders, or move money unless I explicitly turn on auto-buy for that exact rule.
- A new sell rule defaults to alert-only. A general "handle the sell" is not authorization for auto-execution.
- Never buy a red-tier token. Moby refuses them anyway — so do you.
- Never withdraw, transfer, or send funds anywhere. You trade, you do not move money out.
- I set my own take-profits and they stay. You set none.
- Keep it small to start. Never hold more than $1,000 in the trading wallet.
- My keys live in your secure vault only. Never in chat, never in a file, never in a log.
- If you are unsure, ask me. A missed trade costs nothing. A wrong trade costs money.`;

const BEST_CALLS = [
  { symbol: "Debu", called: "$17.7K", peak: "$153K", mult: "8.7x", lane: "Microcap lane", date: "Nov 16" },
  { symbol: "Marvin", called: "$180K", peak: "$919K", mult: "5.1x", lane: "Early launch hunter", date: "Nov 15" },
  { symbol: "tinfoil", called: "$98K", peak: "$473K", mult: "4.8x", lane: "Early launch hunter", date: "Nov 14" },
  { symbol: "HOGE", called: "$336K", peak: "$1.38M", mult: "4.1x", lane: "Early launch hunter", date: "Nov 15" },
  { symbol: "BAWSAQ", called: "$404K", peak: "$1.14M", mult: "2.8x", lane: "Early launch hunter", date: "Nov 16" },
  { symbol: "BUTTHOLE", called: "$305K", peak: "$840K", mult: "2.8x", lane: "Early launch hunter", date: "Nov 15" },
];

const LANES = [
  {
    name: "Play Finder",
    cadence: "Every 5 min",
    text: "Scans all four Moby strategies and deep-checks every qualifier with a full brief before it becomes a call. Re-pings a runner only at +20% vs the last alert sent.",
  },
  {
    name: "Microcap lane",
    cadence: "Every 1 min",
    text: "Fresh launches under $50K — the play finder can never see them. Same safety and smart-money gates, called in minutes while the move is still early.",
  },
  {
    name: "Whale watch",
    cadence: "Every 5 min",
    text: "Tracks named wallets and pings every buy with the amount and new position size. Every signature classified from the wallet's own balances — sells stay silent.",
  },
  {
    name: "OG Scanner",
    cadence: "Every token",
    text: "OrbitX OG score, token intel, holder and bundle forensics on every token before it becomes a call. LP vaults excluded from every holder figure.",
  },
];

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#d4af37]/40 bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#d4af37]">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-white/20 bg-white px-2.5 py-1 text-[12px] font-semibold text-black hover:bg-[#d4af37]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-[12px] leading-relaxed text-white/90">
        {text}
      </pre>
    </div>
  );
}

const AiTrader = () => (
  <PremiumDocPage
    eyebrow="OrbitX AI Trader"
    title={
      <>
        Trade while
        <br />
        you sleep
      </>
    }
    subtitle="Set up your own AI trading agent on OrbitX + Moby. Your agent gets OrbitX data, Moby trading, and the skills to research every token — inside limits you set on your phone."
    rotatingWords={["traders", "night owls", "hands-off holders", "the patient"]}
    marqueeItems={[
      "Non-custodial",
      "You set the limits",
      "Moby checks every buy",
      "Free to scan",
      "Solana",
      "43 calls tracked",
      "Best call 8.7x",
    ]}
  >
    <Reveal>
      <div className="premium-section">
        <div className="premium-section__num">★</div>
        <h2 className="premium-section__title">The proof — best calls so far</h2>
        <div className="premium-section__body">
          <p>
            This is the system you are about to install, running on the same lanes and the same rules. Peak is the
            highest market cap reached after the call. Most calls do not run — these are the ones that did. Across
            55 tracked calls, 14 went 2x or better (25%): the microcap lane hits 46%, the early launch hunter
            40%. Past calls are not a promise.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#d4af37]/40 bg-black px-3 py-3 text-center">
              <div className="text-[22px] font-bold leading-none text-[#d4af37]">43</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-white/60">Calls tracked</div>
            </div>
            <div className="rounded-xl border border-[#d4af37]/40 bg-black px-3 py-3 text-center">
              <div className="text-[22px] font-bold leading-none text-[#d4af37]">8.7x</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-white/60">Best multiple</div>
            </div>
            <div className="rounded-xl border border-[#d4af37]/40 bg-black px-3 py-3 text-center">
              <div className="text-[22px] font-bold leading-none text-[#d4af37]">$1.38M</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-white/60">Biggest peak</div>
            </div>
            <div className="rounded-xl border border-[#d4af37]/40 bg-black px-3 py-3 text-center">
              <div className="text-[22px] font-bold leading-none text-[#d4af37]">4</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-white/60">Hunting lanes</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BEST_CALLS.map((c) => (
              <div key={c.symbol} className="rounded-xl border border-white/15 bg-black p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[17px] font-bold text-white">{c.symbol}</div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-widest text-white/50">
                      {c.lane} · {c.date}
                    </div>
                  </div>
                  <div className="rounded-md bg-[#d4af37] px-2 py-1 text-[15px] font-bold leading-none text-black">
                    {c.mult}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[13px]">
                  <span className="text-white/60">Called {c.called}</span>
                  <span className="text-[#d4af37]">→</span>
                  <span className="font-semibold text-white">Peak {c.peak}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#d4af37]"
                    style={{ width: `${Math.min(100, (parseFloat(c.mult) / 8.7) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>

    <Reveal>
      <div className="premium-section">
        <div className="premium-section__num">01</div>
        <h2 className="premium-section__title">Get an AI agent</h2>
        <div className="premium-section__body">
          <p>
            First you need an agent. <strong className="text-white">Grok Bot and Muse are best</strong> — they
            plug straight into MCP servers and follow setup prompts cleanly. Codex, Claude Code, and Gemini CLI work
            too.
          </p>
          <p>
            The agent is the brain. OrbitX is its eyes — live token data and full forensic checks. Moby is its hands
            — real trading inside limits you control. Nothing here trades for you until you say so.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={60}>
      <div className="premium-section">
        <div className="premium-section__num">02</div>
        <h2 className="premium-section__title">Connect the OrbitX MCP</h2>
        <div className="premium-section__body">
          <p>
            Add the OrbitX MCP to your agent. This is what gives it data and full checks on every token — OG score,
            token intel, holder and bundle forensics, LP lock/burn status, live charts and listings.
          </p>
          <p>
            MCP link (always use www — the apex domain breaks MCP clients):
          </p>
          <CopyBlock label="OrbitX MCP — paste this URL" text={ORBITX_MCP_URL} />
          <p>
            Add it in your agent&apos;s MCP settings with the config below, or open the connector page directly:{" "}
            <a
              href="https://grok.com/connectors"
              target="_blank"
              rel="noreferrer"
              className="text-[#5aa2ff] hover:underline"
            >
              Grok — grok.com/connectors
            </a>{" "}
            ·{" "}
            <a
              href="https://claude.ai/customize/connectors"
              target="_blank"
              rel="noreferrer"
              className="text-[#5aa2ff] hover:underline"
            >
              Claude — customize/connectors
            </a>{" "}
            · ChatGPT — Settings → Connectors.
          </p>
          <CopyBlock label="MCP config — OrbitX" text={ORBITX_MCP_CONFIG} />
        </div>
      </div>
    </Reveal>

    <Reveal delay={120}>
      <div className="premium-section">
        <div className="premium-section__num">03</div>
        <h2 className="premium-section__title">Get the Moby app</h2>
        <div className="premium-section__body">
          <p>
            Moby is the trading app your agent plugs into. Download it, create an account with your email, and fund
            it with USDC or SOL. All download options live at{" "}
            <a
              href="https://moby.win/download/"
              target="_blank"
              rel="noreferrer"
              className="text-[#5aa2ff] hover:underline"
            >
              moby.win/download
            </a>
            .
          </p>
          <ul>
            <li>
              <a href={MOBY_IOS} target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
                iOS — App Store
              </a>
            </li>
            <li>
              <a href={MOBY_ANDROID} target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
                Android — Google Play
              </a>
            </li>
            <li>
              <a href="https://app.moby.win" target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
                Web — app.moby.win
              </a>
            </li>
          </ul>
        </div>
      </div>
    </Reveal>

    <Reveal delay={180}>
      <div className="premium-section">
        <div className="premium-section__num">04</div>
        <h2 className="premium-section__title">Set up your agent in Moby</h2>
        <div className="premium-section__body">
          <p>
            In the Moby app, open the <strong className="text-white">Agent tab → Connect</strong> and create your
            agent. Moby gives you an API key — it starts with <code className="text-white">moby_agent_</code>. That
            key is how your agent talks to Moby. It is revocable, you can have up to 5 active, and you can kill any
            of them in the app at any time.
          </p>
          <p>
            AI Trading is invite-only right now. Use the OrbitX invite code below to get in — redeem it within 24
            hours of activating. No code? DM{" "}
            <a href="https://x.com/mobyagent" target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
              @mobyagent on X
            </a>{" "}
            and they will send you one. Full details at{" "}
            <a href="https://moby.win/agents/" target="_blank" rel="noreferrer" className="text-[#5aa2ff] hover:underline">
              moby.win/agents
            </a>
            .
          </p>
          <CopyBlock label="OrbitX invite code — copy it" text="AGENT-B8YK9A" />
          <p>
            Redeem it here:{" "}
            <a
              href="https://invite.mobyscreener.com/agent-AGENT-B8YK9A"
              target="_blank"
              rel="noreferrer"
              className="text-[#5aa2ff] hover:underline"
            >
              invite.mobyscreener.com/agent-AGENT-B8YK9A
            </a>
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={240}>
      <div className="premium-section">
        <div className="premium-section__num">05</div>
        <h2 className="premium-section__title">Give your agent the Moby key</h2>
        <div className="premium-section__body">
          <p>
            Add the Moby MCP to your agent with your key. Give the key to your agent through its secure connection
            flow — <strong className="text-white">never paste it in a public chat, a post, or a screenshot</strong>.
            Your agent stores it in its own secure vault and sends it only to Moby.
          </p>
          <CopyBlock label="MCP config — Moby (replace the key)" text={MOBY_MCP_CONFIG} />
          <p>
            Moby MCP: <code className="break-all text-white/85">{MOBY_MCP_URL}</code>
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={300}>
      <div className="premium-section">
        <div className="premium-section__num">↗</div>
        <h2 className="premium-section__title">How the calls are found</h2>
        <div className="premium-section__body">
          <p>
            The setup prompt below trains your agent on this exact system — four lanes that never stop, each one
            catching what the others cannot. This is how the calls above were found.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LANES.map((l) => (
              <div key={l.name} className="rounded-xl border border-white/15 bg-black p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[16px] font-bold text-white">{l.name}</div>
                  <div className="rounded-full border border-[#d4af37]/50 px-2 py-0.5 text-[11px] font-semibold text-[#d4af37]">
                    {l.cadence}
                  </div>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/75">{l.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>

    <Reveal delay={360}>
      <div className="premium-section">
        <div className="premium-section__num">06</div>
        <h2 className="premium-section__title">Install the skills pack</h2>
        <div className="premium-section__body">
          <p>
            Now send your agent the setup prompt. One paste trains it on the whole system — the four hunting lanes,
            the winners playbook scored from 55 real calls, the call-history lookup it runs before every new
            play, the data-truth rules that keep its numbers honest, the alert rules, trade cards after every
            trade, and the hard rules that keep it safe.
          </p>
          <CopyBlock label="Master setup prompt — paste to your agent" text={SETUP_PROMPT} />
        </div>
      </div>
    </Reveal>

    <Reveal delay={420}>
      <div className="premium-section">
        <div className="premium-section__num">07</div>
        <h2 className="premium-section__title">Fresh wallet, vaulted key</h2>
        <div className="premium-section__body">
          <p>
            Create a <strong className="text-white">brand-new wallet just for the agent</strong> — never your main
            wallet, never a wallet that holds anything you cannot afford to lose. Fund it small to start.
          </p>
          <p>
            Give the agent the new wallet&apos;s private key and ask it to{" "}
            <strong className="text-white">safely create a vault</strong> for it — its secure vault, not a chat
            message, not a file, not a note. The key lives in the vault only. If the key ever leaks, make a new wallet
            and revoke the old one.
          </p>
          <p>
            The agent trades with that wallet. It cannot withdraw or send your funds out — Moby enforces that
            server-side, and the wallet itself stays yours.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={480}>
      <div className="premium-section">
        <div className="premium-section__num">08</div>
        <h2 className="premium-section__title">Set guardrails — then sleep</h2>
        <div className="premium-section__body">
          <p>
            In the Moby app, set your agent&apos;s limits before it trades a dollar: max per trade, daily buy limit,
            and market-cap range. Moby checks those limits server-side on every single buy your agent makes — and it
            refuses any buy on a token it rates red.
          </p>
          <p>
            That is the whole setup. OrbitX watches the tokens, Moby runs the trades, your agent does the work — and
            you are trading while you sleep.
          </p>
        </div>
      </div>
    </Reveal>

    <Reveal delay={540}>
      <div className="premium-section">
        <div className="premium-section__num">!</div>
        <h2 className="premium-section__title">Risk disclosure</h2>
        <div className="premium-section__body">
          <p>{ORBITX_RISK_DISCLAIMER}</p>
          <p>
            Crypto assets are volatile and high-risk — you can lose everything. An agent does not remove that risk; it
            only trades faster inside the limits you set. Start small, watch the first trades yourself, and never fund
            an agent wallet with money you need. OrbitX never holds your funds and never receives them — there is no
            deposit to OrbitX.
          </p>
        </div>
      </div>
    </Reveal>
  </PremiumDocPage>
);

export default AiTrader;
