import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Send, RefreshCw } from "lucide-react";

interface WalletCalloutButtonProps {
  walletAddress: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export const WalletCalloutButton = ({
  walletAddress,
  variant = "outline",
  size = "sm",
  className = "",
  showLabel = true,
}: WalletCalloutButtonProps) => {
  const [sending, setSending] = useState(false);

  const sendWalletCallout = async () => {
    if (!walletAddress) return;
    setSending(true);

    try {
      // Fetch comprehensive wallet data
      const [overviewRes, txRes] = await Promise.all([
        supabase.functions.invoke("solana-tracker", {
          body: { action: "getWalletOverview", walletAddress },
        }),
        supabase.functions.invoke("solana-tracker", {
          body: { action: "getTransactions", walletAddress, limit: 10 },
        }),
      ]);

      const overview = overviewRes.data;
      const txData = txRes.data;

      // Send to Discord with full wallet data
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: "wallet_alert",
          walletAddress,
          message: `📊 Full Wallet Analysis`,
          walletData: {
            balance: overview?.balance,
            totalUsdValue: overview?.totalUsdValue,
            tokenCount: overview?.tokenCount,
            nftCount: overview?.nftCount,
            priceChange24h: overview?.priceChange24h,
            tradeCount: txData?.transactions?.length || 0,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Wallet Callout Sent!",
        description: "Full wallet info sent to Discord",
      });
    } catch (error) {
      console.error("Error sending wallet callout:", error);
      toast({
        title: "Error",
        description: "Failed to send wallet callout",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={sendWalletCallout}
      disabled={sending}
      className={`gap-1 bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2] ${className}`}
    >
      {sending ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {showLabel && (sending ? "Sending..." : "Discord")}
    </Button>
  );
};
