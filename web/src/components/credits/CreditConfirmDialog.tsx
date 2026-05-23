import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditToolKey, CREDIT_PRICING, formatCreditCost } from "@/lib/credit-pricing";
import { DollarSign, AlertTriangle } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

interface CreditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolKey: CreditToolKey;
  onConfirm: () => void;
  description?: string;
}

export const CreditConfirmDialog = ({
  open,
  onOpenChange,
  toolKey,
  onConfirm,
  description,
}: CreditConfirmDialogProps) => {
  const { getRemainingCredits } = useCredits();
  const toolInfo = CREDIT_PRICING[toolKey];
  const remaining = getRemainingCredits();

  if (!toolInfo) return null;

  const isExpensive = toolInfo.cost >= 1.0;
  const willLeaveLowCredits = (remaining - toolInfo.cost) < (remaining * 0.2);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isExpensive && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            Confirm Credit Usage
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                This action will use credits from your account:
              </p>
              
              <div className="p-4 rounded-lg bg-white/[0.04] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{toolInfo.name}</span>
                  <span className="font-mono font-bold text-primary">
                    {formatCreditCost(toolInfo.cost)}
                  </span>
                </div>
                
                {description && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2">
                    {description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span>Your balance after:</span>
                <span className={willLeaveLowCredits ? "text-amber-500" : "text-muted-foreground"}>
                  ${(remaining - toolInfo.cost).toFixed(2)}
                </span>
              </div>

              {willLeaveLowCredits && (
                <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 p-2 rounded">
                  <AlertTriangle className="h-3 w-3" />
                  This will leave you with low credits
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="gap-2">
            <DollarSign className="h-4 w-4" />
            Spend {formatCreditCost(toolInfo.cost)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
