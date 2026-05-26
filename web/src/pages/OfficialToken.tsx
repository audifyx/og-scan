import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Rocket, Zap, Sparkles, Copy, Check, ExternalLink, 
  TrendingUp, Users, Globe, Twitter, PieChart, Flame, DollarSign, BarChart3,
  MessageCircle, Send, ShieldCheck, Target, Coins
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const CONTRACT_ADDRESS = "HEivoBHhWT939vcaevGgZBtoArS4CAywCMjdVBTSpump";

const LINKS = {
  pumpFun: "https://join.pump.fun/HSag/494el64d",
  telegram: "https://t.me/soltoolsv2",
  promo: "https://soltoolsv2promo.lovable.app/",
  community: "https://twitter.com/i/communities/2007536315483685053",
  dex: `https://dexscreener.com/solana/${CONTRACT_ADDRESS}`,
};

const FEE_BREAKDOWN = [
  { label: "Platform & Development", percent: 50, desc: "AI tools, high-performance infrastructure, and continuous platform evolution", color: "from-primary to-accent", icon: Zap },
  { label: "Team, Marketing & Community", percent: 25, desc: "Team compensation, marketing campaigns, community events, and ecosystem growth", color: "from-blue-500 to-cyan-500", icon: Users },
  { label: "Buybacks, Burns & Ads", percent: 25, desc: "Token buybacks, burns to reduce supply, DEX boosts, and project advertising", color: "from-green-500 to-emerald-500", icon: Flame },
];

const ROADMAP = [
  { phase: "Phase 1", title: "Launch & Foundation", items: ["Platform launch", "Free tools for all users", "Community building", "Token launch on Pump.fun"], done: true },
  { phase: "Phase 2", title: "Growth & Features", items: ["Advanced trading tools", "Social trading lobbies", "Voice chat integration", "Mobile optimization"], done: true },
  { phase: "Phase 3", title: "Expansion", items: ["Copy trading", "Live trading", "Premium analytics", "API access for developers"], done: false },
  { phase: "Phase 4", title: "Ecosystem", items: ["Multi-chain support", "Marketplace for strategies", "DAO governance", "Revenue sharing"], done: false },
];

