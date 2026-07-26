// OrbitX Launchpad shell — black / metal chrome (gold · blue · silver).
import { AntiVampProtectionBadge } from "@/components/layout/AntiVampProtectionBadge";
import { NavLink, Outlet, Link, useSearchParams } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { linkEvmToSolana } from "@/lib/orbitx/walletLink";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { toast } from "sonner";
import {
  Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Wallet, Flame, Trophy, Briefcase, ShieldCheck, Link2, Plus,
  Twitter, Send, Github, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS, TRADE_FEE_CREATOR_SHARE_PCT, TRADE_FEE_PLATFORM_SHARE_PCT } from "@/lib/platformFee";
import { shortAddr } from "./_shared";
import { redeemReferralCode } from "@/lib/orbitx/registry";
import { useAdmin } from "@/hooks/useAdmin";
import { useChainTelemetry, useSolUsd, fmtInt } from "./lpx";
import { useAuth } from "@/hooks/useAuth";
import "./orbitx-2026.css";

const TAB_GROUPS: { id: string; label: string; tabs: TabDef[] }[] = [
  {
    id: "discover",
    label: "Discover",
    tabs: [
      { to: "/orbitxlaunch", label: "Board", icon: Home, end: true },
      { to: "/orbitxlaunch/leaderboard", label: "Leaders", icon: Trophy, end: false },
    ],
  },
  {
    id: "launch",
    label: "Launch",
    tabs: [
      { to: "/orbitxlaunch/create", label: "Create", icon: PlusCircle, end: false, accent: "gold" },
      { to: "/orbitxlaunch/claim", label: "Claim", icon: HandCoins, end: false, hot: true },
      { to: "/orbitxlaunch/rescue", label: "Rescue", icon: Flame, end: false, hot: true },
    ],
  },
  {
    id: "you",
    label: "You",
    tabs: [
      { to: "/orbitxlaunch/portfolio", label: "Portfolio", icon: Briefcase, end: false },
      { to: "/orbitxlaunch/profile", label: "Profile", icon: UserCircle2, end: false },
      { to: "/orbitxlaunch/about", label: "About", icon: Info, end: false },
    ],
  },
];

type TabDef = {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  hot?: boolean;
  accent?: "gold";
};

function HeaderStats() {
  const tel = useChainTelemetry();
  const solUsd = useSolUsd();
  const ok = tel.data?.ok ?? false;
  return (
    <div className="ox-header-stats hidden md:flex" aria-label="Network stats">
      <span className="ox-header-stat">
        <span className={`ox-header-stat-dot ${ok ? "ox-header-stat-dot--ok" : "ox-header-stat-dot--bad"}`} />
        {ok ? "Solana live" : "Degraded"}
      </span>
      <span className="ox-header-stat ox-header-stat--dim">
        SOL ${solUsd.data ? solUsd.data.price.toFixed(2) : "—"}
      </span>
      <span className="ox-header-stat ox-header-stat--dim">
        {fmtUsd(ORBITX_FEE_USD)} launch
      </span>
      <span className="ox-header-stat ox-header-stat--dim">
        {(CREATOR_FEE_BPS / 100).toFixed(2)}% trade
      </span>
    </div>
  );
}

