import { WalletConnectButton } from "@/components/WalletConnectButton";
import { cn } from "@/lib/utils";

/** Shared wallet entry for blockchain-backed surfaces. */
export function WalletButton({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center", className)}>
      <WalletConnectButton />
    </div>
  );
}
