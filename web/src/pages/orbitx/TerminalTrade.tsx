/**
 * Terminal Trade - Buy/sell interface with chart
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, BarChart3, Volume2 } from "lucide-react";

const chartData = [
  { time: "00:00", price: 0.0200 },
  { time: "04:00", price: 0.0210 },
  { time: "08:00", price: 0.0215 },
  { time: "12:00", price: 0.0220 },
  { time: "16:00", price: 0.0228 },
  { time: "20:00", price: 0.0234 },
  { time: "24:00", price: 0.0240 },
];

export default function TerminalTrade() {
  return (
    <div className="space-y-6">
      {/* Selected Token Info */}
      <div className="bg-black/50 border border-green-500/20 rounded p-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-green-400">ORBITX</h2>
            <p className="text-gray-500 text-sm">OBX • Bonding Curve</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">$0.0234</div>
            <div className="text-green-400 text-sm">↑ 45.2%</div>
          </div>
        </div>
      </div>

      {/* Chart & Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-black/50 border border-green-500/20 rounded p-6">
          <h3 className="text-sm font-bold text-green-400 mb-4 uppercase">24h Price Chart</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.1)" />
              <XAxis dataKey="time" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', border: '1px solid #22c55e' }}
                labelStyle={{ color: '#22c55e' }}
              />
              <Line type="monotone" dataKey="price" stroke="#22c55e" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          {/* Buy Panel */}
          <div className="bg-black/50 border border-green-500/20 rounded p-4">
            <h3 className="text-xs font-bold text-green-400 mb-4 uppercase">Buy OBX</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Amount (SOL)</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-black/50 border border-green-500/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div className="bg-black/50 border border-green-500/10 rounded p-2">
                <div className="text-[10px] text-gray-600 flex justify-between">
                  <span>You get</span>
                  <span>0.00 OBX</span>
                </div>
              </div>
              <button className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-2 rounded uppercase text-sm transition">
                Buy Now
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-black/50 border border-green-500/20 rounded p-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">24h Volume</span>
                <span className="text-white font-bold">$125K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">MarketCap</span>
                <span className="text-white font-bold">$2.34M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Holders</span>
                <span className="text-white font-bold">1,250</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="bg-black/50 border border-green-500/20 rounded p-6">
        <h3 className="text-sm font-bold text-green-400 mb-4 uppercase">Recent Activity</h3>
        <div className="space-y-2 text-xs">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 p-2 hover:bg-green-500/5 transition">
              <div className="text-green-400">BOUGHT</div>
              <div className="text-gray-400">50 OBX</div>
              <div className="text-white">$1.17</div>
              <div className="text-gray-600">2m ago</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