function TabRail({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="ox-tab-groups" aria-label="Launchpad sections">
      {TAB_GROUPS.map((group, gi) => (
        <div key={group.id} className="ox-tab-group">
          <span className="ox-tab-group-label">{group.label}</span>
          <div className="ox-tab-group-items">
            {group.tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "ox-launch-tab",
                    isActive && "ox-launch-tab--on",
                    t.hot && !isActive && "ox-launch-tab--hot",
                    t.accent === "gold" && !isActive && "ox-launch-tab--accent",
                  )
                }
              >
                <t.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{t.label}</span>
              </NavLink>
            ))}
          </div>
          {gi < TAB_GROUPS.length - 1 && <span className="ox-tab-group-divider" aria-hidden />}
        </div>
      ))}
      {isAdmin && (
        <div className="ox-tab-group ox-tab-group--admin">
          <span className="ox-tab-group-label">Admin</span>
          <div className="ox-tab-group-items">
            <NavLink
              to="/orbitxlaunch/ox-desk-m4k9q"
              className={({ isActive }) => cn("ox-launch-tab", isActive && "ox-launch-tab--on")}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Desk</span>
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}

function WalletConsole() {
  const { connection } = useConnection();
  const { publicKey, connected, disconnect } = useWallet();
  const { user } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);
  const addr = publicKey?.toBase58();

  const { data: sol } = useQuery({
    queryKey: ["lp-header-balance", addr],
    queryFn: async () => (addr ? (await connection.getBalance(publicKey!)) / 1e9 : null),
    enabled: !!addr,
    refetchInterval: 30_000,
  });

  const onPick = async (name: string) => {
    try {
      const emailSession = !!user?.email && !/@wallet\.orbitx\.app$/i.test(user.email);
      await signInWith(name, emailSession ? { connectOnly: true } : undefined);
      setPicker(false);
      toast.success(emailSession ? "Wallet connected" : "Signed in with wallet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  if (!connected || !addr) {
    return (
      <>
        <button type="button" onClick={() => setPicker(true)} className="ox-wallet-btn">
          <Wallet className="h-4 w-4" /> Connect
        </button>
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      </>
    );
  }
  return (
    <div className="ox-wallet-chip">
      <span className="ox-wallet-dot" />
      <div className="leading-none">
        <div className="pf-mono text-[11px] font-bold text-white">{shortAddr(addr)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-white/45">
          {sol != null ? `${sol.toFixed(3)} SOL` : "linked"}
        </div>
      </div>
      <button type="button" onClick={() => disconnect().catch(() => undefined)} className="ox-wallet-exit">
        Exit
      </button>
    </div>
  );
}

function EvmWalletButton() {
  const { account, linkedAddress, openConnect, disconnect } = useEvmWallet();
  const { publicKey } = useWallet();
  const shown = account || linkedAddress;
  useEffect(() => {
    const sol = publicKey?.toBase58();
    if (sol && account) linkEvmToSolana(sol, account);
  }, [publicKey, account]);
  if (!shown) {
    return (
      <button type="button" onClick={openConnect} className="ox-ghost-btn hidden md:inline-flex">
        <Link2 className="h-3.5 w-3.5" /> EVM
      </button>
    );
  }
  return (
    <div className="ox-wallet-chip hidden md:flex" data-tone="evm">
      <span className="ox-wallet-dot" style={{ background: "#627EEA", boxShadow: "0 0 8px #627EEA" }} />
      <div className="leading-none">
        <div className="pf-mono text-[11px] font-bold text-white">{shortAddr(shown)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-white/45">EVM</div>
      </div>
      <button type="button" onClick={disconnect} className="ox-wallet-exit">Unlink</button>
    </div>
  );
}

function NetworkStrip() {
  const tel = useChainTelemetry();
  const solUsd = useSolUsd();
  const ok = tel.data?.ok ?? false;
  return (
    <div className="ox-ticker">
      <div className="ox-ticker-track">
        {Array.from({ length: 2 }).map((_, dup) => (
          <span key={dup} className="inline-flex items-center gap-6 pf-mono text-[11px] uppercase tracking-wide">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[#3B82F6]" : "bg-[#ff4d6d]"}`} style={ok ? { boxShadow: "0 0 8px #3B82F6" } : undefined} />
              Solana {ok ? "live" : "degraded"}
            </span>
            <span>slot {fmtInt(tel.data?.slot)}</span>
            <span>{fmtInt(tel.data?.tps)} tps</span>
            <span>rpc {tel.data?.latencyMs != null ? `${tel.data.latencyMs}ms` : "—"}</span>
            <span>SOL ${solUsd.data ? solUsd.data.price.toFixed(2) : "—"}</span>
            {isLaunchFeePromoActive() ? (
              <span className="font-bold text-[#F0C75E]">★ FREE launches — {launchFeePromoDaysLeft()}d left</span>
            ) : (
              <span>{fmtUsd(ORBITX_FEE_USD)} launch · {(CREATOR_FEE_BPS / 100).toFixed(2)}% trade · {TRADE_FEE_CREATOR_SHARE_PCT}/{TRADE_FEE_PLATFORM_SHARE_PCT} split</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReferralCapture() {
  const [params] = useSearchParams();
  const { publicKey } = useWallet();
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    const ref = params.get("ref");
    if (ref) localStorage.setItem("orbitx_pending_referral", ref.toUpperCase());
  }, [params]);
  useEffect(() => {
    const wallet = publicKey?.toBase58();
    const pending = localStorage.getItem("orbitx_pending_referral");
    if (!wallet || !pending || attempted.current === wallet) return;
    attempted.current = wallet;
    redeemReferralCode(wallet, pending).finally(() => localStorage.removeItem("orbitx_pending_referral"));
  }, [publicKey]);
  return null;
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="ox-footer-col">
      <div className="ox-footer-col-title">{title}</div>
      <ul>
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to}>
              {label} <ChevronRight className="h-3 w-3 opacity-50" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LaunchpadFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="ox-footer">
      <div className="ox-footer-inner">
        <div>
          <div className="ox-footer-brand">Orbit<span>X</span></div>
          <p className="ox-footer-blurb">
            Launch, trade, claim, and rescue on Solana — black metal desk for new coins.
          </p>
          <div className="ox-footer-socials">
            <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" aria-label="X"><Twitter className="h-4 w-4" /></a>
            <a href="https://t.me/ogscan" target="_blank" rel="noreferrer" aria-label="Telegram"><Send className="h-4 w-4" /></a>
            <a href="https://github.com/audifyx/og-scan" target="_blank" rel="noreferrer" aria-label="GitHub"><Github className="h-4 w-4" /></a>
          </div>
        </div>
        <FooterCol title="Launchpad" links={[
          ["Board", "/orbitxlaunch"],
          ["Leaders", "/orbitxlaunch/leaderboard"],
          ["Portfolio", "/orbitxlaunch/portfolio"],
          ["About", "/orbitxlaunch/about"],
        ]} />
        <FooterCol title="Create & claim" links={[
          ["Create coin", "/orbitxlaunch/create"],
          ["Claim fees", "/orbitxlaunch/claim"],
          ["Rescue", "/orbitxlaunch/rescue"],
          ["Profile", "/orbitxlaunch/profile"],
        ]} />
        <FooterCol title="Company" links={[
          ["NFT Market", "/nft"],
          ["DEX", "/ORBITX_DEX"],
          ["Terms", "/terms"],
          ["Privacy", "/privacy"],
        ]} />
      </div>
      <div className="ox-footer-bar">
        <div className="ox-footer-bar-inner">
          <span>© {year} OrbitX. All rights reserved.</span>
          <span>
            {(CREATOR_FEE_BPS / 100).toFixed(2)}% trade fee · {TRADE_FEE_CREATOR_SHARE_PCT}/{TRADE_FEE_PLATFORM_SHARE_PCT} creator/platform · {fmtUsd(ORBITX_FEE_USD)} launch
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function LaunchpadLayout() {
  const { isAdmin } = useAdmin();
  return (
    <div className="lp-classic lp-classic relative flex min-h-screen flex-col">
      <ReferralCapture />
      <NetworkStrip />

      <header className="ox-launch-header sticky top-0 z-30">
        <div className="ox-shell-inner ox-launch-header-row">
          <Link to="/orbitxlaunch" className="ox-brand group shrink-0">
            <div className="ox-brand-mark">
              <Rocket className="h-4 w-4" strokeWidth={2.8} />
            </div>
            <div className="leading-tight">
              <div className="ox-brand-name">
                Orbit<span>X</span>
              </div>
              <div className="ox-brand-sub">launchpad</div>
            </div>
          </Link>

          <HeaderStats />

          <div className="ox-shell-actions shrink-0">
            <AntiVampProtectionBadge />
            <Link to="/orbitxlaunch/create" className="ox-create-cta">
              <Plus className="h-4 w-4" strokeWidth={3} />
              <span className="hidden sm:inline">Create coin</span>
              <span className="sm:hidden">Create</span>
            </Link>
            <EvmWalletButton />
            <WalletConsole />
          </div>
        </div>

        <div className="ox-launch-tabbar">
          <div className="ox-shell-inner">
            <TabRail isAdmin={!!isAdmin} />
          </div>
        </div>
      </header>

      <div className="ox-shell-main flex-1">
        <Outlet />
      </div>

      <LaunchpadFooter />
    </div>
  );
}
