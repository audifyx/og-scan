import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

interface WalletCalloutButtonProps {
  walletAddress: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export const WalletCalloutButton = ({
  variant = "outline",
  size = "sm",
  className = "",
  showLabel = true,
}: WalletCalloutButtonProps) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => toast({ title: "Coming Soon", description: "Discord sharing is coming soon!" })}
      className={`gap-1 bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2] ${className}`}
    >
      <Send className="h-4 w-4" />
      {showLabel && "Discord"}
    </Button>
  );
};
