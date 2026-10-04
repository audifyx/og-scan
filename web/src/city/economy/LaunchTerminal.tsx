/**
 * OrbitX City — token launch terminal.
 *
 * Runs the REAL desk-wallet launch flow: orbitx_app_launch (Supercomputer
 * MCP) — the backend signs the pump.fun create from the user's sealed
 * in-app wallet, auto vanity *obx mint, no launch fee, just gas + mint
 * rent. Then orbitx_launch_record surfaces the coin in the platform's
 * launch feeds like any other launch. The player pays gas + dev buy from
 * the desk wallet — product law holds, the platform never funds launches.
 * Every launch shows a receipt with mint + signature + Solscan link.
 */
import { useRef, useState } from "react";
import { Rocket, Upload, X } from "lucide-react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { getBillingAuthCode } from "@/tokenomics/auth";
import { callSupercomputerTool } from "@/tokenomics/mcpClient";
import ReceiptModal from "./ReceiptModal";
import "./economy.css";

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result ?? "");
      const [head, data] = url.split(",");
      const mime = /data:(.*?);/.exec(head)?.[1] || file.type || "image/png";
      resolve({ base64: data ?? "", mime });
    };
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(file);
  });
}

export default function LaunchTerminal({ onClose }: { onClose: () => void }) {
  const billing = useOrbitxBilling();
  const authed = billing.ready && !!getBillingAuthCode();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [devBuy, setDevBuy] = useState("0");
  const [status, setStatus] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ mint: string; sig: string } | null>(null);

  const valid =
    name.trim().length >= 2 &&
    symbol.trim().length >= 1 &&
    symbol.trim().length <= 10 &&
    image !== null &&
    !launching;

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const { base64, mime } = await fileToBase64(f);
      setImage({ base64, mime, preview: URL.createObjectURL(f) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image failed.");
    }
  }

  async function launch() {
    const authCode = getBillingAuthCode();
    if (!authCode || !valid || !image) return;
    setError(null);
    setLaunching(true);
    setStatus("Building coin…");
    try {
      const devBuySol = Math.max(0, Number(devBuy) || 0);
      const res = await callSupercomputerTool(
        "orbitx_app_launch",
        {
          authCode,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          description: description.trim(),
          imageBase64: image.base64,
          imageMimeType: image.mime,
          pair: "sol",
          devBuySol,
        },
        { timeoutMs: 120000 },
      );
      if (!res.ok || typeof res.signature !== "string" || typeof res.mint !== "string") {
        throw new Error(res.message || res.error || "Launch failed.");
      }
      setStatus("Recording launch…");
      // Surface the coin in the platform's launch feeds (best-effort).
      await callSupercomputerTool("orbitx_launch_record", {
        authCode,
        mint: res.mint,
        signature: res.signature,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
      }).catch(() => {});
      setReceipt({ mint: res.mint, sig: res.signature });
      setStatus(null);
      billing.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed.");
      setStatus(null);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label="Launch terminal">
      <div className="oxe-sheet oxe-sheet-wide">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <Rocket className="oxe-ic" />
            <div>
              <div className="oxe-t1">LAUNCH TERMINAL</div>
              <div className="oxe-t2">Real pump.fun deployment · vanity *obx mint · desk-wallet signed</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close launch terminal">
            <X />
          </button>
        </div>

        {!authed ? (
          <div className="oxe-notice">
            <div className="oxe-notice-t">Link your in-app wallet to launch</div>
            <div className="oxe-notice-s">
              One dashboard link, then launches are signed by the backend — no popups, ever.
            </div>
            {billing.error && <div className="oxe-err oxe-err-block">{billing.error}</div>}
            <button className="oxe-btn oxe-btn-primary" onClick={() => billing.beginAuth()}>
              Link in-app wallet
            </button>
          </div>
        ) : (
          <>
            <div className="oxe-field">
              <label>Coin image</label>
              <button className="oxe-imgbtn" onClick={() => fileRef.current?.click()}>
                {image ? (
                  <img src={image.preview} alt="Coin" />
                ) : (
                  <span className="oxe-imgbtn-ph">
                    <Upload className="oxe-ic" /> Tap to upload
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>

            <div className="oxe-field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="OrbitX City Coin" maxLength={32} />
            </div>
            <div className="oxe-fieldrow">
              <div className="oxe-field">
                <label>Symbol</label>
                <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="CITY" maxLength={10} />
              </div>
              <div className="oxe-field">
                <label>Dev buy (SOL)</label>
                <input value={devBuy} onChange={(e) => setDevBuy(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" />
              </div>
            </div>
            <div className="oxe-field">
              <label>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this coin?" rows={2} maxLength={280} />
            </div>

            <div className="oxe-chips">
              <span className="oxe-mini-chip">PAIR · SOL</span>
              <span className="oxe-mini-chip">VANITY · *obx</span>
              <span className="oxe-mini-chip">VIA · pump.fun</span>
              <span className="oxe-mini-chip">SIGNS · desk wallet</span>
            </div>

            {status && <div className="oxe-status">{status}</div>}
            {error && <div className="oxe-err oxe-err-block">{error}</div>}

            <div className="oxe-actions">
              <button className="oxe-btn oxe-btn-primary" onClick={launch} disabled={!valid}>
                <Rocket className="oxe-ic-sm" />
                {launching ? "Launching…" : "Launch token"}
              </button>
            </div>
            <div className="oxe-t2 oxe-center">
              Desk wallet pays gas + dev buy · free launch · token hits the launch feed
            </div>
          </>
        )}
      </div>

      {receipt && (
        <ReceiptModal
          title="Token launched"
          subtitle="Live on pump.fun — tradeable now"
          rows={[{ label: "Mint", value: `${receipt.mint.slice(0, 8)}…${receipt.mint.slice(-8)}` }]}
          signature={receipt.sig}
          links={[
            { label: "Pump.fun", href: `https://pump.fun/coin/${receipt.mint}` },
            { label: "OrbitX token", href: `https://www.orbitx.world/token/${receipt.mint}` },
          ]}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
