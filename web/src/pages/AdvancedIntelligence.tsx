// FILE: web/src/pages/AdvancedIntelligence.tsx

import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart3, TrendingUp, Users, Zap, Target, AlertTriangle,
  Flame, Shield, Trophy, Activity,
} from "lucide-react";
import { HolderAnalysis } from "@/components/advanced-intelligence/HolderAnalysis";
import { TraderLeaderboard } from "@/components/advanced-intelligence/TraderLeaderboard";
import { WhaleRiskAnalysis } from "@/components/advanced-intelligence/WhaleRiskAnalysis";
import { AnomalyDetector } from "@/components/advanced-intelligence/AnomalyDetector";
import { RiskDashboard } from "@/components/advanced-intelligence/RiskDashboard";
import { PriceAction } from "@/components/advanced-intelligence/PriceAction";

type TabId = "holders" | "traders" | "whales" | "risk" | "anomalies" | "price";

interface Tab {
  id: TabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: Tab[] = [
  {
    id: "holders",
    label: "Holder Analysis",
    Icon: Users,
    description: "PnL breakdown, cost basis, entry prices",
  },
  {
    id: "traders",
    label: "Top Traders",
    Icon: Trophy,
    description: "Leaderboard by realized PnL",
  },
  {
    id: "whales",
    label: "Whale Risk",
    Icon: Flame,
    description: "Dump risk, concentration analysis",
  },
  {
    id: "risk",
    label: "Risk Dashboard",
    Icon: Shield,
    description: "Comprehensive risk scoring",
  },
  {
    id: "anomalies",
    label: "Anomalies",
    Icon: AlertTriangle,
    description: "Real-time alert detection",
  },
  {
    id: "price",
    label: "Price Action",
    Icon: TrendingUp,
    description: "Technical indicators, order flow",
  },
];

export default function AdvancedIntelligence() {
  const { mint } = useParams<{ mint: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("holders");

  if (!mint) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Zap className="h-12 w-12 text-og-cyan mx-auto mb-4" />
          <p className="text-lg font-bold">No token selected</p>
          <p className="text-sm text-foreground/50">Select a token to view advanced intelligence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-8 w-8 text-og-cyan" />
            <div>
              <h1 className="text-3xl font-black tracking-tight">Advanced Intelligence</h1>
              <p className="text-sm text-foreground/55 mt-1">
                Deep forensic analysis • Holder tracking • Real-time anomalies
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.Icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap font-medium text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-og-cyan/15 text-og-cyan border border-og-cyan/30"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-og-cyan/0 via-og-cyan to-og-cyan/0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Description */}
          <p className="text-xs text-foreground/50 mt-3">
            {TABS.find(t => t.id === activeTab)?.description}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "holders" && <HolderAnalysis mint={mint} />}
        {activeTab === "traders" && <TraderLeaderboard mint={mint} />}
        {activeTab === "whales" && <WhaleRiskAnalysis mint={mint} />}
        {activeTab === "risk" && <RiskDashboard mint={mint} />}
        {activeTab === "anomalies" && <AnomalyDetector mint={mint} />}
        {activeTab === "price" && <PriceAction mint={mint} />}
      </div>
    </div>
  );
}
