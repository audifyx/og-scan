import { Link, NavLink, Outlet } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Briefcase, Wallet, ListTodo, ShieldCheck } from "lucide-react";
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
        <button type="button" className="bw-btn-ghost bw-btn" onClick={() => setPicker(true)}>
          <Wallet className="h-4 w-4" /> Connect
        </button>
        <WalletPickerModal open={picker} onClose={() => setPicker(false)} wallets={pickable} onPick={onPick} busy={busy} />
      </>
    );
  }

  return (
    <div className="bw-wallet-chip">
      <span className="bw-wallet-dot" />
      <span className="font-mono text-[11px] font-bold">{shortAddr(addr)}</span>
      <button type="button" className="text-[9px] uppercase tracking-widest text-[#A8B0BC] hover:text-white" onClick={() => disconnect().catch(() => undefined)}>
        Exit
      </button>
    </div>
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
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <div className="bw-brand-name">Bagwork</div>
              <div className="bw-brand-sub">earn USDC</div>
            </div>
          </Link>

          <nav className="bw-nav hidden sm:flex">
            <NavLink to="/bagwork" end className={({ isActive }) => cn(isActive && "bw-nav--on")}>
              <ListTodo className="h-3.5 w-3.5" /> Tasks
            </NavLink>
            <NavLink to="/bagwork/my" className={({ isActive }) => cn(isActive && "bw-nav--on")}>
              My work
            </NavLink>
            {showAdmin && (
              <NavLink to="/bagwork/admin" className={({ isActive }) => cn(isActive && "bw-nav--on")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </NavLink>
            )}
          </nav>

          <WalletBar />
        </div>
      </header>

      <nav className="flex gap-2 border-b border-white/10 px-4 py-2 sm:hidden">
        <NavLink to="/bagwork" end className={({ isActive }) => cn("bw-btn flex-1 !py-2 text-[10px]", !isActive && "bw-btn-ghost")}>Tasks</NavLink>
        <NavLink to="/bagwork/my" className={({ isActive }) => cn("bw-btn flex-1 !py-2 text-[10px]", !isActive && "bw-btn-ghost")}>My work</NavLink>
        {showAdmin && (
          <NavLink to="/bagwork/admin" className={({ isActive }) => cn("bw-btn flex-1 !py-2 text-[10px]", !isActive && "bw-btn-ghost")}>Admin</NavLink>
        )}
      </nav>

      <main className="bw-main">
        <Outlet />
      </main>
    </div>
  );
}
