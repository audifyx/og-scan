import { CreditToolKey, CREDIT_PRICING, formatCreditCost } from "@/lib/credit-pricing";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditCostLabelProps {
  toolKey: CreditToolKey;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export const CreditCostLabel = ({ 
  toolKey, 
  className,
  showIcon = true,
  size = "sm"
}: CreditCostLabelProps) => {
  const toolInfo = CREDIT_PRICING[toolKey];
  if (!toolInfo) return null;

  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20",
      size === "sm" ? "text-xs" : "text-sm",
      className
    )}>
      {showIcon && <DollarSign className={cn("text-primary", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />}
      <span className="font-medium text-primary">
        {formatCreditCost(toolInfo.cost)}
      </span>
    </div>
  );
};
