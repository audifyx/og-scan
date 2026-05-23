import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Zap, User, ArrowRight, CheckCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { isValidSolanaAddress } from "@/lib/solana-api";

const Setup = () => {
  const navigate = useNavigate();
  const { user, profile, loading, updateProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    // Skip setup if already has username
    if (!loading && profile?.username) {
      navigate("/app");
    }
  }, [user, profile, loading, navigate]);

  // Check username availability
  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setIsAvailable(null);
        return;
      }

      setIsChecking(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      setIsChecking(false);
      setIsAvailable(!data && !error);
    };

    const debounce = setTimeout(checkUsername, 300);
    return () => clearTimeout(debounce);
  }, [username]);

  // Validate wallet address
  useEffect(() => {
    if (!walletAddress) {
      setWalletError(null);
      return;
    }
    
    if (!isValidSolanaAddress(walletAddress)) {
      setWalletError("Invalid Solana wallet address");
    } else {
      setWalletError(null);
    }
  }, [walletAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (username.length < 3) {
      toast({ title: "Username must be at least 3 characters", variant: "destructive" });
      return;
    }

    if (!isAvailable) {
      toast({ title: "This username is taken", variant: "destructive" });
      return;
    }

    if (walletAddress && !isValidSolanaAddress(walletAddress)) {
      toast({ title: "Invalid Solana wallet address", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const updateData: { username: string; wallet_address?: string } = { 
      username: username.toLowerCase() 
    };
    
    if (walletAddress) {
      updateData.wallet_address = walletAddress;
    }

    const { error } = await updateProfile(updateData);

    if (error) {
      toast({ title: "Failed to set username", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome to OGScan!" });
      navigate("/app");
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[100px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--solana-green)) 0%, transparent 70%)",
            top: "-200px",
            right: "-200px",
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[80px]"
          style={{
            background: "radial-gradient(circle, hsl(var(--solana-purple)) 0%, transparent 70%)",
            bottom: "-100px",
            left: "-100px",
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="glass-card p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-solana-gradient flex items-center justify-center">
              <Zap className="h-6 w-6 text-background" />
            </div>
            <span className="text-2xl font-bold gradient-text">OGScan</span>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
            <p className="text-muted-foreground">
              Set up your username and connect your Solana wallet
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="satoshi"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  className="pl-10 pr-10"
                  maxLength={20}
                />
                {isChecking && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!isChecking && isAvailable === true && username.length >= 3 && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                )}
                {!isChecking && isAvailable === false && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-destructive">Taken</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                3-20 characters, letters, numbers, and underscores only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet">Solana Wallet Address <span className="text-muted-foreground">(optional)</span></Label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="wallet"
                  type="text"
                  placeholder="Enter your Solana wallet address"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value.trim())}
                  className="pl-10 pr-10"
                />
                {walletAddress && !walletError && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                )}
              </div>
              {walletError && (
                <p className="text-xs text-destructive">{walletError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Connect your wallet to show portfolio stats on your profile
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !isAvailable || username.length < 3 || !!walletError}
              className="w-full bg-solana-gradient hover:opacity-90 text-background font-semibold h-12 gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Setup;
