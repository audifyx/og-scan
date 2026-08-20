import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  TELEGRAM_ORBITX_TME,
  telegramOrbitXSetAutoBuy,
  telegramOrbitXStatus,
} from "@/lib/telegramOrbitX";

/**
 * MCP dashboard Auto-buy toggle. ON = Telegram `buy <amount> <CA>` executes
 * from a dedicated hot wallet with no Sign page and no second wallet approve.
 */
export function TelegramAutoBuyCard() {
  const { user } = useAuth();
  const [autoBuy, setAutoBuy] = useState(false);
  const [autoWallet, setAutoWallet] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await telegramOrbitXStatus();
      setAutoBuy(Boolean(next.autoBuy ?? next.links?.[0]?.auto_buy));
      setAutoWallet(next.autoWallet || null);
      setLinked(Boolean(next.links?.length));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Auto-buy status");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  const onToggle = async (enabled: boolean) => {
    setError(null);
    setNote(null);
    setSaving(true);
    try {
      const next = await telegramOrbitXSetAutoBuy(enabled);
      setAutoBuy(next.autoBuy);
      if (next.autoWallet) setAutoWallet(next.autoWallet);
      if (next.message) setNote(next.message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Auto-buy");
    } finally {
      setSaving(false);
    }
  };

  const copyWallet = async () => {
    if (!autoWallet) return;
    try {
      await navigator.clipboard.writeText(autoWallet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy address");
    }
  };

  return (
    <section className="ox-agent__panel">
      <div className="ox-agent__panel-h">
        <h2 className="ox-agent__panel-title">Telegram Auto-buy</h2>
        <span className="ox-agent__panel-hint">{autoBuy ? "ON · no Sign" : "OFF · Sign each buy"}</span>
      </div>
      <div className="ox-agent__panel-b">
        <p className="ox-agent__note" style={{ marginTop: 0 }}>
          Toggle this on, fund the Auto-buy wallet, then in{" "}
          <a href={TELEGRAM_ORBITX_TME} target="_blank" rel="noreferrer">
            @theorbitxmcpbot
          </a>{" "}
          send <code>buy 0.05 CA</code>. It buys immediately — no Sign link, no wallet popup.
        </p>
        <label className="ox-agent__toggle">
          <input
            type="checkbox"
            checked={autoBuy}
            disabled={saving || !user}
            onChange={(e) => void onToggle(e.target.checked)}
          />
          <span>
            {autoBuy
              ? "Auto-buy is ON. Telegram buys fill from the deposit address below."
              : "Auto-buy is OFF. Each Telegram buy returns a Jupiter Sign link."}
          </span>
        </label>
        {!user ? (
          <p className="ox-agent__note">Sign in with your OrbitX wallet to toggle Auto-buy.</p>
        ) : null}
        {autoBuy && autoWallet ? (
          <>
            <div className="ox-agent__row">
              <div className="ox-agent__label">Deposit SOL</div>
              <div className="ox-agent__value">{autoWallet}</div>
              <div className="ox-agent__actions">
                <button type="button" className="ox-agent__btn" onClick={() => void copyWallet()}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <p className="ox-agent__note">
              Only fund what you want the bot to spend. This is a hot wallet OrbitX signs with — not your Jupiter or
              Phantom wallet.
            </p>
          </>
        ) : null}
        {!linked ? (
          <p className="ox-agent__note">
            Link Telegram after <code>/login</code> on{" "}
            <Link to="/telegram">orbitx.world/telegram</Link> so the bot can fill for this account.
          </p>
        ) : null}
        {note ? <p className="ox-agent__note">{note}</p> : null}
        {error ? <div className="ox-agent__alert">{error}</div> : null}
      </div>
    </section>
  );
}
