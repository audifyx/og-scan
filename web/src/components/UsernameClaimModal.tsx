import { FormEvent, useEffect, useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { needsUsernameClaim, validateClaimUsername } from "@/lib/usernameClaim";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * Prompts wallet-login users to pick a real username (wallet-auth seeds a
 * temporary first4+last4 stub). Saves to profiles via updateProfile.
 */
export function UsernameClaimModal({
  open,
  onClose,
  required = false,
}: {
  open: boolean;
  onClose: () => void;
  /** When true, backdrop click / cancel is disabled until they save. */
  required?: boolean;
}) {
  const { user, profile, updateProfile } = useAuth();
  const { publicKey } = useWallet();
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seed = profile?.username && !needsUsernameClaim(profile.username, publicKey?.toBase58())
      ? profile.username
      : "";
    setValue(seed);
    setAvailable(null);
  }, [open, profile?.username, publicKey]);

  useEffect(() => {
    if (!open) return;
    const parsed = validateClaimUsername(value, user?.email);
    if (!parsed.ok) {
      setAvailable(null);
      return;
    }
    let live = true;
    setChecking(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, user_id")
        .eq("username", parsed.username)
        .maybeSingle();
      if (!live) return;
      setChecking(false);
      if (error) {
        setAvailable(null);
        return;
      }
      // Available if unused, or already owned by this user
      setAvailable(!data || data.user_id === user?.id);
    }, 280);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value, open, user?.email, user?.id]);

  if (!open) return null;

  const parsed = validateClaimUsername(value, user?.email);
  const canSave = parsed.ok && available === true && !saving;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    if (available === false) {
      toast.error("That username is taken");
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({ username: parsed.username });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Couldn't save username");
      return;
    }
    toast.success(`Welcome, @${parsed.username}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!required) onClose();
        }}
      />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#060b14] p-5 shadow-2xl"
      >
        <div className="mb-1 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-og-cyan">
          <UserRound className="h-3.5 w-3.5" /> Choose your username
        </div>
        <h2 className="text-xl font-black text-white">What should we call you?</h2>
        <p className="mt-1.5 text-[13px] text-white/55">
          This saves to your OrbitX profile and shows in City, chat, social, and lobbies.
        </p>

        <label className="mt-4 block text-[11px] uppercase tracking-widest text-white/45">
          Username
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
            <span className="text-og-lime">@</span>
            <input
              autoFocus
              value={value}
              maxLength={24}
              onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="yourname"
              className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
            {checking && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
          </div>
        </label>

        <div className="mt-2 min-h-[1.1rem] text-[12px]">
          {!parsed.ok && value.length > 0 && <span className="text-og-blood">{parsed.error}</span>}
          {parsed.ok && available === false && <span className="text-og-blood">Taken — try another</span>}
          {parsed.ok && available === true && <span className="text-og-lime">Available</span>}
        </div>

        <div className="mt-4 flex gap-2">
          {!required && (
            <button
              type="button"
              className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/[0.04]"
              onClick={onClose}
            >
              Later
            </button>
          )}
          <button
            type="submit"
            disabled={!canSave}
            className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl bg-og-cyan px-3 py-2.5 text-sm font-black text-black disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save username
          </button>
        </div>
      </form>
    </div>
  );
}

/** Always-on gate: open claim modal when the signed-in profile still has a stub name. */
export function UsernameClaimGate() {
  const { user, profile, loading } = useAuth();
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile) {
      setOpen(false);
      return;
    }
    const wallet =
      publicKey?.toBase58() ||
      (profile as { sol_wallet?: string | null }).sol_wallet ||
      (user.user_metadata?.wallet as string | undefined) ||
      null;
    setOpen(needsUsernameClaim(profile.username, wallet));
  }, [loading, user, profile, publicKey]);

  return <UsernameClaimModal open={open} onClose={() => setOpen(false)} required />;
}
