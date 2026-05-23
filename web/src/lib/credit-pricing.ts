// Credit pricing configuration
// Users get 10,000 credits per month with 6,500 usable cap

export const CREDIT_PRICING = {
  // AI Tasks
  'wallet-breakdown': { cost: 8, category: 'AI Tasks', name: 'Wallet Breakdown' },
  'token-deep-dive': { cost: 10, category: 'AI Tasks', name: 'Token Deep Dive' },
  'whale-tracker': { cost: 6, category: 'AI Tasks', name: 'Whale Tracker Query' },
  'insider-detector': { cost: 12, category: 'AI Tasks', name: 'Insider Detector' },
  'behavior-analysis': { cost: 12, category: 'AI Tasks', name: 'Full Behavior Analysis' },
  'ai-chat': { cost: 2, category: 'AI Tasks', name: 'AI Chat Message' },
  'wallet-analyzer': { cost: 10, category: 'AI Tasks', name: 'Wallet Analyzer' },
  'rug-detector': { cost: 8, category: 'AI Tasks', name: 'Rug Detector Scan' },
  'risk-detector': { cost: 7, category: 'AI Tasks', name: 'Risk Detection' },
  'ai-token-analysis': { cost: 5, category: 'AI Tasks', name: 'AI Token Analysis' },
  // Visual & Media
  'pnl-image': { cost: 12, category: 'Visual & Media', name: 'PnL Image Generator' },
  'wallet-heatmap': { cost: 10, category: 'Visual & Media', name: 'Wallet Heatmap Visual' },
  'multi-wallet-graph': { cost: 10, category: 'Visual & Media', name: 'Multi-Wallet Graph Map' },
  'shareable-card': { cost: 8, category: 'Visual & Media', name: 'Shareable Card Generator' },
  // Discovery & Tracking
  'wallet-profiler-refresh': { cost: 1, category: 'Discovery & Tracking', name: 'Wallet Profiler Refresh' },
  'liquidity-scan': { cost: 3, category: 'Discovery & Tracking', name: 'Liquidity Scan' },
  'holder-distribution': { cost: 4, category: 'Discovery & Tracking', name: 'Holder Distribution' },
  'multi-wallet-sync': { cost: 2, category: 'Discovery & Tracking', name: 'Multi-Wallet Sync' },
  'token-creator-tracker': { cost: 5, category: 'Discovery & Tracking', name: 'Token Creator Tracker' },
  'jupiter-route': { cost: 3, category: 'Discovery & Tracking', name: 'Jupiter Route Tracker' },
  'lp-position-scan': { cost: 5, category: 'Discovery & Tracking', name: 'LP Position Scanner' },
  'mev-tracker': { cost: 6, category: 'Discovery & Tracking', name: 'MEV Tracker' },
  'fee-analyzer': { cost: 2, category: 'Discovery & Tracking', name: 'Fee Analyzer' },
  'stake-tracker': { cost: 3, category: 'Discovery & Tracking', name: 'Stake Account Tracker' },
  'airdrop-analyzer': { cost: 4, category: 'Discovery & Tracking', name: 'Airdrop Analyzer' },
  'wash-trading-scan': { cost: 8, category: 'Discovery & Tracking', name: 'Wash Trading Scanner' },
  'profit-curve': { cost: 6, category: 'Discovery & Tracking', name: 'Profit Curve Generator' },
  'liquidity-sniper': { cost: 5, category: 'Discovery & Tracking', name: 'Liquidity Sniper' },
  'whale-concentration': { cost: 4, category: 'Discovery & Tracking', name: 'Whale Concentration' },
  'sol-depletion': { cost: 2, category: 'Discovery & Tracking', name: 'SOL Depletion Warning' },
  'wallet-age': { cost: 1, category: 'Discovery & Tracking', name: 'Wallet Age Calculator' },
  'trading-style': { cost: 6, category: 'Discovery & Tracking', name: 'Trading Style Classifier' },
  'transfer-profiler': { cost: 4, category: 'Discovery & Tracking', name: 'Transfer Profiler' },
  'token-metadata': { cost: 2, category: 'Discovery & Tracking', name: 'Token Metadata Inspector' },
  'burn-watcher': { cost: 3, category: 'Discovery & Tracking', name: 'Burn Watcher' },
  'token-lock-monitor': { cost: 3, category: 'Discovery & Tracking', name: 'Token Lock Monitor' },
  'program-interaction': { cost: 4, category: 'Discovery & Tracking', name: 'Program Interaction Monitor' },
  'wallet-relationship': { cost: 10, category: 'Discovery & Tracking', name: 'Wallet Relationship Graph' },
  // Trading Tools
  'token-sniper': { cost: 6, category: 'Trading', name: 'Token Sniper' },
  'staking-calculator': { cost: 1, category: 'Trading', name: 'Staking Calculator' },
  'impermanent-loss': { cost: 2, category: 'Trading', name: 'Impermanent Loss Calculator' },
  // Free
  'basic-lookup': { cost: 0, category: 'Free', name: 'Basic Wallet Lookup' },
  'price-check': { cost: 0, category: 'Free', name: 'Price Check' },
} as const;

