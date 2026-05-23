import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { FileText, RefreshCw, Shield, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const TokenMetadataInspector = () => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

  const inspectToken = async () => {
    if (!tokenAddress) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "analyzeToken", tokenAddress },
      });

      setMetadata(data);
      toast({ title: "Inspection complete" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-cyan-500/10">
          <FileText className="h-5 w-5 text-cyan-500" />
        </div>
        <div>
          <h3 className="font-semibold">Token Metadata Inspector</h3>
          <p className="text-sm text-muted-foreground">SPL token details, authorities, freeze status</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Enter token address..."
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
        />
        <Button onClick={inspectToken} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Inspect"}
        </Button>
      </div>

      {metadata && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{metadata.name || "Unknown"}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <p className="text-xs text-muted-foreground">Symbol</p>
              <p className="font-medium">{metadata.symbol || "???"}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <p className="text-xs text-muted-foreground">Decimals</p>
              <p className="font-medium">{metadata.decimals ?? "N/A"}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <p className="text-xs text-muted-foreground">Total Supply</p>
              <p className="font-medium">{metadata.supply?.toLocaleString() || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Security Flags</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={metadata.mintAuthority ? "destructive" : "default"} className="gap-1">
                {metadata.mintAuthority ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                Mint Authority: {metadata.mintAuthority ? "Active" : "Revoked"}
              </Badge>
              <Badge variant={metadata.freezeAuthority ? "destructive" : "default"} className="gap-1">
                {metadata.freezeAuthority ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                Freeze Authority: {metadata.freezeAuthority ? "Active" : "Revoked"}
              </Badge>
            </div>
          </div>

          {metadata.riskScore !== undefined && (
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${metadata.riskScore > 70 ? "bg-red-500" : metadata.riskScore > 40 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${metadata.riskScore}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{metadata.riskScore}/100</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
