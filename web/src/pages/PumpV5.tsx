import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { TokenDetailModal } from "@/components/pumpv5/TokenDetailModal";
import { 
  Rocket, Star, TrendingUp, TrendingDown, 
  Plus, Globe, Twitter, Send, Upload, Search,
  Loader2, Image, ChevronRight, Flame, Sparkles,
  BarChart3, Droplets, Users, Zap, Filter, ArrowUpRight,
  ArrowDownRight, Crown, Timer, ExternalLink, Copy, RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLivePrices } from "@/hooks/useLivePrices";
import { safeAvatarUrl } from "@/lib/utils";

interface Submission {
  id: string;
  user_id: string | null;
  token_name: string;
  symbol: string;
  contract_address: string;
  launch_platform: string;
  launch_time: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  creator_wallet: string | null;
  banner_url: string | null;
  logo_url: string | null;
  status: string;
  promotion_tier: string;
  is_featured: boolean;
  ai_risk_score: number | null;
  liquidity_usd: number | null;
  holder_count: number | null;
  market_cap: number | null;
  created_at: string;
}

interface TokenLiveData {
  price: string;
  priceChange24h: number;
  priceChange6h?: number;
  priceChange1h: number;
  volume24h: number;
  volume6h?: number;
  volume1h?: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  buys24h?: number;
  sells24h?: number;
  txns24h?: { buys?: number; sells?: number };
  socials?: Array<{ type: string; url: string }>;
  websites?: Array<{ label: string; url: string }>;
  imageUrl?: string;
  dexId?: string;
  pairCreatedAt?: number;
  holderCount?: number;
  description?: string;
}

interface AIAnalysis {
  riskScore: number;
  summary: string;
  about?: string;
  pros: string[];
  cons: string[];
  recommendation: string;
  marketSentiment?: string;
  liquidityRating?: string;
  volumeRating?: string;
}

interface TrendingToken {
  name: string;
  symbol: string;
  address: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  imageUrl?: string;
  platform: string;
}

const LAUNCH_PLATFORMS = [
  { id: "pump.fun", name: "Pump.fun", color: "from-pink-500 to-pink-600" },
  { id: "jupiter", name: "Jupiter", color: "from-green-500 to-green-600" },
  { id: "raydium", name: "Raydium", color: "from-purple-500 to-purple-600" },
  { id: "orca", name: "Orca", color: "from-cyan-500 to-cyan-600" },
  { id: "meteora", name: "Meteora", color: "from-orange-500 to-orange-600" },
  { id: "moonshot", name: "Moonshot", color: "from-yellow-500 to-yellow-600" },
  { id: "private", name: "Private / Custom", color: "from-gray-500 to-gray-600" },
];