export type CreditToolKey = keyof typeof CREDIT_PRICING;

export const MONTHLY_CREDIT_ALLOWANCE = 10000;
export const DAILY_USAGE_ALLOWANCE = 6500;
export const RESET_PERIOD_DAYS = 31;

export const TOOL_NAME_TO_KEY: Record<string, CreditToolKey> = {
  'Token Sniper': 'token-sniper',
  'Wallet Profiler': 'wallet-profiler-refresh',
  'Jupiter Routes': 'jupiter-route',
  'Liquidity Sniper': 'liquidity-sniper',
  'Profit Curve': 'profit-curve',
  'Trading Style': 'trading-style',
  'Holder Analysis': 'holder-distribution',
  'Liquidity Scanner': 'liquidity-scan',
  'Token Metadata': 'token-metadata',
  'Whale Concentration': 'whale-concentration',
  'Wash Trading': 'wash-trading-scan',
  'Insider Detector': 'insider-detector',
  'Staking Calculator': 'staking-calculator',
  'Impermanent Loss': 'impermanent-loss',
  'LP Scanner': 'lp-position-scan',
  'Program Monitor': 'program-interaction',
  'Fee Analyzer': 'fee-analyzer',
  'Token Locks': 'token-lock-monitor',
  'Rug Detector': 'rug-detector',
  'Risk Detector': 'risk-detector',
  'Token Creator': 'token-creator-tracker',
  'Burn Watcher': 'burn-watcher',
  'MEV Tracker': 'mev-tracker',
  'SOL Depletion': 'sol-depletion',
  'Wallet Age': 'wallet-age',
  'Transfer Profiler': 'transfer-profiler',
  'Wallet Graph': 'wallet-relationship',
  'Stake Tracker': 'stake-tracker',
  'Airdrop Analyzer': 'airdrop-analyzer',
  'Multi-Wallet': 'multi-wallet-sync',
  'AI Chat': 'ai-chat',
  'Wallet Analyzer': 'wallet-analyzer',
};

export const formatCreditCost = (cost: number): string => {
  if (cost === 0) return 'Free';
  if (cost >= 1000) return `${(cost / 1000).toFixed(1)}K`;
  return `${cost}`;
};

export const groupPricingByCategory = () => {
  const grouped: Record<string, { key: string; name: string; cost: number }[]> = {};
  Object.entries(CREDIT_PRICING).forEach(([key, value]) => {
    if (!grouped[value.category]) grouped[value.category] = [];
    grouped[value.category].push({ key, name: value.name, cost: value.cost });
  });
  Object.keys(grouped).forEach(cat => grouped[cat].sort((a, b) => b.cost - a.cost));
  return grouped;
};
