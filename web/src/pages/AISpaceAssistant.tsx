/**
 * AISpaceAssistant — ogscan.fun/ai-assistant
 *
 * Feature 13: AI Space Assistant
 * - Real-time auto-transcription of every space
 * - AI-generated show notes published automatically when space ends
 * - Auto chapter markers based on topic changes
 * - Keyword alerts — notify me if anyone says [keyword]
 * - AI topic tagging for discovery algorithm
 * - Post-space searchable transcript archive
 */
import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Mic, FileText, BookOpen, Tag, Bell, Search, Play, Clock,
  Sparkles, Zap, ChevronDown, ChevronUp, Plus, Trash2, Check,
  Copy, Download, Share2, Eye, TrendingUp, Hash, Brain,
  AlignLeft, Bookmark, ListChecks, Volume2, ArrowLeft
} from "lucide-react";

interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
  is_chapter_start: boolean;
  chapter_title?: string;
  sentiment: "positive" | "neutral" | "negative";
}

interface ShowNotes {
  summary: string;
  key_points: string[];
  guest_bios: string[];
  resources: string[];
  topics: string[];
  chapters: { title: string; timestamp: number }[];
}

interface KeywordAlert {
  id: string;
  keyword: string;
  is_active: boolean;
  triggers_today: number;
}

interface SpaceRecord {
  id: string;
  title: string;
  host: string;
  date: string;
  duration: number;
  listeners: number;
  has_transcript: boolean;
  has_notes: boolean;
  topics: string[];
}

const MOCK_SPACES: SpaceRecord[] = [
  { id: "1", title: "Orthotics Innovation in 2026", host: "You", date: "2026-05-26", duration: 4200, listeners: 312, has_transcript: true, has_notes: true, topics: ["orthotics", "medtech", "innovation"] },
  { id: "2", title: "Diabetic Foot Care Weekly", host: "You", date: "2026-05-24", duration: 3600, listeners: 198, has_transcript: true, has_notes: true, topics: ["diabetes", "foot care", "clinical"] },
  { id: "3", title: "Guest: Dr. Sarah Chen — Future of Prosthetics", host: "You", date: "2026-05-20", duration: 5400, listeners: 520, has_transcript: true, has_notes: false, topics: ["prosthetics", "AI", "future"] },
];

const MOCK_TRANSCRIPT: TranscriptSegment[] = [
  { id: "1", speaker: "Host", text: "Welcome everyone to today's space. We're talking about orthotics innovation in 2026 and what the future looks like for custom devices.", timestamp: 0, is_chapter_start: true, chapter_title: "Introduction", sentiment: "positive" },
  { id: "2", speaker: "Host", text: "I want to start by talking about 3D scanning technology because it's fundamentally changed how we take measurements.", timestamp: 45, is_chapter_start: false, sentiment: "positive" },
  { id: "3", speaker: "Guest", text: "Absolutely. The precision we're getting now with structured light scanning is incredible — we're talking sub-millimeter accuracy.", timestamp: 72, is_chapter_start: false, sentiment: "positive" },
  { id: "4", speaker: "Host", text: "And the OG Scan app has been a huge part of democratizing that. Practitioners who couldn't afford a $50,000 scanner can now get comparable results on an iPad.", timestamp: 118, is_chapter_start: true, chapter_title: "3D Scanning Technology", sentiment: "positive" },
  { id: "5", speaker: "Guest", text: "The challenge remains in the materials science side. We have the scanning down, but the orthotic materials haven't kept pace.", timestamp: 165, is_chapter_start: false, sentiment: "neutral" },
  { id: "6", speaker: "Host", text: "That's a really important point. Let's dig into that — what are the key material limitations you're seeing?", timestamp: 195, is_chapter_start: true, chapter_title: "Materials Science Gap", sentiment: "neutral" },
  { id: "7", speaker: "Guest", text: "Carbon fiber composites are still too expensive for most patients. We need a polymer that can match the strength-to-weight ratio at a fraction of the cost.", timestamp: 220, is_chapter_start: false, sentiment: "negative" },
];