const getPlatformColor = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case "pump.fun": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
    case "raydium": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "jupiter": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "orca": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "meteora": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "moonshot": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const formatNumber = (num: number | null | undefined) => {
  if (!num) return "N/A";
  if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatPrice = (price: number | string | null | undefined) => {
  if (!price) return "$0.00";
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (num < 0.00001) return `$${num.toExponential(4)}`;
  if (num < 0.01) return `$${num.toFixed(8)}`;
  if (num < 1) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(4)}`;
};

const PumpV5 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToken, setSelectedToken] = useState<Submission | null>(null);
  const [tokenLiveData, setTokenLiveData] = useState<TokenLiveData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingLiveData, setLoadingLiveData] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [liveTokenData, setLiveTokenData] = useState<Record<string, TokenLiveData>>({});
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [activeTab, setActiveTab] = useState<string>("all");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Real-time price feed via polling (10s interval)
  const allTokenAddresses = useMemo(
    () => submissions.map((s) => s.contract_address).filter(Boolean),
    [submissions]
  );
  const { prices: livePrices, connected: liveFeedConnected } = useLivePrices(allTokenAddresses, 10000);
  
  const [formData, setFormData] = useState({
    token_name: "",
    symbol: "",
    contract_address: "",
    launch_platform: "",
    launch_time: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
    creator_wallet: "",
    logo_url: "",
    banner_url: "",
  });

  useEffect(() => {
    fetchSubmissions();
    fetchTrendingTokens();
    subscribeToSubmissions();
  }, []);

  const fetchTrendingTokens = async () => {
    setLoadingTrending(true);
    try {
      const response = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
      if (response.ok) {
        const data = await response.json();
        const solanaBoosts = data
          .filter((t: any) => t.chainId === "solana")
          .slice(0, 10);

        // Build initial list with placeholder names
        const initialTokens: TrendingToken[] = solanaBoosts.map((t: any) => ({
          name: t.description || "Loading...",
          symbol: "...",
          address: t.tokenAddress,
          price: 0,
          priceChange24h: 0,
          volume24h: 0,
          liquidity: 0,
          marketCap: 0,
          imageUrl: t.icon || t.header,
          platform: "solana",
        }));
        setTrendingTokens(initialTokens);

        // Fetch detailed data (name, symbol, price) for all tokens
        for (const token of initialTokens) {
          try {
            const detailRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              const pair = detailData.pairs?.[0];
              if (pair) {
                setTrendingTokens(prev => prev.map(t =>
                  t.address === token.address ? {
                    ...t,
                    name: pair.baseToken?.name || t.name,
                    symbol: pair.baseToken?.symbol || t.symbol,
                    price: parseFloat(pair.priceUsd || "0"),
                    priceChange24h: pair.priceChange?.h24 || 0,
                    volume24h: pair.volume?.h24 || 0,
                    liquidity: pair.liquidity?.usd || 0,
                    marketCap: pair.marketCap || 0,
                    imageUrl: t.imageUrl || pair.info?.imageUrl,
                  } : t
                ));
              }
            }
          } catch (e) {
            console.error("Error fetching trending token detail:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching trending tokens:", error);
    } finally {
      setLoadingTrending(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("pump_v5_submissions")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const filtered = data?.filter(s => 
        s.status === "approved" || s.status === "live" || s.user_id === user?.id
      ) || [];
      setSubmissions(filtered);
      
      fetchLiveDataForTokens(filtered);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveDataForTokens = async (tokens: Submission[]) => {
    const batchSize = 5;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (token) => {
          try {
            const { data, error } = await supabase.functions.invoke("token-data", {
              body: { action: "get_token_data", tokenAddress: token.contract_address },
            });
            if (!error && data?.success && data.data) {
              setLiveTokenData(prev => ({
                ...prev,
                [token.contract_address]: data.data,
              }));
            }
          } catch (e) {
            console.error(`Error fetching live data for ${token.symbol}:`, e);
          }
        })
      );
    }
  };

  const subscribeToSubmissions = () => {
    const channel = supabase
      .channel("pump-v5-submissions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pump_v5_submissions" },
        () => fetchSubmissions()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const uploadImage = async (file: File, type: "logo" | "banner") => {
    if (!user) {
      toast.error("Please sign in to upload images");
      return null;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;

    if (type === "logo") setUploadingLogo(true);
    else setUploadingBanner(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from("token-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("token-images")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload ${type}`);
      return null;
    } finally {
      if (type === "logo") setUploadingLogo(false);
      else setUploadingBanner(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const url = await uploadImage(file, type);
    if (url) {
      setFormData(prev => ({ ...prev, [`${type}_url`]: url }));
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded!`);
    }
  };

  const autoFillFromContract = async (contractAddress: string) => {
    if (!contractAddress || contractAddress.length < 32) return;

    setAutoFilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("token-data", {
        body: { action: "get_token_data", tokenAddress: contractAddress },
      });

      if (error) throw error;
      if (data?.success && data.data) {
        setFormData(prev => ({
          ...prev,
          token_name: data.data.name || prev.token_name,
          symbol: data.data.symbol || prev.symbol,
          description: data.data.description || prev.description,
        }));
        toast.success("Token info auto-filled from DexScreener!");
      } else {
        toast.error(data?.error || "Token not found");
      }
    } catch (error) {
      console.error("Auto-fill error:", error);
      toast.error("Failed to fetch token data");
    } finally {
      setAutoFilling(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to submit a token");
      return;
    }

    if (!formData.token_name || !formData.symbol || !formData.contract_address || !formData.launch_platform) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("pump_v5_submissions").insert({
        user_id: user.id,
        token_name: formData.token_name,
        symbol: formData.symbol.toUpperCase(),
        contract_address: formData.contract_address,
        launch_platform: formData.launch_platform,
        launch_time: formData.launch_time || null,
        description: formData.description || null,
        website: formData.website || null,
        twitter: formData.twitter || null,
        telegram: formData.telegram || null,
        discord: formData.discord || null,
        creator_wallet: formData.creator_wallet || null,
        logo_url: formData.logo_url || null,
        banner_url: formData.banner_url || null,
        status: "approved",
      });

      if (error) throw error;

      toast.success("Token listed successfully!");
      setShowSubmitDialog(false);
      setFormData({
        token_name: "",
        symbol: "",
        contract_address: "",
        launch_platform: "",
        launch_time: "",
        description: "",
        website: "",
        twitter: "",
        telegram: "",
        discord: "",
        creator_wallet: "",
        logo_url: "",
        banner_url: "",
      });
      fetchSubmissions();

      try {
        await supabase.functions.invoke("discord-webhook", {
          body: {
            type: "pump_v5_submission",
            data: {
              token_name: formData.token_name,
              symbol: formData.symbol,
              contract_address: formData.contract_address,
              launch_platform: formData.launch_platform,
              website: formData.website,
              twitter: formData.twitter,
            },
          },
        });
      } catch (webhookError) {
        console.error("Webhook error:", webhookError);
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit token");
    } finally {
      setSubmitting(false);
    }
  };

  const openTokenDetail = async (token: Submission) => {
    setSelectedToken(token);
    setLoadingLiveData(true);
    setTokenLiveData(null);
    setAiAnalysis(null);

    try {
      const [liveDataResult, aiResult] = await Promise.all([
        supabase.functions.invoke("token-data", {
          body: { action: "get_token_data", tokenAddress: token.contract_address },
        }),
        supabase.functions.invoke("token-data", {
          body: { action: "ai_analysis", tokenAddress: token.contract_address, tokenName: token.token_name },
        }),
      ]);

      if (!liveDataResult.error && liveDataResult.data?.success) {
        setTokenLiveData(liveDataResult.data.data);
      }

      if (!aiResult.error && aiResult.data?.success) {
        setAiAnalysis(aiResult.data.analysis);
        if (aiResult.data.tokenData) {
          setTokenLiveData(prev => ({
            ...prev,
            ...aiResult.data.tokenData,
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching live data:", error);
      toast.error("Failed to load token data");
    } finally {
      setLoadingLiveData(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // Filter and sort logic
  const filteredSubmissions = submissions
    .filter(s => {
      const matchesSearch = s.token_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contract_address.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = activeFilter === "all" || s.launch_platform.toLowerCase() === activeFilter.toLowerCase();
      const matchesTab = activeTab === "all" || 
        (activeTab === "featured" && s.is_featured) ||
        (activeTab === "mine" && s.user_id === user?.id);
      
      return matchesSearch && matchesFilter && matchesTab;
    })
    .sort((a, b) => {
      const aData = liveTokenData[a.contract_address];
      const bData = liveTokenData[b.contract_address];
      
      switch (sortBy) {
        case "mcap":
          return (bData?.marketCap || b.market_cap || 0) - (aData?.marketCap || a.market_cap || 0);
        case "volume":
          return (bData?.volume24h || 0) - (aData?.volume24h || 0);
        case "gainers":
          return (bData?.priceChange24h || 0) - (aData?.priceChange24h || 0);
        case "losers":
          return (aData?.priceChange24h || 0) - (bData?.priceChange24h || 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const featuredTokens = submissions.filter(s => s.is_featured);
  const totalVolume = Object.values(liveTokenData).reduce((sum, t) => sum + (t.volume24h || 0), 0);
  const totalLiquidity = Object.values(liveTokenData).reduce((sum, t) => sum + (t.liquidity || 0), 0);

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Epic Hero Section */}
        <div className="relative overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/3" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/8 rounded-full blur-[120px]" />
          
          <div className="relative p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary blur-xl opacity-60 animate-pulse" />
                  <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-2xl shadow-primary/40">
                    <Rocket className="h-8 w-8 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-display">
                      <span className="gradient-text">
                        Sol Tools Launch Pad
                      </span>
                    </h1>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Sparkles className="h-3 w-3 mr-1" />
                      LIVE
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">Discover & list the hottest Solana tokens</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Live feed indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-white/[0.07]">
                  <div className={`h-2 w-2 rounded-full ${liveFeedConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                    {liveFeedConnected ? 'LIVE' : 'CONNECTING'}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => { fetchSubmissions(); fetchTrendingTokens(); }}
                  className="rounded-xl"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/30 gap-2">
                      <Plus className="h-5 w-5" />
                      List Your Token
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-secondary">
                          <Rocket className="h-5 w-5 text-primary-foreground" />
                        </div>
                        List Your Token
                      </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {/* Image Uploads */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Logo</Label>
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, "logo")}
                          />
                          <div
                            onClick={() => logoInputRef.current?.click()}
                            className="mt-1 h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
                          >
                            {formData.logo_url ? (
                              <img src={formData.logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : uploadingLogo ? (
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground">Upload Logo</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label>Banner</Label>
                          <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, "banner")}
                          />
                          <div
                            onClick={() => bannerInputRef.current?.click()}
                            className="mt-1 h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden bg-muted/20"
                          >
                            {formData.banner_url ? (
                              <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : uploadingBanner ? (
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Image className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground">Upload Banner</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contract Address with auto-fill */}
                      <div>
                        <Label htmlFor="contract">Contract Address *</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            id="contract"
                            placeholder="Solana token contract address"
                            value={formData.contract_address}
                            onChange={(e) => setFormData(prev => ({ ...prev, contract_address: e.target.value }))}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => autoFillFromContract(formData.contract_address)}
                            disabled={autoFilling || formData.contract_address.length < 32}
                          >
                            {autoFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter contract and click ⚡ to auto-fill from DexScreener
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Token Name *</Label>
                          <Input
                            id="name"
                            placeholder="e.g., Bonk"
                            value={formData.token_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, token_name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="symbol">Symbol *</Label>
                          <Input
                            id="symbol"
                            placeholder="e.g., BONK"
                            value={formData.symbol}
                            onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="platform">Launch Platform *</Label>
                        <Select
                          value={formData.launch_platform}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, launch_platform: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {LAUNCH_PLATFORMS.map(platform => (
                              <SelectItem key={platform.id} value={platform.id}>
                                {platform.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Brief description of your token..."
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="website">Website</Label>
                          <Input
                            id="website"
                            placeholder="https://..."
                            value={formData.website}
                            onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="twitter">Twitter</Label>
                          <Input
                            id="twitter"
                            placeholder="@username"
                            value={formData.twitter}
                            onChange={(e) => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="telegram">Telegram</Label>
                          <Input
                            id="telegram"
                            placeholder="t.me/..."
                            value={formData.telegram}
                            onChange={(e) => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="discord">Discord</Label>
                          <Input
                            id="discord"
                            placeholder="discord.gg/..."
                            value={formData.discord}
                            onChange={(e) => setFormData(prev => ({ ...prev, discord: e.target.value }))}
                          />
                        </div>
                      </div>

                      <Button 
                        onClick={handleSubmit} 
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-primary-foreground font-bold"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Listing...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" />
                            List Token
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="og-glass-card border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/20">
                      <Rocket className="h-5 w-5 text-[#22d3ee]" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Listed Tokens</p>
                      <p className="text-xl font-bold">{submissions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="og-glass-card border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-green-500/20">
                      <BarChart3 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">24h Volume</p>
                      <p className="text-xl font-bold">{formatNumber(totalVolume)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="og-glass-card border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/20">
                      <Droplets className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Liquidity</p>
                      <p className="text-xl font-bold">{formatNumber(totalLiquidity)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="og-glass-card border-yellow-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-yellow-500/20">
                      <Star className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Featured</p>
                      <p className="text-xl font-bold">{featuredTokens.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8 space-y-8">
          {/* Trending Tokens Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/20">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Trending on Solana</h2>
                  <p className="text-xs text-muted-foreground">Most boosted tokens right now</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchTrendingTokens} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loadingTrending ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-4 pb-4">
                {loadingTrending ? (
                  Array(5).fill(0).map((_, i) => (
                    <Card key={i} className="og-glass-card min-w-[280px] animate-pulse">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-muted" />
                          <div className="space-y-2">
                            <div className="h-4 w-24 bg-muted rounded" />
                            <div className="h-3 w-16 bg-muted rounded" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  trendingTokens.map((token, index) => (
                    <Card 
                      key={token.address} 
                      className="og-glass-card min-w-[300px] cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02]"
                      onClick={() => window.open(`https://dexscreener.com/solana/${token.address}`, "_blank")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="absolute -top-1 -left-1 bg-gradient-to-br from-orange-500 to-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                              {index + 1}
                            </div>
                            {token.imageUrl ? (
                              <img src={token.imageUrl} alt={token.symbol} className="h-12 w-12 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold">
                                {token.symbol.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{token.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">${token.symbol}</Badge>
                              {token.priceChange24h !== 0 && (
                                <Badge className={token.priceChange24h >= 0 ? "bg-green-500/20 text-green-400 text-[10px]" : "bg-red-500/20 text-red-400 text-[10px]"}>
                                  {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatPrice(token.price)}</p>
                            <p className="text-xs text-muted-foreground">{formatNumber(token.marketCap)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Featured Tokens Carousel */}
          {featuredTokens.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-yellow-500/20">
                  <Crown className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Featured Tokens</h2>
                  <p className="text-xs text-muted-foreground">Promoted and verified tokens</p>
                </div>
              </div>
              
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-4">
                  {featuredTokens.map((token) => {
                    const liveData = liveTokenData[token.contract_address];
                    return (
                      <Card 
                        key={token.id}
                        className="min-w-[350px] cursor-pointer overflow-hidden border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent hover:border-yellow-500/50 transition-all"
                        onClick={() => openTokenDetail(token)}
                      >
                        <div className="h-24 bg-gradient-to-br from-yellow-500/20 to-orange-500/10 relative">
                          {safeAvatarUrl(token.banner_url) && (
                            <img src={safeAvatarUrl(token.banner_url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
                          )}
                          <Badge className="absolute top-2 right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                            <Star className="h-3 w-3 mr-1" />
                            Featured
                          </Badge>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            {safeAvatarUrl(token.logo_url) ? (
                              <img src={safeAvatarUrl(token.logo_url)} alt={token.symbol} className="h-12 w-12 rounded-xl object-cover ring-2 ring-yellow-500/30" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center font-bold text-white">
                                {token.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="font-bold">{token.token_name}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">${token.symbol}</Badge>
                                <Badge variant="outline" className={`text-xs ${getPlatformColor(token.launch_platform)}`}>
                                  {token.launch_platform}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {liveData && (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-[10px] text-muted-foreground">Price</p>
                                <p className="text-xs font-bold">{formatPrice(liveData.price)}</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-[10px] text-muted-foreground">MCap</p>
                                <p className="text-xs font-bold">{formatNumber(liveData.marketCap)}</p>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-[10px] text-muted-foreground">24h</p>
                                <p className={`text-xs font-bold ${(liveData.priceChange24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {(liveData.priceChange24h || 0) >= 0 ? '+' : ''}{(liveData.priceChange24h || 0).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {/* Main Token Grid */}
          <div>
            {/* Filters & Search */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
                <TabsList className="bg-muted/30">
                  <TabsTrigger value="all" className="gap-2">
                    <Rocket className="h-4 w-4" />
                    All Tokens
                  </TabsTrigger>
                  <TabsTrigger value="featured" className="gap-2">
                    <Star className="h-4 w-4" />
                    Featured
                  </TabsTrigger>
                  {user && (
                    <TabsTrigger value="mine" className="gap-2">
                      <Users className="h-4 w-4" />
                      My Listings
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tokens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full lg:w-64"
                  />
                </div>
                
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="w-36">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {LAUNCH_PLATFORMS.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="mcap">Market Cap</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                    <SelectItem value="gainers">Top Gainers</SelectItem>
                    <SelectItem value="losers">Top Losers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Token Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array(8).fill(0).map((_, i) => (
                  <Card key={i} className="og-glass-card animate-pulse">
                    <div className="h-20 bg-muted" />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-24 bg-muted rounded" />
                          <div className="h-3 w-16 bg-muted rounded" />
                        </div>
                      </div>
                      <div className="h-16 bg-muted rounded-lg" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <Card className="og-glass-card">
                <CardContent className="p-16 text-center">
                  <div className="inline-flex p-4 rounded-full bg-white/[0.04] mb-4">
                    <Rocket className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">No tokens found</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6">Be the first to list a token on Sol Tools Launch Pad!</p>
                  <Button onClick={() => setShowSubmitDialog(true)} className="bg-gradient-to-r from-primary to-secondary">
                    <Plus className="h-4 w-4 mr-2" />
                    List Token Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredSubmissions.map((token) => {
                  const liveData = liveTokenData[token.contract_address];
                  const realtimePrice = livePrices[token.contract_address];
                  // Prefer real-time data, fall back to initial fetch
                  const displayPrice = realtimePrice?.price || (liveData ? parseFloat(String(liveData.price)) : null);
                  const priceChange = realtimePrice?.priceChange24h ?? liveData?.priceChange24h ?? 0;
                  const displayLiquidity = realtimePrice?.liquidity || liveData?.liquidity || token.liquidity_usd;
                  const displayMcap = realtimePrice?.marketCap || liveData?.marketCap || token.market_cap;
                  const displayVolume = realtimePrice?.volume24h || liveData?.volume24h;
                  const isPositive = priceChange >= 0;
                  const isRealtimeActive = !!realtimePrice && (Date.now() - realtimePrice.lastUpdated < 30000);
                  
                  return (
                    <Card 
                      key={token.id} 
                      className={`group overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border-2 ${
                        token.is_featured 
                          ? "border-yellow-500/50 bg-gradient-to-br from-yellow-500/5 via-card to-orange-500/5 shadow-lg shadow-yellow-500/10" 
                          : "border-white/[0.07] bg-[#0a1220] hover:border-primary/50 hover:shadow-primary/20"
                      }`}
                      onClick={() => openTokenDetail(token)}
                    >
                      {/* Header with Live Price */}
                      <div className={`relative p-4 ${
                        safeAvatarUrl(token.banner_url)
                          ? '' 
                          : 'bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/10'
                      }`}>
                        {safeAvatarUrl(token.banner_url) && (
                          <>
                            <img src={safeAvatarUrl(token.banner_url)} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-card" />
                          </>
                        )}
                        
                        <div className="relative flex items-start justify-between">
                          {/* Token Logo & Name */}
                          <div className="flex items-center gap-3">
                            {safeAvatarUrl(token.logo_url) ? (
                              <img 
                                src={safeAvatarUrl(token.logo_url)} 
                                alt={token.symbol} 
                                className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/20 shadow-lg"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-lg ring-2 ring-white/20 shadow-lg">
                                {token.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <h3 className="font-bold text-base truncate max-w-[120px]">{token.token_name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background/80">
                                  ${token.symbol}
                                </Badge>
                                {token.is_featured && (
                                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 text-[9px] px-1.5 py-0">
                                    <Star className="h-2.5 w-2.5 mr-0.5" />
                                    HOT
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Live Price Badge */}
                          {liveData && (
                            <div className={`px-2.5 py-1.5 rounded-xl text-right ${
                              isPositive 
                                ? 'bg-green-500/20 border border-green-500/30' 
                                : 'bg-red-500/20 border border-red-500/30'
                            }`}>
                              <div className={`text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
                              </div>
                              <div className="text-[10px] text-muted-foreground">24h</div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <CardContent className="p-4 pt-0">
                        {/* Price Display - Large & Prominent */}
                        <div className="py-3 mb-3 border-b border-white/[0.07]">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Price</p>
                                {isRealtimeActive && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[8px] text-green-500 font-mono">LIVE</span>
                                  </div>
                                )}
                              </div>
                              <p className={`text-2xl font-black tracking-tight transition-colors duration-300 ${isRealtimeActive ? (isPositive ? 'text-green-400' : 'text-red-400') : ''}`}>
                                {displayPrice ? formatPrice(displayPrice) : 'Loading...'}
                              </p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] px-2 py-0.5 ${getPlatformColor(token.launch_platform)}`}
                            >
                              {token.launch_platform}
                            </Badge>
                          </div>
                        </div>

                        {/* Key Stats Grid - More Prominent */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Droplets className="h-3 w-3 text-blue-400" />
                              <p className="text-[10px] text-blue-300 uppercase tracking-wider">Liquidity</p>
                            </div>
                            <p className="text-sm font-bold text-blue-50">
                              {formatNumber(displayLiquidity)}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <BarChart3 className="h-3 w-3 text-purple-400" />
                              <p className="text-[10px] text-purple-300 uppercase tracking-wider">MCap</p>
                            </div>
                            <p className="text-sm font-bold text-purple-50">
                              {formatNumber(displayMcap)}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <TrendingUp className="h-3 w-3 text-green-400" />
                              <p className="text-[10px] text-green-300 uppercase tracking-wider">Volume</p>
                            </div>
                            <p className="text-sm font-bold text-green-50">
                              {formatNumber(displayVolume)}
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        {token.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{token.description}</p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
                          <div className="flex items-center gap-1">
                            {token.website && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg hover:bg-primary/10" 
                                onClick={(e) => { e.stopPropagation(); window.open(token.website!, "_blank"); }}
                              >
                                <Globe className="h-4 w-4" />
                              </Button>
                            )}
                            {token.twitter && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg hover:bg-primary/10" 
                                onClick={(e) => { e.stopPropagation(); window.open(`https://twitter.com/${token.twitter!.replace("@", "")}`, "_blank"); }}
                              >
                                <Twitter className="h-4 w-4" />
                              </Button>
                            )}
                            {token.telegram && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg hover:bg-primary/10" 
                                onClick={(e) => { e.stopPropagation(); window.open(token.telegram!.startsWith("http") ? token.telegram! : `https://t.me/${token.telegram}`, "_blank"); }}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-primary/10"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(token.contract_address); }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px] rounded-lg hover:bg-primary/10 gap-1"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                window.open(`https://dexscreener.com/solana/${token.contract_address}`, "_blank"); 
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Chart
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Token Detail Modal */}
        <TokenDetailModal
          token={selectedToken}
          tokenLiveData={tokenLiveData}
          aiAnalysis={aiAnalysis}
          loadingLiveData={loadingLiveData}
          onClose={() => setSelectedToken(null)}
        />
      </div>
    </AppLayout>
  );
};

export default PumpV5;