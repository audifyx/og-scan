// Global sign-in control. Drop it at the top of any page:
// signed-out -> /auth email login; signed-in -> account menu.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Settings, Wallet, ChevronDown, Loader2, Image, GitMerge } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { MergeAccountModal } from "@/components/MergeAccountModal";
import { UsernameClaimModal } from "@/components/UsernameClaimModal";
import { needsUsernameClaim } from "@/lib/usernameClaim";
import { cn } from "@/lib/utils";

export function WalletConnectButton() {
  const { user, profile, signOut, loading } = useAuth();
  const { disconnect, publicKey } = useWallet();
  const navigate = useNavigate();
  const [merge, setMerge] = useState(false);
  const [menu, setMenu] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const doSignOut = async () => {
    await signOut().catch(() => {});
    await disconnect().catch(() => {});
    setMenu(false);
  };

  const walletPk =
    publicKey?.toBase58() ||
    (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
    (user?.user_metadata?.wallet as string | undefined) ||
    null;
  const needsName = needsUsernameClaim(profile?.username, walletPk);

  if (loading) {
    return (
      <div className="inline-flex h-10 items-center px-3">
        <Loader2 className="h-4 w-4 animate-spin text-og-cyan" />
      </div>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => navigate("/auth")}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-og-cyan/40 bg-og-cyan/10 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-og-cyan transition hover:border-og-cyan hover:bg-og-cyan/20 sm:px-4"
      >
        <Wallet className="h-3.5 w-3.5" /> Sign in
      </button>
    );
  }

  const username = needsName ? "set-username" : (profile?.username ?? "wallet");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenu((p) => !p)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-og-lime/40 bg-og-lime/10 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-og-lime transition hover:border-og-lime hover:bg-og-lime/20 sm:px-4"
      >
        <User className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">@{username}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", menu && "rotate-180")} />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
          <div className="absolute right-0 top-12 z-50 min-w-[190px] overflow-hidden rounded-2xl border border-white/10 bg-[#020915]/95 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</p>
              <p className="mt-0.5 font-mono text-xs font-bold text-og-lime">@{username}</p>
            </div>
            <div className="py-1">
              {needsName && (
                <button
                  type="button"
                  onClick={() => {
                    setClaimOpen(true);
                    setMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-og-cyan transition hover:bg-white/[0.05]"
                >
                  <User className="h-3.5 w-3.5" /> Set username
                </button>
              )}
              {[
                { icon: Image, label: "NFT Market", path: "/nft" },
                { icon: Wallet, label: "Wallets", path: "/wallets" },
                { icon: Settings, label: "Settings", path: "/settings" },
              ].map(({ icon: Icon, label, path }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => {
                    navigate(path);
                    setMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white/70 transition hover:bg-white/[0.05] hover:text-og-lime"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 py-1">
              <button
                type="button"
                onClick={() => {
                  setMerge(true);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-og-gold transition hover:bg-og-gold/10"
              >
                <GitMerge className="h-3.5 w-3.5" /> Merge old account
              </button>
              <button
                type="button"
                onClick={doSignOut}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-og-blood transition hover:bg-og-blood/10"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}
      <MergeAccountModal open={merge} onClose={() => setMerge(false)} />
      <UsernameClaimModal open={claimOpen} required={needsName} onClose={() => setClaimOpen(false)} />
    </div>
  );
}

export default WalletConnectButton;
