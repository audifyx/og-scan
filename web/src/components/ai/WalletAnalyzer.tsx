import { useState } from "react";
import { Brain, Loader2, Search, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getWalletOverview, getAssets, getTransactions, isValidSolanaAddress } from "@/lib/solana-api";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { useCredits } from "@/hooks/useCredits";
import { CreditCostLabel } from "@/components/credits/CreditCostLabel";
import { CreditConfirmDialog } from "@/components/credits/CreditConfirmDialog";

export const WalletAnalyzer = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const { spendCredits, canAfford } = useCredits();

  const handleAnalyze = () => {
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      toast({ title: "Enter a valid Solana wallet address", variant: "destructive" });
      return;
    }
    
    if (!canAfford('wallet-analyzer')) {
      toast({ title: "Insufficient credits", description: "You need more credits to use this feature", variant: "destructive" });
      return;
    }
    
    setShowConfirm(true);
  };

  const analyzeWallet = async () => {
    setShowConfirm(false);
    
    // Spend credits first
    const spent = await spendCredits('wallet-analyzer', `Analyzed wallet: ${walletAddress.slice(0, 8)}...`);
    if (!spent) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      // Fetch wallet data
      const [overview, assets, txs] = await Promise.all([
        getWalletOverview(walletAddress),
        getAssets(walletAddress),
        getTransactions(walletAddress),
      ]);

      // Send to AI for analysis
      const { data, error } = await supabase.functions.invoke("ai-analyzer", {
        body: {
          action: "analyzeWallet",
          data: {
            walletAddress,
            ...overview,
            tokens: assets.assets?.filter((a: any) => a.interface === "FungibleToken") || [],
            transactions: txs.transactions || [],
          }
        }
      });

      if (error) throw error;
      setAnalysis(data.analysis);

    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Could not analyze wallet",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <CreditConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        toolKey="wallet-analyzer"
        onConfirm={analyzeWallet}
        description={`Analyze wallet: ${walletAddress.slice(0, 8)}...`}
      />
      
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">AI Wallet Analyzer</h2>
              <p className="text-sm text-muted-foreground">Deep analysis of any wallet</p>
            </div>
          </div>
          <CreditCostLabel toolKey="wallet-analyzer" />
        </div>

        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter wallet address to analyze..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
          </Button>
        </div>

      {isAnalyzing && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing wallet activity...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
        </div>
      )}

      {analysis && (
        <div className="animate-fade-in">
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-medium mt-3 mb-1 text-foreground">{children}</h3>,
                p: ({ children }) => <p className="text-muted-foreground mb-2">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 text-muted-foreground">{children}</ul>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
              }}
            >
              {analysis}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {!analysis && !isAnalyzing && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="p-4 rounded-lg bg-white/[0.04] text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-green-500" />
            <p className="text-xs text-muted-foreground">Trading Patterns</p>
          </div>
          <div className="p-4 rounded-lg bg-white/[0.04] text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
            <p className="text-xs text-muted-foreground">Risk Assessment</p>
          </div>
          <div className="p-4 rounded-lg bg-white/[0.04] text-center">
            <Target className="h-5 w-5 mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">Strategy Insights</p>
          </div>
        </div>
      )}
    </Card>
    </>
  );
};
