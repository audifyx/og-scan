
import React, { useEffect, useState } from "react";
import { Shield, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function RiskDashboard({ mint }: { mint: string }) {
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRiskData() {
      try {
        const { data: token } = await supabase
          .from("tokens")
          .select("*")
          .eq("mint", mint)
          .single();

        setRiskData(token);
      } catch (error) {
        console.error("Error fetching risk data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRiskData();
  }, [mint]);

  if (loading) return <div className="flex h-64 items-center justify-center">Loading...</div>;

  const riskFactors = [
    { label: "Holder Concentration", score: riskData?.risk_score || 0, color: "bg-og-cyan" },
    { label: "Deployer History", score: 70, color: "bg-og-gold" },
    { label: "Liquidity Risk", score: 30, color: "bg-og-lime" },
    { label: "Authority Risk", score: 10, color: "bg-og-red" },
  ];

  const overallRisk = Math.round(riskFactors.reduce((sum, f) => sum + f.score, 0) / riskFactors.length);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="text-center mb-8">
          <Shield className="h-16 w-16 mx-auto text-og-cyan mb-4" />
          <h2 className="text-4xl font-black mb-2">{overallRisk}/100</h2>
          <p className="text-foreground/60">Overall Risk Score</p>
        </div>

        <div className="space-y-4">
          {riskFactors.map((factor) => (
            <div key={factor.label}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{factor.label}</span>
                <span className="text-sm font-mono">{factor.score}</span>
              </div>
              <div className="w-full bg-foreground/10 rounded-full h-2">
                <div
                  className={`h-full rounded-full ${factor.color} transition-all duration-500`}
                  style={{ width: `${factor.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
