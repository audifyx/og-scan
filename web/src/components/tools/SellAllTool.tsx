import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ArrowRightLeft, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fetchTokenMetadata } from "@/lib/helius-integration";
import type { PublicKey } from "@solana/web3.js";

interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  logoUrl?: string;
}

type OutputAsset = "SOL" | "USDC";

export function SellAllTool() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [outputAsset, setOutputAsset] = useState<OutputAsset>("SOL");
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!publicKey) return;
    scanTokens();
  }, [publicKey]);

  const scanTokens = async () => {
    if (!publicKey) return;
    try {
      setLoading(true);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: new (await import("@solana/spl-token")).TOKEN_PROGRAM_ID,
      });

      const balances: TokenBalance[] = [];
      for (const account of tokenAccounts.value) {
        const parsed = account.account.data.parsed;
        if (parsed.type !== "account") continue;

        const info = parsed.info;
        const mint = info.mint;
        const balance = Number(info.tokenAmount.amount) / Math.pow(10, info.tokenAmount.decimals);

        if (balance > 0) {
          try {
            const meta = await fetchTokenMetadata(mint);
            balances.push({
              mint,
              symbol: meta.symbol || "???",
              name: meta.name || "Unknown",
              decimals: info.tokenAmount.decimals,
              balance,
              logoUrl: meta.logoUrl,
            });
          } catch {
            balances.push({
              mint,
              symbol: "???",
              name: mint.slice(0, 8),
              decimals: info.tokenAmount.decimals,
              balance,
            });
          }
        }
      }

      setTokens(balances.sort((a, b) => b.balance - a.balance));
      if (balances.length > 0) {
        setSelectedTokens(new Set(balances.map((t) => t.mint)));
      }
    } catch (err) {
      console.error("[SellAll] scan error", err);
      toast.error("Failed to scan tokens");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSellAll = async () => {
    if (!publicKey || selectedTokens.size === 0) return;

    try {
      setLoading(true);
      const selected = tokens.filter((t) => selectedTokens.has(t.mint));

      // Placeholder: Real implementation would:
      // 1. Fetch Jupiter routes for each token → SOL/USDC
      // 2. Construct swap instructions
      // 3. Batch into single transaction or multi-sig bundle
      // 4. Submit and monitor

      toast.success(`Ready to swap ${selected.length} tokens to ${outputAsset}`);
      // After successful tx:
      // toast.success("All tokens swapped");
      // await scanTokens();
    } catch (err) {
      console.error("[SellAll] execute error", err);
      toast.error("Swap failed");
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <p className="text-sm text-white/50">Connect wallet to use Sell All tool</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-[hsl(var(--og-lime))]" />
        <h2 className="text-lg font-bold text-white">Sell All Holdings</h2>
      </div>

      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="assets" className="flex-1">
            Assets ({tokens.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-1">
            Output
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="text-sm text-white/50">Scanning wallet...</div>
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5 text-white/30" />
              <p className="text-sm text-white/50">No tokens found</p>
              <Button size="sm" variant="outline" onClick={scanTokens} className="mt-2">
                Retry Scan
              </Button>
            </div>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {tokens.map((token) => (
                <label
                  key={token.mint}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 p-2.5 hover:border-white/20 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selectedTokens.has(token.mint)}
                    onChange={(e) => {
                      const next = new Set(selectedTokens);
                      if (e.target.checked) {
                        next.add(token.mint);
                      } else {
                        next.delete(token.mint);
                      }
                      setSelectedTokens(next);
                    }}
                    className="h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {token.logoUrl ? (
                        <img src={token.logoUrl} alt="" className="h-5 w-5 rounded-full" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{token.symbol}</p>
                        <p className="truncate text-xs text-white/40">{token.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-white">
                      {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/50">
              Swap To
            </p>
            <div className="flex gap-2">
              {(["SOL", "USDC"] as const).map((asset) => (
                <button
                  key={asset}
                  onClick={() => setOutputAsset(asset)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    outputAsset === asset
                      ? "border border-white/30 bg-white/20 text-white"
                      : "border border-white/10 bg-white/5 text-white/50 hover:border-white/20"
                  }`}
                >
                  {asset === "SOL" ? "◎ Solana" : "$ USDC"}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">
              {outputAsset === "SOL"
                ? "Recommended: Direct to native SOL for lowest fees"
                : "Stablecoin output for price stability"}
            </p>
          </div>

          <div className="rounded-lg border border-[hsl(var(--og-lime))]/20 bg-[hsl(var(--og-lime))]/5 p-3">
            <div className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--og-lime))]" />
              <div className="text-xs text-[hsl(var(--og-lime))]/80">
                <p className="font-semibold">One-click batch execution</p>
                <p className="mt-1">All selected tokens → {outputAsset} in a single atomic transaction</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Button
        onClick={handleExecuteSellAll}
        disabled={loading || selectedTokens.size === 0}
        size="lg"
        className="w-full bg-gradient-to-r from-[hsl(var(--og-lime))] to-[hsl(var(--og-gold))] text-black hover:opacity-90"
      >
        <Zap className="mr-2 h-4 w-4" />
        Sell {selectedTokens.size} Token{selectedTokens.size !== 1 ? "s" : ""} → {outputAsset}
      </Button>
    </div>
  );
}
