import { Link } from "react-router-dom";
import { short } from "../lib/api";
import { Wallet } from "lucide-react";

// Clickable wallet address -> opens the wallet portfolio page.
export default function WalletLink({ address, display, className = "", icon = true }: { address?: string | null; display?: string; className?: string; icon?: boolean }) {
  if (!address) return <span className="text-muted">—</span>;
  return (
    <Link to={`/wallet/${address}`} onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 font-mono hover:text-accent transition-colors ${className}`} title="View wallet holdings">
      {icon && <Wallet className="w-3 h-3 opacity-60" />}{display ?? short(address)}
    </Link>
  );
}
