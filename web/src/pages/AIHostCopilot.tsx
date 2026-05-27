/**
 * AIHostCopilot — ogscan.fun/host-copilot
 *
 * Feature 14: AI Host Copilot
 * - Real-time listener drop suggestions: "4 listeners dropped off — consider changing topic"
 * - Audience sentiment meter (live, based on chat reactions + emoji usage)
 * - Suggested questions to ask based on audience reactions
 * - Post-space coaching report: "Your best moment was 12:34 — here's why"
 * - Voice clarity score + background noise warnings
 */
import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import {
  Brain, Mic, TrendingUp, TrendingDown, Users, MessageSquare,
  Lightbulb, AlertTriangle, CheckCircle, Star, Zap, Heart,
  BarChart2, Volume2, VolumeX, Clock, Award, ChevronRight,
  ArrowUp, ArrowDown, Radio, Activity, Sparkles, ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CopilotSuggestion {
  id: string;
  type: "topic" | "question" | "engagement" | "warning" | "praise";
  message: string;
  timestamp: number;
  priority: "high" | "medium" | "low";
}

interface CoachingReport {
  spaceId: string;
  title: string;
  date: string;
  duration: number;
  overallScore: number;
  bestMoment: { timestamp: number; reason: string };
  metrics: { label: string; value: string; trend: "up" | "down" | "neutral"; delta: string }[];
  suggestions: string[];
  strengths: string[];
}

const MOCK_SUGGESTIONS: CopilotSuggestion[] = [
  { id: "1", type: "warning", message: "4 listeners dropped off in the last 2 minutes. Consider switching topics or inviting a speaker.", timestamp: 0, priority: "high" },
  { id: "2", type: "question", message: "The audience is reacting strongly to your comment about 3D scanning. Try asking: \"What's the biggest challenge you've faced with existing scanning tools?\"", timestamp: 45, priority: "high" },
  { id: "3", type: "engagement", message: "🔥 Engagement spike! 12 new listeners joined after your last point. Keep this energy.", timestamp: 120, priority: "medium" },
  { id: "4", type: "topic", message: "Chat mentions 'cost' 8 times. Your audience wants to hear about pricing. Pivot now.", timestamp: 180, priority: "high" },
  { id: "5", type: "praise", message: "Great pacing in the last 5 minutes. Listener retention is up 18%.", timestamp: 240, priority: "low" },
];

const MOCK_REPORTS: CoachingReport[] = [
  {
    spaceId: "1",
    title: "Orthotics Innovation in 2026",
    date: "2026-05-26",
    duration: 4200,
    overallScore: 87,
    bestMoment: { timestamp: 1134, reason: "You asked a direct audience question about pricing barriers — listener count jumped +31 in 90 seconds and chat engagement tripled." },
    metrics: [
      { label: "Avg Listen Duration", value: "13m 28s", trend: "up", delta: "+2m vs last space" },
      { label: "Peak Listeners", value: "312", trend: "up", delta: "+47 vs last space" },
      { label: "Chat Messages", value: "528", trend: "up", delta: "+112 new chatters" },
      { label: "Follower Conversions", value: "42", trend: "up", delta: "13.5% conversion rate" },
      { label: "Drop-off Rate", value: "18%", trend: "down", delta: "-4% vs last space" },
      { label: "Voice Clarity Score", value: "94/100", trend: "neutral", delta: "Excellent" },
    ],
    suggestions: [
      "Start with a direct question in the first 90 seconds — your retention was 12% higher when you did.",
      "Avoid long monologues over 4 minutes — listener attention dips predictably after the 3-minute mark.",
      "Invite speakers earlier. Your guest-enabled segments retain 24% more listeners.",
      "Post a thread after the space — 3 past co-hosts drove +200 extra listens via retweets.",
    ],
    strengths: [
      "Your voice pacing is excellent — no rushing.",
      "You handled listener questions smoothly and kept momentum.",
      "Strong topic diversity — 5 topic shifts kept the space dynamic.",
    ],
  },
];

const SENTIMENT_EMOJIS = ["😤", "😐", "😊", "🤩", "🔥"];

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

const AIHostCopilot = () => {
  const [activeTab, setActiveTab] = useState<"live" | "reports">("live");
  const navigate = useNavigate();
  const [isLive, setIsLive] = useState(false);
  const [sentimentScore, setSentimentScore] = useState(72); // 0-100
  const [listenerCount, setListenerCount] = useState(0);
  const [voiceScore, setVoiceScore] = useState(94);
  const [hasNoise, setHasNoise] = useState(false);
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedReport, setSelectedReport] = useState<CoachingReport | null>(MOCK_REPORTS[0]);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isLive) {
      // Simulate real-time copilot
      let idx = 0;
      setListenerCount(48);
      intervalRef.current = setInterval(() => {
        if (idx < MOCK_SUGGESTIONS.length) {
          setSuggestions(prev => [MOCK_SUGGESTIONS[idx], ...prev]);
          idx++;
        }
        setListenerCount(c => c + Math.floor(Math.random() * 5) - 1);
        setSentimentScore(s => Math.min(100, Math.max(20, s + Math.floor(Math.random() * 10) - 4)));
        setVoiceScore(v => Math.min(100, Math.max(60, v + Math.floor(Math.random() * 4) - 1)));
        setHasNoise(Math.random() < 0.08);
      }, 3500);
    } else {
      clearInterval(intervalRef.current);
      setSuggestions([]);
      setListenerCount(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [isLive]);

  const dismiss = (id: string) => setDismissedIds(prev => new Set(prev).add(id));
  const activeSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

  const sentimentLabel = sentimentScore >= 80 ? "Very Positive" : sentimentScore >= 60 ? "Positive" : sentimentScore >= 40 ? "Neutral" : sentimentScore >= 20 ? "Mixed" : "Negative";
  const sentimentColor = sentimentScore >= 80 ? "text-emerald-400" : sentimentScore >= 60 ? "text-green-400" : sentimentScore >= 40 ? "text-amber-400" : "text-red-400";
  const sentimentBg = sentimentScore >= 80 ? "bg-emerald-500/10 border-emerald-500/20" : sentimentScore >= 60 ? "bg-green-500/10 border-green-500/20" : sentimentScore >= 40 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

  const suggestionIcon = (type: CopilotSuggestion["type"]) => ({
    topic: Lightbulb,
    question: MessageSquare,
    engagement: TrendingUp,
    warning: AlertTriangle,
    praise: Star,
  }[type]);

  const suggestionColor = (type: CopilotSuggestion["type"]) => ({
    topic: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    question: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    engagement: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    praise: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  }[type]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#080a0f] text-white">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-blue-900/10 via-[#080a0f] to-violet-900/10">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back
              </button>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 border border-blue-500/20">
                <Sparkles className="h-7 w-7 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI Host Copilot</h1>
                <p className="text-sm text-white/40 mt-0.5">Real-time suggestions, sentiment analysis & post-space coaching</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-5 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/[0.06]">
              {(["live", "reports"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    activeTab === tab ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "live" ? "Live Mode" : "Coaching Reports"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">

          {/* ── LIVE MODE ── */}
          {activeTab === "live" && (
            <div className="space-y-4">
              {/* Start/Stop */}
              {!isLive ? (
                <div className="text-center py-12 border border-dashed border-white/[0.08] rounded-3xl">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                    <Radio className="h-8 w-8 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white mb-1">Copilot Standby</h2>
                  <p className="text-sm text-white/40 mb-6">Start a space and the copilot will activate automatically, or demo it here.</p>
                  <button
                    onClick={() => setIsLive(true)}
                    className="px-6 py-3 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-400 transition-colors"
                  >
                    Demo Live Mode
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Live status bar */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-500/5 border border-blue-500/15">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-sm font-bold text-blue-300">Copilot Active</span>
                    </div>
                    <button onClick={() => setIsLive(false)} className="text-xs text-red-400/70 hover:text-red-400 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/15">
                      Stop Demo
                    </button>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Sentiment */}
                    <div className={cn("p-4 rounded-2xl border transition-all", sentimentBg)}>
                      <p className="text-xs text-white/40 mb-1">Audience Sentiment</p>
                      <div className="flex items-end gap-2">
                        <span className={cn("text-2xl font-black", sentimentColor)}>{sentimentScore}</span>
                        <span className="text-xs text-white/30 mb-0.5">/100</span>
                      </div>
                      <p className={cn("text-xs font-medium mt-1", sentimentColor)}>{sentimentLabel}</p>
                      {/* Emoji bar */}
                      <div className="flex gap-1 mt-2">
                        {SENTIMENT_EMOJIS.map((e, i) => (
                          <span key={i} className={cn("text-base transition-all", i <= Math.floor(sentimentScore / 22) ? "opacity-100 scale-110" : "opacity-20")}>{e}</span>
                        ))}
                      </div>
                    </div>

                    {/* Listeners */}
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-white/40 mb-1">Live Listeners</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-white">{Math.max(0, listenerCount)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowUp className="h-3 w-3 text-emerald-400" />
                        <span className="text-xs text-emerald-400">Growing</span>
                      </div>
                    </div>

                    {/* Voice clarity */}
                    <div className={cn("p-4 rounded-2xl border transition-all", hasNoise ? "bg-red-500/8 border-red-500/20" : "bg-white/[0.03] border-white/[0.06]")}>
                      <p className="text-xs text-white/40 mb-1">Voice Clarity</p>
                      <div className="flex items-end gap-2">
                        <span className={cn("text-2xl font-black", hasNoise ? "text-red-400" : "text-emerald-400")}>{voiceScore}</span>
                        <span className="text-xs text-white/30 mb-0.5">/100</span>
                      </div>
                      {hasNoise ? (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3 text-red-400" />
                          <span className="text-xs text-red-400">Background noise detected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1">
                          <Volume2 className="h-3 w-3 text-emerald-400" />
                          <span className="text-xs text-emerald-400">Crystal clear</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Suggestions feed */}
                  <div>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Copilot Suggestions</p>
                    {activeSuggestions.length === 0 ? (
                      <div className="text-center py-6 text-white/25">
                        <Activity className="h-6 w-6 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Analyzing your space...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeSuggestions.map(s => {
                          const Icon = suggestionIcon(s.type);
                          return (
                            <div key={s.id} className={cn("p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300", suggestionColor(s.type))}>
                              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                              <p className="text-sm flex-1 leading-relaxed">{s.message}</p>
                              <button onClick={() => dismiss(s.id)} className="text-white/20 hover:text-white/50 shrink-0 text-xs">✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── REPORTS ── */}
          {activeTab === "reports" && (
            <div className="flex gap-4">
              {/* Report list */}
              <div className="w-64 shrink-0 space-y-2">
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Past Spaces</h2>
                {MOCK_REPORTS.map(r => (
                  <button
                    key={r.spaceId}
                    onClick={() => setSelectedReport(r)}
                    className={cn("w-full p-4 rounded-2xl text-left border transition-all",
                      selectedReport?.spaceId === r.spaceId ? "bg-blue-500/10 border-blue-500/30" : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]"
                    )}
                  >
                    <p className="text-sm font-semibold text-white line-clamp-2">{r.title}</p>
                    <p className="text-xs text-white/40 mt-1">{r.date}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Award className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-sm font-black text-amber-400">{r.overallScore}</span>
                      <span className="text-xs text-white/30">/100</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Report detail */}
              {selectedReport && (
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedReport.title}</h2>
                    <p className="text-xs text-white/40">{selectedReport.date} · {Math.floor(selectedReport.duration / 60)}m</p>
                  </div>

                  {/* Score */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-violet-500/5 border border-blue-500/20 flex items-center gap-5">
                    <div className="text-center">
                      <div className="text-5xl font-black text-blue-300">{selectedReport.overallScore}</div>
                      <div className="text-xs text-white/40 mt-1">Overall Score</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white mb-1">🌟 Best Moment — {formatTime(selectedReport.bestMoment.timestamp)}</p>
                      <p className="text-sm text-white/60 leading-relaxed">{selectedReport.bestMoment.reason}</p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    {selectedReport.metrics.map(m => (
                      <div key={m.label} className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-[11px] text-white/40 mb-1">{m.label}</p>
                        <p className="text-base font-bold text-white">{m.value}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {m.trend === "up" && <ArrowUp className="h-3 w-3 text-emerald-400" />}
                          {m.trend === "down" && <ArrowDown className="h-3 w-3 text-emerald-400" />}
                          <span className={cn("text-[11px]", m.trend === "up" || (m.trend === "down" && m.label === "Drop-off Rate") ? "text-emerald-400" : m.trend === "neutral" ? "text-white/40" : "text-red-400")}>
                            {m.delta}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strengths */}
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                    <p className="text-xs font-bold text-emerald-300/70 uppercase tracking-wider mb-3">Strengths</p>
                    <ul className="space-y-2">
                      {selectedReport.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-sm text-white/70">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Suggestions */}
                  <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15">
                    <p className="text-xs font-bold text-blue-300/70 uppercase tracking-wider mb-3">Next Time</p>
                    <ul className="space-y-2">
                      {selectedReport.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Lightbulb className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <span className="text-sm text-white/70">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AIHostCopilot;
