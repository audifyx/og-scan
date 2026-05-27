/**
 * EnterpriseDashboard — ogscan.fun/enterprise
 *
 * Feature 20: Enterprise & Healthcare Mode
 * - HIPAA-compliant recording storage (huge for OrthoGenix's medical audience)
 * - Encrypted private spaces — invite-only, zero public metadata
 * - SSO / SAML login for corporate teams
 * - Compliance audit logs
 * - Custom data retention policies
 * - Team seat management
 * - SLA guarantees
 */
import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import {
  Shield, Lock, FileSearch, Users, Database, Clock, CheckCircle,
  AlertTriangle, Building2, Key, Eye, EyeOff, Copy, Download,
  Settings, Plus, Trash2, ChevronRight, ExternalLink, Globe,
  Cpu, Activity, Server, ToggleLeft, ToggleRight, Fingerprint,
  ClipboardList, HardDrive, Award, Zap, ArrowLeft
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  resource: string;
  timestamp: string;
  ip: string;
  status: "success" | "warning" | "error";
}

interface TeamSeat {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  lastActive: string;
  status: "active" | "pending" | "suspended";
}

const MOCK_LOGS: AuditLog[] = [
  { id: "1", action: "space.recording_accessed", actor: "admin@orthogenix.com.au", resource: "Space #8821", timestamp: "2026-05-27 00:12", ip: "203.24.18.99", status: "success" },
  { id: "2", action: "user.sso_login", actor: "dr.chen@orthogenix.com.au", resource: "SSO/SAML", timestamp: "2026-05-26 23:58", ip: "203.24.18.45", status: "success" },
  { id: "3", action: "space.created", actor: "admin@orthogenix.com.au", resource: "Encrypted Space #8822", timestamp: "2026-05-26 23:44", ip: "203.24.18.99", status: "success" },
  { id: "4", action: "recording.export", actor: "dr.smith@orthogenix.com.au", resource: "Recording #7741-E", timestamp: "2026-05-26 22:10", ip: "203.24.20.11", status: "success" },
  { id: "5", action: "user.login_failed", actor: "unknown@external.com", resource: "Auth", timestamp: "2026-05-26 21:30", ip: "185.220.101.12", status: "error" },
  { id: "6", action: "api_key.created", actor: "admin@orthogenix.com.au", resource: "API Key #4", timestamp: "2026-05-26 20:05", ip: "203.24.18.99", status: "success" },
  { id: "7", action: "space.recording_deleted", actor: "admin@orthogenix.com.au", resource: "Recording #7200", timestamp: "2026-05-25 16:20", ip: "203.24.18.99", status: "warning" },
];

const MOCK_SEATS: TeamSeat[] = [
  { id: "1", name: "SIR OG (Admin)", email: "ogogscan@gmail.com", role: "admin", lastActive: "now", status: "active" },
  { id: "2", name: "Dr. Sarah Chen", email: "dr.chen@orthogenix.com.au", role: "member", lastActive: "2h ago", status: "active" },
  { id: "3", name: "James Okafor", email: "j.okafor@orthogenix.com.au", role: "member", lastActive: "1d ago", status: "active" },
  { id: "4", name: "Maria Santos", email: "m.santos@orthogenix.com.au", role: "viewer", lastActive: "3d ago", status: "active" },
  { id: "5", name: "New Member", email: "new@orthogenix.com.au", role: "member", lastActive: "—", status: "pending" },
];

const COMPLIANCE_ITEMS = [
  { label: "HIPAA Compliant Recording Storage", status: true, desc: "All recordings encrypted at rest with AES-256" },
  { label: "SOC 2 Type II", status: true, desc: "Annual third-party audit certification" },
  { label: "GDPR Data Processing Agreement", status: true, desc: "DPA available for EU customers" },
  { label: "ISO 27001 Certification", status: false, desc: "Coming Q3 2026" },
  { label: "HL7 FHIR Integration", status: false, desc: "Healthcare data interoperability — coming Q4 2026" },
];

const RETENTION_OPTIONS = ["30 days", "90 days", "1 year", "3 years", "7 years", "Indefinite"];

