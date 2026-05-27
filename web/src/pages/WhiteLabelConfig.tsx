/**
 * WhiteLabelConfig — White-label & brand customization settings.
 * Configure custom domain, branding, colors, CSS/JS overrides,
 * and toggle OGScan branding visibility.
 */
import React, { useState, useEffect } from "react";
import {
  Palette, Globe, Code, Eye, EyeOff, Save, ChevronLeft,
  ExternalLink, Check, AlertCircle, Brush, Layout, Zap, Upload
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface WhitelabelConfig {
  id?: string;
  owner_id: string;
  subdomain: string | null;
  custom_domain: string | null;
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  hide_ogscan_branding: boolean;
  custom_css: string | null;
  custom_js: string | null;
  is_active: boolean;
}

const PRESET_PALETTES = [
  { name: "OG Purple", primary: "#7c3aed", secondary: "#a855f7", accent: "#c084fc" },
  { name: "Midnight Blue", primary: "#1d4ed8", secondary: "#3b82f6", accent: "#60a5fa" },
  { name: "Emerald", primary: "#059669", secondary: "#10b981", accent: "#34d399" },
  { name: "Rose", primary: "#e11d48", secondary: "#f43f5e", accent: "#fb7185" },
  { name: "Amber", primary: "#d97706", secondary: "#f59e0b", accent: "#fbbf24" },
  { name: "Slate", primary: "#334155", secondary: "#475569", accent: "#94a3b8" },
];

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="p-1.5 rounded-lg bg-white/[0.05]">
      <Icon className="h-4 w-4 text-violet-400" />
    </div>
    <h2 className="text-sm font-black text-white/70 uppercase tracking-wider">{title}</h2>
  </div>
);

