import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isValidSolanaAddress } from "@/lib/solana-api";
import { toast } from "@/hooks/use-toast";

interface WalletSearchProps {
  onSearch: (address: string) => void;
  isLoading?: boolean;
}

export function WalletSearch({ onSearch, isLoading }: WalletSearchProps) {
  const [address, setAddress] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    
    if (!trimmed) {
      toast({
        title: "Enter a wallet address",
        description: "Please enter a Solana wallet address to track",
        variant: "destructive",
      });
      return;
    }

    if (!isValidSolanaAddress(trimmed)) {
      toast({
        title: "Invalid address",
        description: "Please enter a valid Solana wallet address",
        variant: "destructive",
      });
      return;
    }

    onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-solana-gradient rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-300" />
        <div className="relative flex gap-2 bg-card rounded-xl p-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter Solana wallet address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pl-12 h-12 bg-transparent border-0 text-lg font-mono focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
              disabled={isLoading}
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="h-12 px-6 bg-solana-gradient hover:opacity-90 text-primary-foreground font-semibold rounded-lg transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              "Track"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
