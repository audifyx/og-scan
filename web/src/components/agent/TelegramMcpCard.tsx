import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TgBot = {
  id: string;
  bot_username: string;
  mcp_agent_enabled?: boolean;
  mcp_x_enabled?: boolean;
};

async function tgErr(error: { message?: string } | null) {
  return error?.message || "Request failed";
}

type Props = {
  /** Agent MCP = full tools minus auth/trading. X = image + video only. */
  kind: "agent" | "x";
};

/**
 * Fast Telegram MCP setup on /agent and /x Connect tabs.
 * Bot token → dashboard auth (owner user) → /cmds registered. No auth tools, no trading.
 */
export function TelegramMcpCard({ kind }: Props) {
  const [bot, setBot] = useState<TgBot | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = kind === "x" ? !!bot?.mcp_x_enabled : !!bot?.mcp_agent_enabled;

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("telegram-connect", { body: { action: "status" } });
      setBot(data?.bot || null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    if (!tokenInput.trim()) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const body: Record<string, unknown> = {
        action: "connect",
        botToken: tokenInput.trim(),
      };
      if (kind === "x") body.mcp_x = true;
      else body.mcp_agent = true;
      const { data, error: err } = await supabase.functions.invoke("telegram-connect", { body });
      if (data?.error) throw new Error(data.error);
      if (err) throw new Error(await tgErr(err));
      setBot(data.bot);
      setTokenInput("");
      // Ensure MCP flag is on (connect may have upserted an existing bot without flag if columns missing)
      const { data: en } = await supabase.functions.invoke("telegram-connect", {
        body: { action: "mcp_enable", kind },
      });
      if (en?.bot) setBot(en.bot);
      setNote(
        kind === "x"
          ? `Connected @${data.bot.bot_username} · X MCP img/vid cmds registered · dashboard auth`
          : `Connected @${data.bot.bot_username} · Agent MCP /cmds registered · dashboard auth`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to connect bot");
    } finally {
      setBusy(false);
    }
  };

  const toggleMcp = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("telegram-connect", {
        body: { action: on ? "mcp_enable" : "mcp_disable", kind },
      });
      if (data?.error) throw new Error(data.error);
      if (err) throw new Error(await tgErr(err));
      setBot(data.bot);
      setNote(on ? "MCP commands registered on Telegram." : "MCP commands removed from Telegram menu.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update MCP");
    } finally {
      setBusy(false);
    }
  };

  const title = kind === "x" ? "Telegram · X MCP" : "Telegram · Agent MCP";
  const hint =
    kind === "x"
      ? "Paste BotFather token → image & video MCP only. Auth from this dashboard. No trading, no auth tools. Claude / ChatGPT / Grok stay as MCP connectors above."
      : "Paste BotFather token → all Agent MCP tools as /cmds. Auth from this dashboard. No auth-link tools, no trading.";

  return (
    <div
      className="ox-agent__note"
      style={{
        marginTop: "1.25rem",
        padding: "0.95rem 1rem",
        border: "1px solid rgba(34, 158, 217, 0.35)",
        borderRadius: 12,
        background: "rgba(34, 158, 217, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        {enabled ? (
          <span className="ox-agent__pill is-ok" style={{ fontSize: 10 }}>
            <span className="ox-agent__pill-dot" /> Live
          </span>
        ) : bot ? (
          <span className="ox-agent__pill" style={{ fontSize: 10 }}>
            Bot linked · MCP off
          </span>
        ) : null}
      </div>
      <p style={{ margin: "0 0 0.75rem", opacity: 0.85, fontSize: 13 }}>{hint}</p>

      {loading ? (
        <p className="ox-agent__note" style={{ margin: 0 }}>
          Loading…
        </p>
      ) : bot ? (
        <>
          <div className="ox-agent__row" style={{ marginBottom: 8 }}>
            <div className="ox-agent__label">Bot</div>
            <div className="ox-agent__value">@{bot.bot_username}</div>
            <div className="ox-agent__actions">
              <a
                className="ox-agent__btn ox-agent__btn--ghost"
                href={`https://t.me/${bot.bot_username}`}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </div>
          </div>
          <div className="ox-agent__btn-row" style={{ marginTop: 0 }}>
            {!enabled ? (
              <button
                type="button"
                className="ox-agent__btn ox-agent__btn--primary"
                disabled={busy}
                onClick={() => toggleMcp(true)}
              >
                {busy ? "…" : "Enable MCP on Telegram"}
              </button>
            ) : (
              <button type="button" className="ox-agent__btn" disabled={busy} onClick={() => toggleMcp(false)}>
                {busy ? "…" : "Disable MCP"}
              </button>
            )}
          </div>
          {enabled && (
            <p className="ox-agent__note" style={{ marginBottom: 0, marginTop: 10 }}>
              {kind === "x" ? (
                <>
                  Try <code>/mcp</code> <code>/cmds</code> <code>/img prompt</code> <code>/vid prompt</code>{" "}
                  <code>/media taskId</code>
                </>
              ) : (
                <>
                  Try <code>/mcp</code> <code>/cmds</code> <code>/img</code> <code>/token mint</code>{" "}
                  <code>/chart ca</code> <code>/call tool args</code>
                </>
              )}
            </p>
          )}
        </>
      ) : (
        <>
          <ol className="ox-agent__ol" style={{ marginBottom: 10 }}>
            <li>
              Open{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                @BotFather
              </a>{" "}
              → <code>/newbot</code>
            </li>
            <li>Paste the token below → Connect (uses your OrbitX session — no second auth)</li>
            <li>
              In Telegram: <code>/cmds</code> for the MCP board
            </li>
          </ol>
          <div className="ox-agent__btn-row" style={{ marginTop: 0, flexWrap: "wrap" }}>
            <input
              className="ox-agent__input"
              style={{ flex: "1 1 220px", minWidth: 0 }}
              type="password"
              autoComplete="off"
              placeholder="123456:ABC-DEF… (BotFather token)"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button
              type="button"
              className="ox-agent__btn ox-agent__btn--primary"
              disabled={busy || !tokenInput.trim()}
              onClick={() => void connect()}
            >
              {busy ? "Connecting…" : "Connect + enable MCP"}
            </button>
          </div>
        </>
      )}

      {note && (
        <p className="ox-agent__note" style={{ marginBottom: 0, marginTop: 8, color: "var(--oa-ok)" }}>
          {note}
        </p>
      )}
      {error && (
        <p className="ox-agent__note" style={{ marginBottom: 0, marginTop: 8, color: "var(--oa-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
