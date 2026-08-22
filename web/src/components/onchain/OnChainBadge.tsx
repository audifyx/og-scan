import { ShieldCheck } from "lucide-react";
import { SolscanLink } from "./SolscanLink";
import { cn } from "@/lib/utils";

export function OnChainBadge({
  signature,
  label = "Verified on-chain",
  className,
}: {
  signature?: string | null;
  label?: string;
  className?: string;
}) {
  if (!signature) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-[#60A5FA]/40 bg-[#60A5FA]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#60A5FA]", className)}>
      <ShieldCheck className="h-3 w-3" />
      {label}
      <SolscanLink signature={signature} className="text-[10px] text-[#60A5FA]" />
    </span>
  );
}
