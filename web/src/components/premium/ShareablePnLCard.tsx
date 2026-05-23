import { useState } from "react";
import { Download, Share2, Loader2, Sparkles, TrendingUp, TrendingDown, Wallet, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { getWalletOverview, getAssets, getTransactions, formatUsd } from "@/lib/solana-api";
import { toast } from "sonner";
import { useCredits } from "@/hooks/useCredits";
import { CreditCostLabel } from "@/components/credits/CreditCostLabel";

interface TokenPosition {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  image?: string;
}

export const ShareablePnLCard = () => {
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [cardStyle, setCardStyle] = useState<"pnl" | "wallet">("pnl");
  const { spendCredits, canAfford } = useCredits();
  
  // Wallet data state
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [positions, setPositions] = useState<TokenPosition[]>([]);
  const [totalTrades, setTotalTrades] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);

  const fetchWalletData = async () => {
    if (!walletAddress || walletAddress.length < 32) {
      toast.error("Please enter a valid Solana wallet address");
      return;
    }

    setLoading(true);
    try {
      const [overview, assetsData, txData] = await Promise.all([
        getWalletOverview(walletAddress),
        getAssets(walletAddress),
        getTransactions(walletAddress),
      ]);

      setPortfolioValue(overview.totalUsdValue);
      setSolBalance(overview.balance);
      setTotalTrades(txData.transactions?.length || 0);

      // Extract token positions
      const tokenPositions: TokenPosition[] = (assetsData.assets || [])
        .filter((a: any) => a.interface === 'FungibleToken' || a.interface === 'FungibleAsset')
        .map((asset: any) => ({
          symbol: asset.content?.metadata?.symbol || '???',
          name: asset.content?.metadata?.name || 'Unknown',
          balance: (asset.token_info?.balance || 0) / Math.pow(10, asset.token_info?.decimals || 0),
          value: asset.token_info?.price_info?.total_price || 0,
          image: asset.content?.links?.image,
        }))
        .sort((a: TokenPosition, b: TokenPosition) => b.value - a.value)
        .slice(0, 10);

      setPositions(tokenPositions);
      setDataLoaded(true);
      toast.success("Wallet data loaded!");
    } catch (error) {
      console.error("Error fetching wallet data:", error);
      toast.error("Failed to fetch wallet data");
    } finally {
      setLoading(false);
    }
  };

  const generateWithGemini = async () => {
    if (!dataLoaded) {
      toast.error("Please load wallet data first");
      return;
    }

    if (!canAfford('pnl-image')) {
      toast.error("Insufficient credits for this action");
      return;
    }

    const spent = await spendCredits('pnl-image', `Generated ${cardStyle} card for ${walletAddress.slice(0, 8)}...`);
    if (!spent) return;

    setGenerating(true);
    try {
      const topHoldings = positions.slice(0, 5).map(p => 
        `${p.symbol}: ${p.balance.toFixed(2)} ($${p.value.toFixed(2)})`
      ).join(', ');

      const bestTrade = positions.length > 0 ? positions[0] : null;

      const prompt = cardStyle === "pnl"
        ? `Create a sleek, professional trading P&L card image with dark cyber/neon aesthetic. 
           IMPORTANT: Include these EXACT values in the design:
           - Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}
           - Portfolio Value: $${portfolioValue.toFixed(2)}
           - SOL Balance: ${solBalance.toFixed(4)} SOL
           - Total Positions: ${positions.length}
           - Total Transactions: ${totalTrades}
           - Top Holdings: ${topHoldings || 'None'}
           ${bestTrade ? `- Best Position: ${bestTrade.symbol} worth $${bestTrade.value.toFixed(2)}` : ''}
           
           Style: Dark background (#0a0a0f), green (#00FFA3) for profits, purple (#9945FF) gradient accents.
           Include glassmorphism effects, modern typography, Solana logo.
           Make it Instagram/Twitter shareable, 1080x1080 aspect ratio.
           Layout: Clean card design with stats prominently displayed.`
        : `Create a sleek wallet portfolio overview card image with dark cyber/neon aesthetic.
           IMPORTANT: Include these EXACT values:
           - Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}
           - Total Value: $${portfolioValue.toFixed(2)}
           - SOL: ${solBalance.toFixed(4)}
           - Tokens Held: ${positions.length}
           - Top 5 Holdings: ${topHoldings || 'No tokens'}
           
           Style: Dark background, purple (#9945FF) and green (#00FFA3) gradients.
           Glassmorphism, modern typography. Include Solana branding.
           Make it shareable on social media. 1080x1080 square format.`;

      const { data, error } = await supabase.functions.invoke("generate-pnl-image", {
        body: { prompt, type: cardStyle },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Image generated successfully!");
      } else {
        throw new Error("No image returned");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Failed to generate image. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `solana-${cardStyle}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Image downloaded!");
  };

  const shareImage = async () => {
    if (!generatedImage) return;
    try {
      if (navigator.share) {
        const blob = await fetch(generatedImage).then((r) => r.blob());
        const file = new File([blob], `solana-${cardStyle}.png`, { type: "image/png" });
        await navigator.share({
          files: [file],
          title: "My Solana Portfolio",
          text: `Check out my Solana portfolio - $${portfolioValue.toFixed(2)} total value!`,
        });
      } else {
        await navigator.clipboard.writeText(generatedImage);
        toast.success("Image URL copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <Card className="og-glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Generated Shareable Cards
          </CardTitle>
          <CreditCostLabel toolKey="pnl-image" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Input */}
        <div className="space-y-2">
          <Label>Wallet Address</Label>
          <div className="flex gap-2">
            <Input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter Solana wallet address"
              className="font-mono flex-1"
            />
            <Button onClick={fetchWalletData} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Loaded Data Preview */}
        {dataLoaded && (
          <div className="p-4 rounded-lg bg-white/[0.04] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Portfolio Value</span>
              <span className="text-xl font-bold text-primary">${portfolioValue.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SOL Balance</span>
              <span className="font-medium">{solBalance.toFixed(4)} SOL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Token Positions</span>
              <span className="font-medium">{positions.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Transactions</span>
              <span className="font-medium">{totalTrades}</span>
            </div>
            
            {positions.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Top Holdings</p>
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2">
                    {positions.slice(0, 5).map((pos, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {pos.image ? (
                            <img src={pos.image} alt={pos.symbol} className="h-5 w-5 rounded-full" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                              {pos.symbol.slice(0, 1)}
                            </div>
                          )}
                          <span className="font-medium">{pos.symbol}</span>
                        </div>
                        <span className="text-muted-foreground">${pos.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Card Type Selection */}
        <Tabs value={cardStyle} onValueChange={(v) => setCardStyle(v as "pnl" | "wallet")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pnl" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              P&L Card
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Portfolio Card
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Generated Image Preview */}
        {generatedImage && (
          <div className="space-y-2">
            <Label>Generated Image</Label>
            <div className="rounded-xl overflow-hidden border border-border">
              <img
                src={generatedImage}
                alt="Generated Card"
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={generateWithGemini}
            disabled={generating || !dataLoaded}
            className="flex-1"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Card
              </>
            )}
          </Button>

          {generatedImage && (
            <>
              <Button variant="outline" onClick={downloadImage}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={shareImage}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </>
          )}
        </div>

        {!dataLoaded && (
          <p className="text-xs text-center text-muted-foreground">
            Enter a wallet address and click search to load real data for your card
          </p>
        )}
      </CardContent>
    </Card>
  );
};
