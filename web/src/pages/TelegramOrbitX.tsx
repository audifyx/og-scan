import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { AgentLoading, AgentShell, type ShellTab } from "@/components/agent/AgentShell";
import {
  TELEGRAM_ORBITX_BOT,
  TELEGRAM_ORBITX_TME,
  telegramOrbitXCall,
  telegramOrbitXCmds,
  telegramOrbitXLink,
  telegramOrbitXSetAutoBuy,
  telegramOrbitXStatus,
  type TelegramOrbitXStatus,
} from "@/lib/telegramOrbitX";
import "./telegram-orbitx.css";

type Tab = "link" | "tools";
const TABS: ShellTab[] = [
  { id: "link", label: "Link", ico: "◎" },
  { id: "tools", label: "Tools", ico: "✦" },
];

export default function TelegramOrbitX() {
  const [params] = useSearchParams();
  const code = (params.get("code") || "").trim().toUpperCase();
  const { user, loading: authLoading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [tab, setTab] = useState<Tab>(code ? "link" : "tools");
  const [status, setStatus] = useState<TelegramOrbitXStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [query, setQuery] = useState("");
  const [cmds, setCmds] = useState<{ count: number; tools: Array<{ name: string; description?: string }> } | null>(null);
  const [toolName, setToolName] = useState("orbitx_get_token");
  const [toolArgs, setToolArgs] = useState("mint ");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [media, setMedia] = useState<string[]>([]);
  const [signHref, setSignHref] = useState<string>("");
  const [solscanHref, setSolscanHref] = useState<string>("");
  const [autoBuy, setAutoBuy] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await telegramOrbitXStatus();
      setStatus(next);
      setAutoBuy(Boolean(next.links?.[0]?.auto_buy));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Telegram status");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  useEffect(() => {
    let cancelled = false;
    telegramOrbitXCmds(query)
      .then((page) => {
        if (!cancelled) setCmds({ count: page.count, tools: page.tools });
      })
      .catch(() => {
        if (!cancelled) setCmds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const onLink = async () => {
    setError(null);
    if (!code) {
      setError("Open this page from the /login link the bot sent you.");
      return;
    }
    if (!user) {
      setError("Sign in with the wallet you use on OrbitX first.");
      return;
    }
    setLinking(true);
    try {
      await telegramOrbitXLink(code);
      setLinked(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setLinking(false);
    }
  };

  const run = async (tool: string, args: Record<string, unknown>) => {
    setError(null);
    setRunning(true);
    setOutput("");
    setMedia([]);
    setSignHref("");
    setSolscanHref("");
    try {
      const result = await telegramOrbitXCall(tool, args);
      setOutput(result.text || JSON.stringify(result.result || result, null, 2));
      setMedia(result.imageUrls || []);
      const payload = (result.result && typeof result.result === "object" ? result.result : {}) as Record<string, unknown>;
      const open =
        (typeof payload.openUrl === "string" && payload.openUrl) ||
        (typeof payload.signUrl === "string" && payload.signUrl) ||
        (typeof payload.autoSignUrl === "string" && payload.autoSignUrl) ||
        "";
      if (open) setSignHref(open);
      const scan =
        (typeof payload.solscan === "string" && payload.solscan) ||
        (typeof payload.solscanToken === "string" && payload.solscanToken) ||
        "";
      if (scan) setSolscanHref(scan);
      if (!result.ok && result.message) setError(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tool failed");
    } finally {
      setRunning(false);
    }
  };

  const onToggleAuto = async (enabled: boolean) => {
    setError(null);
    setSavingAuto(true);
    try {
      const next = await telegramOrbitXSetAutoBuy(enabled);
      setAutoBuy(next.autoBuy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save auto-sign");
    } finally {
      setSavingAuto(false);
    }
  };

  const parsedArgs = useMemo(() => {
    const raw = toolArgs.trim();
    if (!raw) return {};
    if (raw.startsWith("{")) {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { q: raw };
      }
    }
    const out: Record<string, unknown> = {};
    const parts = raw.split(/\s+/);
    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq > 0) out[part.slice(0, eq)] = part.slice(eq + 1);
      else if (!out.mint && !out.prompt && !out.q) {
        if (/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(part)) out.mint = part;
        else out.prompt = raw;
      }
    }
    return out;
  }, [toolArgs]);

  if (authLoading) return <AgentLoading label="Loading Telegram…" />;

  const alreadyLinked = Boolean(status?.links?.length);

  return (
    <AgentShell
      showTabs
      tabs={TABS}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
      statusLabel={alreadyLinked ? "Telegram linked" : "Official bot"}
      statusWarn={!alreadyLinked}
      brandHref="/telegram"
      brandSub="Telegram"
      footerBrand="OrbitX Telegram"
      footerNote="Official @theorbitxmcpbot — groups are public; DMs unlock trade and X after /login."
      mcpUrl={TELEGRAM_ORBITX_TME}
      siblingHref="/agent"
      siblingLabel="Agent"
      topSubtitle="Official bot · not MCP OAuth"
    >
      {tab === "link" ? (
        <section className="ox-agent__panel ox-tg__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Link @{TELEGRAM_ORBITX_BOT}</h2>
            <span className="ox-agent__panel-hint">{linked || alreadyLinked ? "linked" : code ? "code ready" : "awaiting /login"}</span>
          </div>
          <div className="ox-agent__panel-b">
            <p className="ox-tg__lead">
              In Telegram, message the bot privately and send <code>/login</code>. Then confirm here with the same OrbitX wallet.
              Groups stay public: <code>/cmds</code>, <code>/token</code>, <code>/chart</code>, <code>/img</code>, <code>/vid</code>, <code>/check</code>, <code>/links</code>.
              Image and video take a few minutes — keep sending <code>/check</code> until the countdown hits ready.
            </p>
            <div className="ox-agent__btn-row">
              <a className="ox-agent__btn ox-agent__btn--primary" href={TELEGRAM_ORBITX_TME} target="_blank" rel="noreferrer">
                Open @{TELEGRAM_ORBITX_BOT}
              </a>
              <Link className="ox-agent__btn" to="/x">
                Connect X
              </Link>
            </div>

            {linked ? (
              <p className="ox-tg__ok">Linked. Return to Telegram and try /me, /buy, or /tweet.</p>
            ) : !user ? (
              <div className="ox-agent__btn-row">
                {pickable.slice(0, 4).map((w) => (
                  <button
                    key={w.name}
                    type="button"
                    className="ox-agent__btn ox-agent__btn--primary"
                    disabled={busy === w.name}
                    onClick={() => signInWith(w.name, { replaceEmailSession: true }).catch((e) => setError(e.message))}
                  >
                    {busy === w.name ? "Connecting…" : `Continue with ${w.name}`}
                  </button>
                ))}
              </div>
            ) : (
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={linking || !code} onClick={onLink}>
                  {linking ? "Linking…" : code ? "Confirm Telegram link" : "Need a /login code"}
                </button>
              </div>
            )}

            {alreadyLinked && status?.links?.[0] ? (
              <>
                <p className="ox-agent__note">
                  Linked Telegram {status.links[0].telegram_username ? `@${status.links[0].telegram_username}` : status.links[0].telegram_user_id}
                  {status.links[0].wallet_address ? ` · ${status.links[0].wallet_address.slice(0, 4)}…${status.links[0].wallet_address.slice(-4)}` : ""}
                </p>
                <label className="ox-tg__toggle">
                  <input
                    type="checkbox"
                    checked={autoBuy}
                    disabled={savingAuto || !user}
                    onChange={(e) => void onToggleAuto(e.target.checked)}
                  />
                  <span>
                    Auto-sign buys — Phantom prompts as soon as the swap is ready. You still approve in the wallet. OrbitX never holds keys.
                  </span>
                </label>
              </>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="ox-agent__panel ox-tg__panel">
          <div className="ox-agent__panel-h">
            <h2 className="ox-agent__panel-title">Live tools</h2>
            <span className="ox-agent__panel-hint">{cmds?.count || status?.tools || 0} tools</span>
          </div>
          <div className="ox-agent__panel-b">
            <div className="ox-tg__quick">
              <p className="ox-tg__lead">
                Buy $ORBITX with SOL from the wallet you linked. “Buy $1” converts USD → SOL at the live price, then opens Phantom.
              </p>
              <label className="ox-tg__toggle">
                <input
                  type="checkbox"
                  checked={autoBuy}
                  disabled={savingAuto || !user}
                  onChange={(e) => void onToggleAuto(e.target.checked)}
                />
                <span>Auto-sign — skip the extra confirm and open Phantom immediately</span>
              </label>
              <div className="ox-agent__btn-row">
                <button
                  type="button"
                  className="ox-agent__btn ox-agent__btn--primary"
                  disabled={running || !user}
                  onClick={() => run("orbitx_buy_orbitx", { amountUsd: 1, autoConfirm: autoBuy })}
                >
                  {running ? "Building swap…" : "Buy $1 $ORBITX"}
                </button>
                <button
                  type="button"
                  className="ox-agent__btn"
                  disabled={running || !user}
                  onClick={() => run("orbitx_buy_orbitx", { amountSol: 0.05, autoConfirm: autoBuy })}
                >
                  Buy 0.05 SOL
                </button>
                <button
                  type="button"
                  className="ox-agent__btn"
                  disabled={running || !user}
                  onClick={() => run("orbitx_mcp_access_buy", { package: "day", autoConfirm: autoBuy })}
                >
                  Burn 1 day MCP
                </button>
              </div>
              {signHref ? (
                <div className="ox-agent__btn-row">
                  <a className="ox-agent__btn ox-agent__btn--primary" href={signHref} target="_blank" rel="noreferrer">
                    {autoBuy ? "Auto-sign in Phantom" : "Sign in Phantom"}
                  </a>
                  {solscanHref ? (
                    <a className="ox-agent__btn" href={solscanHref} target="_blank" rel="noreferrer">
                      Solscan
                    </a>
                  ) : null}
                </div>
              ) : null}
              <textarea
                className="ox-tg__input"
                rows={2}
                placeholder="Image or video prompt…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="ox-agent__btn-row">
                <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={running || !prompt.trim()} onClick={() => run("orbitx_generate_image", { prompt })}>
                  Generate image
                </button>
                <button type="button" className="ox-agent__btn" disabled={running || !prompt.trim()} onClick={() => run("orbitx_generate_video", { prompt })}>
                  Generate video
                </button>
              </div>
            </div>

            <label className="ox-tg__label">
              Search catalog
              <input className="ox-tg__input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="chart, screen, grok…" />
            </label>
            <div className="ox-tg__tools">
              {(cmds?.tools || []).slice(0, 40).map((tool) => (
                <button
                  key={tool.name}
                  type="button"
                  className="ox-tg__chip"
                  onClick={() => {
                    setToolName(tool.name);
                    setToolArgs("");
                  }}
                >
                  {tool.name.replace(/^orbitx_/, "")}
                </button>
              ))}
            </div>

            <label className="ox-tg__label">
              /call
              <input className="ox-tg__input" value={toolName} onChange={(e) => setToolName(e.target.value)} />
            </label>
            <label className="ox-tg__label">
              Args (key=value or JSON)
              <input className="ox-tg__input" value={toolArgs} onChange={(e) => setToolArgs(e.target.value)} placeholder='mint=So111… or {"prompt":"…"}' />
            </label>
            <button type="button" className="ox-agent__btn ox-agent__btn--primary" disabled={running || !toolName.trim()} onClick={() => run(toolName.trim(), parsedArgs)}>
              {running ? "Running…" : "Run tool"}
            </button>
            {output ? <pre className="ox-tg__out">{output}</pre> : null}
            {media.length ? (
              <div className="ox-tg__media">
                {media.map((url) =>
                  /\.(mp4|webm|mov)(\?|$)/i.test(url) ? (
                    <video key={url} src={url} controls />
                  ) : (
                    <img key={url} src={url} alt="" />
                  ),
                )}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {error ? <div className="ox-agent__alert ox-tg__alert">{error}</div> : null}
    </AgentShell>
  );
}
