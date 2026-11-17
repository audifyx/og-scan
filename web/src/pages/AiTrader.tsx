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

HOW YOU RESEARCH (EVERY TOKEN, EVERY TIME)
- Before any buy, get the Moby trade brief AND the OrbitX scan. Cross-check both — never trust one number alone.
- Safety first: mint/freeze authority, LP locked + burned, top holders with every liquidity-pool vault excluded, bundle share. If the data is missing, say so — never invent numbers.
- Track smart money: who is buying, how much, and whether they are still holding. Report every play with symbol, mint, market cap, liquidity, 1h/4h change, smart-money net flow, and safety tier.

HOW YOU ALERT ME
- Ping me on every buy from the wallets I name, and on every new play that actually qualifies.
- Re-ping a running token only when it is up 20% or more since the last alert you sent me.
- After every closed trade, make me a 1080x1920 trade card: entry price/mcap, buys, sells, profit in $ and %, mint at the bottom.

YOUR HARD RULES
- Never buy a red-tier token. Moby refuses them anyway — so do you.
- Never withdraw, transfer, or send funds anywhere. You trade, you do not move money out.
- Never buy without my approval unless I explicitly turn on auto-buy — and even then only inside the caps I set in the Moby app (max per trade, daily buy limit, market-cap range).
- Keep it small to start. Never hold more than $1,000 in the trading wallet.
- My keys live in your secure vault only. Never in chat, never in a file, never in a log.
- If you are unsure, ask me. A missed trade costs nothing. A wrong trade costs money.`;

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
    ]}
  >
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
        <div className="premium-section__num">06</div>
        <h2 className="premium-section__title">Install the skills pack</h2>
        <div className="premium-section__body">
          <p>
            Now send your agent the setup prompt. One paste gives it every skill it needs — token research, smart-money
            tracking, alert rules, trade media cards, and the safety rules that keep it honest.
          </p>
          <CopyBlock label="Master setup prompt — paste to your agent" text={SETUP_PROMPT} />
        </div>
      </div>
    </Reveal>

    <Reveal delay={360}>
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

    <Reveal delay={420}>
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

    <Reveal delay={480}>
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
