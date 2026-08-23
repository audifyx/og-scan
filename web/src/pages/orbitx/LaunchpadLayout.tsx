// OrbitX Launchpad — iOS mobile + desktop web-app shell
import { AntiVampProtectionBadge } from "@/components/layout/AntiVampProtectionBadge";
import { NavLink, Outlet, Link, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { linkEvmToSolana } from "@/lib/orbitx/walletLink";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { toast } from "sonner";
import {
  Home, PlusCircle, Info, UserCircle2, HandCoins, Wallet, Flame, Trophy, Briefcase, ShieldCheck, Link2, Plus,
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
import { PlatformThemeButton } from "@/components/theme/PlatformThemeButton";
import { PlatformLinks } from "@/components/theme/PlatformDock";
import {
  IosAppShell,
  IosNav,
  IosTabBar,
  IosRailBrand,
  IosRailLink,
  type IosTabItem,
} from "@/components/app-shell/IosAppShell";
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

const MOBILE_TABS: IosTabItem[] = [
  { id: "board", to: "/orbitxlaunch", label: "Board", ico: "⌂", end: true },
  { id: "create", to: "/orbitxlaunch/create", label: "Create", ico: "✦" },
  { id: "claim", to: "/orbitxlaunch/claim", label: "Claim", ico: "◎" },
  { id: "bag", to: "/orbitxlaunch/portfolio", label: "Bag", ico: "▣" },
  { id: "you", to: "/orbitxlaunch/profile", label: "You", ico: "◉" },
];

const ROOT_PATHS = new Set([
  "/orbitxlaunch",
  "/orbitxlaunch/",
  "/orbitxlaunch/leaderboard",
  "/orbitxlaunch/create",
  "/orbitxlaunch/create/custom",
  "/orbitxlaunch/create/pump",
  "/orbitxlaunch/create/api",
  "/orbitxlaunch/create/curve",
  "/orbitxlaunch/create/nft",
  "/orbitxlaunch/claim",
  "/orbitxlaunch/rescue",
  "/orbitxlaunch/portfolio",
  "/orbitxlaunch/profile",
  "/orbitxlaunch/about",
  "/orbitxlaunch/ox-desk-m4k9q",
]);

function titleFor(pathname: string): string {
  if (pathname.startsWith("/orbitxlaunch/create/pump")) return "Pump launch";
  if (pathname.startsWith("/orbitxlaunch/create/custom")) return "Custom launch";
  if (pathname.startsWith("/orbitxlaunch/create/api")) return "API launch";
  if (pathname.startsWith("/orbitxlaunch/create/curve")) return "Curve launch";
  if (pathname.startsWith("/orbitxlaunch/create/nft")) return "NFT launch";
  if (pathname === "/orbitxlaunch/create" || pathname === "/orbitxlaunch/create/") return "Create";
  const flat = TAB_GROUPS.flatMap((g) => g.tabs);
  const hit = flat.find((t) =>
    t.end ? pathname === t.to || pathname === `${t.to}/` : pathname === t.to || pathname.startsWith(`${t.to}/`),
  );
  if (hit) return hit.label;
  if (pathname.includes("/ox-desk")) return "Desk";
  if (pathname.includes("/coin") || pathname.includes("/token")) return "Coin";
  return "Launchpad";
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
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-white">
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
      <button type="button" onClick={openConnect} className="ox-ghost-btn hidden lg:inline-flex">
        <Link2 className="h-3.5 w-3.5" /> EVM
      </button>
    );
  }
  return (
    <div className="ox-wallet-chip hidden lg:flex" data-tone="evm">
      <span className="ox-wallet-dot" style={{ background: "#627EEA", boxShadow: "0 0 8px #627EEA" }} />
      <div className="leading-none">
        <div className="pf-mono text-[11px] font-bold text-white">{shortAddr(shown)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-white">EVM</div>
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
    <div className="ox-ticker hidden md:block">
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
    <footer className="ox-footer hidden md:block">
      <div className="ox-footer-inner">
        <div>
          <div className="ox-footer-brand">Orbit<span>X</span></div>
          <p className="ox-footer-blurb">
            Launch, trade, claim, and rescue on Solana — black metal desk for new coins.
          </p>
          <div className="ox-footer-socials">
            <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" aria-label="X"><Twitter className="h-4 w-4" /></a>
            <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" aria-label="Telegram"><Send className="h-4 w-4" /></a>
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
          ["App Hub", "/app"],
          ["NFT Market", "/nft"],
          ["DEX", "/ORBITX_DEX"],
          ["Agent MCP", "/agent"],
          ["Social", "/orbitx-social"],
          ["Whitepaper", "/whitepaper"],
          ["Terms", "/terms"],
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
  const loc = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement | null>(null);
  const title = useMemo(() => titleFor(loc.pathname), [loc.pathname]);
  const normalized = loc.pathname.replace(/\/$/, "") || "/orbitxlaunch";
  const isRoot = ROOT_PATHS.has(normalized) || ROOT_PATHS.has(loc.pathname);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--ox-lp-header-h", `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--ox-lp-header-h");
    };
  }, [title, isRoot]);

  const rail = (
    <>
      <IosRailBrand href="/orbitxlaunch" title="OrbitX" subtitle="Launchpad" />
      {TAB_GROUPS.map((group) => (
        <div key={group.id} className="mb-2">
          <div className="ios-group__label px-2" style={{ margin: "0.5rem 0 0.25rem 0.35rem" }}>
            {group.label}
          </div>
          {group.tabs.map((t) => (
            <IosRailLink
              key={t.to}
              to={t.to}
              label={t.label}
              ico={<t.icon className="h-4 w-4" />}
              active={t.end ? loc.pathname === t.to || loc.pathname === `${t.to}/` : loc.pathname.startsWith(t.to)}
            />
          ))}
        </div>
      ))}
      {isAdmin && (
        <IosRailLink
          to="/orbitxlaunch/ox-desk-m4k9q"
          label="Desk"
          ico={<ShieldCheck className="h-4 w-4" />}
          active={loc.pathname.includes("ox-desk")}
        />
      )}
      <div className="mt-auto pt-4">
        <PlatformLinks className="ox-platform-links--compact flex-col !items-stretch" />
      </div>
    </>
  );

  return (
    <IosAppShell accent="gold" wide className="lp-classic lp-ios">
      <div className="lp-ios-frame">
        <aside className="lp-ios-rail" aria-label="Launchpad">
          {rail}
        </aside>

        <div className="lp-ios-main">
          <ReferralCapture />
          <NetworkStrip />

          <header ref={headerRef}>
            <IosNav
              title={title}
              canBack={!isRoot}
              onBack={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate("/orbitxlaunch");
              }}
              trail={
                <>
                  <PlatformLinks className="ox-platform-links--compact hidden xl:flex" />
                  <PlatformThemeButton compact />
                  <AntiVampProtectionBadge />
                  <Link to="/orbitxlaunch/create" className="ios-nav__btn hidden sm:inline-flex" title="Create">
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </Link>
                  <EvmWalletButton />
                  <WalletConsole />
                </>
              }
            />

            {/* Desktop secondary strip — section tabs */}
            <div className="ox-launch-tabbar lp-ios-desk-tabs">
              <div className="ox-shell-inner">
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
              </div>
            </div>
          </header>

          <div className="ox-shell-main flex-1 lp-ios-body">
            {!isRoot ? null : (
              <h2 className="ios-large-title px-4 pt-2 md:hidden">{title}</h2>
            )}
            <Outlet />
          </div>

          <LaunchpadFooter />
          <IosTabBar tabs={MOBILE_TABS} pathname={loc.pathname} className="lp-ios-tabbar" />
          <div className="ios-home-ind" aria-hidden />
        </div>
      </div>
    </IosAppShell>
  );
}
