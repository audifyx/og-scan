import { useState } from "react";
import { TrendingUp, TrendingDown, Wallet, Coins, Image, Activity, ExternalLink, Send, X, Copy, Check, RefreshCw } from "lucide-react";
import { WalletOverview, formatUsd, formatNumber, formatAddress } from "@/lib/solana-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface PortfolioOverviewProps {
  data: WalletOverview;
  walletAddress: string;
  onRefresh?: () => void;
}

type StatType = 'portfolio' | 'sol' | 'tokens' | 'nfts' | 'assets' | null;

export function PortfolioOverview({ data, walletAddress, onRefresh }: PortfolioOverviewProps) {
  const isPositive = data.priceChange24h >= 0;
  const [activeModal, setActiveModal] = useState<StatType>(null);
  const [copied, setCopied] = useState(false);
  const [sendingWebhook, setSendingWebhook] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Address copied!");
  };

  const sendToDiscord = async (type: string) => {
    setSendingWebhook(true);
    try {
      let content = "";
      let embedTitle = "";
      let embedDescription = "";
      let fields: any[] = [];

      switch (type) {
        case 'portfolio':
          embedTitle = "💰 Portfolio Overview";
          embedDescription = `Wallet: \`${formatAddress(walletAddress, 8)}\``;
          fields = [
            { name: "Total Value", value: formatUsd(data.totalUsdValue), inline: true },
            { name: "SOL Price", value: formatUsd(data.solPrice), inline: true },
            { name: "24h Change", value: `${isPositive ? '+' : ''}${data.priceChange24h.toFixed(2)}%`, inline: true },
          ];
          break;
        case 'sol':
          embedTitle = "◎ SOL Balance";
          embedDescription = `Wallet: \`${formatAddress(walletAddress, 8)}\``;
          fields = [
            { name: "SOL Balance", value: `${formatNumber(data.balance, 4)} SOL`, inline: true },
            { name: "USD Value", value: formatUsd(data.usdValue), inline: true },
            { name: "SOL Price", value: formatUsd(data.solPrice), inline: true },
          ];
          break;
        case 'tokens':
          embedTitle = "🪙 Token Holdings";
          embedDescription = `Wallet: \`${formatAddress(walletAddress, 8)}\``;
          fields = [
            { name: "Token Count", value: data.tokenCount.toString(), inline: true },
            { name: "Portfolio Value", value: formatUsd(data.totalUsdValue), inline: true },
          ];
          break;
        case 'assets':
          embedTitle = "📊 Total Assets";
          embedDescription = `Wallet: \`${formatAddress(walletAddress, 8)}\``;
          fields = [
            { name: "Total Assets", value: data.totalAssets.toString(), inline: true },
            { name: "Tokens", value: data.tokenCount.toString(), inline: true },
            { name: "NFTs", value: data.nftCount.toString(), inline: true },
          ];
          break;
      }

      const { error } = await supabase.functions.invoke('discord-webhook', {
        body: {
          embeds: [{
            title: embedTitle,
            description: embedDescription,
            color: 0x9945FF,
            fields,
            footer: { text: "SolanaHub • Wallet Tracker" },
            timestamp: new Date().toISOString(),
          }]
        }
      });

      if (error) throw error;
      toast.success("Sent to Discord!");
      setActiveModal(null);
    } catch (error) {
      console.error("Discord webhook error:", error);
      toast.error("Failed to send to Discord");
    } finally {
      setSendingWebhook(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Main Balance Card */}
        <div 
          className="glass-card p-6 md:p-8 cursor-pointer hover:border-primary/50 transition-all"
          onClick={() => setActiveModal('portfolio')}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-primary border-primary/50">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                  Live
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm font-medium mb-1">Portfolio Value</p>
              <h2 className="text-4xl md:text-5xl font-bold gradient-text">
                {formatUsd(data.totalUsdValue)}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); copyAddress(); }}
                  className="text-muted-foreground font-mono text-sm hover:text-primary transition-colors flex items-center gap-1"
                >
                  {formatAddress(walletAddress, 8)}
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </button>
                <a 
                  href={`https://solscan.io/account/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {onRefresh && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRefresh(); }}>
                  <RefreshCw className="h-5 w-5" />
                </Button>
              )}
              <div className="text-right">
                <p className="text-muted-foreground text-sm">SOL Price</p>
                <p className="text-2xl font-semibold">{formatUsd(data.solPrice)}</p>
                <div className={`flex items-center justify-end gap-1 text-sm ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{isPositive ? '+' : ''}{data.priceChange24h.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Wallet className="h-5 w-5" />}
            label="SOL Balance"
            value={`${formatNumber(data.balance, 4)} SOL`}
            subValue={formatUsd(data.usdValue)}
            color="green"
            onClick={() => setActiveModal('sol')}
          />
          <StatCard
            icon={<Coins className="h-5 w-5" />}
            label="Tokens"
            value={data.tokenCount.toString()}
            subValue="Holdings"
            color="purple"
            onClick={() => setActiveModal('tokens')}
          />
          <StatCard
            icon={<Image className="h-5 w-5" />}
            label="NFTs"
            value={data.nftCount.toString()}
            subValue="Collectibles"
            color="green"
            onClick={() => setActiveModal('nfts')}
          />
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Total Assets"
            value={data.totalAssets.toString()}
            subValue="On-chain"
            color="purple"
            onClick={() => setActiveModal('assets')}
          />
        </div>
      </div>

      {/* Portfolio Detail Modal */}
      <Dialog open={activeModal === 'portfolio'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              Portfolio Overview
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-primary">{formatUsd(data.totalUsdValue)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">SOL Price</p>
                <p className="text-2xl font-bold">{formatUsd(data.solPrice)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">24h Change</p>
                <p className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{data.priceChange24h.toFixed(2)}%
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Wallet</p>
                <p className="font-mono text-sm truncate">{formatAddress(walletAddress, 6)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <a href={`https://solscan.io/account/${walletAddress}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Solscan
                </a>
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => sendToDiscord('portfolio')}
                disabled={sendingWebhook}
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Discord
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SOL Balance Modal */}
      <Dialog open={activeModal === 'sol'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              SOL Balance Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">SOL Balance</p>
                <p className="text-2xl font-bold">{formatNumber(data.balance, 6)} SOL</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">USD Value</p>
                <p className="text-2xl font-bold text-primary">{formatUsd(data.usdValue)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 col-span-2">
                <p className="text-xs text-muted-foreground">Current SOL Price</p>
                <p className="text-xl font-bold">{formatUsd(data.solPrice)}</p>
                <p className={`text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{data.priceChange24h.toFixed(2)}% (24h)
                </p>
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={() => sendToDiscord('sol')}
              disabled={sendingWebhook}
            >
              <Send className="h-4 w-4 mr-2" />
              Send to Discord
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tokens Modal */}
      <Dialog open={activeModal === 'tokens'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-secondary/20">
                <Coins className="h-5 w-5 text-secondary" />
              </div>
              Token Holdings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-muted/50 text-center">
              <p className="text-5xl font-bold text-secondary">{data.tokenCount}</p>
              <p className="text-muted-foreground">Different Tokens Held</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Portfolio Value</p>
                <p className="font-bold text-primary">{formatUsd(data.totalUsdValue)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">SOL Balance</p>
                <p className="font-bold">{formatNumber(data.balance, 2)} SOL</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Click on individual tokens in the list below to see detailed info
            </p>
            <Button 
              className="w-full" 
              onClick={() => sendToDiscord('tokens')}
              disabled={sendingWebhook}
            >
              <Send className="h-4 w-4 mr-2" />
              Send to Discord
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NFTs Modal */}
      <Dialog open={activeModal === 'nfts'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/20">
                <Image className="h-5 w-5 text-primary" />
              </div>
              NFT Collection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-muted/50 text-center">
              <p className="text-5xl font-bold text-primary">{data.nftCount}</p>
              <p className="text-muted-foreground">NFTs Owned</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              View detailed NFT gallery in the NFTs tab below
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Total Assets Modal */}
      <Dialog open={activeModal === 'assets'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-secondary/20">
                <Activity className="h-5 w-5 text-secondary" />
              </div>
              Total On-chain Assets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-muted/50 text-center">
              <p className="text-5xl font-bold text-secondary">{data.totalAssets}</p>
              <p className="text-muted-foreground">Total Assets</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold">{data.tokenCount}</p>
                <p className="text-xs text-muted-foreground">Tokens</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold">{data.nftCount}</p>
                <p className="text-xs text-muted-foreground">NFTs</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-2xl font-bold">1</p>
                <p className="text-xs text-muted-foreground">SOL</p>
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={() => sendToDiscord('assets')}
              disabled={sendingWebhook}
            >
              <Send className="h-4 w-4 mr-2" />
              Send to Discord
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  color: "green" | "purple";
  onClick: () => void;
}

function StatCard({ icon, label, value, subValue, color, onClick }: StatCardProps) {
  return (
    <div 
      className="glass-card p-4 md:p-5 group hover:scale-[1.02] hover:border-primary/50 transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      <div className={`inline-flex p-2 rounded-lg mb-3 ${color === 'green' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
        {icon}
      </div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl md:text-2xl font-bold mt-1">{value}</p>
      <p className="text-muted-foreground text-sm">{subValue}</p>
    </div>
  );
}
