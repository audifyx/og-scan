import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { CREDIT_PRICING, MONTHLY_CREDIT_ALLOWANCE, DAILY_USAGE_ALLOWANCE, type CreditToolKey, formatCreditCost } from "@/lib/credit-pricing";

interface UserCredits {
  id: string;
  user_id: string;
  total_credits: number;
  used_credits: number;
  last_reset_at: string;
  next_reset_at: string;
}

interface CreditTransaction {
  id: string;
  tool_name: string;
  tool_category: string;
  cost: number;
  description: string | null;
  created_at: string;
}

export const useCredits = () => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [todayUsed, setTodayUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!user) { setCredits(null); setLoading(false); return; }
    try {
      const { data, error } = await supabase.from("user_credits").select("*").eq("user_id", user.id).single();
      if (error && error.code === "PGRST116") {
        const { data: newCredits, error: ie } = await supabase
          .from("user_credits")
          .insert({ user_id: user.id, total_credits: MONTHLY_CREDIT_ALLOWANCE, used_credits: 0 })
          .select().single();
        if (ie) throw ie;
        setCredits(newCredits);
      } else if (error) {
        throw error;
      } else {
        const now = new Date();
        if (data?.next_reset_at && now >= new Date(data.next_reset_at)) {
          const { data: reset } = await supabase.from("user_credits")
            .update({ total_credits: MONTHLY_CREDIT_ALLOWANCE, used_credits: 0, last_reset_at: now.toISOString(), next_reset_at: new Date(now.getTime() + 31 * 86400000).toISOString() })
            .eq("user_id", user.id).select().single();
          setCredits(reset);
          toast.success("Credits Renewed! 🎉", { description: `Reset to ${formatCreditCost(MONTHLY_CREDIT_ALLOWANCE)}` });
        } else {
          setCredits(data);
        }
      }
    } catch (e) { console.error("credits fetch:", e); }
    finally { setLoading(false); }
  }, [user?.id]);

  const fetchTransactions = useCallback(async (limit = 50) => {
    if (!user) return;
    const { data } = await supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
    setTransactions(data ?? []);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    setTodayUsed((data ?? []).filter(tx => new Date(tx.created_at) >= today).reduce((s, tx) => s + tx.cost, 0));
  }, [user?.id]);

  const spendCredits = useCallback(async (_toolKey: CreditToolKey, _description?: string): Promise<boolean> => { return true; }, []);

  const canAfford = useCallback((_toolKey: CreditToolKey): boolean => { return true; }, []);

  const getRemainingCredits = useCallback(() => credits ? credits.total_credits - credits.used_credits : 0, [credits]);
  const getDailyRemaining = useCallback(() => Math.max(0, DAILY_USAGE_ALLOWANCE - todayUsed), [todayUsed]);
  const getUsagePercentage = useCallback(() => credits ? ((credits.total_credits - credits.used_credits) / credits.total_credits) * 100 : 0, [credits]);
  const getDaysUntilReset = useCallback(() => {
    if (!credits) return 31;
    return Math.max(0, Math.ceil((new Date(credits.next_reset_at).getTime() - Date.now()) / 86400000));
  }, [credits]);

  useEffect(() => { void fetchCredits(); }, [fetchCredits]);
  useEffect(() => { if (credits) void fetchTransactions(); }, [credits?.id, fetchTransactions]);

  return { credits, transactions, loading, todayUsed, dailyLimit: DAILY_USAGE_ALLOWANCE, spendCredits, canAfford, getRemainingCredits, getDailyRemaining, getUsagePercentage, getDaysUntilReset, refreshCredits: fetchCredits, refreshTransactions: fetchTransactions };
};
