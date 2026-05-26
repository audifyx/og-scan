import { useCallback } from "react";

/**
 * useCredits — STUBBED
 * Credits have been removed from the platform. 
 * This hook now returns values that allow all actions for free.
 */

export const useCredits = () => {
  const spendCredits = useCallback(async (_toolKey: string, _description?: string): Promise<boolean> => {
    return true;
  }, []);

  const canAfford = useCallback((_toolKey: string): boolean => {
    return true;
  }, []);

  return {
    credits: {
      total_credits: 10000,
      used_credits: 0,
      next_reset_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
    transactions: [],
    loading: false,
    todayUsed: 0,
    dailyLimit: 10000,
    spendCredits,
    canAfford,
    getRemainingCredits: () => 10000,
    getDailyRemaining: () => 10000,
    getUsagePercentage: () => 100,
    getDaysUntilReset: () => 30,
    refreshCredits: () => {},
    refreshTransactions: () => {},
  };
};
