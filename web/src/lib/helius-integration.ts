// FILE: web/src/lib/helius-integration.ts
// Complete Helius integration for fetching all transaction data

import { supabase } from '@/lib/supabase';

const HELIUS_API_KEY = process.env.REACT_APP_HELIUS_KEY || '';
const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';

interface HeliosTokenTransaction {
  signature: string;
  type: string;
  timestamp: number;
  source: string;
  fee: number;
  feePayer: string;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAccount: string;
    mint: string;
    tokenAmount: number;
    decimals: number;
  }>;
}

/**
 * Fetch all transactions for a token from Helius
 */
export async function fetchTokenTransactions(mint: string, limit: number = 10000) {
  try {
    let allTransactions: HeliosTokenTransaction[] = [];
    let before = '';
    const pageSize = 100;

    while (allTransactions.length < limit) {
      const url = new URL(`${HELIUS_BASE_URL}/addresses/${mint}/transactions`);
      url.searchParams.append('api-key', HELIUS_API_KEY);
      url.searchParams.append('limit', String(pageSize));
      if (before) url.searchParams.append('before', before);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Helius API error: ${response.status}`);

      const txs = await response.json() as HeliosTokenTransaction[];
      if (!txs || txs.length === 0) break;

      allTransactions = allTransactions.concat(txs);
      before = txs[txs.length - 1].signature;

      console.log(`Fetched ${allTransactions.length} transactions...`);
    }

    return allTransactions.slice(0, limit);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

/**
 * Fetch all token holders from Helius
 */
export async function fetchTokenHolders(mint: string) {
  try {
    const url = new URL(`${HELIUS_BASE_URL}/token/holders`);
    url.searchParams.append('api-key', HELIUS_API_KEY);
    url.searchParams.append('mint', mint);
    url.searchParams.append('limit', '10000');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Helius API error: ${response.status}`);

    const data = await response.json();
    return data.holders || [];
  } catch (error) {
    console.error('Error fetching holders:', error);
    return [];
  }
}

/**
 * Fetch token metadata
 */
export async function fetchTokenMetadata(mint: string) {
  try {
    const url = new URL(`${HELIUS_BASE_URL}/token/metadata`);
    url.searchParams.append('api-key', HELIUS_API_KEY);
    url.searchParams.append('mint', mint);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Helius API error: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
}

/**
 * Process transactions and store in Supabase
 */
export async function processAndStoreTransactions(
  mint: string,
  transactions: HeliosTokenTransaction[]
) {
  const processed = [];

  for (const tx of transactions) {
    // Parse token transfers
    if (tx.tokenTransfers) {
      for (const transfer of tx.tokenTransfers) {
        if (transfer.mint !== mint) continue;

        const tokenAmount = transfer.tokenAmount / Math.pow(10, transfer.decimals);
        
        // Determine if buy or sell by looking at fee payer
        const isBuy = transfer.toUserAccount === transfer.tokenAccount;
        
        processed.push({
          signature: tx.signature,
          blockchain_timestamp: tx.timestamp,
          tx_type: 'swap',
          direction: isBuy ? 'buy' : 'sell',
          buyer_address: isBuy ? transfer.fromUserAccount : null,
          seller_address: !isBuy ? transfer.fromUserAccount : null,
          mint_address: mint,
          token_amount: BigInt(transfer.tokenAmount),
          dex_name: 'Unknown',
          fee_sol: (tx.fee || 0) / 1e9,
          created_at: new Date(tx.timestamp * 1000).toISOString(),
        });
      }
    }
  }

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < processed.length; i += batchSize) {
    const batch = processed.slice(i, i + batchSize);
    const { error } = await supabase
      .from('transactions_extended')
      .upsert(batch, { onConflict: 'signature' });

    if (error) {
      console.error(`Error inserting batch ${i}:`, error);
    } else {
      console.log(`Inserted batch ${i} - ${i + batchSize} transactions`);
    }
  }

  return processed.length;
}

/**
 * Calculate holder snapshots and PnL
 */
