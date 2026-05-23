import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Shield, RefreshCw, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const RISK_FLAGS = [
  { id: "newWallet", label: "New Wallet", desc: "Less than 7 days old" },
  { id: "lowTxCount", label: "Low Activity", desc: "Few transactions" },
  { id: "highRiskInteractions", label: "Risky Interactions", desc: "Interacts with flagged addresses" },
  { id: "unusualPatterns", label: "Unusual Patterns", desc: "Abnormal transaction behavior" },
  { id: "tokenDeployer", label: "Token Deployer", desc: "Has deployed tokens before" },
];

export const RiskDetector = () => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState<any>(null);

  const analyzeRisk = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [overviewRes, txRes] = await Promise.all([
        supabase.functions.invoke("solana-tracker", {
          body: { action: "getWalletOverview", walletAddress: address },
        }),
        supabase.functions.invoke("solana-tracker", {
          body: { action: "getTransactions", walletAddress: address, limit: 50 },
        }),
      ]);

      const overview = overviewRes.data;
      const txs = txRes.data?.transactions || [];
      
      const flags: string[] = [];
      let riskScore = 0;

      // Check wallet age (based on transaction history)
      if (txs.length < 10) {
        flags.push("lowTxCount");
        riskScore += 20;
      }

      // Check if token deployer
      const hasDeployments = txs.some((tx: any) => 
        tx.type?.toLowerCase().includes("create") || tx.type?.toLowerCase().includes("initialize")
      );
      if (hasDeployments) {
        flags.push("tokenDeployer");
        riskScore += 15;
      }

      // Check for unusual patterns
      const swapCount = txs.filter((tx: any) => tx.type?.toLowerCase().includes("swap")).length;
      if (swapCount > txs.length * 0.8) {
        flags.push("unusualPatterns");
        riskScore += 25;
      }

      setRiskAnalysis({
        flags,
        riskScore: Math.min(riskScore, 100),
        totalTransactions: txs.length,
        balance: overview?.balance || 0,
      });

      toast({ title: "Risk analysis complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 60) return { label: "HIGH", color: "destructive" };
    if (score >= 30) return { label: "MEDIUM", color: "secondary" };
    return { label: "LOW", color: "default" };
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-red-500/10">
          <Shield className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold">Risk Detector</h3>
          <p className="text-sm text-muted-foreground">Flag high-risk addresses & behaviors</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter wallet or token address..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Button onClick={analyzeRisk} disabled={loading} variant="destructive">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
        </Button>
      </div>

      {riskAnalysis && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.04]">
            <div>
              <p className="text-xs text-muted-foreground">Risk Score</p>
              <p className="text-3xl font-bold">{riskAnalysis.riskScore}</p>
            </div>
            <Badge variant={getRiskLevel(riskAnalysis.riskScore).color as any}>
              {getRiskLevel(riskAnalysis.riskScore).label} RISK
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Risk Flags</p>
            {RISK_FLAGS.map((flag) => {
              const isActive = riskAnalysis.flags.includes(flag.id);
              return (
                <div 
                  key={flag.id} 
                  className={`p-3 rounded-lg flex items-center gap-3 ${isActive ? "bg-red-500/10 border border-red-500/20" : "bg-white/[0.04]"}`}
                >
                  {isActive ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{flag.label}</p>
                    <p className="text-xs text-muted-foreground">{flag.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};
