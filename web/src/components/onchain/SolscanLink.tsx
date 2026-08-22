import { ExternalLink } from "lucide-react";
import { solscanTokenUrl, solscanTxUrl } from "../../../shared/orbitx-onchain.js";
import { cn } from "@/lib/utils";

type Props = {
  signature?: string | null;
  mint?: string | null;
  cluster?: string;
  className?: string;
  children?: React.ReactNode;
};

export function SolscanLink({ signature, mint, cluster, className, children }: Props) {
  const href = signature ? solscanTxUrl(signature, cluster) : mint ? solscanTokenUrl(mint, cluster) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1 text-[#60A5FA] hover:underline", className)}
    >
      {children || "View on Solscan ↗"}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