const InputField = ({ label, value, onChange, placeholder, type = "text", hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) => (
  <div>
    <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder-white/20 border border-white/[0.06] focus:border-violet-500/40 transition-colors"
    />
    {hint && <p className="text-[10px] text-white/20 mt-1">{hint}</p>}
  </div>
);

const WhiteLabelConfig: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<WhitelabelConfig>({
    owner_id: user?.id || "",
    subdomain: "",
    custom_domain: "",
    brand_name: "OGScan",
    logo_url: "",
    favicon_url: "",
    primary_color: "#7c3aed",
    secondary_color: "#a855f7",
    accent_color: "#c084fc",
    hide_ogscan_branding: false,
    custom_css: "",
    custom_js: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"branding" | "domain" | "colors" | "code">("branding");
  const [domainStatus, setDomainStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  useEffect(() => { if (user) loadConfig(); }, [user]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("whitelabel_configs")
      .select("*")
      .eq("owner_id", user!.id)
      .single();
    if (data) setConfig(data as WhitelabelConfig);
    setLoading(false);
  };

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    const payload = { ...config, owner_id: user.id };
    if (config.id) {
      await supabase.from("whitelabel_configs").update(payload).eq("id", config.id);
    } else {
      const { data } = await supabase.from("whitelabel_configs").insert(payload).select().single();
      if (data) setConfig(data as WhitelabelConfig);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const checkDomain = async () => {
    if (!config.custom_domain) return;
    setDomainStatus("checking");
    await new Promise(r => setTimeout(r, 1500));
    setDomainStatus("invalid"); // Real implementation would do DNS lookup
  };

  const update = (key: keyof WhitelabelConfig, value: any) => setConfig(prev => ({ ...prev, [key]: value }));

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0f]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-white/[0.06]">
            <ChevronLeft className="h-5 w-5 text-white/40" />
          </button>
          <div>
            <h1 className="text-base font-black">White-label</h1>
            <p className="text-xs text-white/30">Brand customization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", config.is_active ? "bg-emerald-500" : "bg-white/20")} />
            <span className="text-xs text-white/30">{config.is_active ? "Active" : "Inactive"}</span>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
              saved ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            )}
          >
            {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? "Saving…" : <><Save className="h-4 w-4" /> Save</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 border-b border-white/[0.06] overflow-x-auto">
        {([
          { id: "branding", label: "Branding", icon: Layout },
          { id: "domain", label: "Domain", icon: Globe },
          { id: "colors", label: "Colors", icon: Palette },
          { id: "code", label: "Code", icon: Code },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              activeTab === tab.id ? "bg-violet-600/20 text-violet-400 border border-violet-500/20" : "text-white/30 hover:text-white/60"
            )}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 max-w-lg space-y-5">
        {/* Branding tab */}
        {activeTab === "branding" && (
          <>
            <SectionTitle icon={Layout} title="Identity" />
            <InputField label="Brand Name" value={config.brand_name} onChange={v => update("brand_name", v)} placeholder="My Platform" />
            <InputField label="Logo URL" value={config.logo_url || ""} onChange={v => update("logo_url", v)} placeholder="https://..." hint="Recommended: 200×60px transparent PNG" />
            <InputField label="Favicon URL" value={config.favicon_url || ""} onChange={v => update("favicon_url", v)} placeholder="https://..." hint="32×32px ICO or PNG" />

            {/* Logo preview */}
            {config.logo_url && (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-2">Preview</p>
                <img src={config.logo_url} alt="Logo" className="h-8 object-contain" onError={e => (e.currentTarget.style.display = "none")} />
              </div>
            )}

            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <button onClick={() => update("hide_ogscan_branding", !config.hide_ogscan_branding)}
                className={cn("relative w-10 h-5 rounded-full transition-colors shrink-0", config.hide_ogscan_branding ? "bg-violet-600" : "bg-white/[0.1]")}>
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", config.hide_ogscan_branding ? "left-5" : "left-0.5")} />
              </button>
              <div>
                <p className="text-sm font-bold text-white">Hide OGScan Branding</p>
                <p className="text-xs text-white/30">Remove "Powered by OGScan" footer</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <button onClick={() => update("is_active", !config.is_active)}
                className={cn("relative w-10 h-5 rounded-full transition-colors shrink-0", config.is_active ? "bg-emerald-600" : "bg-white/[0.1]")}>
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", config.is_active ? "left-5" : "left-0.5")} />
              </button>
              <div>
                <p className="text-sm font-bold text-white">White-label Active</p>
                <p className="text-xs text-white/30">Enable custom branding on your domain</p>
              </div>
            </div>
          </>
        )}

        {/* Domain tab */}
        {activeTab === "domain" && (
          <>
            <SectionTitle icon={Globe} title="Custom Domain" />
            <InputField
              label="Subdomain"
              value={config.subdomain || ""}
              onChange={v => update("subdomain", v)}
              placeholder="myplatform"
              hint="yourname.ogscan.fun — free, instant"
            />
            <div>
              <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Custom Domain</label>
              <div className="flex gap-2">
                <input
                  value={config.custom_domain || ""}
                  onChange={e => update("custom_domain", e.target.value)}
                  placeholder="spaces.myplatform.com"
                  className="flex-1 bg-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder-white/20 border border-white/[0.06] focus:border-violet-500/40 transition-colors"
                />
                <button onClick={checkDomain}
                  className="px-3 py-2.5 rounded-xl bg-white/[0.05] text-xs text-white/50 font-bold hover:bg-white/[0.08] transition-colors whitespace-nowrap">
                  {domainStatus === "checking" ? "Checking…" : "Verify"}
                </button>
              </div>
              {domainStatus === "valid" && <p className="text-xs text-emerald-400 mt-1">✓ Domain verified!</p>}
              {domainStatus === "invalid" && (
                <div className="mt-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <p className="text-xs text-amber-400 font-bold mb-1">DNS Setup Required</p>
                  <p className="text-xs text-white/30">Add a CNAME record:</p>
                  <code className="text-xs text-violet-400 font-mono block mt-1">
                    {config.custom_domain} → cname.ogscan.fun
                  </code>
                </div>
              )}
            </div>
          </>
        )}

        {/* Colors tab */}
        {activeTab === "colors" && (
          <>
            <SectionTitle icon={Palette} title="Color Palette" />
            <p className="text-xs text-white/30 mb-4">Pick a preset or customize individual colors</p>
            {/* Presets */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {PRESET_PALETTES.map(p => (
                <button key={p.name} onClick={() => { update("primary_color", p.primary); update("secondary_color", p.secondary); update("accent_color", p.accent); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                  <div className="flex gap-1">
                    {[p.primary, p.secondary, p.accent].map(c => (
                      <span key={c} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <p className="text-[10px] text-white/40">{p.name}</p>
                </button>
              ))}
            </div>
            {/* Custom */}
            {[
              { key: "primary_color", label: "Primary" },
              { key: "secondary_color", label: "Secondary" },
              { key: "accent_color", label: "Accent" },
            ].map(c => (
              <div key={c.key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={(config as any)[c.key]}
                  onChange={e => update(c.key as keyof WhitelabelConfig, e.target.value)}
                  className="w-10 h-10 rounded-xl border border-white/[0.1] bg-transparent cursor-pointer shrink-0"
                />
                <div className="flex-1">
                  <p className="text-xs text-white/50 font-bold">{c.label}</p>
                  <input
                    value={(config as any)[c.key]}
                    onChange={e => update(c.key as keyof WhitelabelConfig, e.target.value)}
                    className="bg-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs text-white/70 font-mono w-28 outline-none border border-white/[0.06] focus:border-violet-500/40"
                  />
                </div>
              </div>
            ))}
            {/* Preview swatch */}
            <div className="p-4 rounded-2xl border border-white/[0.06] mt-2" style={{ background: `linear-gradient(135deg, ${config.primary_color}20, ${config.secondary_color}10)` }}>
              <p className="text-xs text-white/30 mb-2">Preview</p>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: config.primary_color }}>Primary</span>
                <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: config.secondary_color }}>Secondary</span>
                <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: config.accent_color }}>Accent</span>
              </div>
            </div>
          </>
        )}

        {/* Code tab */}
        {activeTab === "code" && (
          <>
            <SectionTitle icon={Code} title="Custom Code" />
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/70">Custom JS runs in user browsers. Only use trusted code.</p>
            </div>
            <div>
              <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Custom CSS</label>
              <textarea
                value={config.custom_css || ""}
                onChange={e => update("custom_css", e.target.value)}
                placeholder="/* Override default styles */&#10;.space-card { border-radius: 16px; }"
                rows={7}
                className="w-full bg-white/[0.05] rounded-xl px-4 py-3 text-xs text-emerald-300/80 font-mono outline-none placeholder-white/15 border border-white/[0.06] focus:border-violet-500/40 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 font-bold uppercase tracking-wide block mb-1.5">Custom JavaScript</label>
              <textarea
                value={config.custom_js || ""}
                onChange={e => update("custom_js", e.target.value)}
                placeholder="// Custom analytics, widgets, etc&#10;console.log('Hello from my platform');"
                rows={7}
                className="w-full bg-white/[0.05] rounded-xl px-4 py-3 text-xs text-blue-300/80 font-mono outline-none placeholder-white/15 border border-white/[0.06] focus:border-violet-500/40 resize-none"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WhiteLabelConfig;
