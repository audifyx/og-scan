/**
 * OrbitxLaunch — the Orbitx Launch Console (mounted at /orbitxlaunch).
 *
 * Full Solana launchpad with token marketplace, trading, and launcher.
 * Features: token discovery, buy/sell UI, global wallet, featured tokens,
 * and full token creation form. Built on OrbitX design system.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { toast } from "sonner";
import {
  Rocket, Wallet, Globe, Twitter, Send, MessagesSquare, Upload, Image as ImageIcon,
  Coins, ShieldCheck, Droplets, Sparkles, Lock, Flame, Gauge, Timer,
  CheckCircle2, AlertTriangle, Info, Wand2, ChevronRight, Loader2, Copy, Check,
  Home, TrendingUp, BarChart3, Zap, ArrowRight, ArrowUpRight, ArrowDownLeft, X,
} from "lucide-react";

const LAUNCH_FEE_SOL = 0.15;
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const OFFICIAL_TOKEN_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

// Mock market data - in production, fetch from your API
const MOCK_TOKENS = [
  {
    mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
    name: "OrbitX",
    ticker: "OBX",
    logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23fbbf24'/%3E%3Ctext x='50' y='60' text-anchor='middle' font-size='40' font-weight='bold' fill='%23000'%3EOBX%3C/text%3E%3C/svg%3E",
    mcap: 1250000,
    ch24: 12.5,
    volume: 350000,
    holders: 2480,
  },
  {
    mint: "EPjFWaLb3hyccqaB3JhriQqq6zu7YxDAKyS3uTHSfVU",
    name: "USDC",
    ticker: "USDC",
    logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%232775ca'/%3E%3Ctext x='50' y='60' text-anchor='middle' font-size='35' font-weight='bold' fill='%23fff'%3EUSDC%3C/text%3E%3C/svg%3E",
    mcap: 32500000,
    ch24: -0.8,
    volume: 1250000,
    holders: 5820,
  },
];

type MarketToken = typeof MOCK_TOKENS[0];

const LAUNCH_TYPES = [
  { value: "fair", label: "Fair Launch", hint: "No presale · everyone buys at open" },
  { value: "bonding", label: "Bonding Curve", hint: "On-curve price discovery" },
  { value: "presale", label: "Presale + LP", hint: "Raise, then seed liquidity" },
] as const;

// Custom launchpad — no pump.fun / PumpSwap. Own SPL mint, then seed
// liquidity into an independent DEX pool we create directly via their SDK.
const DEXES = [
  { value: "raydium", label: "Raydium (CPMM)" },
  { value: "meteora", label: "Meteora (DLMM)" },
  { value: "orca", label: "Orca (Whirlpools)" },
] as const;

const SECTIONS = [
  { id: "identity", label: "Identity", icon: Sparkles },
  { id: "socials", label: "Socials", icon: Globe },
  { id: "supply", label: "Supply", icon: Coins },
  { id: "authorities", label: "Authorities", icon: ShieldCheck },
  { id: "tokenomics", label: "Tokenomics", icon: Gauge },
  { id: "liquidity", label: "Liquidity", icon: Droplets },
  { id: "protections", label: "Protections", icon: ShieldCheck },

] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const ALLOC_COLORS: Record<string, string> = {
  dev: "hsl(var(--og-blood))",
  community: "hsl(var(--og-lime))",
  marketing: "hsl(var(--og-cyan))",
  treasury: "hsl(var(--og-gold))",
};

interface Alloc { dev: number; community: number; marketing: number; treasury: number; }

interface LaunchConfig {
  name: string; ticker: string; description: string; logoDataUrl: string | null;
  website: string; twitter: string; telegram: string; discord: string;
  decimals: number; supply: string; initialPriceUsd: string; launchType: string; launchDelayMin: number;
  revokeMint: boolean; revokeFreeze: boolean; immutableMetadata: boolean;
  alloc: Alloc; burnPct: number;
  liquiditySol: string; dex: string; lpLockDays: number; burnLp: boolean;
  maxWalletPct: number; maxTxPct: number; cooldownSec: number;
  antiBot: boolean; antiSandwich: boolean; sniperProtection: boolean;
  vanityPrefix: string;
}

const DEFAULT_CONFIG: LaunchConfig = {
  name: "", ticker: "", description: "", logoDataUrl: null,
  website: "", twitter: "", telegram: "", discord: "",
  decimals: 9, supply: "1000000000", initialPriceUsd: "0.0001", launchType: "bonding", launchDelayMin: 0,
  revokeMint: true, revokeFreeze: true, immutableMetadata: false,
  alloc: { dev: 5, community: 80, marketing: 10, treasury: 5 }, burnPct: 0,
  liquiditySol: "10", dex: "raydium", lpLockDays: 30, burnLp: false,
  maxWalletPct: 2, maxTxPct: 1, cooldownSec: 0,
  antiBot: true, antiSandwich: true, sniperProtection: true,
  vanityPrefix: "OBX",
};

const fieldClass =
  "bg-black/40 border-white/10 focus-visible:ring-[hsl(var(--og-gold))] focus-visible:border-[hsl(var(--og-gold))]/60";

function StatChip({ label, value, tone = "gold" }: { label: string; value: string; tone?: "gold" | "cyan" | "lime" | "blood" }) {
  const toneMap: Record<string, string> = {
    gold: "text-[hsl(var(--og-gold))]", cyan: "text-[hsl(var(--og-cyan))]",
    lime: "text-[hsl(var(--og-lime))]", blood: "text-[hsl(var(--og-blood))]",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-semibold ${toneMap[tone]}`}>{value}</div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--og-gold))]/30 bg-[hsl(var(--og-gold))]/10">
        <Icon className="h-[18px] w-[18px] text-[hsl(var(--og-gold))]" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function AllocationBar({ alloc, height = 10 }: { alloc: Alloc; height?: number }) {
  const total = Math.max(1, alloc.dev + alloc.community + alloc.marketing + alloc.treasury);
  return (
    <div className="flex w-full overflow-hidden rounded-full border border-white/10" style={{ height }}>
      {(["dev", "community", "marketing", "treasury"] as (keyof Alloc)[]).map((k) => (
        <div key={k} style={{ width: `${(alloc[k] / total) * 100}%`, background: ALLOC_COLORS[k] }} title={`${k}: ${alloc[k]}%`} />
      ))}
    </div>
  );
}

function estimateVanity(prefix: string, ratePerSec: number) {
  const clean = prefix.replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
  const n = clean.length;
  const perCharSpace = 58 / 2;
  const expected = Math.pow(perCharSpace, n);
  const seconds = ratePerSec > 0 ? expected / ratePerSec : Infinity;
  return { n, expected, seconds };
}
function humanTime(sec: number) {
  if (!isFinite(sec)) return "—";
  if (sec < 1) return "<1s";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}

export default function OrbitxLaunch() {
  const { connected, publicKey, connect, wallets, select } = useWallet();
  const [cfg, setCfg] = useState<LaunchConfig>(DEFAULT_CONFIG);
  const [active, setActive] = useState<SectionId>("identity");
  const [launching, setLaunching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof LaunchConfig>(key: K, value: LaunchConfig[K]) => {
    setCfg((c) => ({ ...c, [key]: value }));
  }, []);
  const setAlloc = useCallback((key: keyof Alloc, value: number) => {
    setCfg((c) => ({ ...c, alloc: { ...c.alloc, [key]: value } }));
  }, []);

  const allocTotal = cfg.alloc.dev + cfg.alloc.community + cfg.alloc.marketing + cfg.alloc.treasury;
  const allocValid = allocTotal === 100;

  const sectionDone = useMemo<Record<SectionId, boolean>>(() => ({
    identity: !!cfg.name.trim() && !!cfg.ticker.trim() && !!cfg.description.trim() && !!cfg.logoDataUrl,
    socials: !!(cfg.website || cfg.twitter || cfg.telegram || cfg.discord),
    supply: /^\d+$/.test(cfg.supply) && Number(cfg.supply) > 0 && Number(cfg.initialPriceUsd) > 0,
    authorities: cfg.revokeMint && cfg.revokeFreeze,
    tokenomics: allocValid,
    liquidity: Number(cfg.liquiditySol) > 0 && (cfg.burnLp || cfg.lpLockDays > 0),
    protections: cfg.antiBot || cfg.antiSandwich || cfg.sniperProtection,

  }), [cfg, allocValid]);
  const readiness = useMemo(() => {
    const keys = Object.keys(sectionDone) as SectionId[];
    return Math.round((keys.filter((k) => sectionDone[k]).length / keys.length) * 100);
  }, [sectionDone]);
  const trust = useMemo(() => {
    let s = 0;
    if (cfg.revokeMint) s += 30;
    if (cfg.revokeFreeze) s += 25;
    if (cfg.burnLp) s += 25; else if (cfg.lpLockDays >= 30) s += 15;
    if (cfg.immutableMetadata) s += 10;
    if (allocValid && cfg.alloc.dev <= 10) s += 10;
    return Math.min(100, s);
  }, [cfg, allocValid]);
  const trustTone = trust >= 80 ? "lime" : trust >= 50 ? "gold" : "blood";
  const toneHsl: Record<string, string> = {
    lime: "hsl(var(--og-lime))", gold: "hsl(var(--og-gold))", blood: "hsl(var(--og-blood))", cyan: "hsl(var(--og-cyan))",
  };

  const [grinding, setGrinding] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [foundKey, setFoundKey] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const grindStop = useRef(false);
  const vanityEst = useMemo(() => estimateVanity(cfg.vanityPrefix, rate || 8000), [cfg.vanityPrefix, rate]);

  const runGrind = useCallback(() => {
    const target = cfg.vanityPrefix.trim();
    if (!target) return;
    setGrinding(true); setFoundKey(null); setAttempts(0);
    grindStop.current = false;
    const started = performance.now();
    let count = 0;
    const CHUNK = 1200;
    const targetLower = target.toLowerCase();
    const step = () => {
      if (grindStop.current) { setGrinding(false); return; }
      for (let i = 0; i < CHUNK; i++) {
        const kp = Keypair.generate();
        count++;
        const addr = kp.publicKey.toBase58();
        if (addr.toLowerCase().startsWith(targetLower)) {
          setFoundKey(addr); setAttempts(count);
          setRate(Math.round((count / (performance.now() - started)) * 1000));
          setGrinding(false);
          toast.success(`Found ${target}… address in ${count.toLocaleString()} tries`);
          return;
        }
      }
      setAttempts(count);
      setRate(Math.round((count / (performance.now() - started)) * 1000));
      if (count > 2_500_000) {
        setGrinding(false);
        toast.error("Grind ceiling reached — try a shorter prefix (OBX is realistic, longer isn't).");
        return;
      }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }, [cfg.vanityPrefix]);
  useEffect(() => () => { grindStop.current = true; }, []);

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMG.includes(file.type)) return toast.error("Use PNG, JPG, GIF or WebP");
    if (file.size > MAX_LOGO_SIZE) return toast.error("Logo must be under 5MB");
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!cfg.name.trim()) e.push("Token name is required");
    if (!cfg.ticker.trim()) e.push("Ticker is required");
    if (!/^\d+$/.test(cfg.supply) || Number(cfg.supply) <= 0) e.push("Supply must be a positive number");
    if (!allocValid) e.push(`Allocations must total 100% (currently ${allocTotal}%)`);
    return e;
  }, [cfg, allocValid, allocTotal]);

  const handleConnect = async () => {
    try {
      if (!wallets?.length) return toast.error("No wallet detected — install Phantom, Solflare, Backpack or Glow");
      const ready = wallets.find((w) => w.readyState === "Installed") || wallets[0];
      select(ready.adapter.name);
      await connect();
    } catch { toast.error("Wallet connection cancelled"); }
  };

  const handleLaunch = async () => {
    if (errors.length) { toast.error(errors[0]); return; }
    if (!connected) { toast.error("Connect a wallet first"); return; }
    setLaunching(true);
    await new Promise((r) => setTimeout(r, 1400));
    setLaunching(false);
    toast.success(`${cfg.ticker.toUpperCase()} configuration validated — ready for devnet mint`);
  };

  const renderSection = () => {
    switch (active) {
      case "identity":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Sparkles} title="Token Identity" desc="Name, ticker, story and logo — the face of your launch." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Token Name</Label>
                <Input className={fieldClass} placeholder="Orbit Protocol" value={cfg.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="space-y-2"><Label>Ticker</Label>
                <Input className={fieldClass} placeholder="ORBIT" maxLength={10} value={cfg.ticker} onChange={(e) => set("ticker", e.target.value.toUpperCase())} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label>
              <Textarea className={fieldClass} rows={4} placeholder="What is this token? Why does it exist?" value={cfg.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="space-y-2"><Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  {cfg.logoDataUrl ? <img src={cfg.logoDataUrl} alt="logo" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <input ref={fileRef} type="file" accept={ACCEPTED_IMG.join(",")} className="hidden" onChange={onLogo} />
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="border-white/15"><Upload className="mr-2 h-4 w-4" /> Upload logo</Button>
              </div></div>
          </div>
        );
      case "socials":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Globe} title="Socials & Links" desc="Where your community lives. All optional, all shown on the token page." />
            {[
              { key: "website", label: "Website", icon: Globe, ph: "https://…" },
              { key: "twitter", label: "Twitter / X", icon: Twitter, ph: "https://x.com/…" },
              { key: "telegram", label: "Telegram", icon: Send, ph: "https://t.me/…" },
              { key: "discord", label: "Discord", icon: MessagesSquare, ph: "https://discord.gg/…" },
            ].map((f) => (
              <div key={f.key} className="space-y-2">
                <Label className="flex items-center gap-2"><f.icon className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> {f.label}</Label>
                <Input className={fieldClass} placeholder={f.ph} value={(cfg as any)[f.key]} onChange={(e) => set(f.key as keyof LaunchConfig, e.target.value as any)} />
              </div>
            ))}
          </div>
        );
      case "supply":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Coins} title="Supply & Launch" desc="Mint economics and how trading opens." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Total Supply</Label>
                <Input className={fieldClass} inputMode="numeric" value={cfg.supply} onChange={(e) => set("supply", e.target.value.replace(/[^\d]/g, ""))} /></div>
              <div className="space-y-2"><Label>Decimals</Label>
                <Select value={String(cfg.decimals)} onValueChange={(v) => set("decimals", Number(v))}>
                  <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 2, 4, 6, 9].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Initial Price (USD)</Label>
                <Input className={fieldClass} value={cfg.initialPriceUsd} onChange={(e) => set("initialPriceUsd", e.target.value)} /></div>
              <div className="space-y-2"><Label>Launch Delay (minutes)</Label>
                <Input className={fieldClass} inputMode="numeric" value={String(cfg.launchDelayMin)} onChange={(e) => set("launchDelayMin", Number(e.target.value.replace(/[^\d]/g, "")) || 0)} /></div>
            </div>
            <div className="space-y-2"><Label>Launch Type</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {LAUNCH_TYPES.map((t) => (
                  <button key={t.value} onClick={() => set("launchType", t.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${cfg.launchType === t.value ? "border-[hsl(var(--og-gold))]/60 bg-[hsl(var(--og-gold))]/10 shadow-og-gold" : "border-white/10 bg-black/30 hover:border-white/25"}`}>
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.hint}</div>
                  </button>
                ))}
              </div></div>
          </div>
        );
      case "authorities":
        return (
          <div className="space-y-5">
            <SectionHeading icon={ShieldCheck} title="Mint Authorities" desc="Revoking authorities is the strongest trust signal you can give holders." />
            {[
              { key: "revokeMint", label: "Revoke Mint Authority", desc: "No one can ever mint more supply. Recommended." },
              { key: "revokeFreeze", label: "Revoke Freeze Authority", desc: "Wallets can never be frozen. Recommended." },
              { key: "immutableMetadata", label: "Immutable Metadata", desc: "Name, ticker and image can never be changed." },
            ].map((a) => (
              <div key={a.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="pr-4"><div className="text-sm font-semibold">{a.label}</div><div className="text-xs text-muted-foreground">{a.desc}</div></div>
                <Switch checked={(cfg as any)[a.key]} onCheckedChange={(v) => set(a.key as keyof LaunchConfig, v as any)} />
              </div>
            ))}
          </div>
        );
      case "tokenomics":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Gauge} title="Tokenomics" desc="Allocate supply across buckets. Must total 100%." />
            <AllocationBar alloc={cfg.alloc} height={14} />
            <div className="flex flex-wrap gap-3 text-xs">
              {(["dev", "community", "marketing", "treasury"] as (keyof Alloc)[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5 capitalize text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: ALLOC_COLORS[k] }} /> {k} {cfg.alloc[k]}%
                </span>
              ))}
            </div>
            {(["dev", "community", "marketing", "treasury"] as (keyof Alloc)[]).map((k) => (
              <div key={k} className="space-y-2">
                <div className="flex items-center justify-between"><Label className="capitalize">{k} allocation</Label>
                  <span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.alloc[k]}%</span></div>
                <Slider value={[cfg.alloc[k]]} min={0} max={100} step={1} onValueChange={([v]) => setAlloc(k, v)} />
              </div>
            ))}
            <div className={`flex items-center justify-between rounded-xl border p-3 text-sm ${allocValid ? "border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10" : "border-[hsl(var(--og-blood))]/40 bg-[hsl(var(--og-blood))]/10"}`}>
              <span className="flex items-center gap-2">{allocValid ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--og-lime))]" /> : <AlertTriangle className="h-4 w-4 text-[hsl(var(--og-blood))]" />} Total allocation</span>
              <span className="font-mono font-semibold">{allocTotal}%</span>
            </div>
            <Separator className="bg-white/10" />
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Flame className="h-3.5 w-3.5 text-[hsl(var(--og-blood))]" /> Burn at launch</Label>
                <span className="font-mono text-sm text-[hsl(var(--og-blood))]">{cfg.burnPct}%</span></div>
              <Slider value={[cfg.burnPct]} min={0} max={50} step={1} onValueChange={([v]) => set("burnPct", v)} />
            </div>
          </div>
        );
      case "liquidity":
        return (
          <div className="space-y-5">
            <SectionHeading icon={Droplets} title="Liquidity" desc="Seed the pool, lock or burn the LP. Devnet-tested; mainnet is gated." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Initial Liquidity (SOL)</Label>
                <Input className={fieldClass} value={cfg.liquiditySol} onChange={(e) => set("liquiditySol", e.target.value)} /></div>
              <div className="space-y-2"><Label>DEX</Label>
                <Select value={cfg.dex} onValueChange={(v) => set("dex", v)}>
                  <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>{DEXES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-[hsl(var(--og-cyan))]" /> LP Lock Duration</Label>
                <span className="font-mono text-sm text-[hsl(var(--og-cyan))]">{cfg.lpLockDays} days</span></div>
              <Slider value={[cfg.lpLockDays]} min={0} max={365} step={1} onValueChange={([v]) => set("lpLockDays", v)} disabled={cfg.burnLp} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="pr-4"><div className="text-sm font-semibold">Burn LP tokens</div><div className="text-xs text-muted-foreground">Permanently burns liquidity — the strongest lock, but irreversible.</div></div>
              <Switch checked={cfg.burnLp} onCheckedChange={(v) => set("burnLp", v)} />
            </div>
          </div>
        );
      case "protections":
        return (
          <div className="space-y-5">
            <SectionHeading icon={ShieldCheck} title="Trading Protections" desc="Anti-bot and limit controls." />
            <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--og-gold))]/30 bg-[hsl(var(--og-gold))]/10 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-gold))]" />
              <span>On-chain enforcement of limits, cooldowns and anti-sandwich needs a custom Anchor program (audited before mainnet). These configure that program; standard SPL tokens can't enforce them alone.</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><div className="flex items-center justify-between"><Label>Max Wallet</Label><span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.maxWalletPct}%</span></div>
                <Slider value={[cfg.maxWalletPct]} min={0} max={10} step={0.5} onValueChange={([v]) => set("maxWalletPct", v)} /></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><Label>Max Transaction</Label><span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.maxTxPct}%</span></div>
                <Slider value={[cfg.maxTxPct]} min={0} max={10} step={0.5} onValueChange={([v]) => set("maxTxPct", v)} /></div>
            </div>
            <div className="space-y-2"><div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Trading cooldown</Label><span className="font-mono text-sm text-[hsl(var(--og-gold))]">{cfg.cooldownSec}s</span></div>
              <Slider value={[cfg.cooldownSec]} min={0} max={60} step={1} onValueChange={([v]) => set("cooldownSec", v)} /></div>
            {[
              { key: "antiBot", label: "Anti-bot", desc: "Block known bot signatures at open." },
              { key: "antiSandwich", label: "Anti-sandwich", desc: "Mitigate MEV sandwich attacks." },
              { key: "sniperProtection", label: "Sniper protection", desc: "Throttle block-0 snipers." },
            ].map((p) => (
              <div key={p.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="pr-4"><div className="text-sm font-semibold">{p.label}</div><div className="text-xs text-muted-foreground">{p.desc}</div></div>
                <Switch checked={(cfg as any)[p.key]} onCheckedChange={(v) => set(p.key as keyof LaunchConfig, v as any)} />
              </div>
            ))}
          </div>
        );

    }
  };

  return (
    <AppLayout>
      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-6">
        {/* Hero */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[hsl(var(--og-gold))]/10 to-transparent p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--og-gold))]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[hsl(var(--og-cyan))]/10 blur-3xl" />
          <div className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 opacity-60 md:block">
            <div className="relative h-40 w-40 animate-[spin_38s_linear_infinite] rounded-full border border-dashed border-[hsl(var(--og-gold))]/30">
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[hsl(var(--og-gold))] shadow-[0_0_12px_hsl(var(--og-gold))]" />
              <div className="absolute inset-4 rounded-full border border-dashed border-[hsl(var(--og-cyan))]/30">
                <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[hsl(var(--og-cyan))] shadow-[0_0_10px_hsl(var(--og-cyan))]" />
              </div>
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--og-gold))] shadow-[0_0_18px_hsl(var(--og-gold))]" />
            </div>
          </div>
          {([["12%", "18%"], ["28%", "62%"], ["8%", "78%"], ["70%", "22%"], ["85%", "70%"]] as [string, string][]).map(([t, l], i) => (
            <span key={i} className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/60 animate-pulse" style={{ top: t, left: l, animationDelay: `${i * 0.6}s` }} />
          ))}

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 flex items-center gap-2">
                <Badge className="border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))]"><Rocket className="mr-1 h-3 w-3" /> Orbitx Launch</Badge>
                <Badge variant="outline" className="border-[hsl(var(--og-cyan))]/40 text-[hsl(var(--og-cyan))]">Solana-only</Badge>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Launch a token on <span className="text-[hsl(var(--og-gold))] text-glow-gold">Solana</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your own launchpad — own SPL mint, Metaplex metadata, independent DEX liquidity, on-chain protections and a custom OBX vanity address. No pump.fun.
              </p>
              <div className="mt-5 max-w-sm">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Launch readiness</span>
                  <span className="font-mono font-semibold text-[hsl(var(--og-gold))]">{readiness}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--og-cyan))] to-[hsl(var(--og-gold))] transition-all duration-500" style={{ width: `${readiness}%` }} />
                </div>
              </div>
            </div>
            {connected ? (
              <Badge variant="outline" className="border-[hsl(var(--og-lime))]/40 text-[hsl(var(--og-lime))]"><Wallet className="mr-1 h-3 w-3" /> {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}</Badge>
            ) : (
              <Button onClick={handleConnect} className="bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90"><Wallet className="mr-2 h-4 w-4" /> Connect Wallet</Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr_320px]">
          {/* Section nav with completion ticks */}
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s, idx) => {
              const Icon = s.icon; const on = active === s.id; const done = sectionDone[s.id];
              return (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all lg:w-full ${on ? "border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))]" : "border-white/8 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{s.label}</span>
                  {done ? <Check className="h-3.5 w-3.5 text-[hsl(var(--og-lime))]" /> : <span className="font-mono text-[10px] text-muted-foreground/60">{idx + 1}</span>}
                </button>
              );
            })}
          </nav>

          {/* Active section */}
          <Card className="border-white/10 bg-card/60 backdrop-blur"><CardContent className="p-6">{renderSection()}</CardContent></Card>

          {/* Live summary */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="border-white/10 bg-card/60 backdrop-blur"><CardContent className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {cfg.logoDataUrl ? <img src={cfg.logoDataUrl} alt="" className="h-full w-full object-cover" /> : <Coins className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{cfg.name || "Untitled Token"}</div>
                  <div className="font-mono text-xs text-[hsl(var(--og-gold))]">${cfg.ticker || "TICKER"}</div>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Trust score</span>
                  <span className="font-mono font-semibold" style={{ color: toneHsl[trustTone] }}>{trust}/100</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${trust}%`, background: toneHsl[trustTone] }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Supply" value={Number(cfg.supply || 0).toLocaleString()} />
                <StatChip label="Type" value={LAUNCH_TYPES.find((t) => t.value === cfg.launchType)?.label.split(" ")[0] || "—"} tone="cyan" />
                <StatChip label="Liquidity" value={`${cfg.liquiditySol || 0} SOL`} tone="lime" />
                <StatChip label="LP" value={cfg.burnLp ? "Burned" : `${cfg.lpLockDays}d lock`} tone="cyan" />
                <StatChip label="Burn" value={`${cfg.burnPct}%`} tone="blood" />
                <StatChip label="Vanity" value={cfg.vanityPrefix || "—"} tone="gold" />
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Allocation</div>
                <AllocationBar alloc={cfg.alloc} />
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Mint authority</span><span className={cfg.revokeMint ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-blood))]"}>{cfg.revokeMint ? "Revoked" : "Retained"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Freeze authority</span><span className={cfg.revokeFreeze ? "text-[hsl(var(--og-lime))]" : "text-[hsl(var(--og-blood))]"}>{cfg.revokeFreeze ? "Revoked" : "Retained"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">DEX</span><span className="text-foreground">{DEXES.find((d) => d.value === cfg.dex)?.label || "—"}</span></div>
              </div>

              <Separator className="my-4 bg-white/10" />
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Launch fee</span>
                <span className="font-mono font-semibold text-[hsl(var(--og-gold))]">{LAUNCH_FEE_SOL} SOL</span>
              </div>

              <Button onClick={handleLaunch} disabled={launching || errors.length > 0}
                className="w-full bg-[hsl(var(--og-gold))] text-black hover:bg-[hsl(var(--og-gold))]/90 disabled:opacity-50">
                {launching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating…</> : <><Rocket className="mr-2 h-4 w-4" /> Launch Token</>}
              </Button>
              {errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {errors.map((e) => (
                    <div key={e} className="flex items-center gap-1.5 text-xs text-[hsl(var(--og-blood))]"><AlertTriangle className="h-3 w-3" /> {e}</div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <button onClick={() => { const i = SECTIONS.findIndex((s) => s.id === active); setActive(SECTIONS[(i + 1) % SECTIONS.length].id); }}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/20 py-2 text-sm text-muted-foreground hover:text-foreground">
              Next section <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
