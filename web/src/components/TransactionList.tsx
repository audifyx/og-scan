import { ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink } from "lucide-react";
import { Transaction, formatAddress, formatNumber } from "@/lib/solana-api";

interface TransactionListProps {
  transactions: Transaction[];
  walletAddress: string;
}

export function TransactionList({ transactions, walletAddress }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="og-glass-card p-8 text-center">
        <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No recent transactions found</p>
      </div>
    );
  }

  return (
    <div className="og-glass-card overflow-hidden animate-fade-in" style={{ animationDelay: '0.2s' }}>
      <div className="p-4 md:p-6 border-b border-border">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-secondary" />
          Recent Transactions
        </h3>
      </div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
        {transactions.map((tx, index) => (
          <TransactionRow 
            key={tx.signature} 
            transaction={tx} 
            walletAddress={walletAddress}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
  walletAddress: string;
  index: number;
}

function TransactionRow({ transaction, walletAddress, index }: TransactionRowProps) {
  const type = transaction.type || 'UNKNOWN';
  const timestamp = transaction.timestamp 
    ? new Date(transaction.timestamp * 1000).toLocaleString() 
    : 'Unknown time';
  
  // Determine if it's incoming or outgoing
  const nativeTransfer = transaction.nativeTransfers?.[0];
  const isIncoming = nativeTransfer?.toUserAccount?.toLowerCase() === walletAddress.toLowerCase();
  const isOutgoing = nativeTransfer?.fromUserAccount?.toLowerCase() === walletAddress.toLowerCase();
  
  const getTypeColor = () => {
    if (type === 'TRANSFER' && isIncoming) return 'text-primary';
    if (type === 'TRANSFER' && isOutgoing) return 'text-destructive';
    if (type === 'SWAP') return 'text-secondary';
    return 'text-muted-foreground';
  };

  const getIcon = () => {
    if (type === 'TRANSFER' && isIncoming) return <ArrowDownLeft className="h-4 w-4" />;
    if (type === 'TRANSFER' && isOutgoing) return <ArrowUpRight className="h-4 w-4" />;
    return <RefreshCw className="h-4 w-4" />;
  };

  const getDisplayType = () => {
    if (type === 'TRANSFER' && isIncoming) return 'Received';
    if (type === 'TRANSFER' && isOutgoing) return 'Sent';
    return type.replace(/_/g, ' ');
  };

  const amount = nativeTransfer?.amount 
    ? formatNumber(nativeTransfer.amount / 1e9, 4) + ' SOL'
    : null;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors group">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${getTypeColor()}`}>
          {getIcon()}
        </div>
        <div>
          <p className="font-semibold capitalize">{getDisplayType()}</p>
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {amount && (
          <div className="text-right">
            <p className={`font-semibold ${isIncoming ? 'text-primary' : ''}`}>
              {isIncoming ? '+' : '-'}{amount}
            </p>
          </div>
        )}
        <a
          href={`https://solscan.io/tx/${transaction.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}
