import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Send, RefreshCw } from "lucide-react";

interface TokenCalloutButtonProps {
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export const TokenCalloutButton = ({
  tokenAddress,
  tokenName,
  tokenSymbol,
  variant = "outline",
  size = "sm",
  className = "",
  showLabel = true,
}: TokenCalloutButtonProps) => {
  const [sending, setSending] = useState(false);

  const sendTokenCallout = async () => {
    if (!tokenAddress) return;
    setSending(true);

    try {
      // Fetch comprehensive token data
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("solana-tracker", {
        body: { action: "analyzeToken", tokenAddress },
      });

      if (tokenError) throw tokenError;

      // Send to Discord with full token data
      const { error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          type: "token_callout",
          tokenAddress,
          tokenName: tokenData?.name || tokenName || "Unknown Token",
          tokenSymbol: tokenData?.symbol || tokenSymbol || tokenAddress.slice(0, 4).toUpperCase(),
          message: `🚀 Alpha Callout: ${tokenData?.name || tokenName || "Token"} (${tokenData?.symbol || tokenSymbol || "???"})`,
          tokenData: {
            price: tokenData?.price,
            priceChange24h: tokenData?.priceChange24h,
            marketCap: tokenData?.marketCap,
            holders: tokenData?.holders,
            liquidity: tokenData?.liquidity,
            supply: tokenData?.supply,
            createdAt: tokenData?.createdAt,
            riskScore: tokenData?.riskScore,
            topHolderPercent: tokenData?.topHolderPercent,
            devWallet: tokenData?.devWallet,
            lpLocked: tokenData?.lpLocked,
            mintDisabled: tokenData?.mintDisabled,
            freezeDisabled: tokenData?.freezeDisabled,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Token Callout Sent!",
        description: `${tokenSymbol || "Token"} info sent to Discord`,
      });
    } catch (error) {
      console.error("Error sending token callout:", error);
      toast({
        title: "Error",
        description: "Failed to send token callout",
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
      onClick={sendTokenCallout}
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
