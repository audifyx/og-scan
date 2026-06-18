
import React, { useEffect, useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AnomalyDetector({ mint }: { mint: string }) {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnomalies() {
      try {
        const { data } = await supabase
          .from("real_time_alerts")
          .select("*")
          .eq("mint_address", mint)
          .order("triggered_timestamp", { ascending: false })
          .limit(50);

        setAnomalies(data || []);
      } catch (error) {
        console.error("Error fetching anomalies:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnomalies();
  }, [mint]);

  if (loading) return <div className="flex h-64 items-center justify-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="h-6 w-6 text-og-red" />
          <h2 className="text-2xl font-bold">Recent Anomalies</h2>
        </div>

        {anomalies.length === 0 ? (
          <p className="text-foreground/50 text-center py-12">No anomalies detected</p>
        ) : (
          <div className="space-y-3">
            {anomalies.map((anomaly, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  anomaly.severity === "critical"
                    ? "bg-og-red/10 border-og-red/30"
                    : anomaly.severity === "high"
                    ? "bg-og-gold/10 border-og-gold/30"
                    : "bg-og-cyan/10 border-og-cyan/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold capitalize">{anomaly.alert_type}</p>
                    <p className="text-sm text-foreground/60">{anomaly.metric_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold">{anomaly.percent_change?.toFixed(2)}%</p>
                    <p className="text-xs uppercase font-bold text-foreground/60">{anomaly.severity}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
