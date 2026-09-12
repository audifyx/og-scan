import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { AuthSheet } from "@/components/launchpad/AuthSheet";
import { useLaunchpadIdentity } from "@/hooks/useLaunchpadIdentity";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { canLaunch } from "@/lib/launchpad";
import { TabHero } from "./TabHero";

export default function LaunchpadConnectWallet() {
  const nav = useNavigate();
  const { identity, ready, conflict } = useLaunchpadIdentity();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [picker, setPicker] = useState(false);

  return (
    <div className="mx-auto max-w-xl">
      <TabHero
        icon={Wallet}
        accent="gold"
        eyebrow="Step B · prove wallet"
        title="Connect wallet"
        subtitle="X plus a connected wallet. A session with only X cannot launch."
      />
      <AuthSheet
        identity={identity}
        connectingWallet={!!busy}
        onConnectWallet={() => setPicker(true)}
      />
      {conflict && <p className="lp-preview-warn">{conflict}</p>}
      {ready && (
        <button type="button" className="lp-launch-btn mt-4" onClick={() => nav("/orbitxlaunch/create")}>
          Continue to launch
        </button>
      )}
      {!canLaunch(identity) && (
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest">
          <Link to="/orbitxlaunch" className="text-[#E8C547]">Back to board</Link>
        </p>
      )}
      <WalletPickerModal
        open={picker}
        onClose={() => setPicker(false)}
        wallets={pickable}
        onPick={async (name) => {
          try {
            await signInWith(name);
            setPicker(false);
            toast.success("Wallet proved");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Sign-in failed");
          }
        }}
        busy={busy}
      />
    </div>
  );
}