const OfficialToken = () => {
  const [copied, setCopied] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);

  const copyCA = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Contract address copied!" });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONTRACT_ADDRESS}`);
        const data = await res.json();
        if (data.pairs?.[0]) setTokenData(data.pairs[0]);
      } catch (e) { console.error("Failed to fetch token data", e); }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (n: number) => {
    if (!n) return "$0";
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <AppLayout>
      <PageHeader title="Official Token" description="$SOLTOOLS — Powering the Platform">
        <Badge className="bg-primary/20 text-primary border-primary/30 gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Live
        </Badge>
      </PageHeader>

      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Hero */}
          <Card className="og-glass-card-premium overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardContent className="relative p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent blur-2xl opacity-40" />
                  <img src={logo} alt="Sol Tools" className="relative w-24 h-24 rounded-3xl shadow-2xl shadow-primary/30 border border-primary/20" />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h1 className="text-3xl font-bold gradient-text font-display mb-1">Sol Tools Token</h1>
                  <p className="text-xl text-muted-foreground mb-3">$SOLTOOLS</p>
                  <button onClick={copyCA} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-primary/30 transition-all text-sm font-mono">
                    <span className="text-muted-foreground">{CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-6)}</span>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Price Data */}
          {tokenData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: DollarSign, label: "Price", value: `$${parseFloat(tokenData.priceUsd || 0) < 0.01 ? parseFloat(tokenData.priceUsd).toExponential(2) : parseFloat(tokenData.priceUsd).toFixed(6)}`, color: "text-[#22d3ee]" },
                { icon: BarChart3, label: "Market Cap", value: formatNumber(tokenData.fdv || 0), color: "text-blue-500" },
                { icon: TrendingUp, label: "24h Volume", value: formatNumber(tokenData.volume?.h24 || 0), color: "text-green-500" },
                { icon: Users, label: "Liquidity", value: formatNumber(tokenData.liquidity?.usd || 0), color: "text-accent" },
              ].map((s, i) => (
                <Card key={i} className="og-glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1"><s.icon className={`h-4 w-4 ${s.color}`} /><span className="text-xs">{s.label}</span></div>
                    <p className="text-xl font-bold">{s.value}</p>
                    {s.label === "Price" && tokenData.priceChange?.h24 && (
                      <p className={`text-xs ${tokenData.priceChange.h24 >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {tokenData.priceChange.h24 >= 0 ? "+" : ""}{tokenData.priceChange.h24.toFixed(1)}% 24h
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button asChild className="btn-3d gap-2 h-12 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0">
              <a href={LINKS.pumpFun} target="_blank" rel="noopener noreferrer"><Rocket className="h-4 w-4" /> Buy on Pump.fun</a>
            </Button>
            <Button asChild variant="outline" className="gap-2 h-12 rounded-2xl">
              <a href={LINKS.telegram} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4" /> Telegram</a>
            </Button>
            <Button asChild variant="outline" className="gap-2 h-12 rounded-2xl">
              <a href={LINKS.community} target="_blank" rel="noopener noreferrer"><Users className="h-4 w-4" /> Community</a>
            </Button>
            <Button asChild variant="outline" className="gap-2 h-12 rounded-2xl">
              <a href={LINKS.promo} target="_blank" rel="noopener noreferrer"><Globe className="h-4 w-4" /> Promo Site</a>
            </Button>
          </div>

          {/* DEX Chart */}
          <Card className="og-glass-card overflow-hidden">
            <CardContent className="p-0">
              <iframe
                src={`https://dexscreener.com/solana/${CONTRACT_ADDRESS}?embed=1&theme=dark&info=0`}
                className="w-full h-[400px] lg:h-[500px] border-0"
                title="DEX Chart"
              />
            </CardContent>
          </Card>

          {/* What is Sol Tools */}
          <Card className="og-glass-card-premium border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#22d3ee]" /> What is Sol Tools?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="text-foreground font-semibold">Sol Tools</span> is the ultimate all-in-one Solana toolkit — tracking, analytics, sniping, social trading, and more — completely <span className="text-primary font-semibold">FREE FOREVER</span>.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The $SOLTOOLS token powers the ecosystem. Transaction fees fund platform development, community growth, and token buybacks — keeping the platform free while rewarding holders.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { icon: Target, label: "Real-time analytics" },
                  { icon: Users, label: "Social trading lobbies" },
                  { icon: Zap, label: "Token sniping tools" },
                  { icon: Coins, label: "No paywalls or subscriptions" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-border/30">
                    <f.icon className="h-4 w-4 text-[#22d3ee]" />
                    <span className="text-xs font-medium">{f.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Announcement */}
          <Card className="og-glass-card-premium border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-[#22d3ee]" /> Launch Announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                🚀 <span className="text-foreground font-semibold">We have finally launched Sol Tools!</span> Your all-in-one platform for tracking, analyzing, and sniping on the Solana blockchain — completely <span className="text-primary font-semibold">FREE FOREVER</span>. No price tag, ever. 🤑
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Why free? Because our token powers the platform: it generates fees that let us build more tools, grow the team, and expand the community — without charging you a dime. 💪
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                We're all about better tools for everyone, no subscriptions, no hidden fees, just pure Solana power. ⚡
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
                  <a href={LINKS.community} target="_blank" rel="noopener noreferrer"><Users className="h-4 w-4" /> Community</a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
                  <a href={LINKS.dex} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> DexScreener</a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
                  <a href={LINKS.pumpFun} target="_blank" rel="noopener noreferrer"><Rocket className="h-4 w-4" /> Pump.fun</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Fee Breakdown */}
          <Card className="og-glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5 text-[#22d3ee]" /> Fee Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {FEE_BREAKDOWN.map((fee, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/[0.04] border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <fee.icon className="h-4 w-4 text-[#22d3ee]" />
                      <span className="font-semibold text-sm">{fee.label}</span>
                    </div>
                    <Badge className={`bg-gradient-to-r ${fee.color} text-white border-0 font-bold`}>{fee.percent}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{fee.desc}</p>
                  <div className="mt-3 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${fee.color} rounded-full`} style={{ width: `${fee.percent}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Roadmap */}
          <Card className="og-glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#22d3ee]" /> Roadmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROADMAP.map((phase, i) => (
                  <div key={i} className={`p-4 rounded-2xl border ${phase.done ? 'border-green-500/30 bg-green-500/5' : 'border-border/30 bg-white/[0.03]'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={phase.done ? "default" : "outline"} className={phase.done ? "bg-green-500/20 text-green-500 border-0" : ""}>{phase.phase}</Badge>
                      {phase.done && <Check className="h-4 w-4 text-green-500" />}
                    </div>
                    <h4 className="font-semibold text-sm mb-2">{phase.title}</h4>
                    <ul className="space-y-1">
                      {phase.items.map((item, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${phase.done ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card className="og-glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[#22d3ee]" /> FAQ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { q: "Is Sol Tools really free?", a: "Yes! Sol Tools is completely free forever. The $SOLTOOLS token funds platform development through transaction fees." },
                { q: "Is the platform really free?", a: "Yes. Every tool on OG Scan is free to use. We don't believe in paywalls or restricting access to the intelligence you need to trade safely." },
                { q: "What is the $SOLTOOLS token?", a: "It's the utility token that powers the Sol Tools ecosystem. Transaction fees are used to fund development, marketing, and buybacks." },
                { q: "How do I get started?", a: "Simply create an account, and you'll have instant access to 30+ Solana trading tools, social lobbies, and analytics." },
                { q: "Is my data safe?", a: "Yes. We use enterprise-grade encryption and never store private keys. Your wallet address is used only for read-only tracking." },
              ].map((faq, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/[0.04] border border-border/30">
                  <h4 className="font-semibold text-sm mb-1">{faq.q}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 justify-center pb-4">
            {["#Solana", "#CryptoTools", "#FreeForever", "#BlockchainHustle", "#SOLTOOLS"].map(tag => (
              <Badge key={tag} variant="outline" className="text-xs bg-primary/5 border-primary/20">{tag}</Badge>
            ))}
          </div>
        </div>
      </ScrollArea>
    </AppLayout>
  );
};

export default OfficialToken;
