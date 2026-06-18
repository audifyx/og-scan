
import React, { useEffect, useState } from "react";
import { TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function PriceAction({ mint }: { mint: string }) {
  const [priceData, setPriceData] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPriceData() {
      try {
        const { data } = await supabase
          .from("price_candles_extended")
          .select("*")
          .eq("mint_address", mint)
          .eq("timeframe", "1h")
          .order("candle_timestamp", { ascending: true })
          .limit(100);

        setPriceData(
          (data || []).map((d) => ({
            timestamp: new Date(d.candle_timestamp * 1000).toLocaleString(),
            price: d.close_price,
            volume: d.volume_usd,
            rsi: d.rsi_14,
            macd: d.macd,
          }))
        );

        const latest = data?.[data.length - 1];
        if (latest) {
          setIndicators({
            rsi: latest.rsi_14,
            macd: latest.macd,
            bbUpper: latest.bb_upper,
            bbLower: latest.bb_lower,
            buyVolume: latest.buy_volume_usd,
            sellVolume: latest.sell_volume_usd,
          });
        }
      } catch (error) {
        console.error("Error fetching price data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPriceData();
  }, [mint]);

  if (loading) return <div className="flex h-64 items-center justify-center">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Indicators Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <IndicatorCard label="RSI (14)" value={indicators.rsi?.toFixed(1)} warning={indicators.rsi > 70 || indicators.rsi < 30} />
        <IndicatorCard label="MACD" value={indicators.macd > 0 ? "Bullish" : "Bearish"} />
        <IndicatorCard label="Buy Volume" value={`$${(indicators.buyVolume / 1000).toFixed(1)}K`} />
        <IndicatorCard label="Sell Volume" value={`$${(indicators.sellVolume / 1000).toFixed(1)}K`} />
      </div>

      {/* Price Chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-4">Price Action (1H)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404050" />
            <XAxis dataKey="timestamp" stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#0F0F14", border: "1px solid #404050" }} />
            <Line type="monotone" dataKey="price" stroke="#38C4DC" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-4">Volume (1H)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404050" />
            <XAxis dataKey="timestamp" stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#0F0F14", border: "1px solid #404050" }} />
            <Bar dataKey="volume" fill="#38C4DC" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function IndicatorCard({ label, value, warning }: any) {
  return (
    <div className={`rounded-lg border p-4 ${warning ? "bg-og-gold/10 border-og-gold/30" : "bg-card border-border"}`}>
      <p className="text-sm text-foreground/60 mb-1">{label}</p>
      <p className={`text-lg font-bold ${warning ? "text-og-gold" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