export async function calculateAndStoreHolderSnapshots(mint: string) {
  try {
    // Get all transactions
    const { data: transactions } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', mint)
      .order('blockchain_timestamp', { ascending: true });

    if (!transactions || transactions.length === 0) return 0;

    // Group by wallet and calculate PnL
    const walletData = new Map<string, any>();

    for (const tx of transactions) {
      const wallet = tx.direction === 'buy' ? tx.buyer_address : tx.seller_address;
      if (!wallet) continue;

      if (!walletData.has(wallet)) {
        walletData.set(wallet, {
          balance: 0,
          totalCost: 0,
          transactions: [],
          buys: 0,
          sells: 0,
          realizedPnL: 0,
          firstBuyTime: 0,
        });
      }

      const data = walletData.get(wallet)!;
      data.transactions.push(tx);

      if (tx.direction === 'buy') {
        data.balance += Number(tx.token_amount);
        data.totalCost += tx.usd_volume || 0;
        data.buys++;
        if (!data.firstBuyTime) data.firstBuyTime = tx.blockchain_timestamp;
      } else {
        const costBasis = data.totalCost / (data.balance || 1);
        const pnl = (tx.token_price - costBasis) * Number(tx.token_amount);
        data.realizedPnL += pnl;
        data.balance -= Number(tx.token_amount);
        data.totalCost -= costBasis * Number(tx.token_amount);
        data.sells++;
      }
    }

    // Get current price
    const { data: token } = await supabase
      .from('tokens')
      .select('usdPrice')
      .eq('mint', mint)
      .single();

    const currentPrice = token?.usdPrice || 0;

    // Create snapshots
    const snapshots = [];
    const now = Math.floor(Date.now() / 1000);

    for (const [wallet, data] of walletData.entries()) {
      const costBasis = data.balance > 0 ? data.totalCost / data.balance : 0;
      const unrealizedPnL = (currentPrice - costBasis) * data.balance;
      const holdingDays = data.firstBuyTime ? (now - data.firstBuyTime) / 86400 : 0;

      snapshots.push({
        snapshot_timestamp: now,
        mint_address: mint,
        wallet_address: wallet,
        balance: BigInt(Math.floor(data.balance)),
        balance_usd: data.balance * currentPrice,
        avg_entry_price: costBasis,
        unrealized_pnl_usd: unrealizedPnL,
        unrealized_pnl_percent: costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0,
        realized_pnl_usd: data.realizedPnL,
        realized_pnl_percent: data.totalCost > 0 ? (data.realizedPnL / data.totalCost) * 100 : 0,
        total_pnl_usd: unrealizedPnL + data.realizedPnL,
        total_pnl_percent: (data.totalCost + data.realizedPnL) > 0 
          ? ((unrealizedPnL + data.realizedPnL) / (data.totalCost + data.realizedPnL)) * 100 
          : 0,
        first_buy_timestamp: data.firstBuyTime,
        last_activity_timestamp: data.transactions[data.transactions.length - 1]?.blockchain_timestamp,
        holding_duration_days: holdingDays,
        buy_count: data.buys,
        sell_count: data.sells,
        total_transactions: data.transactions.length,
        classification: classifyHolder(data, unrealizedPnL),
      });
    }

    // Insert snapshots in batches
    const batchSize = 100;
    for (let i = 0; i < snapshots.length; i += batchSize) {
      const batch = snapshots.slice(i, i + batchSize);
      const { error } = await supabase
        .from('holder_snapshots')
        .insert(batch);

      if (error) {
        console.error(`Error inserting snapshot batch ${i}:`, error);
      } else {
        console.log(`Inserted snapshot batch ${i} - ${i + batchSize}`);
      }
    }

    return snapshots.length;
  } catch (error) {
    console.error('Error calculating snapshots:', error);
    return 0;
  }
}

function classifyHolder(data: any, unrealizedPnL: number): string {
  if (data.buys === 0) return 'inactive';
  if (data.sells === 0 && unrealizedPnL > 0) return 'diamond_hand';
  if (data.sells === 0 && unrealizedPnL < 0) return 'bag_holder';
  if (data.buys > 5 || data.sells > 3) return 'swing_trader';
  if (data.balance * 0.001 > 1 && unrealizedPnL > 50000) return 'whale';
  return 'trader';
}

/**
 * Full data population pipeline
 */
export async function populateTokenData(mint: string) {
  console.log(`Starting data population for ${mint}...`);

  try {
    // Step 1: Fetch transactions
    console.log('Step 1: Fetching transactions...');
    const transactions = await fetchTokenTransactions(mint);
    console.log(`Fetched ${transactions.length} transactions`);

    // Step 2: Process and store
    console.log('Step 2: Processing and storing transactions...');
    const txCount = await processAndStoreTransactions(mint, transactions);
    console.log(`Stored ${txCount} transactions`);

    // Step 3: Calculate PnL and snapshots
    console.log('Step 3: Calculating holder PnL...');
    const snapshotCount = await calculateAndStoreHolderSnapshots(mint);
    console.log(`Created ${snapshotCount} holder snapshots`);

    console.log('✅ Data population complete!');
    return { transactionCount: txCount, snapshotCount };
  } catch (error) {
    console.error('Error in data population:', error);
    throw error;
  }
}
