import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TransactionAlert {
  kolName: string;
  wallet: string;
  txType: 'buy' | 'sell';
  tokenSymbol: string;
  amount: number;
  price: number;
  timestamp: string;
  signature: string;
}

interface MonitorResponse {
  success: boolean;
  alert?: TransactionAlert;
  error?: string;
}

/**
 * Monitor KOL wallet for buy/sell transactions
 * This would typically be called by a cron job or webhook
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse<MonitorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { wallet, trackAllKols = false, trackedWallets = [] } = req.body;

    if (!wallet && !trackAllKols && trackedWallets.length === 0) {
      return res.status(400).json({ success: false, error: 'No wallets to monitor' });
    }

    // Get Solana RPC endpoint from environment
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    // Build list of wallets to check
    const walletsToCheck = wallet ? [wallet] : trackAllKols ? trackedWallets : trackedWallets;

    // Fetch recent signatures for the wallet
    const signatures = await getRecentSignatures(walletsToCheck[0], rpcUrl);

    if (!signatures || signatures.length === 0) {
      return res.status(200).json({ success: true });
    }

    // Check first transaction for buy/sell pattern
    const latestTx = signatures[0];
    const txDetails = await getTransactionDetails(latestTx.signature, rpcUrl);

    if (!txDetails) {
      return res.status(200).json({ success: true });
    }

    // Parse transaction to detect buy/sell
    const alert = parseTransactionForAlert(txDetails);

    if (alert) {
      return res.status(200).json({ success: true, alert });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Monitor error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function getRecentSignatures(wallet: string, rpcUrl: string) {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [wallet, { limit: 5 }],
      }),
    });

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching signatures:', error);
    return null;
  }
}

async function getTransactionDetails(signature: string, rpcUrl: string) {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
      }),
    });

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return null;
  }
}

function parseTransactionForAlert(tx: any): TransactionAlert | null {
  try {
    // Placeholder: would parse Solana transaction to detect token swaps
    // This is a simplified version - real implementation would check for DEX interactions
    
    const meta = tx.meta;
    if (!meta || meta.err) return null;

    // Check for token account changes (simplified)
    if (!meta.postTokenBalances || meta.postTokenBalances.length === 0) {
      return null;
    }

    // This would need more sophisticated parsing for actual buy/sell detection
    return null;
  } catch (error) {
    console.error('Error parsing transaction:', error);
    return null;
  }
}
