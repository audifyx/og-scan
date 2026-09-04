import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Rocket } from "lucide-react";
import { saveTokenCreatePrefill } from "@/lib/orbitx/tokenCreatePrefill";

/**
 * MCP → Launchpad handoff. Prefills Pump create form, then opens Phantom launch UI.
 * Query: name, symbol, description, imageUrl, twitter, telegram, website, lane
 */
export default function AgentCreateTokenPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const name = (params.get("name") || "").trim();
    const symbol = (params.get("symbol") || "").trim().toUpperCase();
    if (!name || !symbol) {
      setError("Missing name or symbol. Call orbitx_create_token from MCP first.");
      return;
    }

    const imageUrl = (params.get("imageUrl") || params.get("image") || "").trim() || null;
    const imageDataUrl = (params.get("imageDataUrl") || "").trim() || null;

    saveTokenCreatePrefill({
      name,
      symbol,
      description: (params.get("description") || "").trim(),
      website: (params.get("website") || "").trim() || undefined,
      twitter: (params.get("twitter") || "").trim() || undefined,
      telegram: (params.get("telegram") || "").trim() || undefined,
      imageUrl,
      imageDataUrl,
      source: params.get("telegramUser") ? "telegram" : "nft",
      telegramUserId: (params.get("telegramUser") || "").trim() || null,
      telegramChatId: (params.get("chat") || "").trim() || null,
      confirmNonce: (params.get("nonce") || "").trim() || null,
    });

    const lane = params.get("lane") === "custom" ? "custom" : "pump";
    const from = params.get("telegramUser") ? "telegram" : "mcp";
    navigate(`/orbitxlaunch/create/${lane}?from=${from}`, { replace: true });
  }, [params, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070a10] p-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c111a] p-6">
          <h1 className="mb-2 text-lg font-black">Create token</h1>
          <p className="mb-4 text-sm text-rose-200/80">{error}</p>
          <Link to="/orbitxlaunch/create/pump" className="text-sm text-emerald-300 hover:underline">
            Open launchpad manually →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#070a10] text-white/60">
      <Rocket className="h-6 w-6 text-emerald-400" />
      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
      <p className="text-sm">Opening OrbitX launchpad for Phantom…</p>
    </div>
  );
}