const EnterpriseDashboard = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "audit" | "team" | "sso" | "retention">("overview");
  const navigate = useNavigate();
  const [encryptedSpaces, setEncryptedSpaces] = useState(true);
  const [hipaaMode, setHipaaMode] = useState(true);
  const [zeroMetadata, setZeroMetadata] = useState(false);
  const [selectedRetention, setSelectedRetention] = useState("1 year");
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [samlUrl, setSamlUrl] = useState("");
  const [samlCert, setSamlCert] = useState("");
  const [showCert, setShowCert] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [newSeatEmail, setNewSeatEmail] = useState("");

  const filteredLogs = MOCK_LOGS.filter(l =>
    !auditSearch || l.action.includes(auditSearch) || l.actor.includes(auditSearch) || l.resource.includes(auditSearch)
  );

  const toggle = (setter: (v: boolean) => void, val: boolean, label: string) => {
    setter(!val);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#080a0f] text-white">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-slate-900/40 via-[#080a0f] to-emerald-900/10">
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
              <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-500/20 to-emerald-500/10 border border-slate-500/20">
                <Building2 className="h-7 w-7 text-slate-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Enterprise Dashboard</h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25">HIPAA</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-bold border border-blue-500/25">SOC 2</span>
                </div>
                <p className="text-sm text-white/40 mt-0.5">Security, compliance, team management & audit logs</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-5 flex-wrap">
              {(["overview", "audit", "team", "sso", "retention"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    activeTab === tab ? "bg-slate-500/20 text-slate-200 border border-slate-500/30" : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "sso" ? "SSO / SAML" : tab === "retention" ? "Data Retention" : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Team Seats", value: "5/20", icon: Users, color: "text-blue-400" },
                  { label: "Encrypted Spaces", value: "12", icon: Lock, color: "text-violet-400" },
                  { label: "Storage Used", value: "48 GB", icon: HardDrive, color: "text-amber-400" },
                  { label: "Audit Events", value: "1,284", icon: FileSearch, color: "text-emerald-400" },
                ].map(stat => (
                  <div key={stat.label} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <stat.icon className={cn("h-5 w-5 mb-2", stat.color)} />
                    <p className="text-xl font-black text-white">{stat.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Compliance */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-emerald-400" />Compliance Status</p>
                <div className="space-y-2.5">
                  {COMPLIANCE_ITEMS.map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      {item.status ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-white/25 shrink-0" />
                      )}
                      <div>
                        <span className={cn("text-sm font-medium", item.status ? "text-white" : "text-white/40")}>{item.label}</span>
                        <span className="text-xs text-white/30 ml-2">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security toggles */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                <p className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Shield className="h-4 w-4 text-slate-400" />Security Settings</p>
                {[
                  { label: "HIPAA Mode", desc: "Encrypt all recordings + enforce data residency", state: hipaaMode, set: setHipaaMode, icon: Fingerprint },
                  { label: "Encrypted Spaces", desc: "All spaces invite-only with E2E encryption", state: encryptedSpaces, set: setEncryptedSpaces, icon: Lock },
                  { label: "Zero Public Metadata", desc: "No space titles, speakers, or schedules visible publicly", state: zeroMetadata, set: setZeroMetadata, icon: Eye },
                ].map(setting => (
                  <div key={setting.label} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <setting.icon className="h-4 w-4 text-slate-400/70" />
                      <div>
                        <p className="text-sm font-medium text-white">{setting.label}</p>
                        <p className="text-xs text-white/35">{setting.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggle(setting.set, setting.state, setting.label)}
                      className={cn("relative w-11 h-6 rounded-full transition-all", setting.state ? "bg-emerald-500" : "bg-white/[0.1]")}
                    >
                      <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", setting.state ? "left-[22px]" : "left-0.5")} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AUDIT LOGS ── */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Audit Logs</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/50 text-xs hover:bg-white/[0.08]">
                  <Download className="h-3.5 w-3.5" />Export CSV
                </button>
              </div>

              <input
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Search logs..."
                className="w-full bg-white/[0.04] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none border border-white/[0.06] focus:border-slate-500/40"
              />

              <div className="space-y-2">
                {filteredLogs.map(log => (
                  <div key={log.id} className={cn("p-4 rounded-xl flex items-start gap-3 border",
                    log.status === "error" ? "bg-red-500/5 border-red-500/15"
                      : log.status === "warning" ? "bg-amber-500/5 border-amber-500/15"
                        : "bg-white/[0.02] border-white/[0.04]"
                  )}>
                    {log.status === "success" && <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
                    {log.status === "warning" && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />}
                    {log.status === "error" && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-white/80">{log.action}</span>
                        <span className="text-[11px] text-white/30">→</span>
                        <span className="text-xs text-white/50">{log.resource}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-white/40">{log.actor}</span>
                        <span className="text-[11px] text-white/25">{log.ip}</span>
                        <span className="text-[11px] text-white/25 ml-auto">{log.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TEAM ── */}
          {activeTab === "team" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Team Management</h2>
                  <p className="text-xs text-white/40">5 of 20 seats used</p>
                </div>
              </div>

              {/* Invite */}
              <div className="flex gap-2">
                <input
                  value={newSeatEmail}
                  onChange={e => setNewSeatEmail(e.target.value)}
                  placeholder="Invite team member by email"
                  className="flex-1 bg-white/[0.04] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none border border-white/[0.06] focus:border-slate-500/40"
                />
                <button className="px-4 py-2.5 rounded-xl bg-slate-600 text-white font-bold text-sm hover:bg-slate-500">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {MOCK_SEATS.map(seat => (
                  <div key={seat.id} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{seat.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{seat.name}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold",
                          seat.role === "admin" ? "bg-amber-500/20 text-amber-300" : seat.role === "member" ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.06] text-white/40"
                        )}>{seat.role}</span>
                        {seat.status === "pending" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">pending</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-white/35">{seat.email}</span>
                        <span className="text-xs text-white/25">Active: {seat.lastActive}</span>
                      </div>
                    </div>
                    {seat.role !== "admin" && (
                      <button className="p-1.5 text-red-400/40 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SSO / SAML ── */}
          {activeTab === "sso" && (
            <div className="space-y-4 max-w-lg">
              <div>
                <h2 className="text-base font-bold text-white">SSO / SAML Configuration</h2>
                <p className="text-sm text-white/40 mt-0.5">Let your team log in via your corporate identity provider.</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-sm font-semibold text-white">Enable SSO</p>
                  <p className="text-xs text-white/40">Enforce SAML 2.0 for all team members</p>
                </div>
                <button
                  onClick={() => setSsoEnabled(!ssoEnabled)}
                  className={cn("relative w-11 h-6 rounded-full transition-all", ssoEnabled ? "bg-emerald-500" : "bg-white/[0.1]")}
                >
                  <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", ssoEnabled ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>

              <div className={cn("space-y-3 transition-all", !ssoEnabled && "opacity-40 pointer-events-none")}>
                <div>
                  <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">SSO / IdP Metadata URL</label>
                  <input
                    value={samlUrl}
                    onChange={e => setSamlUrl(e.target.value)}
                    placeholder="https://sso.yourcompany.com/saml/metadata"
                    className="w-full bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/15 outline-none border border-white/[0.08] focus:border-slate-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">X.509 Certificate</label>
                  <div className="relative">
                    <textarea
                      value={samlCert}
                      onChange={e => setSamlCert(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      rows={5}
                      className="w-full bg-white/[0.05] rounded-xl px-4 py-3 text-xs font-mono text-emerald-300/70 placeholder-white/10 outline-none border border-white/[0.08] focus:border-slate-500/40 resize-none"
                    />
                    <button onClick={() => setShowCert(!showCert)} className="absolute top-3 right-3 text-white/20 hover:text-white/50">
                      {showCert ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* ACS URL */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs text-white/40 mb-1.5">Your ACS URL (give to your IdP)</p>
                  <div className="flex items-center gap-2 font-mono text-xs text-white/60">
                    <span className="flex-1">https://ogscan.fun/auth/saml/callback</span>
                    <button onClick={() => copyToClipboard("https://ogscan.fun/auth/saml/callback")} className="text-white/30 hover:text-white/60">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <button className="w-full py-3 rounded-xl bg-slate-600 text-white font-bold text-sm hover:bg-slate-500 transition-colors">
                  Save SSO Configuration
                </button>
              </div>
            </div>
          )}

          {/* ── RETENTION ── */}
          {activeTab === "retention" && (
            <div className="space-y-4 max-w-lg">
              <div>
                <h2 className="text-base font-bold text-white">Data Retention Policy</h2>
                <p className="text-sm text-white/40 mt-0.5">Control how long recordings, transcripts and data are kept.</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/70">HIPAA requires healthcare providers to retain records for a minimum of 6 years from the date of creation.</p>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Space Recordings", current: "1 year" },
                  { label: "Chat Transcripts", current: "90 days" },
                  { label: "Audit Logs", current: "7 years" },
                  { label: "User Data", current: "Indefinite" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-slate-400/60" />
                      <span className="text-sm font-medium text-white">{item.label}</span>
                    </div>
                    <select
                      defaultValue={item.current}
                      className="bg-white/[0.08] text-white text-xs px-3 py-1.5 rounded-lg border border-white/[0.1] outline-none"
                    >
                      {RETENTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <button className="w-full py-3 rounded-xl bg-slate-600 text-white font-bold text-sm hover:bg-slate-500 transition-colors">
                Save Retention Policy
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default EnterpriseDashboard;
