import { useNavigate } from "react-router-dom";
import { useCredits } from "@/hooks/useCredits";
import { DollarSign, RefreshCw, TrendingUp, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CreditBalanceProps {
  compact?: boolean;
  className?: string;
}

export const CreditBalance = ({ compact = false, className }: CreditBalanceProps) => {
  const navigate = useNavigate();
  const { credits, loading, getUsagePercentage, getRemainingCredits, getDaysUntilReset } = useCredits();

  if (loading) {
    return (
      <div className={cn("animate-pulse bg-muted rounded-xl h-10", className)} />
    );
  }

  if (!credits) return null;

  const remaining = getRemainingCredits();
  const percentage = getUsagePercentage();
  const daysUntilReset = getDaysUntilReset();

  const formatBalance = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  if (compact) {
    return (
      <div 
        className={cn(
          "flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 cursor-pointer hover:from-primary/15 hover:to-primary/10 transition-all",
          className
        )}
        onClick={() => navigate("/credits")}
      >
        <div className="p-1 rounded-lg bg-primary/20">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-bold font-mono text-primary">{formatBalance(remaining)}</span>
        <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-6 rounded-2xl glass-card-premium", className)}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Available Credits</p>
            <p className="text-3xl font-bold font-mono gradient-text">{formatBalance(remaining)}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>Renews in <span className="text-foreground font-medium">{daysUntilReset}</span> days</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Used: <span className="font-mono text-foreground">{formatBalance(credits.used_credits)}</span></span>
          <span className="text-primary font-medium">{percentage.toFixed(0)}% remaining</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary via-primary/80 to-secondary rounded-full transition-all duration-700"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
