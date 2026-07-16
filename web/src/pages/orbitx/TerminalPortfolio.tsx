/**
 * Terminal Portfolio - Holdings and performance
 */

import { Trash2, ExternalLink } from "lucide-react";

interface Position {
  ticker: string;
  name: string;
  amount: number;
  price: number;
  value: number;
  change: number;
  launchFees?: number;
}

const positions: Position[] = [
  { ticker: "OBX", name: "ORBITX", amount: 5000, price: 0.0234, value: 117, change: 45.2 },
  { ticker: "DEGEN", name: "Degen Tower", amount: 10000, price: 0.012, value: 120, change: -12.5 },
  { ticker: "FRESH", name: "Fresh Launch", amount: 500000, price: 0.00001, value: 5, change: 0, launchFees: 12.5 },
];

export default function TerminalPortfolio() {
  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalFees = positions.reduce((sum, p) => sum + (p.launchFees || 0), 0);

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-black/50 border border-green-500/20 rounded p-4">
          <div className="text-xs text-gray-500 uppercase mb-2">Portfolio Value</div>
          <div className="text-2xl font-bold text-green-400">${totalValue.toFixed(2)}</div>
        </div>
        <div className="bg-black/50 border border-green-500/20 rounded p-4">
          <div className="text-xs text-gray-500 uppercase mb-2">Launch Fees Earned</div>
          <div className="text-2xl font-bold text-amber-400">${totalFees.toFixed(2)}</div>
        </div>
        <div className="bg-black/50 border border-green-500/20 rounded p-4">
          <div className="text-xs text-gray-500 uppercase mb-2">Total P/L</div>
          <div className="text-2xl font-bold text-green-400">+$45.23</div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-black/50 border border-green-500/20 rounded overflow-hidden">
        <div className="grid grid-cols-10 gap-4 p-4 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-green-500/10">
          <div className="col-span-2">Token</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Value</div>
          <div className="col-span-2">Change</div>
          <div className="col-span-2">Action</div>
        </div>

        {positions.map((pos, i) => (
          <div key={i} className="grid grid-cols-10 gap-4 p-4 items-center text-xs border-b border-green-500/10 hover:bg-green-500/5 transition">
            <div className="col-span-2">
              <div className="font-bold text-green-400">{pos.ticker}</div>
              <div className="text-gray-600 text-[10px]">{pos.name}</div>
            </div>
            <div className="col-span-2 text-gray-400">
              {pos.amount.toLocaleString()}
            </div>
            <div className="col-span-2 text-white font-bold">
              ${pos.value.toFixed(2)}
            </div>
            <div className={`col-span-2 ${pos.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pos.change >= 0 ? '+' : ''}{pos.change.toFixed(2)}%
            </div>
            <div className="col-span-2 flex gap-2">
              <button className="p-1 hover:bg-green-500/20 rounded transition" title="Sell">
                <ExternalLink className="w-4 h-4 text-green-400" />
              </button>
              <button className="p-1 hover:bg-red-500/20 rounded transition" title="Remove">
                <Trash2 className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Launch Fees Breakdown */}
      <div className="bg-black/50 border border-green-500/20 rounded p-6">
        <h3 className="text-sm font-bold text-green-400 mb-4 uppercase">Launch Fees Earned</h3>
        <div className="space-y-2 text-xs">
          {positions.filter(p => p.launchFees).map((pos, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-black/50 rounded">
              <span className="text-gray-400">{pos.ticker} - {pos.name}</span>
              <button className="text-green-400 hover:text-green-300 font-bold">
                Claim ${pos.launchFees?.toFixed(2)} →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
