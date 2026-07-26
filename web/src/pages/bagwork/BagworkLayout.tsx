import { Link, NavLink, Outlet } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Briefcase, Wallet, ListTodo, ShieldCheck, ClipboardList, ChevronRight,
  Twitter, Send, Github, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import "./bagwork.css";

function shortAddr(a: string, n = 4) {
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

function WalletBar() {
  const { publicKey, connected, disconnect } = useWallet();
  const { user } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);
  const addr = publicKey?.toBase58();

  const onPick = async (name: string) => {
    try {
      const emailSession = !!user?.email && !/@wallet\.orbitx\.app$/i.test(user.email);
      await signInWith(name, emailSession ? { connectOnly: true } : undefined);
      setPicker(false);
      toast.success(emailSession ? "Wallet connected" : "Signed in with wallet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connect failed");
    }
  };

  if (!connected || !addr) {
    return (
      <>
        <button type="button" className="bw-wallet-btn" onClick={() => setPicker(true)}>
          <Wallet className="h-4 w-4" /> Connect
        </button>
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      </>
    );
  }

  return (
    <div className="bw-wallet-chip">
      <span className="bw-wallet-dot" />
      <div className="leading-none">
        <div className="font-mono text-[11px] font-bold">{shortAddr(addr)}</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[#A8B0BC]">sol</div>
      </div>
      <button
        type="button"
        className="font-mono text-[9px] uppercase tracking-widest text-[#A8B0BC] hover:text-white"
        onClick={() => disconnect().catch(() => undefined)}
      >
        Exit
      </button>
    </div>
  );
}

function TabRail({ showAdmin }: { showAdmin: boolean }) {
  return (
    <nav className="bw-tabs-wrap" aria-label="Bagwork">
      <NavLink to="/bagwork" end className={({ isActive }) => cn("bw-tab", isActive && "bw-tab--on")}>
        <ListTodo className="h-3.5 w-3.5" /> Tasks
      </NavLink>
      <NavLink to="/bagwork/my" className={({ isActive }) => cn("bw-tab", isActive && "bw-tab--on")}>
        <ClipboardList className="h-3.5 w-3.5" /> My work
      </NavLink>
      {showAdmin && (
        <NavLink to="/bagwork/admin" className={({ isActive }) => cn("bw-tab", isActive && "bw-tab--on")}>
          <ShieldCheck className="h-3.5 w-3.5" /> Admin
        </NavLink>
      )}
      <NavLink to="/orbitxlaunch" className="bw-tab">
        <Rocket className="h-3.5 w-3.5" /> Launchpad
      </NavLink>
    </nav>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="bw-footer-col">
      <div className="bw-footer-col-title">{title}</div>
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

function BagworkFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bw-footer">
      <div className="bw-footer-inner">
        <div>
          <div className="bw-footer-brand">Bag<span>work</span></div>
          <p className="bw-footer-blurb">
            Collect task cards, complete work, earn USDC on Solana — same metal desk as OrbitX Launchpad.
          </p>
          <div className="bw-footer-socials">
            <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" aria-label="X"><Twitter className="h-4 w-4" /></a>
            <a href="https://t.me/ogscan" target="_blank" rel="noreferrer" aria-label="Telegram"><Send className="h-4 w-4" /></a>
            <a href="https://github.com/audifyx/og-scan" target="_blank" rel="noreferrer" aria-label="GitHub"><Github className="h-4 w-4" /></a>
          </div>
        </div>
        <FooterCol title="Bagwork" links={[
          ["Task board", "/bagwork"],
          ["My submissions", "/bagwork/my"],
        ]} />
        <FooterCol title="OrbitX" links={[
          ["Launchpad", "/orbitxlaunch"],
          ["NFT Market", "/nft"],
          ["DEX", "/ORBITX_DEX"],
        ]} />
        <FooterCol title="Company" links={[
          ["App hub", "/app"],
          ["Terms", "/terms"],
          ["Privacy", "/privacy"],
        ]} />
      </div>
      <div className="bw-footer-bar">
        <div className="bw-footer-bar-inner">
          <span>© {year} OrbitX Bagwork</span>
          <span>USDC · Solana · wallet login</span>
        </div>
      </div>
    </footer>
  );
}

export default function BagworkLayout() {
  const { isAdmin, isOwnerIdentity } = useAdmin();
  const showAdmin = isAdmin || isOwnerIdentity;

  return (
    <div className="bw-shell">
      <header className="bw-header">
        <div className="bw-header-inner">
          <Link to="/bagwork" className="bw-brand">
            <div className="bw-brand-mark">
              <Briefcase className="h-4 w-4" strokeWidth={2.6} />
            </div>
            <div>
              <div className="bw-brand-name">Bag<span>work</span></div>
              <div className="bw-brand-sub">earn USDC</div>
            </div>
          </Link>

          <div className="bw-tabs-desktop">
            <TabRail showAdmin={showAdmin} />
          </div>

          <div className="bw-header-actions">
            <WalletBar />
          </div>
        </div>
      </header>

      <div className="bw-tabs-mobile">
        <TabRail showAdmin={showAdmin} />
      </div>

      <main className="bw-main">
        <Outlet />
      </main>

      <BagworkFooter />
    </div>
  );
}