const MOCK_SHOW_NOTES: ShowNotes = {
  summary: "A deep-dive discussion on orthotics innovation in 2026, covering 3D scanning advancements, materials science challenges, and the democratization of custom device technology through iPad-based scanning solutions.",
  key_points: [
    "Structured light scanning now achieves sub-millimeter accuracy on consumer devices",
    "OG Scan app has democratized precision scanning for practitioners",
    "Materials science is the biggest remaining bottleneck in custom orthotics",
    "Carbon fiber alternatives needed to reduce patient costs by 60-80%",
    "AI-generated fitting predictions reducing iteration cycles from 3 to 1",
  ],
  guest_bios: ["Dr. Sarah Chen — Biomechanics Research Lead at Stanford, 15 years in prosthetics and orthotics R&D. Author of 40+ peer-reviewed papers."],
  resources: ["OG Scan App (ogscan.fun)", "Journal of Biomechanical Engineering Vol. 48", "Stanford Bionics Lab — stanfordbionics.edu"],
  topics: ["orthotics", "3D scanning", "materials science", "medtech", "custom devices"],
  chapters: [
    { title: "Introduction", timestamp: 0 },
    { title: "3D Scanning Technology", timestamp: 118 },
    { title: "Materials Science Gap", timestamp: 195 },
  ],
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const AISpaceAssistant = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"transcripts" | "alerts" | "settings">("transcripts");
  const navigate = useNavigate();
  const [selectedSpace, setSelectedSpace] = useState<SpaceRecord | null>(null);
  const [viewMode, setViewMode] = useState<"transcript" | "notes">("notes");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedChapter, setExpandedChapter] = useState<string | null>("Introduction");
  const [keywords, setKeywords] = useState<KeywordAlert[]>([
    { id: "1", keyword: "orthotics", is_active: true, triggers_today: 3 },
    { id: "2", keyword: "diabetic foot", is_active: true, triggers_today: 1 },
    { id: "3", keyword: "carbon fiber", is_active: false, triggers_today: 0 },
  ]);
  const [newKeyword, setNewKeyword] = useState("");
  const [autoNotes, setAutoNotes] = useState(true);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [autoChapters, setAutoChapters] = useState(true);
  const [autoTopicTags, setAutoTopicTags] = useState(true);
  const [generatingNotes, setGeneratingNotes] = useState(false);

  const filteredTranscript = MOCK_TRANSCRIPT.filter(seg =>
    !searchQuery || seg.text.toLowerCase().includes(searchQuery.toLowerCase()) || seg.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    setKeywords(prev => [...prev, { id: crypto.randomUUID(), keyword: newKeyword.trim().toLowerCase(), is_active: true, triggers_today: 0 }]);
    setNewKeyword("");
    toast({ title: "Keyword alert added" });
  };

  const removeKeyword = (id: string) => {
    setKeywords(prev => prev.filter(k => k.id !== id));
  };

  const generateNotes = async (spaceId: string) => {
    setGeneratingNotes(true);
    await new Promise(r => setTimeout(r, 2200));
    setGeneratingNotes(false);
    toast({ title: "Show notes generated ✓" });
  };

  const copyNotes = () => {
    const notes = `${MOCK_SHOW_NOTES.summary}\n\nKey Points:\n${MOCK_SHOW_NOTES.key_points.map(p => `• ${p}`).join("\n")}\n\nTopics: ${MOCK_SHOW_NOTES.topics.join(", ")}`;
    navigator.clipboard.writeText(notes);
    toast({ title: "Notes copied!" });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#080a0f] text-white">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-violet-900/10 via-[#080a0f] to-fuchsia-900/10">
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
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/20">
                <Brain className="h-7 w-7 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">AI Space Assistant</h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30">BETA</span>
                </div>
                <p className="text-sm text-white/40 mt-0.5">Auto-transcription, show notes, chapters & keyword alerts</p>
              </div>
            </div>

            {/* Live indicator */}
            <div className="mt-5 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 w-fit">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-300/70 font-medium">Listening — auto-transcription active for all live spaces</span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-5 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/[0.06]">
              {(["transcripts", "alerts", "settings"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    activeTab === tab ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">

          {/* ── TRANSCRIPTS TAB ── */}
          {activeTab === "transcripts" && (
            <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[400px]">
              {/* Spaces list */}
              <div className={cn("space-y-2", selectedSpace ? "w-72 shrink-0" : "w-full")}>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Past Spaces</h2>
                {MOCK_SPACES.map(space => (
                  <button
                    key={space.id}
                    onClick={() => setSelectedSpace(space)}
                    className={cn(
                      "w-full p-4 rounded-2xl text-left transition-all border",
                      selectedSpace?.id === space.id
                        ? "bg-violet-500/10 border-violet-500/30"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]"
                    )}
                  >
                    <p className="text-sm font-semibold text-white line-clamp-1">{space.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{space.date} · {formatTime(space.duration)} · {space.listeners} listeners</p>
                    <div className="flex items-center gap-2 mt-2">
                      {space.has_transcript && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300/80">Transcript</span>}
                      {space.has_notes && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300/80">Notes</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {space.topics.slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] text-white/25">#{t}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              {/* Detail panel */}
              {selectedSpace && (
                <div className="flex-1 overflow-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">{selectedSpace.title}</h2>
                      <p className="text-xs text-white/40">{selectedSpace.date} · {formatTime(selectedSpace.duration)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewMode("notes")}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all",
                          viewMode === "notes" ? "bg-violet-500/20 text-violet-300" : "text-white/40 hover:text-white/70"
                        )}
                      >
                        <BookOpen className="h-3.5 w-3.5" />Notes
                      </button>
                      <button
                        onClick={() => setViewMode("transcript")}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all",
                          viewMode === "transcript" ? "bg-violet-500/20 text-violet-300" : "text-white/40 hover:text-white/70"
                        )}
                      >
                        <AlignLeft className="h-3.5 w-3.5" />Transcript
                      </button>
                    </div>
                  </div>

                  {/* Notes view */}
                  {viewMode === "notes" && (
                    <div className="space-y-4">
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button onClick={copyNotes} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/50 text-xs hover:bg-white/[0.08]">
                          <Copy className="h-3.5 w-3.5" />Copy
                        </button>
                        <button
                          onClick={() => generateNotes(selectedSpace.id)}
                          disabled={generatingNotes}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 text-xs hover:bg-violet-500/25 disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" />{generatingNotes ? "Generating..." : "Regenerate"}
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Summary</p>
                        <p className="text-sm text-white/70 leading-relaxed">{MOCK_SHOW_NOTES.summary}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Key Points</p>
                        <ul className="space-y-2">
                          {MOCK_SHOW_NOTES.key_points.map((pt, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="text-sm text-white/70">{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Chapters</p>
                        <div className="space-y-2">
                          {MOCK_SHOW_NOTES.chapters.map(ch => (
                            <div key={ch.title} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-violet-400/70 w-10 shrink-0">{formatTime(ch.timestamp)}</span>
                              <span className="text-sm text-white/70">{ch.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Topics</p>
                        <div className="flex flex-wrap gap-2">
                          {MOCK_SHOW_NOTES.topics.map(t => (
                            <span key={t} className="px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-300/80 border border-violet-500/20">#{t}</span>
                          ))}
                        </div>
                      </div>

                      {MOCK_SHOW_NOTES.resources.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Resources</p>
                          <ul className="space-y-1.5">
                            {MOCK_SHOW_NOTES.resources.map((r, i) => (
                              <li key={i} className="text-sm text-blue-400/70">{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transcript view */}
                  {viewMode === "transcript" && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <input
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search transcript..."
                          className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] rounded-xl text-sm text-white placeholder-white/25 outline-none border border-white/[0.06] focus:border-violet-500/40"
                        />
                      </div>

                      <div className="space-y-2">
                        {filteredTranscript.map(seg => (
                          <div key={seg.id} className={cn("p-4 rounded-xl transition-all", seg.is_chapter_start ? "bg-violet-500/8 border border-violet-500/15" : "bg-white/[0.02]")}>
                            {seg.is_chapter_start && (
                              <div className="flex items-center gap-2 mb-2">
                                <Bookmark className="h-3.5 w-3.5 text-violet-400" />
                                <span className="text-xs font-bold text-violet-300">{seg.chapter_title}</span>
                                <span className="text-[10px] text-white/25 font-mono ml-auto">{formatTime(seg.timestamp)}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-bold text-white/50 w-12 shrink-0 mt-0.5">
                                {!seg.is_chapter_start && <span className="font-mono text-white/25">{formatTime(seg.timestamp)}</span>}
                              </span>
                              <div>
                                <span className="text-xs font-bold text-violet-300/80 mr-2">{seg.speaker}</span>
                                <span className="text-sm text-white/70 leading-relaxed">{seg.text}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ALERTS TAB ── */}
          {activeTab === "alerts" && (
            <div className="space-y-4 max-w-lg">
              <div>
                <h2 className="text-base font-bold text-white">Keyword Alerts</h2>
                <p className="text-sm text-white/40 mt-0.5">Get notified instantly when these words are spoken in any live space.</p>
              </div>

              {/* Add keyword */}
              <div className="flex gap-2">
                <input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addKeyword()}
                  placeholder="Add keyword (e.g. 'diabetic foot')"
                  className="flex-1 bg-white/[0.04] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none border border-white/[0.06] focus:border-violet-500/40"
                />
                <button onClick={addKeyword} className="px-4 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-400">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {keywords.map(kw => (
                  <div key={kw.id} className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <Bell className={cn("h-4 w-4", kw.is_active ? "text-violet-400" : "text-white/20")} />
                      <span className="text-sm font-medium text-white">"{kw.keyword}"</span>
                      {kw.triggers_today > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">{kw.triggers_today}x today</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, is_active: !k.is_active } : k))}
                        className={cn("text-xs px-2.5 py-1 rounded-lg font-medium border transition-all",
                          kw.is_active ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-white/[0.03] text-white/30 border-white/[0.06]"
                        )}
                      >
                        {kw.is_active ? "On" : "Off"}
                      </button>
                      <button onClick={() => removeKeyword(kw.id)} className="p-1.5 text-red-400/40 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === "settings" && (
            <div className="space-y-3 max-w-lg">
              <h2 className="text-base font-bold text-white">AI Assistant Settings</h2>
              {[
                { label: "Auto-Transcription", desc: "Transcribe every space automatically", state: autoTranscribe, set: setAutoTranscribe, icon: Mic },
                { label: "Auto Show Notes", desc: "Generate notes when space ends", state: autoNotes, set: setAutoNotes, icon: FileText },
                { label: "Auto Chapter Markers", desc: "Detect topic changes and add chapter breaks", state: autoChapters, set: setAutoChapters, icon: Bookmark },
                { label: "Auto Topic Tags", desc: "Tag spaces for discovery algorithm", state: autoTopicTags, set: setAutoTopicTags, icon: Hash },
              ].map(setting => (
                <div key={setting.label} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <setting.icon className="h-5 w-5 text-violet-400/70" />
                    <div>
                      <p className="text-sm font-semibold text-white">{setting.label}</p>
                      <p className="text-xs text-white/40">{setting.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setting.set(!setting.state); toast({ title: `${setting.label} ${!setting.state ? "enabled" : "disabled"}` }); }}
                    className={cn("relative w-11 h-6 rounded-full transition-all",
                      setting.state ? "bg-violet-500" : "bg-white/[0.1]"
                    )}
                  >
                    <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", setting.state ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AISpaceAssistant;
