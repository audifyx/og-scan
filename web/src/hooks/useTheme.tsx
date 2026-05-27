import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";


// ── OG / WOJAK / MEME / SOLANA / CRYPTO THEMES (200 total) ──
// Each theme has optional `gradient` field for background layer (CSS gradient string)
// AppLayout renders it as a fixed behind the main content at low opacity, same as custom wallpaper

export interface ThemePreset {
  id: string;
  name: string;
  category: string;
  vars: Record<string, string>;
  gradient?: string; // Optional CSS gradient for background
}

// Helper: build a standard dark theme vars block
function mkVars(bg: string, fg: string, pri: string, acc: string, sec: string): Record<string, string> {
  return {
    "--background": bg,
    "--foreground": fg,
    "--card": bg.replace(/(\d+)%$/, (_, n) => `${Math.min(100, parseInt(n) + 3)}%`),
    "--card-foreground": fg,
    "--primary": pri,
    "--primary-foreground": "0 0% 3%",
    "--accent": acc,
    "--accent-foreground": "0 0% 100%",
    "--secondary": sec,
    "--secondary-foreground": fg,
    "--muted": bg.replace(/(\d+)%$/, (_, n) => `${Math.min(100, parseInt(n) + 2)}%`),
    "--muted-foreground": "0 0% 45%",
    "--border": bg.replace(/(\d+)%$/, (_, n) => `${Math.min(100, parseInt(n) + 5)}%`),
    "--input": bg.replace(/(\d+)%$/, (_, n) => `${Math.min(100, parseInt(n) + 5)}%`),
    "--ring": pri,
    "--popover": bg.replace(/(\d+)%$/, (_, n) => `${Math.min(100, parseInt(n) + 3)}%`),
    "--popover-foreground": fg,
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  // ── GLASS & BROKEN GLASS (8) ──
  { id: "broken-glass-gold", name: "Broken Glass Gold", category: "Glass", vars: {
    "--background":"0 0% 3%","--foreground":"40 10% 95%","--card":"0 0% 6%","--card-foreground":"40 10% 95%",
    "--primary":"43 90% 55%","--primary-foreground":"0 0% 3%","--accent":"35 80% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"38 30% 18%","--secondary-foreground":"40 10% 90%","--muted":"0 0% 10%","--muted-foreground":"0 0% 50%",
    "--border":"40 10% 14%","--input":"40 10% 14%","--ring":"43 90% 55%","--popover":"0 0% 7%","--popover-foreground":"40 10% 95%",
  }, gradient: "radial-gradient(ellipse at 20% 50%, rgba(245,197,24,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,160,0,0.12) 0%, transparent 50%)"},
  { id: "broken-glass-blue", name: "Broken Glass Blue", category: "Glass", vars: {
    "--background":"220 20% 4%","--foreground":"210 20% 95%","--card":"220 15% 7%","--card-foreground":"210 20% 95%",
    "--primary":"210 80% 55%","--primary-foreground":"0 0% 100%","--accent":"220 70% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 25% 16%","--secondary-foreground":"210 20% 90%","--muted":"220 15% 10%","--muted-foreground":"220 10% 50%",
    "--border":"220 15% 15%","--input":"220 15% 15%","--ring":"210 80% 55%","--popover":"220 15% 7%","--popover-foreground":"210 20% 95%",
  }, gradient: "radial-gradient(ellipse at 30% 40%, rgba(55,130,220,0.2) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(0,80,200,0.12) 0%, transparent 50%)"},
  { id: "broken-glass-emerald", name: "Broken Glass Emerald", category: "Glass", vars: {
    "--background":"160 15% 3%","--foreground":"150 10% 95%","--card":"160 10% 6%","--card-foreground":"150 10% 95%",
    "--primary":"155 70% 45%","--primary-foreground":"0 0% 3%","--accent":"165 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"160 20% 15%","--secondary-foreground":"150 10% 90%","--muted":"160 10% 10%","--muted-foreground":"160 5% 50%",
    "--border":"160 10% 14%","--input":"160 10% 14%","--ring":"155 70% 45%","--popover":"160 10% 7%","--popover-foreground":"150 10% 95%",
  }, gradient: "radial-gradient(ellipse at 25% 60%, rgba(0,200,120,0.18) 0%, transparent 55%)"},
  { id: "broken-glass-purple", name: "Broken Glass Purple", category: "Glass", vars: {
    "--background":"270 15% 4%","--foreground":"270 10% 95%","--card":"270 10% 7%","--card-foreground":"270 10% 95%",
    "--primary":"270 60% 55%","--primary-foreground":"0 0% 100%","--accent":"280 50% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"270 20% 16%","--secondary-foreground":"270 10% 90%","--muted":"270 10% 10%","--muted-foreground":"270 5% 50%",
    "--border":"270 10% 14%","--input":"270 10% 14%","--ring":"270 60% 55%","--popover":"270 10% 7%","--popover-foreground":"270 10% 95%",
  }, gradient: "radial-gradient(ellipse at 60% 30%, rgba(150,60,240,0.2) 0%, transparent 55%)"},
  { id: "broken-glass-rose", name: "Broken Glass Rose", category: "Glass", vars: {
    "--background":"350 15% 4%","--foreground":"350 10% 95%","--card":"350 10% 7%","--card-foreground":"350 10% 95%",
    "--primary":"345 70% 55%","--primary-foreground":"0 0% 100%","--accent":"340 60% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"350 20% 16%","--secondary-foreground":"350 10% 90%","--muted":"350 10% 10%","--muted-foreground":"350 5% 50%",
    "--border":"350 10% 14%","--input":"350 10% 14%","--ring":"345 70% 55%","--popover":"350 10% 7%","--popover-foreground":"350 10% 95%",
  }, gradient: "radial-gradient(ellipse at 40% 50%, rgba(240,60,100,0.2) 0%, transparent 55%)"},
  { id: "frosted-glass", name: "Frosted Glass", category: "Glass", vars: {
    "--background":"220 10% 5%","--foreground":"0 0% 93%","--card":"220 8% 8%","--card-foreground":"0 0% 93%",
    "--primary":"0 0% 90%","--primary-foreground":"220 10% 5%","--accent":"220 15% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 8% 14%","--secondary-foreground":"0 0% 85%","--muted":"220 8% 11%","--muted-foreground":"220 5% 45%",
    "--border":"220 8% 16%","--input":"220 8% 16%","--ring":"0 0% 90%","--popover":"220 8% 8%","--popover-foreground":"0 0% 93%",
  }, gradient: "linear-gradient(135deg, rgba(200,220,255,0.06) 0%, rgba(150,180,255,0.04) 100%)"},
  { id: "stained-glass", name: "Stained Glass", category: "Glass", vars: {
    "--background":"240 15% 4%","--foreground":"30 20% 95%","--card":"240 10% 7%","--card-foreground":"30 20% 95%",
    "--primary":"30 85% 55%","--primary-foreground":"0 0% 3%","--accent":"200 70% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 15% 15%","--secondary-foreground":"30 15% 85%","--muted":"240 10% 10%","--muted-foreground":"240 5% 45%",
    "--border":"240 10% 15%","--input":"240 10% 15%","--ring":"30 85% 55%","--popover":"240 10% 7%","--popover-foreground":"30 20% 95%",
  }, gradient: "radial-gradient(ellipse at 20% 20%, rgba(255,140,0,0.15) 0%, transparent 40%), radial-gradient(ellipse at 80% 80%, rgba(0,150,255,0.12) 0%, transparent 40%), radial-gradient(ellipse at 50% 50%, rgba(255,0,100,0.08) 0%, transparent 50%)"},
  { id: "crystal-ice", name: "Crystal Ice", category: "Glass", vars: {
    "--background":"200 20% 4%","--foreground":"195 15% 95%","--card":"200 15% 7%","--card-foreground":"195 15% 95%",
    "--primary":"195 80% 60%","--primary-foreground":"200 20% 4%","--accent":"190 60% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 15% 14%","--secondary-foreground":"195 10% 85%","--muted":"200 10% 10%","--muted-foreground":"200 8% 48%",
    "--border":"200 12% 15%","--input":"200 12% 15%","--ring":"195 80% 60%","--popover":"200 15% 7%","--popover-foreground":"195 15% 95%",
  }, gradient: "radial-gradient(ellipse at 50% 0%, rgba(0,220,255,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(100,200,255,0.1) 0%, transparent 40%)"},

  // ── DARK ELITE (8) ──
  { id: "midnight-black", name: "Midnight Black", category: "Dark Elite", vars: {
    "--background":"0 0% 2%","--foreground":"0 0% 92%","--card":"0 0% 5%","--card-foreground":"0 0% 92%",
    "--primary":"0 0% 85%","--primary-foreground":"0 0% 2%","--accent":"0 0% 25%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 10%","--secondary-foreground":"0 0% 80%","--muted":"0 0% 8%","--muted-foreground":"0 0% 42%",
    "--border":"0 0% 12%","--input":"0 0% 12%","--ring":"0 0% 85%","--popover":"0 0% 5%","--popover-foreground":"0 0% 92%",
  }},
  { id: "carbon-fiber", name: "Carbon Fiber", category: "Dark Elite", vars: {
    "--background":"210 8% 3%","--foreground":"210 5% 90%","--card":"210 6% 6%","--card-foreground":"210 5% 90%",
    "--primary":"210 30% 55%","--primary-foreground":"0 0% 100%","--accent":"210 20% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 8% 12%","--secondary-foreground":"210 5% 80%","--muted":"210 5% 9%","--muted-foreground":"210 5% 45%",
    "--border":"210 6% 14%","--input":"210 6% 14%","--ring":"210 30% 55%","--popover":"210 6% 6%","--popover-foreground":"210 5% 90%",
  }, gradient: "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 2px, transparent 2px, transparent 8px)"},
  { id: "obsidian", name: "Obsidian", category: "Dark Elite", vars: {
    "--background":"260 10% 3%","--foreground":"260 5% 90%","--card":"260 8% 6%","--card-foreground":"260 5% 90%",
    "--primary":"260 50% 60%","--primary-foreground":"0 0% 100%","--accent":"260 35% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"260 10% 12%","--secondary-foreground":"260 5% 80%","--muted":"260 8% 9%","--muted-foreground":"260 5% 45%",
    "--border":"260 8% 14%","--input":"260 8% 14%","--ring":"260 50% 60%","--popover":"260 8% 6%","--popover-foreground":"260 5% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 100%, rgba(120,60,220,0.15) 0%, transparent 60%)"},
  { id: "void-black", name: "Void", category: "Dark Elite", vars: {
    "--background":"0 0% 1%","--foreground":"0 0% 88%","--card":"0 0% 4%","--card-foreground":"0 0% 88%",
    "--primary":"43 90% 55%","--primary-foreground":"0 0% 1%","--accent":"43 70% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 8%","--secondary-foreground":"0 0% 75%","--muted":"0 0% 6%","--muted-foreground":"0 0% 38%",
    "--border":"0 0% 10%","--input":"0 0% 10%","--ring":"43 90% 55%","--popover":"0 0% 4%","--popover-foreground":"0 0% 88%",
  }},
  { id: "dark-steel", name: "Dark Steel", category: "Dark Elite", vars: {
    "--background":"215 12% 4%","--foreground":"215 8% 90%","--card":"215 10% 7%","--card-foreground":"215 8% 90%",
    "--primary":"215 40% 55%","--primary-foreground":"0 0% 100%","--accent":"215 30% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"215 10% 13%","--secondary-foreground":"215 5% 80%","--muted":"215 8% 10%","--muted-foreground":"215 5% 45%",
    "--border":"215 8% 14%","--input":"215 8% 14%","--ring":"215 40% 55%","--popover":"215 10% 7%","--popover-foreground":"215 8% 90%",
  }},
  { id: "charcoal-ember", name: "Charcoal Ember", category: "Dark Elite", vars: {
    "--background":"15 8% 3%","--foreground":"15 5% 90%","--card":"15 6% 6%","--card-foreground":"15 5% 90%",
    "--primary":"15 80% 55%","--primary-foreground":"0 0% 100%","--accent":"10 60% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"15 8% 12%","--secondary-foreground":"15 5% 80%","--muted":"15 5% 9%","--muted-foreground":"15 5% 45%",
    "--border":"15 6% 14%","--input":"15 6% 14%","--ring":"15 80% 55%","--popover":"15 6% 6%","--popover-foreground":"15 5% 90%",
  }, gradient: "radial-gradient(ellipse at 30% 70%, rgba(255,80,0,0.12) 0%, transparent 50%)"},
  { id: "deep-navy", name: "Deep Navy", category: "Dark Elite", vars: {
    "--background":"230 25% 4%","--foreground":"230 10% 92%","--card":"230 20% 7%","--card-foreground":"230 10% 92%",
    "--primary":"230 65% 58%","--primary-foreground":"0 0% 100%","--accent":"230 45% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 18% 14%","--secondary-foreground":"230 8% 82%","--muted":"230 15% 10%","--muted-foreground":"230 8% 46%",
    "--border":"230 15% 15%","--input":"230 15% 15%","--ring":"230 65% 58%","--popover":"230 20% 7%","--popover-foreground":"230 10% 92%",
  }, gradient: "radial-gradient(ellipse at 0% 50%, rgba(30,80,200,0.18) 0%, transparent 50%)"},
  { id: "shadow-bronze", name: "Shadow Bronze", category: "Dark Elite", vars: {
    "--background":"30 10% 3%","--foreground":"30 8% 90%","--card":"30 8% 6%","--card-foreground":"30 8% 90%",
    "--primary":"30 60% 48%","--primary-foreground":"0 0% 100%","--accent":"25 45% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"30 10% 12%","--secondary-foreground":"30 5% 78%","--muted":"30 6% 9%","--muted-foreground":"30 5% 42%",
    "--border":"30 8% 14%","--input":"30 8% 14%","--ring":"30 60% 48%","--popover":"30 8% 6%","--popover-foreground":"30 8% 90%",
  }, gradient: "radial-gradient(ellipse at 70% 30%, rgba(180,100,20,0.15) 0%, transparent 50%)"},

  // ── NEON (8) ──
  { id: "neon-green", name: "Neon Matrix", category: "Neon", vars: {
    "--background":"140 15% 3%","--foreground":"140 10% 92%","--card":"140 10% 6%","--card-foreground":"140 10% 92%",
    "--primary":"145 90% 50%","--primary-foreground":"0 0% 3%","--accent":"150 70% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"140 15% 12%","--secondary-foreground":"140 8% 82%","--muted":"140 10% 9%","--muted-foreground":"140 5% 45%",
    "--border":"140 10% 14%","--input":"140 10% 14%","--ring":"145 90% 50%","--popover":"140 10% 6%","--popover-foreground":"140 10% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(0,255,100,0.1) 0%, transparent 60%), repeating-linear-gradient(0deg, rgba(0,255,80,0.02) 0px, rgba(0,255,80,0.02) 1px, transparent 1px, transparent 20px)"},
  { id: "neon-pink", name: "Neon Pink", category: "Neon", vars: {
    "--background":"330 15% 3%","--foreground":"330 10% 92%","--card":"330 10% 6%","--card-foreground":"330 10% 92%",
    "--primary":"330 90% 60%","--primary-foreground":"0 0% 3%","--accent":"320 70% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"330 15% 12%","--secondary-foreground":"330 8% 82%","--muted":"330 10% 9%","--muted-foreground":"330 5% 45%",
    "--border":"330 10% 14%","--input":"330 10% 14%","--ring":"330 90% 60%","--popover":"330 10% 6%","--popover-foreground":"330 10% 92%",
  }, gradient: "radial-gradient(ellipse at 30% 30%, rgba(255,0,120,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(200,0,200,0.1) 0%, transparent 40%)"},
  { id: "neon-cyan", name: "Neon Cyan", category: "Neon", vars: {
    "--background":"185 20% 3%","--foreground":"185 10% 92%","--card":"185 15% 6%","--card-foreground":"185 10% 92%",
    "--primary":"185 95% 55%","--primary-foreground":"0 0% 3%","--accent":"190 75% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"185 15% 12%","--secondary-foreground":"185 8% 82%","--muted":"185 10% 9%","--muted-foreground":"185 5% 45%",
    "--border":"185 12% 14%","--input":"185 12% 14%","--ring":"185 95% 55%","--popover":"185 15% 6%","--popover-foreground":"185 10% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 0%, rgba(0,240,255,0.15) 0%, transparent 50%)"},
  { id: "neon-orange", name: "Neon Inferno", category: "Neon", vars: {
    "--background":"20 15% 3%","--foreground":"20 10% 92%","--card":"20 10% 6%","--card-foreground":"20 10% 92%",
    "--primary":"20 95% 58%","--primary-foreground":"0 0% 3%","--accent":"10 80% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"20 15% 12%","--secondary-foreground":"20 8% 82%","--muted":"20 10% 9%","--muted-foreground":"20 5% 45%",
    "--border":"20 10% 14%","--input":"20 10% 14%","--ring":"20 95% 58%","--popover":"20 10% 6%","--popover-foreground":"20 10% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 80%, rgba(255,100,0,0.18) 0%, transparent 55%)"},
  { id: "neon-violet", name: "Neon Violet", category: "Neon", vars: {
    "--background":"280 15% 3%","--foreground":"280 10% 92%","--card":"280 10% 6%","--card-foreground":"280 10% 92%",
    "--primary":"280 90% 62%","--primary-foreground":"0 0% 3%","--accent":"270 70% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 15% 12%","--secondary-foreground":"280 8% 82%","--muted":"280 10% 9%","--muted-foreground":"280 5% 45%",
    "--border":"280 10% 14%","--input":"280 10% 14%","--ring":"280 90% 62%","--popover":"280 10% 6%","--popover-foreground":"280 10% 92%",
  }, gradient: "radial-gradient(ellipse at 40% 60%, rgba(160,0,255,0.18) 0%, transparent 55%)"},
  { id: "neon-yellow", name: "Neon Volt", category: "Neon", vars: {
    "--background":"60 15% 3%","--foreground":"60 10% 92%","--card":"60 10% 6%","--card-foreground":"60 10% 92%",
    "--primary":"60 100% 55%","--primary-foreground":"0 0% 3%","--accent":"55 80% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"60 15% 12%","--secondary-foreground":"60 8% 82%","--muted":"60 10% 9%","--muted-foreground":"60 5% 45%",
    "--border":"60 10% 14%","--input":"60 10% 14%","--ring":"60 100% 55%","--popover":"60 10% 6%","--popover-foreground":"60 10% 92%",
  }, gradient: "radial-gradient(ellipse at 60% 40%, rgba(255,255,0,0.12) 0%, transparent 50%)"},
  { id: "neon-red", name: "Neon Blood", category: "Neon", vars: {
    "--background":"0 15% 3%","--foreground":"0 10% 92%","--card":"0 10% 6%","--card-foreground":"0 10% 92%",
    "--primary":"0 90% 58%","--primary-foreground":"0 0% 3%","--accent":"355 70% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 15% 12%","--secondary-foreground":"0 8% 82%","--muted":"0 10% 9%","--muted-foreground":"0 5% 45%",
    "--border":"0 10% 14%","--input":"0 10% 14%","--ring":"0 90% 58%","--popover":"0 10% 6%","--popover-foreground":"0 10% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 30%, rgba(255,0,0,0.15) 0%, transparent 50%)"},
  { id: "neon-rainbow", name: "Neon Rainbow", category: "Neon", vars: {
    "--background":"250 15% 3%","--foreground":"0 0% 92%","--card":"250 10% 6%","--card-foreground":"0 0% 92%",
    "--primary":"200 90% 55%","--primary-foreground":"0 0% 3%","--accent":"320 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"250 15% 12%","--secondary-foreground":"0 0% 82%","--muted":"250 10% 9%","--muted-foreground":"250 5% 45%",
    "--border":"250 10% 14%","--input":"250 10% 14%","--ring":"200 90% 55%","--popover":"250 10% 6%","--popover-foreground":"0 0% 92%",
  }, gradient: "linear-gradient(135deg, rgba(255,0,0,0.06) 0%, rgba(255,127,0,0.06) 16%, rgba(255,255,0,0.06) 33%, rgba(0,255,0,0.06) 50%, rgba(0,0,255,0.06) 66%, rgba(75,0,130,0.06) 83%, rgba(238,130,238,0.06) 100%)"},

  // ── CRYPTO / WEB3 (8) ──
  { id: "bitcoin-orange", name: "Bitcoin", category: "Crypto", vars: {
    "--background":"25 12% 3%","--foreground":"25 8% 92%","--card":"25 10% 6%","--card-foreground":"25 8% 92%",
    "--primary":"25 100% 55%","--primary-foreground":"0 0% 3%","--accent":"20 80% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"25 12% 12%","--secondary-foreground":"25 5% 80%","--muted":"25 8% 9%","--muted-foreground":"25 5% 45%",
    "--border":"25 8% 14%","--input":"25 8% 14%","--ring":"25 100% 55%","--popover":"25 10% 6%","--popover-foreground":"25 8% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(247,147,26,0.15) 0%, transparent 60%)"},
  { id: "ethereum-blue", name: "Ethereum", category: "Crypto", vars: {
    "--background":"230 18% 4%","--foreground":"230 8% 92%","--card":"230 15% 7%","--card-foreground":"230 8% 92%",
    "--primary":"230 70% 62%","--primary-foreground":"0 0% 100%","--accent":"240 55% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 15% 13%","--secondary-foreground":"230 6% 80%","--muted":"230 12% 10%","--muted-foreground":"230 6% 45%",
    "--border":"230 12% 15%","--input":"230 12% 15%","--ring":"230 70% 62%","--popover":"230 15% 7%","--popover-foreground":"230 8% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 40%, rgba(98,126,234,0.18) 0%, transparent 55%)"},
  { id: "solana-cyber", name: "Solana", category: "Crypto", vars: {
    "--background":"250 15% 3%","--foreground":"250 8% 92%","--card":"250 12% 6%","--card-foreground":"250 8% 92%",
    "--primary":"170 100% 50%","--primary-foreground":"0 0% 3%","--accent":"300 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"250 15% 12%","--secondary-foreground":"250 6% 80%","--muted":"250 10% 9%","--muted-foreground":"250 6% 45%",
    "--border":"250 10% 14%","--input":"250 10% 14%","--ring":"170 100% 50%","--popover":"250 12% 6%","--popover-foreground":"250 8% 92%",
  }, gradient: "linear-gradient(135deg, rgba(0,255,180,0.12) 0%, rgba(180,0,255,0.12) 100%)"},
  { id: "defi-green", name: "DeFi Green", category: "Crypto", vars: {
    "--background":"160 18% 3%","--foreground":"160 8% 92%","--card":"160 14% 6%","--card-foreground":"160 8% 92%",
    "--primary":"155 80% 48%","--primary-foreground":"0 0% 3%","--accent":"140 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"160 14% 12%","--secondary-foreground":"160 6% 80%","--muted":"160 10% 9%","--muted-foreground":"160 6% 45%",
    "--border":"160 10% 14%","--input":"160 10% 14%","--ring":"155 80% 48%","--popover":"160 14% 6%","--popover-foreground":"160 8% 92%",
  }, gradient: "radial-gradient(ellipse at 30% 70%, rgba(0,200,100,0.15) 0%, transparent 55%)"},
  { id: "web3-purple", name: "Web3 Purple", category: "Crypto", vars: {
    "--background":"265 18% 4%","--foreground":"265 8% 92%","--card":"265 14% 7%","--card-foreground":"265 8% 92%",
    "--primary":"265 75% 60%","--primary-foreground":"0 0% 100%","--accent":"280 60% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"265 14% 13%","--secondary-foreground":"265 6% 80%","--muted":"265 10% 10%","--muted-foreground":"265 6% 45%",
    "--border":"265 10% 15%","--input":"265 10% 15%","--ring":"265 75% 60%","--popover":"265 14% 7%","--popover-foreground":"265 8% 92%",
  }, gradient: "radial-gradient(ellipse at 60% 40%, rgba(130,60,230,0.18) 0%, transparent 55%)"},
  { id: "meme-coin-gold", name: "Meme Coin Gold", category: "Crypto", vars: {
    "--background":"45 15% 3%","--foreground":"45 10% 92%","--card":"45 12% 6%","--card-foreground":"45 10% 92%",
    "--primary":"45 100% 58%","--primary-foreground":"0 0% 3%","--accent":"35 85% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"45 12% 12%","--secondary-foreground":"45 6% 80%","--muted":"45 8% 9%","--muted-foreground":"45 5% 45%",
    "--border":"45 8% 14%","--input":"45 8% 14%","--ring":"45 100% 58%","--popover":"45 12% 6%","--popover-foreground":"45 10% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 30%, rgba(255,200,0,0.18) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(200,150,0,0.1) 0%, transparent 40%)"},
  { id: "rug-pull-red", name: "Rug Alert", category: "Crypto", vars: {
    "--background":"0 18% 3%","--foreground":"0 8% 92%","--card":"0 14% 6%","--card-foreground":"0 8% 92%",
    "--primary":"0 85% 55%","--primary-foreground":"0 0% 100%","--accent":"10 70% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 14% 12%","--secondary-foreground":"0 6% 80%","--muted":"0 10% 9%","--muted-foreground":"0 5% 45%",
    "--border":"0 10% 14%","--input":"0 10% 14%","--ring":"0 85% 55%","--popover":"0 14% 6%","--popover-foreground":"0 8% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(220,30,30,0.15) 0%, transparent 55%)"},
  { id: "wagmi-cyan", name: "WAGMI", category: "Crypto", vars: {
    "--background":"190 18% 3%","--foreground":"190 8% 92%","--card":"190 14% 6%","--card-foreground":"190 8% 92%",
    "--primary":"185 90% 52%","--primary-foreground":"0 0% 3%","--accent":"175 70% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"190 14% 12%","--secondary-foreground":"190 6% 80%","--muted":"190 10% 9%","--muted-foreground":"190 5% 45%",
    "--border":"190 10% 14%","--input":"190 10% 14%","--ring":"185 90% 52%","--popover":"190 14% 6%","--popover-foreground":"190 8% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 0%, rgba(0,230,240,0.15) 0%, transparent 50%)"},

  // ── OG / MEME CHARACTER (8) ──
  { id: "og-cyber", name: "OG Cyber", category: "OG", vars: {
    "--background":"220 15% 4%","--foreground":"185 8% 92%","--card":"220 12% 7%","--card-foreground":"185 8% 92%",
    "--primary":"170 100% 48%","--primary-foreground":"0 0% 3%","--accent":"280 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 12% 12%","--secondary-foreground":"185 6% 80%","--muted":"220 8% 9%","--muted-foreground":"220 5% 45%",
    "--border":"220 8% 15%","--input":"220 8% 15%","--ring":"170 100% 48%","--popover":"220 12% 7%","--popover-foreground":"185 8% 92%",
  }, gradient: "radial-gradient(ellipse at 20% 80%, rgba(0,245,196,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.12) 0%, transparent 45%)"},
  { id: "og-hacker", name: "OG Hacker", category: "OG", vars: {
    "--background":"130 20% 3%","--foreground":"130 10% 90%","--card":"130 15% 6%","--card-foreground":"130 10% 90%",
    "--primary":"130 80% 45%","--primary-foreground":"0 0% 3%","--accent":"140 60% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"130 15% 11%","--secondary-foreground":"130 8% 78%","--muted":"130 10% 8%","--muted-foreground":"130 6% 42%",
    "--border":"130 10% 14%","--input":"130 10% 14%","--ring":"130 80% 45%","--popover":"130 15% 6%","--popover-foreground":"130 10% 90%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(0,200,80,0.03) 0px, rgba(0,200,80,0.03) 1px, transparent 1px, transparent 22px), radial-gradient(ellipse at 50% 50%, rgba(0,200,80,0.08) 0%, transparent 70%)"},
  { id: "og-gold", name: "OG Gold", category: "OG", vars: {
    "--background":"40 12% 3%","--foreground":"40 8% 92%","--card":"40 10% 6%","--card-foreground":"40 8% 92%",
    "--primary":"42 95% 55%","--primary-foreground":"0 0% 3%","--accent":"35 80% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"40 10% 12%","--secondary-foreground":"40 5% 80%","--muted":"40 6% 9%","--muted-foreground":"40 5% 45%",
    "--border":"40 6% 14%","--input":"40 6% 14%","--ring":"42 95% 55%","--popover":"40 10% 6%","--popover-foreground":"40 8% 92%",
  }, gradient: "radial-gradient(ellipse at 40% 20%, rgba(245,197,24,0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(200,140,0,0.1) 0%, transparent 40%)"},
  { id: "og-pink", name: "OG Pink", category: "OG", vars: {
    "--background":"335 15% 3%","--foreground":"335 8% 92%","--card":"335 12% 6%","--card-foreground":"335 8% 92%",
    "--primary":"335 85% 58%","--primary-foreground":"0 0% 3%","--accent":"320 65% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"335 12% 12%","--secondary-foreground":"335 5% 80%","--muted":"335 8% 9%","--muted-foreground":"335 5% 45%",
    "--border":"335 8% 14%","--input":"335 8% 14%","--ring":"335 85% 58%","--popover":"335 12% 6%","--popover-foreground":"335 8% 92%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(255,0,100,0.15) 0%, transparent 55%)"},
  { id: "wojak-dark", name: "Wojak Dark", category: "OG", vars: {
    "--background":"220 8% 5%","--foreground":"220 4% 88%","--card":"220 6% 8%","--card-foreground":"220 4% 88%",
    "--primary":"220 4% 70%","--primary-foreground":"220 8% 5%","--accent":"220 8% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 6% 12%","--secondary-foreground":"220 4% 75%","--muted":"220 5% 10%","--muted-foreground":"220 4% 40%",
    "--border":"220 5% 16%","--input":"220 5% 16%","--ring":"220 4% 70%","--popover":"220 6% 8%","--popover-foreground":"220 4% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 100%, rgba(40,60,100,0.2) 0%, transparent 60%)"},
  { id: "pepe-green", name: "Pepe Green", category: "OG", vars: {
    "--background":"125 15% 5%","--foreground":"125 8% 88%","--card":"125 12% 8%","--card-foreground":"125 8% 88%",
    "--primary":"125 60% 45%","--primary-foreground":"0 0% 3%","--accent":"100 50% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"125 12% 13%","--secondary-foreground":"125 5% 75%","--muted":"125 8% 10%","--muted-foreground":"125 5% 42%",
    "--border":"125 8% 15%","--input":"125 8% 15%","--ring":"125 60% 45%","--popover":"125 12% 8%","--popover-foreground":"125 8% 88%",
  }, gradient: "radial-gradient(ellipse at 30% 50%, rgba(80,180,80,0.15) 0%, transparent 50%)"},
  { id: "degen-purple", name: "Degen Mode", category: "OG", vars: {
    "--background":"260 20% 4%","--foreground":"260 8% 90%","--card":"260 16% 7%","--card-foreground":"260 8% 90%",
    "--primary":"260 80% 62%","--primary-foreground":"0 0% 100%","--accent":"300 70% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"260 16% 13%","--secondary-foreground":"260 6% 78%","--muted":"260 12% 10%","--muted-foreground":"260 6% 44%",
    "--border":"260 12% 15%","--input":"260 12% 15%","--ring":"260 80% 62%","--popover":"260 16% 7%","--popover-foreground":"260 8% 90%",
  }, gradient: "radial-gradient(ellipse at 30% 30%, rgba(140,0,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(255,0,200,0.12) 0%, transparent 45%)"},
  { id: "ngmi-black", name: "NGMI Black", category: "OG", vars: {
    "--background":"0 0% 2%","--foreground":"0 0% 85%","--card":"0 0% 5%","--card-foreground":"0 0% 85%",
    "--primary":"0 0% 75%","--primary-foreground":"0 0% 2%","--accent":"0 0% 20%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 9%","--secondary-foreground":"0 0% 72%","--muted":"0 0% 7%","--muted-foreground":"0 0% 36%",
    "--border":"0 0% 11%","--input":"0 0% 11%","--ring":"0 0% 75%","--popover":"0 0% 5%","--popover-foreground":"0 0% 85%",
  }},

  // ── SOLANA / BLOCKCHAIN THEME (8) ──
  { id: "solana-gradient", name: "SOL Gradient", category: "Solana", vars: {
    "--background":"255 18% 4%","--foreground":"255 6% 90%","--card":"255 14% 7%","--card-foreground":"255 6% 90%",
    "--primary":"170 100% 50%","--primary-foreground":"0 0% 3%","--accent":"300 85% 58%","--accent-foreground":"0 0% 100%",
    "--secondary":"255 14% 12%","--secondary-foreground":"255 5% 78%","--muted":"255 10% 9%","--muted-foreground":"255 5% 44%",
    "--border":"255 10% 15%","--input":"255 10% 15%","--ring":"170 100% 50%","--popover":"255 14% 7%","--popover-foreground":"255 6% 90%",
  }, gradient: "linear-gradient(135deg, rgba(0,255,163,0.14) 0%, rgba(220,31,255,0.14) 100%)"},
  { id: "solana-dark", name: "SOL Dark", category: "Solana", vars: {
    "--background":"240 20% 3%","--foreground":"240 6% 88%","--card":"240 16% 6%","--card-foreground":"240 6% 88%",
    "--primary":"170 95% 45%","--primary-foreground":"0 0% 3%","--accent":"290 80% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 16% 11%","--secondary-foreground":"240 5% 76%","--muted":"240 12% 8%","--muted-foreground":"240 5% 42%",
    "--border":"240 12% 14%","--input":"240 12% 14%","--ring":"170 95% 45%","--popover":"240 16% 6%","--popover-foreground":"240 6% 88%",
  }, gradient: "radial-gradient(ellipse at 0% 100%, rgba(0,255,163,0.12) 0%, transparent 45%), radial-gradient(ellipse at 100% 0%, rgba(220,31,255,0.12) 0%, transparent 45%)"},
  { id: "blockchain-blue", name: "Blockchain", category: "Solana", vars: {
    "--background":"215 22% 4%","--foreground":"215 8% 90%","--card":"215 18% 7%","--card-foreground":"215 8% 90%",
    "--primary":"215 80% 58%","--primary-foreground":"0 0% 100%","--accent":"200 70% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"215 18% 12%","--secondary-foreground":"215 5% 78%","--muted":"215 14% 9%","--muted-foreground":"215 5% 44%",
    "--border":"215 14% 15%","--input":"215 14% 15%","--ring":"215 80% 58%","--popover":"215 18% 7%","--popover-foreground":"215 8% 90%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(50,120,220,0.025) 0px, rgba(50,120,220,0.025) 1px, transparent 1px, transparent 30px), repeating-linear-gradient(90deg, rgba(50,120,220,0.025) 0px, rgba(50,120,220,0.025) 1px, transparent 1px, transparent 30px)"},
  { id: "validator-node", name: "Validator Node", category: "Solana", vars: {
    "--background":"195 20% 4%","--foreground":"195 8% 90%","--card":"195 16% 7%","--card-foreground":"195 8% 90%",
    "--primary":"195 85% 52%","--primary-foreground":"0 0% 3%","--accent":"175 65% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"195 16% 12%","--secondary-foreground":"195 5% 78%","--muted":"195 12% 9%","--muted-foreground":"195 5% 44%",
    "--border":"195 12% 15%","--input":"195 12% 15%","--ring":"195 85% 52%","--popover":"195 16% 7%","--popover-foreground":"195 8% 90%",
  }, gradient: "radial-gradient(circle at 50% 50%, rgba(0,180,210,0.1) 0%, transparent 60%)"},
  { id: "stake-pool", name: "Stake Pool", category: "Solana", vars: {
    "--background":"165 18% 4%","--foreground":"165 6% 88%","--card":"165 14% 7%","--card-foreground":"165 6% 88%",
    "--primary":"165 85% 48%","--primary-foreground":"0 0% 3%","--accent":"150 65% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"165 14% 12%","--secondary-foreground":"165 5% 76%","--muted":"165 10% 9%","--muted-foreground":"165 5% 42%",
    "--border":"165 10% 14%","--input":"165 10% 14%","--ring":"165 85% 48%","--popover":"165 14% 7%","--popover-foreground":"165 6% 88%",
  }, gradient: "radial-gradient(ellipse at 70% 30%, rgba(0,220,140,0.14) 0%, transparent 50%)"},
  { id: "nft-gallery", name: "NFT Gallery", category: "Solana", vars: {
    "--background":"280 16% 4%","--foreground":"280 6% 90%","--card":"280 12% 7%","--card-foreground":"280 6% 90%",
    "--primary":"280 70% 60%","--primary-foreground":"0 0% 100%","--accent":"300 60% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 12% 13%","--secondary-foreground":"280 5% 78%","--muted":"280 8% 10%","--muted-foreground":"280 5% 44%",
    "--border":"280 8% 16%","--input":"280 8% 16%","--ring":"280 70% 60%","--popover":"280 12% 7%","--popover-foreground":"280 6% 90%",
  }, gradient: "radial-gradient(ellipse at 40% 60%, rgba(160,80,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(255,80,200,0.1) 0%, transparent 40%)"},
  { id: "token-launch", name: "Token Launch", category: "Solana", vars: {
    "--background":"35 16% 4%","--foreground":"35 6% 90%","--card":"35 12% 7%","--card-foreground":"35 6% 90%",
    "--primary":"35 90% 55%","--primary-foreground":"0 0% 3%","--accent":"20 75% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"35 12% 13%","--secondary-foreground":"35 5% 78%","--muted":"35 8% 10%","--muted-foreground":"35 5% 44%",
    "--border":"35 8% 16%","--input":"35 8% 16%","--ring":"35 90% 55%","--popover":"35 12% 7%","--popover-foreground":"35 6% 90%",
  }, gradient: "radial-gradient(ellipse at 60% 30%, rgba(255,160,0,0.16) 0%, transparent 50%)"},
  { id: "exit-fiat", name: "Exit Fiat", category: "Solana", vars: {
    "--background":"140 18% 4%","--foreground":"140 6% 88%","--card":"140 14% 7%","--card-foreground":"140 6% 88%",
    "--primary":"145 80% 48%","--primary-foreground":"0 0% 3%","--accent":"155 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"140 14% 12%","--secondary-foreground":"140 5% 76%","--muted":"140 10% 9%","--muted-foreground":"140 5% 42%",
    "--border":"140 10% 14%","--input":"140 10% 14%","--ring":"145 80% 48%","--popover":"140 14% 7%","--popover-foreground":"140 6% 88%",
  }, gradient: "repeating-linear-gradient(90deg, rgba(0,200,100,0.02) 0px, rgba(0,200,100,0.02) 2px, transparent 2px, transparent 25px), radial-gradient(ellipse at 50% 50%, rgba(0,200,100,0.1) 0%, transparent 65%)"},

  // ── CYBER / SCI-FI (8) ──
  { id: "cyberpunk-2077", name: "Cyberpunk 2077", category: "Cyber", vars: {
    "--background":"220 20% 4%","--foreground":"50 8% 92%","--card":"220 16% 7%","--card-foreground":"50 8% 92%",
    "--primary":"50 100% 55%","--primary-foreground":"0 0% 3%","--accent":"285 90% 58%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 16% 12%","--secondary-foreground":"50 6% 80%","--muted":"220 12% 9%","--muted-foreground":"220 6% 44%",
    "--border":"220 12% 15%","--input":"220 12% 15%","--ring":"50 100% 55%","--popover":"220 16% 7%","--popover-foreground":"50 8% 92%",
  }, gradient: "radial-gradient(ellipse at 30% 70%, rgba(255,200,0,0.14) 0%, transparent 45%), radial-gradient(ellipse at 80% 20%, rgba(200,0,255,0.14) 0%, transparent 45%)"},
  { id: "matrix-rain", name: "Matrix Rain", category: "Cyber", vars: {
    "--background":"130 18% 3%","--foreground":"130 10% 88%","--card":"130 14% 6%","--card-foreground":"130 10% 88%",
    "--primary":"130 85% 48%","--primary-foreground":"0 0% 3%","--accent":"120 60% 32%","--accent-foreground":"0 0% 100%",
    "--secondary":"130 14% 11%","--secondary-foreground":"130 6% 76%","--muted":"130 10% 8%","--muted-foreground":"130 5% 42%",
    "--border":"130 10% 13%","--input":"130 10% 13%","--ring":"130 85% 48%","--popover":"130 14% 6%","--popover-foreground":"130 10% 88%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(0,220,80,0.04) 0px, rgba(0,220,80,0.04) 1px, transparent 1px, transparent 18px)"},
  { id: "tron-grid", name: "TRON Grid", category: "Cyber", vars: {
    "--background":"200 22% 4%","--foreground":"200 8% 90%","--card":"200 18% 7%","--card-foreground":"200 8% 90%",
    "--primary":"195 100% 55%","--primary-foreground":"0 0% 3%","--accent":"185 80% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 18% 12%","--secondary-foreground":"200 6% 78%","--muted":"200 14% 9%","--muted-foreground":"200 6% 44%",
    "--border":"200 14% 15%","--input":"200 14% 15%","--ring":"195 100% 55%","--popover":"200 18% 7%","--popover-foreground":"200 8% 90%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(0,220,255,0.03) 0px, rgba(0,220,255,0.03) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(0,220,255,0.03) 0px, rgba(0,220,255,0.03) 1px, transparent 1px, transparent 28px)"},
  { id: "ghost-protocol", name: "Ghost Protocol", category: "Cyber", vars: {
    "--background":"0 0% 4%","--foreground":"0 0% 80%","--card":"0 0% 7%","--card-foreground":"0 0% 80%",
    "--primary":"180 80% 55%","--primary-foreground":"0 0% 3%","--accent":"180 55% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 12%","--secondary-foreground":"0 0% 68%","--muted":"0 0% 9%","--muted-foreground":"0 0% 38%",
    "--border":"0 0% 14%","--input":"0 0% 14%","--ring":"180 80% 55%","--popover":"0 0% 7%","--popover-foreground":"0 0% 80%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(0,200,200,0.08) 0%, transparent 60%)"},
  { id: "synthwave", name: "Synthwave", category: "Cyber", vars: {
    "--background":"265 22% 4%","--foreground":"300 8% 90%","--card":"265 18% 7%","--card-foreground":"300 8% 90%",
    "--primary":"300 85% 62%","--primary-foreground":"0 0% 100%","--accent":"220 80% 58%","--accent-foreground":"0 0% 100%",
    "--secondary":"265 18% 13%","--secondary-foreground":"300 5% 78%","--muted":"265 14% 10%","--muted-foreground":"265 6% 44%",
    "--border":"265 14% 16%","--input":"265 14% 16%","--ring":"300 85% 62%","--popover":"265 18% 7%","--popover-foreground":"300 8% 90%",
  }, gradient: "linear-gradient(180deg, rgba(40,0,80,0.4) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(255,0,200,0.2) 0%, transparent 50%), radial-gradient(ellipse at 50% 0%, rgba(80,0,200,0.15) 0%, transparent 40%)"},
  { id: "vaporwave", name: "Vaporwave", category: "Cyber", vars: {
    "--background":"280 20% 5%","--foreground":"30 8% 90%","--card":"280 16% 8%","--card-foreground":"30 8% 90%",
    "--primary":"180 70% 62%","--primary-foreground":"0 0% 3%","--accent":"330 80% 62%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 16% 14%","--secondary-foreground":"30 5% 78%","--muted":"280 12% 11%","--muted-foreground":"280 6% 44%",
    "--border":"280 12% 17%","--input":"280 12% 17%","--ring":"180 70% 62%","--popover":"280 16% 8%","--popover-foreground":"30 8% 90%",
  }, gradient: "linear-gradient(135deg, rgba(0,220,255,0.1) 0%, rgba(255,0,200,0.1) 50%, rgba(255,200,0,0.08) 100%)"},
  { id: "blade-runner", name: "Blade Runner", category: "Cyber", vars: {
    "--background":"20 15% 4%","--foreground":"20 6% 88%","--card":"20 12% 7%","--card-foreground":"20 6% 88%",
    "--primary":"20 90% 55%","--primary-foreground":"0 0% 3%","--accent":"300 60% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"20 12% 12%","--secondary-foreground":"20 5% 76%","--muted":"20 8% 9%","--muted-foreground":"20 5% 42%",
    "--border":"20 8% 14%","--input":"20 8% 14%","--ring":"20 90% 55%","--popover":"20 12% 7%","--popover-foreground":"20 6% 88%",
  }, gradient: "radial-gradient(ellipse at 20% 80%, rgba(255,100,0,0.15) 0%, transparent 45%), radial-gradient(ellipse at 80% 20%, rgba(200,0,200,0.1) 0%, transparent 40%)"},
  { id: "neuromancer", name: "Neuromancer", category: "Cyber", vars: {
    "--background":"210 22% 4%","--foreground":"210 6% 88%","--card":"210 18% 7%","--card-foreground":"210 6% 88%",
    "--primary":"210 90% 60%","--primary-foreground":"0 0% 100%","--accent":"180 85% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 18% 12%","--secondary-foreground":"210 5% 76%","--muted":"210 14% 9%","--muted-foreground":"210 5% 42%",
    "--border":"210 14% 15%","--input":"210 14% 15%","--ring":"210 90% 60%","--popover":"210 18% 7%","--popover-foreground":"210 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(0,150,255,0.12) 0%, transparent 55%)"},

  // ── GAMER (8) ──
  { id: "gm-xbox", name: "Xbox", category: "Gamer", vars: {
    "--background":"140 20% 4%","--foreground":"140 6% 88%","--card":"140 16% 7%","--card-foreground":"140 6% 88%",
    "--primary":"140 80% 40%","--primary-foreground":"0 0% 100%","--accent":"130 60% 28%","--accent-foreground":"0 0% 100%",
    "--secondary":"140 16% 12%","--secondary-foreground":"140 5% 76%","--muted":"140 12% 9%","--muted-foreground":"140 5% 42%",
    "--border":"140 12% 14%","--input":"140 12% 14%","--ring":"140 80% 40%","--popover":"140 16% 7%","--popover-foreground":"140 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(16,124,16,0.15) 0%, transparent 55%)"},
  { id: "gm-ps", name: "PlayStation", category: "Gamer", vars: {
    "--background":"220 22% 4%","--foreground":"220 6% 88%","--card":"220 18% 7%","--card-foreground":"220 6% 88%",
    "--primary":"220 80% 55%","--primary-foreground":"0 0% 100%","--accent":"200 65% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 18% 12%","--secondary-foreground":"220 5% 76%","--muted":"220 14% 9%","--muted-foreground":"220 5% 42%",
    "--border":"220 14% 15%","--input":"220 14% 15%","--ring":"220 80% 55%","--popover":"220 18% 7%","--popover-foreground":"220 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(0,67,156,0.18) 0%, transparent 55%)"},
  { id: "gm-switch", name: "Nintendo Switch", category: "Gamer", vars: {
    "--background":"0 18% 4%","--foreground":"0 6% 88%","--card":"0 14% 7%","--card-foreground":"0 6% 88%",
    "--primary":"0 90% 55%","--primary-foreground":"0 0% 100%","--accent":"240 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 14% 12%","--secondary-foreground":"0 5% 76%","--muted":"0 10% 9%","--muted-foreground":"0 5% 42%",
    "--border":"0 10% 15%","--input":"0 10% 15%","--ring":"0 90% 55%","--popover":"0 14% 7%","--popover-foreground":"0 6% 88%",
  }, gradient: "radial-gradient(ellipse at 30% 50%, rgba(255,60,40,0.15) 0%, transparent 45%), radial-gradient(ellipse at 70% 50%, rgba(40,80,220,0.15) 0%, transparent 45%)"},
  { id: "gm-gameboy", name: "Game Boy", category: "Gamer", vars: {
    "--background":"90 15% 5%","--foreground":"90 8% 85%","--card":"90 12% 8%","--card-foreground":"90 8% 85%",
    "--primary":"90 60% 50%","--primary-foreground":"0 0% 3%","--accent":"80 45% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"90 12% 13%","--secondary-foreground":"90 5% 72%","--muted":"90 8% 10%","--muted-foreground":"90 5% 40%",
    "--border":"90 8% 15%","--input":"90 8% 15%","--ring":"90 60% 50%","--popover":"90 12% 8%","--popover-foreground":"90 8% 85%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(155,188,15,0.03) 0px, rgba(155,188,15,0.03) 2px, transparent 2px, transparent 12px)"},
  { id: "gm-steam", name: "Steam", category: "Gamer", vars: {
    "--background":"210 14% 5%","--foreground":"210 6% 85%","--card":"210 12% 8%","--card-foreground":"210 6% 85%",
    "--primary":"210 40% 55%","--primary-foreground":"0 0% 100%","--accent":"200 30% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 12% 13%","--secondary-foreground":"210 5% 72%","--muted":"210 8% 10%","--muted-foreground":"210 5% 40%",
    "--border":"210 8% 16%","--input":"210 8% 16%","--ring":"210 40% 55%","--popover":"210 12% 8%","--popover-foreground":"210 6% 85%",
  }},
  { id: "gm-n64", name: "Nintendo 64", category: "Gamer", vars: {
    "--background":"255 16% 5%","--foreground":"255 6% 85%","--card":"255 12% 8%","--card-foreground":"255 6% 85%",
    "--primary":"255 65% 58%","--primary-foreground":"0 0% 100%","--accent":"30 80% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"255 12% 13%","--secondary-foreground":"255 5% 72%","--muted":"255 8% 10%","--muted-foreground":"255 5% 40%",
    "--border":"255 8% 16%","--input":"255 8% 16%","--ring":"255 65% 58%","--popover":"255 12% 8%","--popover-foreground":"255 6% 85%",
  }, gradient: "radial-gradient(ellipse at 25% 25%, rgba(255,100,0,0.1) 0%, transparent 40%), radial-gradient(ellipse at 75% 75%, rgba(100,60,220,0.12) 0%, transparent 40%)"},
  { id: "gm-genesis", name: "Sega Genesis", category: "Gamer", vars: {
    "--background":"205 20% 4%","--foreground":"205 6% 88%","--card":"205 16% 7%","--card-foreground":"205 6% 88%",
    "--primary":"205 80% 52%","--primary-foreground":"0 0% 3%","--accent":"190 60% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"205 16% 12%","--secondary-foreground":"205 5% 76%","--muted":"205 12% 9%","--muted-foreground":"205 5% 42%",
    "--border":"205 12% 14%","--input":"205 12% 14%","--ring":"205 80% 52%","--popover":"205 16% 7%","--popover-foreground":"205 6% 88%",
  }},
  { id: "gm-arcade", name: "Arcade Cabinet", category: "Gamer", vars: {
    "--background":"0 0% 3%","--foreground":"60 10% 90%","--card":"0 0% 6%","--card-foreground":"60 10% 90%",
    "--primary":"60 95% 55%","--primary-foreground":"0 0% 3%","--accent":"0 85% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 11%","--secondary-foreground":"60 6% 78%","--muted":"0 0% 8%","--muted-foreground":"0 0% 42%",
    "--border":"0 0% 13%","--input":"0 0% 13%","--ring":"60 95% 55%","--popover":"0 0% 6%","--popover-foreground":"60 10% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(255,220,0,0.08) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(255,0,0,0.08) 0%, transparent 40%)"},

  // ── NATURE / AESTHETIC (8) ──
  { id: "deep-ocean", name: "Deep Ocean", category: "Nature", vars: {
    "--background":"220 28% 4%","--foreground":"220 8% 88%","--card":"220 24% 7%","--card-foreground":"220 8% 88%",
    "--primary":"200 80% 52%","--primary-foreground":"0 0% 100%","--accent":"210 60% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 24% 12%","--secondary-foreground":"220 5% 76%","--muted":"220 20% 9%","--muted-foreground":"220 5% 42%",
    "--border":"220 20% 15%","--input":"220 20% 15%","--ring":"200 80% 52%","--popover":"220 24% 7%","--popover-foreground":"220 8% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 100%, rgba(0,80,180,0.2) 0%, transparent 60%)"},
  { id: "volcanic", name: "Volcanic", category: "Nature", vars: {
    "--background":"10 18% 4%","--foreground":"10 6% 88%","--card":"10 14% 7%","--card-foreground":"10 6% 88%",
    "--primary":"10 90% 52%","--primary-foreground":"0 0% 3%","--accent":"30 80% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"10 14% 12%","--secondary-foreground":"10 5% 76%","--muted":"10 10% 9%","--muted-foreground":"10 5% 42%",
    "--border":"10 10% 14%","--input":"10 10% 14%","--ring":"10 90% 52%","--popover":"10 14% 7%","--popover-foreground":"10 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 100%, rgba(255,60,0,0.2) 0%, transparent 55%), radial-gradient(ellipse at 30% 80%, rgba(200,80,0,0.12) 0%, transparent 40%)"},
  { id: "aurora-borealis", name: "Aurora", category: "Nature", vars: {
    "--background":"200 22% 4%","--foreground":"200 6% 90%","--card":"200 18% 7%","--card-foreground":"200 6% 90%",
    "--primary":"170 80% 50%","--primary-foreground":"0 0% 3%","--accent":"280 70% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 18% 12%","--secondary-foreground":"200 5% 78%","--muted":"200 14% 9%","--muted-foreground":"200 5% 44%",
    "--border":"200 14% 15%","--input":"200 14% 15%","--ring":"170 80% 50%","--popover":"200 18% 7%","--popover-foreground":"200 6% 90%",
  }, gradient: "radial-gradient(ellipse at 30% 30%, rgba(0,255,180,0.12) 0%, transparent 45%), radial-gradient(ellipse at 70% 60%, rgba(140,0,255,0.12) 0%, transparent 45%), radial-gradient(ellipse at 50% 80%, rgba(0,200,255,0.08) 0%, transparent 40%)"},
  { id: "midnight-forest", name: "Midnight Forest", category: "Nature", vars: {
    "--background":"150 18% 4%","--foreground":"150 6% 86%","--card":"150 14% 7%","--card-foreground":"150 6% 86%",
    "--primary":"150 55% 42%","--primary-foreground":"0 0% 3%","--accent":"130 40% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"150 14% 12%","--secondary-foreground":"150 5% 74%","--muted":"150 10% 9%","--muted-foreground":"150 5% 40%",
    "--border":"150 10% 14%","--input":"150 10% 14%","--ring":"150 55% 42%","--popover":"150 14% 7%","--popover-foreground":"150 6% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 100%, rgba(0,100,50,0.18) 0%, transparent 55%)"},
  { id: "desert-sand", name: "Desert Dusk", category: "Nature", vars: {
    "--background":"35 14% 5%","--foreground":"35 6% 86%","--card":"35 12% 8%","--card-foreground":"35 6% 86%",
    "--primary":"35 65% 50%","--primary-foreground":"0 0% 3%","--accent":"20 55% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"35 12% 13%","--secondary-foreground":"35 5% 74%","--muted":"35 8% 10%","--muted-foreground":"35 5% 40%",
    "--border":"35 8% 16%","--input":"35 8% 16%","--ring":"35 65% 50%","--popover":"35 12% 8%","--popover-foreground":"35 6% 86%",
  }, gradient: "linear-gradient(180deg, rgba(180,100,20,0.1) 0%, transparent 50%)"},
  { id: "cosmic-dust", name: "Cosmic Dust", category: "Nature", vars: {
    "--background":"250 18% 4%","--foreground":"250 5% 88%","--card":"250 14% 7%","--card-foreground":"250 5% 88%",
    "--primary":"250 65% 60%","--primary-foreground":"0 0% 100%","--accent":"220 55% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"250 14% 12%","--secondary-foreground":"250 4% 76%","--muted":"250 10% 9%","--muted-foreground":"250 4% 42%",
    "--border":"250 10% 15%","--input":"250 10% 15%","--ring":"250 65% 60%","--popover":"250 14% 7%","--popover-foreground":"250 5% 88%",
  }, gradient: "radial-gradient(ellipse at 20% 20%, rgba(80,40,200,0.15) 0%, transparent 40%), radial-gradient(ellipse at 80% 80%, rgba(200,100,255,0.1) 0%, transparent 40%)"},
  { id: "nebula", name: "Nebula", category: "Nature", vars: {
    "--background":"280 20% 4%","--foreground":"280 5% 88%","--card":"280 16% 7%","--card-foreground":"280 5% 88%",
    "--primary":"300 80% 60%","--primary-foreground":"0 0% 100%","--accent":"200 70% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 16% 12%","--secondary-foreground":"280 4% 76%","--muted":"280 12% 9%","--muted-foreground":"280 4% 42%",
    "--border":"280 12% 15%","--input":"280 12% 15%","--ring":"300 80% 60%","--popover":"280 16% 7%","--popover-foreground":"280 5% 88%",
  }, gradient: "radial-gradient(ellipse at 20% 40%, rgba(200,0,255,0.15) 0%, transparent 45%), radial-gradient(ellipse at 80% 60%, rgba(0,180,255,0.12) 0%, transparent 45%)"},
  { id: "blood-moon", name: "Blood Moon", category: "Nature", vars: {
    "--background":"0 18% 4%","--foreground":"0 5% 88%","--card":"0 14% 7%","--card-foreground":"0 5% 88%",
    "--primary":"0 80% 52%","--primary-foreground":"0 0% 100%","--accent":"15 65% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 14% 12%","--secondary-foreground":"0 4% 76%","--muted":"0 10% 9%","--muted-foreground":"0 4% 42%",
    "--border":"0 10% 14%","--input":"0 10% 14%","--ring":"0 80% 52%","--popover":"0 14% 7%","--popover-foreground":"0 5% 88%",
  }, gradient: "radial-gradient(circle at 50% 30%, rgba(200,20,0,0.18) 0%, transparent 50%)"},

  // ── LUXURY / PREMIUM (8) ──
  { id: "royal-gold", name: "Royal Gold", category: "Luxury", vars: {
    "--background":"40 12% 4%","--foreground":"40 8% 90%","--card":"40 10% 7%","--card-foreground":"40 8% 90%",
    "--primary":"42 92% 58%","--primary-foreground":"0 0% 3%","--accent":"38 75% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"40 10% 13%","--secondary-foreground":"40 5% 78%","--muted":"40 6% 10%","--muted-foreground":"40 4% 44%",
    "--border":"40 6% 15%","--input":"40 6% 15%","--ring":"42 92% 58%","--popover":"40 10% 7%","--popover-foreground":"40 8% 90%",
  }, gradient: "linear-gradient(135deg, rgba(200,150,0,0.12) 0%, transparent 50%, rgba(180,120,0,0.08) 100%)"},
  { id: "platinum", name: "Platinum", category: "Luxury", vars: {
    "--background":"220 8% 5%","--foreground":"220 4% 90%","--card":"220 6% 8%","--card-foreground":"220 4% 90%",
    "--primary":"220 10% 75%","--primary-foreground":"220 8% 5%","--accent":"220 8% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 6% 13%","--secondary-foreground":"220 3% 76%","--muted":"220 4% 10%","--muted-foreground":"220 3% 44%",
    "--border":"220 4% 16%","--input":"220 4% 16%","--ring":"220 10% 75%","--popover":"220 6% 8%","--popover-foreground":"220 4% 90%",
  }, gradient: "linear-gradient(135deg, rgba(200,210,220,0.06) 0%, transparent 60%)"},
  { id: "midnight-sapphire", name: "Sapphire", category: "Luxury", vars: {
    "--background":"225 28% 4%","--foreground":"225 8% 90%","--card":"225 22% 7%","--card-foreground":"225 8% 90%",
    "--primary":"225 75% 60%","--primary-foreground":"0 0% 100%","--accent":"215 60% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"225 22% 12%","--secondary-foreground":"225 5% 78%","--muted":"225 18% 9%","--muted-foreground":"225 5% 44%",
    "--border":"225 18% 15%","--input":"225 18% 15%","--ring":"225 75% 60%","--popover":"225 22% 7%","--popover-foreground":"225 8% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 30%, rgba(40,80,220,0.16) 0%, transparent 50%)"},
  { id: "dark-diamond", name: "Dark Diamond", category: "Luxury", vars: {
    "--background":"200 12% 4%","--foreground":"200 5% 90%","--card":"200 10% 7%","--card-foreground":"200 5% 90%",
    "--primary":"200 60% 70%","--primary-foreground":"200 12% 4%","--accent":"190 45% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 10% 12%","--secondary-foreground":"200 4% 76%","--muted":"200 6% 9%","--muted-foreground":"200 4% 42%",
    "--border":"200 6% 15%","--input":"200 6% 15%","--ring":"200 60% 70%","--popover":"200 10% 7%","--popover-foreground":"200 5% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(150,220,255,0.06) 0%, transparent 55%)"},
  { id: "blood-diamond", name: "Blood Diamond", category: "Luxury", vars: {
    "--background":"350 14% 4%","--foreground":"350 5% 88%","--card":"350 10% 7%","--card-foreground":"350 5% 88%",
    "--primary":"350 80% 58%","--primary-foreground":"0 0% 100%","--accent":"340 60% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"350 10% 12%","--secondary-foreground":"350 4% 76%","--muted":"350 6% 9%","--muted-foreground":"350 4% 42%",
    "--border":"350 6% 15%","--input":"350 6% 15%","--ring":"350 80% 58%","--popover":"350 10% 7%","--popover-foreground":"350 5% 88%",
  }, gradient: "radial-gradient(ellipse at 60% 40%, rgba(220,20,60,0.14) 0%, transparent 50%)"},
  { id: "rose-gold", name: "Rose Gold", category: "Luxury", vars: {
    "--background":"350 12% 5%","--foreground":"350 5% 88%","--card":"350 10% 8%","--card-foreground":"350 5% 88%",
    "--primary":"10 70% 62%","--primary-foreground":"0 0% 3%","--accent":"340 55% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"350 10% 13%","--secondary-foreground":"350 4% 76%","--muted":"350 6% 10%","--muted-foreground":"350 4% 42%",
    "--border":"350 6% 16%","--input":"350 6% 16%","--ring":"10 70% 62%","--popover":"350 10% 8%","--popover-foreground":"350 5% 88%",
  }, gradient: "linear-gradient(135deg, rgba(220,120,100,0.1) 0%, transparent 55%)"},
  { id: "black-onyx", name: "Black Onyx", category: "Luxury", vars: {
    "--background":"260 8% 3%","--foreground":"260 3% 85%","--card":"260 6% 6%","--card-foreground":"260 3% 85%",
    "--primary":"260 8% 65%","--primary-foreground":"260 8% 3%","--accent":"260 5% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"260 6% 10%","--secondary-foreground":"260 3% 72%","--muted":"260 4% 8%","--muted-foreground":"260 3% 36%",
    "--border":"260 4% 12%","--input":"260 4% 12%","--ring":"260 8% 65%","--popover":"260 6% 6%","--popover-foreground":"260 3% 85%",
  }},
  { id: "imperial-purple", name: "Imperial", category: "Luxury", vars: {
    "--background":"280 20% 4%","--foreground":"280 5% 88%","--card":"280 16% 7%","--card-foreground":"280 5% 88%",
    "--primary":"280 70% 60%","--primary-foreground":"0 0% 100%","--accent":"265 55% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 16% 12%","--secondary-foreground":"280 4% 76%","--muted":"280 12% 9%","--muted-foreground":"280 4% 42%",
    "--border":"280 12% 15%","--input":"280 12% 15%","--ring":"280 70% 60%","--popover":"280 16% 7%","--popover-foreground":"280 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(140,40,220,0.14) 0%, transparent 55%)"},

  // ── TERMINAL / RETRO (8) ──
  { id: "terminal-green", name: "Terminal Green", category: "Terminal", vars: {
    "--background":"0 0% 2%","--foreground":"120 80% 60%","--card":"0 0% 5%","--card-foreground":"120 80% 60%",
    "--primary":"120 80% 55%","--primary-foreground":"0 0% 2%","--accent":"120 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 9%","--secondary-foreground":"120 60% 50%","--muted":"0 0% 7%","--muted-foreground":"120 30% 40%",
    "--border":"120 20% 12%","--input":"120 20% 12%","--ring":"120 80% 55%","--popover":"0 0% 5%","--popover-foreground":"120 80% 60%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(0,255,70,0.025) 0px, rgba(0,255,70,0.025) 1px, transparent 1px, transparent 14px)"},
  { id: "terminal-amber", name: "Terminal Amber", category: "Terminal", vars: {
    "--background":"0 0% 2%","--foreground":"40 100% 60%","--card":"0 0% 5%","--card-foreground":"40 100% 60%",
    "--primary":"40 100% 55%","--primary-foreground":"0 0% 2%","--accent":"30 80% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 9%","--secondary-foreground":"40 80% 50%","--muted":"0 0% 7%","--muted-foreground":"40 40% 40%",
    "--border":"40 20% 12%","--input":"40 20% 12%","--ring":"40 100% 55%","--popover":"0 0% 5%","--popover-foreground":"40 100% 60%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(255,160,0,0.025) 0px, rgba(255,160,0,0.025) 1px, transparent 1px, transparent 14px)"},
  { id: "dos-blue", name: "DOS Blue", category: "Terminal", vars: {
    "--background":"240 50% 12%","--foreground":"60 100% 90%","--card":"240 50% 16%","--card-foreground":"60 100% 90%",
    "--primary":"60 100% 75%","--primary-foreground":"240 50% 12%","--accent":"60 80% 55%","--accent-foreground":"240 50% 12%",
    "--secondary":"240 50% 20%","--secondary-foreground":"60 80% 80%","--muted":"240 40% 18%","--muted-foreground":"60 50% 60%",
    "--border":"240 50% 22%","--input":"240 50% 22%","--ring":"60 100% 75%","--popover":"240 50% 16%","--popover-foreground":"60 100% 90%",
  }},
  { id: "red-alert", name: "Red Alert", category: "Terminal", vars: {
    "--background":"0 0% 3%","--foreground":"0 100% 65%","--card":"0 0% 6%","--card-foreground":"0 100% 65%",
    "--primary":"0 90% 60%","--primary-foreground":"0 0% 3%","--accent":"0 70% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 10%","--secondary-foreground":"0 70% 55%","--muted":"0 0% 8%","--muted-foreground":"0 40% 40%",
    "--border":"0 20% 14%","--input":"0 20% 14%","--ring":"0 90% 60%","--popover":"0 0% 6%","--popover-foreground":"0 100% 65%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(255,0,0,0.03) 0px, rgba(255,0,0,0.03) 1px, transparent 1px, transparent 16px)"},
  { id: "scanlines", name: "Scanlines", category: "Terminal", vars: {
    "--background":"0 0% 3%","--foreground":"0 0% 78%","--card":"0 0% 6%","--card-foreground":"0 0% 78%",
    "--primary":"0 0% 70%","--primary-foreground":"0 0% 3%","--accent":"0 0% 25%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 10%","--secondary-foreground":"0 0% 65%","--muted":"0 0% 8%","--muted-foreground":"0 0% 36%",
    "--border":"0 0% 14%","--input":"0 0% 14%","--ring":"0 0% 70%","--popover":"0 0% 6%","--popover-foreground":"0 0% 78%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 3px)"},
  { id: "commodore-64", name: "C64", category: "Terminal", vars: {
    "--background":"240 50% 10%","--foreground":"60 80% 75%","--card":"240 50% 14%","--card-foreground":"60 80% 75%",
    "--primary":"60 80% 65%","--primary-foreground":"240 50% 10%","--accent":"180 80% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 40% 18%","--secondary-foreground":"60 60% 65%","--muted":"240 35% 14%","--muted-foreground":"60 40% 50%",
    "--border":"240 40% 20%","--input":"240 40% 20%","--ring":"60 80% 65%","--popover":"240 50% 14%","--popover-foreground":"60 80% 75%",
  }},
  { id: "hacker-red", name: "Hacker Red", category: "Terminal", vars: {
    "--background":"0 0% 2%","--foreground":"0 80% 60%","--card":"0 0% 5%","--card-foreground":"0 80% 60%",
    "--primary":"0 80% 55%","--primary-foreground":"0 0% 2%","--accent":"0 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 9%","--secondary-foreground":"0 60% 50%","--muted":"0 0% 7%","--muted-foreground":"0 30% 38%",
    "--border":"0 20% 11%","--input":"0 20% 11%","--ring":"0 80% 55%","--popover":"0 0% 5%","--popover-foreground":"0 80% 60%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(255,0,0,0.025) 0px, rgba(255,0,0,0.025) 1px, transparent 1px, transparent 16px)"},
  { id: "neon-terminal", name: "Neon Terminal", category: "Terminal", vars: {
    "--background":"250 20% 3%","--foreground":"185 90% 65%","--card":"250 16% 6%","--card-foreground":"185 90% 65%",
    "--primary":"185 90% 60%","--primary-foreground":"0 0% 3%","--accent":"300 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"250 16% 10%","--secondary-foreground":"185 60% 55%","--muted":"250 12% 8%","--muted-foreground":"185 40% 40%",
    "--border":"250 14% 14%","--input":"250 14% 14%","--ring":"185 90% 60%","--popover":"250 16% 6%","--popover-foreground":"185 90% 65%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(0,220,255,0.08) 0%, transparent 60%)"},

  // ── MONOCHROME (8) ──
  { id: "pure-black", name: "Pure Black", category: "Mono", vars: {
    "--background":"0 0% 0%","--foreground":"0 0% 90%","--card":"0 0% 4%","--card-foreground":"0 0% 90%",
    "--primary":"0 0% 80%","--primary-foreground":"0 0% 0%","--accent":"0 0% 20%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 8%","--secondary-foreground":"0 0% 78%","--muted":"0 0% 6%","--muted-foreground":"0 0% 36%",
    "--border":"0 0% 10%","--input":"0 0% 10%","--ring":"0 0% 80%","--popover":"0 0% 4%","--popover-foreground":"0 0% 90%",
  }},
  { id: "sepia", name: "Sepia", category: "Mono", vars: {
    "--background":"30 8% 5%","--foreground":"30 5% 82%","--card":"30 6% 8%","--card-foreground":"30 5% 82%",
    "--primary":"30 45% 52%","--primary-foreground":"0 0% 3%","--accent":"25 35% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"30 6% 13%","--secondary-foreground":"30 4% 70%","--muted":"30 4% 10%","--muted-foreground":"30 4% 38%",
    "--border":"30 4% 15%","--input":"30 4% 15%","--ring":"30 45% 52%","--popover":"30 6% 8%","--popover-foreground":"30 5% 82%",
  }, gradient: "linear-gradient(135deg, rgba(150,100,50,0.08) 0%, transparent 60%)"},
  { id: "ash-grey", name: "Ash Grey", category: "Mono", vars: {
    "--background":"0 0% 6%","--foreground":"0 0% 82%","--card":"0 0% 9%","--card-foreground":"0 0% 82%",
    "--primary":"0 0% 65%","--primary-foreground":"0 0% 6%","--accent":"0 0% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 14%","--secondary-foreground":"0 0% 72%","--muted":"0 0% 11%","--muted-foreground":"0 0% 38%",
    "--border":"0 0% 17%","--input":"0 0% 17%","--ring":"0 0% 65%","--popover":"0 0% 9%","--popover-foreground":"0 0% 82%",
  }},
  { id: "cool-slate", name: "Cool Slate", category: "Mono", vars: {
    "--background":"215 8% 5%","--foreground":"215 4% 85%","--card":"215 6% 8%","--card-foreground":"215 4% 85%",
    "--primary":"215 20% 60%","--primary-foreground":"215 8% 5%","--accent":"215 12% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"215 6% 13%","--secondary-foreground":"215 3% 74%","--muted":"215 4% 10%","--muted-foreground":"215 3% 40%",
    "--border":"215 4% 16%","--input":"215 4% 16%","--ring":"215 20% 60%","--popover":"215 6% 8%","--popover-foreground":"215 4% 85%",
  }},
  { id: "warm-noir", name: "Warm Noir", category: "Mono", vars: {
    "--background":"20 5% 5%","--foreground":"20 3% 82%","--card":"20 4% 8%","--card-foreground":"20 3% 82%",
    "--primary":"20 35% 55%","--primary-foreground":"20 5% 5%","--accent":"15 25% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"20 4% 13%","--secondary-foreground":"20 2% 72%","--muted":"20 3% 10%","--muted-foreground":"20 2% 38%",
    "--border":"20 3% 16%","--input":"20 3% 16%","--ring":"20 35% 55%","--popover":"20 4% 8%","--popover-foreground":"20 3% 82%",
  }},
  { id: "ink-wash", name: "Ink Wash", category: "Mono", vars: {
    "--background":"230 6% 5%","--foreground":"230 2% 80%","--card":"230 4% 8%","--card-foreground":"230 2% 80%",
    "--primary":"230 12% 58%","--primary-foreground":"230 6% 5%","--accent":"230 8% 26%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 4% 13%","--secondary-foreground":"230 2% 70%","--muted":"230 2% 10%","--muted-foreground":"230 2% 38%",
    "--border":"230 2% 16%","--input":"230 2% 16%","--ring":"230 12% 58%","--popover":"230 4% 8%","--popover-foreground":"230 2% 80%",
  }},
  { id: "ghost-white", name: "Ghost", category: "Mono", vars: {
    "--background":"0 0% 4%","--foreground":"0 0% 86%","--card":"0 0% 7%","--card-foreground":"0 0% 86%",
    "--primary":"0 0% 78%","--primary-foreground":"0 0% 4%","--accent":"0 0% 22%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 11%","--secondary-foreground":"0 0% 74%","--muted":"0 0% 9%","--muted-foreground":"0 0% 36%",
    "--border":"0 0% 14%","--input":"0 0% 14%","--ring":"0 0% 78%","--popover":"0 0% 7%","--popover-foreground":"0 0% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 60%)"},
  { id: "stealth", name: "Stealth", category: "Mono", vars: {
    "--background":"210 6% 4%","--foreground":"210 3% 78%","--card":"210 4% 7%","--card-foreground":"210 3% 78%",
    "--primary":"210 6% 60%","--primary-foreground":"210 6% 4%","--accent":"210 4% 20%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 4% 11%","--secondary-foreground":"210 2% 68%","--muted":"210 3% 8%","--muted-foreground":"210 2% 34%",
    "--border":"210 3% 13%","--input":"210 3% 13%","--ring":"210 6% 60%","--popover":"210 4% 7%","--popover-foreground":"210 3% 78%",
  }},

  // ── DEGEN / MEME CULTURE (8) ──
  { id: "to-the-moon", name: "To The Moon", category: "Degen", vars: {
    "--background":"230 22% 4%","--foreground":"230 6% 90%","--card":"230 18% 7%","--card-foreground":"230 6% 90%",
    "--primary":"50 100% 60%","--primary-foreground":"0 0% 3%","--accent":"220 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 18% 12%","--secondary-foreground":"230 4% 78%","--muted":"230 14% 9%","--muted-foreground":"230 4% 44%",
    "--border":"230 14% 15%","--input":"230 14% 15%","--ring":"50 100% 60%","--popover":"230 18% 7%","--popover-foreground":"230 6% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 80%, rgba(30,60,200,0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 10%, rgba(255,200,0,0.15) 0%, transparent 40%)"},
  { id: "diamond-hands", name: "Diamond Hands", category: "Degen", vars: {
    "--background":"200 18% 4%","--foreground":"200 5% 90%","--card":"200 14% 7%","--card-foreground":"200 5% 90%",
    "--primary":"200 80% 68%","--primary-foreground":"200 18% 4%","--accent":"185 65% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 14% 12%","--secondary-foreground":"200 4% 78%","--muted":"200 10% 9%","--muted-foreground":"200 4% 44%",
    "--border":"200 10% 15%","--input":"200 10% 15%","--ring":"200 80% 68%","--popover":"200 14% 7%","--popover-foreground":"200 5% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(100,220,255,0.12) 0%, transparent 55%)"},
  { id: "paper-hands", name: "Paper Hands", category: "Degen", vars: {
    "--background":"40 12% 5%","--foreground":"40 5% 82%","--card":"40 10% 8%","--card-foreground":"40 5% 82%",
    "--primary":"40 50% 58%","--primary-foreground":"0 0% 3%","--accent":"30 40% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"40 10% 13%","--secondary-foreground":"40 4% 70%","--muted":"40 6% 10%","--muted-foreground":"40 4% 38%",
    "--border":"40 6% 16%","--input":"40 6% 16%","--ring":"40 50% 58%","--popover":"40 10% 8%","--popover-foreground":"40 5% 82%",
  }},
  { id: "ape-together", name: "Ape Together", category: "Degen", vars: {
    "--background":"30 15% 5%","--foreground":"30 5% 85%","--card":"30 12% 8%","--card-foreground":"30 5% 85%",
    "--primary":"30 70% 50%","--primary-foreground":"0 0% 3%","--accent":"20 55% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"30 12% 13%","--secondary-foreground":"30 4% 73%","--muted":"30 8% 10%","--muted-foreground":"30 4% 40%",
    "--border":"30 8% 16%","--input":"30 8% 16%","--ring":"30 70% 50%","--popover":"30 12% 8%","--popover-foreground":"30 5% 85%",
  }, gradient: "radial-gradient(ellipse at 40% 60%, rgba(200,120,40,0.14) 0%, transparent 50%)"},
  { id: "fud-grey", name: "FUD Season", category: "Degen", vars: {
    "--background":"0 0% 4%","--foreground":"0 0% 72%","--card":"0 0% 7%","--card-foreground":"0 0% 72%",
    "--primary":"0 0% 60%","--primary-foreground":"0 0% 4%","--accent":"0 0% 22%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 11%","--secondary-foreground":"0 0% 62%","--muted":"0 0% 9%","--muted-foreground":"0 0% 32%",
    "--border":"0 0% 13%","--input":"0 0% 13%","--ring":"0 0% 60%","--popover":"0 0% 7%","--popover-foreground":"0 0% 72%",
  }},
  { id: "pump-it", name: "Pump It", category: "Degen", vars: {
    "--background":"150 18% 4%","--foreground":"150 5% 88%","--card":"150 14% 7%","--card-foreground":"150 5% 88%",
    "--primary":"150 80% 48%","--primary-foreground":"0 0% 3%","--accent":"50 90% 52%","--accent-foreground":"0 0% 3%",
    "--secondary":"150 14% 12%","--secondary-foreground":"150 4% 76%","--muted":"150 10% 9%","--muted-foreground":"150 4% 42%",
    "--border":"150 10% 14%","--input":"150 10% 14%","--ring":"150 80% 48%","--popover":"150 14% 7%","--popover-foreground":"150 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 60%, rgba(0,220,100,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(255,200,0,0.1) 0%, transparent 40%)"},
  { id: "bearish", name: "Bear Market", category: "Degen", vars: {
    "--background":"0 12% 4%","--foreground":"0 5% 82%","--card":"0 10% 7%","--card-foreground":"0 5% 82%",
    "--primary":"0 70% 48%","--primary-foreground":"0 0% 100%","--accent":"0 50% 32%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 10% 12%","--secondary-foreground":"0 4% 70%","--muted":"0 6% 9%","--muted-foreground":"0 4% 38%",
    "--border":"0 6% 14%","--input":"0 6% 14%","--ring":"0 70% 48%","--popover":"0 10% 7%","--popover-foreground":"0 5% 82%",
  }, gradient: "radial-gradient(ellipse at 50% 30%, rgba(200,30,30,0.12) 0%, transparent 50%)"},
  { id: "bullish", name: "Bull Run", category: "Degen", vars: {
    "--background":"145 18% 4%","--foreground":"145 5% 88%","--card":"145 14% 7%","--card-foreground":"145 5% 88%",
    "--primary":"145 75% 48%","--primary-foreground":"0 0% 3%","--accent":"40 85% 52%","--accent-foreground":"0 0% 3%",
    "--secondary":"145 14% 12%","--secondary-foreground":"145 4% 76%","--muted":"145 10% 9%","--muted-foreground":"145 4% 42%",
    "--border":"145 10% 14%","--input":"145 10% 14%","--ring":"145 75% 48%","--popover":"145 14% 7%","--popover-foreground":"145 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 70%, rgba(0,200,100,0.15) 0%, transparent 50%), radial-gradient(ellipse at 60% 10%, rgba(255,180,0,0.12) 0%, transparent 40%)"},

// ── ADDITIONAL GLASS (4) ──
  { id: "vapor-glass", name: "Vapor Glass", category: "Glass", vars: {
    "--background":"260 15% 4%","--foreground":"260 5% 90%","--card":"260 12% 7%","--card-foreground":"260 5% 90%",
    "--primary":"260 65% 62%","--primary-foreground":"0 0% 100%","--accent":"200 75% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"260 12% 12%","--secondary-foreground":"260 4% 78%","--muted":"260 8% 9%","--muted-foreground":"260 4% 44%",
    "--border":"260 8% 15%","--input":"260 8% 15%","--ring":"260 65% 62%","--popover":"260 12% 7%","--popover-foreground":"260 5% 90%",
  }, gradient: "linear-gradient(135deg, rgba(150,100,255,0.1) 0%, rgba(0,200,255,0.1) 100%)"},
  { id: "smoke-glass", name: "Smoke Glass", category: "Glass", vars: {
    "--background":"0 0% 3%","--foreground":"0 0% 80%","--card":"0 0% 6%","--card-foreground":"0 0% 80%",
    "--primary":"0 0% 70%","--primary-foreground":"0 0% 3%","--accent":"0 0% 28%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 10%","--secondary-foreground":"0 0% 68%","--muted":"0 0% 7%","--muted-foreground":"0 0% 35%",
    "--border":"0 0% 13%","--input":"0 0% 13%","--ring":"0 0% 70%","--popover":"0 0% 6%","--popover-foreground":"0 0% 80%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 65%)"},
  { id: "absinthe", name: "Absinthe", category: "Glass", vars: {
    "--background":"170 18% 4%","--foreground":"170 8% 88%","--card":"170 14% 7%","--card-foreground":"170 8% 88%",
    "--primary":"170 75% 48%","--primary-foreground":"0 0% 3%","--accent":"140 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"170 14% 12%","--secondary-foreground":"170 4% 76%","--muted":"170 10% 9%","--muted-foreground":"170 4% 42%",
    "--border":"170 10% 14%","--input":"170 10% 14%","--ring":"170 75% 48%","--popover":"170 14% 7%","--popover-foreground":"170 8% 88%",
  }, gradient: "radial-gradient(ellipse at 40% 60%, rgba(0,200,150,0.15) 0%, transparent 50%)"},
  { id: "wine-glass", name: "Wine Glass", category: "Glass", vars: {
    "--background":"350 12% 4%","--foreground":"350 5% 86%","--card":"350 10% 7%","--card-foreground":"350 5% 86%",
    "--primary":"350 70% 52%","--primary-foreground":"0 0% 100%","--accent":"330 55% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"350 10% 12%","--secondary-foreground":"350 4% 74%","--muted":"350 6% 9%","--muted-foreground":"350 4% 40%",
    "--border":"350 6% 14%","--input":"350 6% 14%","--ring":"350 70% 52%","--popover":"350 10% 7%","--popover-foreground":"350 5% 86%",
  }, gradient: "radial-gradient(ellipse at 40% 30%, rgba(200,30,80,0.14) 0%, transparent 50%)"},

  // ── ADDITIONAL DARK ELITE (4) ──
  { id: "gunmetal", name: "Gunmetal", category: "Dark Elite", vars: {
    "--background":"210 6% 4%","--foreground":"210 3% 85%","--card":"210 5% 7%","--card-foreground":"210 3% 85%",
    "--primary":"210 20% 52%","--primary-foreground":"0 0% 100%","--accent":"210 14% 32%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 5% 12%","--secondary-foreground":"210 3% 73%","--muted":"210 4% 9%","--muted-foreground":"210 3% 40%",
    "--border":"210 4% 14%","--input":"210 4% 14%","--ring":"210 20% 52%","--popover":"210 5% 7%","--popover-foreground":"210 3% 85%",
  }},
  { id: "jet-black", name: "Jet Black", category: "Dark Elite", vars: {
    "--background":"240 6% 2%","--foreground":"240 2% 86%","--card":"240 4% 5%","--card-foreground":"240 2% 86%",
    "--primary":"240 50% 55%","--primary-foreground":"0 0% 100%","--accent":"240 30% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 4% 9%","--secondary-foreground":"240 2% 72%","--muted":"240 3% 7%","--muted-foreground":"240 2% 34%",
    "--border":"240 3% 11%","--input":"240 3% 11%","--ring":"240 50% 55%","--popover":"240 4% 5%","--popover-foreground":"240 2% 86%",
  }},
  { id: "pitch-slate", name: "Pitch Slate", category: "Dark Elite", vars: {
    "--background":"220 10% 3%","--foreground":"220 4% 84%","--card":"220 8% 6%","--card-foreground":"220 4% 84%",
    "--primary":"220 35% 52%","--primary-foreground":"0 0% 100%","--accent":"220 22% 34%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 8% 11%","--secondary-foreground":"220 3% 72%","--muted":"220 6% 8%","--muted-foreground":"220 3% 38%",
    "--border":"220 6% 13%","--input":"220 6% 13%","--ring":"220 35% 52%","--popover":"220 8% 6%","--popover-foreground":"220 4% 84%",
  }},
  { id: "dark-teal", name: "Dark Teal", category: "Dark Elite", vars: {
    "--background":"185 20% 4%","--foreground":"185 5% 86%","--card":"185 16% 7%","--card-foreground":"185 5% 86%",
    "--primary":"185 70% 46%","--primary-foreground":"0 0% 3%","--accent":"175 50% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"185 16% 12%","--secondary-foreground":"185 4% 74%","--muted":"185 12% 9%","--muted-foreground":"185 4% 40%",
    "--border":"185 12% 14%","--input":"185 12% 14%","--ring":"185 70% 46%","--popover":"185 16% 7%","--popover-foreground":"185 5% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 70%, rgba(0,180,180,0.13) 0%, transparent 50%)"},

  // ── ADDITIONAL NEON (4) ──
  { id: "neon-lime", name: "Neon Lime", category: "Neon", vars: {
    "--background":"85 18% 3%","--foreground":"85 8% 90%","--card":"85 14% 6%","--card-foreground":"85 8% 90%",
    "--primary":"85 95% 52%","--primary-foreground":"0 0% 3%","--accent":"80 75% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"85 14% 11%","--secondary-foreground":"85 5% 78%","--muted":"85 10% 8%","--muted-foreground":"85 4% 43%",
    "--border":"85 10% 13%","--input":"85 10% 13%","--ring":"85 95% 52%","--popover":"85 14% 6%","--popover-foreground":"85 8% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 60%, rgba(160,255,0,0.12) 0%, transparent 55%)"},
  { id: "neon-teal", name: "Neon Teal", category: "Neon", vars: {
    "--background":"175 20% 3%","--foreground":"175 8% 90%","--card":"175 16% 6%","--card-foreground":"175 8% 90%",
    "--primary":"175 95% 50%","--primary-foreground":"0 0% 3%","--accent":"165 75% 36%","--accent-foreground":"0 0% 100%",
    "--secondary":"175 16% 11%","--secondary-foreground":"175 5% 78%","--muted":"175 12% 8%","--muted-foreground":"175 4% 43%",
    "--border":"175 12% 13%","--input":"175 12% 13%","--ring":"175 95% 50%","--popover":"175 16% 6%","--popover-foreground":"175 8% 90%",
  }, gradient: "radial-gradient(ellipse at 40% 40%, rgba(0,255,200,0.13) 0%, transparent 50%)"},
  { id: "neon-magenta", name: "Neon Magenta", category: "Neon", vars: {
    "--background":"300 18% 3%","--foreground":"300 6% 90%","--card":"300 14% 6%","--card-foreground":"300 6% 90%",
    "--primary":"300 90% 58%","--primary-foreground":"0 0% 3%","--accent":"285 70% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"300 14% 11%","--secondary-foreground":"300 4% 78%","--muted":"300 10% 8%","--muted-foreground":"300 4% 43%",
    "--border":"300 10% 13%","--input":"300 10% 13%","--ring":"300 90% 58%","--popover":"300 14% 6%","--popover-foreground":"300 6% 90%",
  }, gradient: "radial-gradient(ellipse at 60% 40%, rgba(255,0,255,0.14) 0%, transparent 50%)"},
  { id: "neon-white", name: "Neon White", category: "Neon", vars: {
    "--background":"230 12% 4%","--foreground":"0 0% 95%","--card":"230 10% 7%","--card-foreground":"0 0% 95%",
    "--primary":"0 0% 95%","--primary-foreground":"230 12% 4%","--accent":"230 20% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 10% 12%","--secondary-foreground":"0 0% 80%","--muted":"230 8% 9%","--muted-foreground":"230 4% 44%",
    "--border":"230 8% 15%","--input":"230 8% 15%","--ring":"0 0% 95%","--popover":"230 10% 7%","--popover-foreground":"0 0% 95%",
  }, gradient: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.07) 0%, transparent 50%)"},

  // ── ADDITIONAL CRYPTO (4) ──
  { id: "litecoin", name: "Litecoin", category: "Crypto", vars: {
    "--background":"210 10% 4%","--foreground":"210 5% 88%","--card":"210 8% 7%","--card-foreground":"210 5% 88%",
    "--primary":"210 30% 60%","--primary-foreground":"0 0% 100%","--accent":"200 22% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 8% 12%","--secondary-foreground":"210 4% 76%","--muted":"210 6% 9%","--muted-foreground":"210 4% 42%",
    "--border":"210 6% 14%","--input":"210 6% 14%","--ring":"210 30% 60%","--popover":"210 8% 7%","--popover-foreground":"210 5% 88%",
  }},
  { id: "cardano", name: "Cardano", category: "Crypto", vars: {
    "--background":"220 18% 4%","--foreground":"220 5% 88%","--card":"220 14% 7%","--card-foreground":"220 5% 88%",
    "--primary":"220 75% 58%","--primary-foreground":"0 0% 100%","--accent":"200 60% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 14% 12%","--secondary-foreground":"220 4% 76%","--muted":"220 10% 9%","--muted-foreground":"220 4% 42%",
    "--border":"220 10% 15%","--input":"220 10% 15%","--ring":"220 75% 58%","--popover":"220 14% 7%","--popover-foreground":"220 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(0,51,173,0.16) 0%, transparent 55%)"},
  { id: "avalanche", name: "Avalanche", category: "Crypto", vars: {
    "--background":"0 14% 4%","--foreground":"0 5% 88%","--card":"0 10% 7%","--card-foreground":"0 5% 88%",
    "--primary":"0 85% 55%","--primary-foreground":"0 0% 100%","--accent":"0 65% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 10% 12%","--secondary-foreground":"0 4% 76%","--muted":"0 6% 9%","--muted-foreground":"0 4% 42%",
    "--border":"0 6% 14%","--input":"0 6% 14%","--ring":"0 85% 55%","--popover":"0 10% 7%","--popover-foreground":"0 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(232,65,66,0.15) 0%, transparent 55%)"},
  { id: "polygon", name: "Polygon", category: "Crypto", vars: {
    "--background":"270 18% 4%","--foreground":"270 5% 88%","--card":"270 14% 7%","--card-foreground":"270 5% 88%",
    "--primary":"270 80% 62%","--primary-foreground":"0 0% 100%","--accent":"280 65% 44%","--accent-foreground":"0 0% 100%",
    "--secondary":"270 14% 12%","--secondary-foreground":"270 4% 76%","--muted":"270 10% 9%","--muted-foreground":"270 4% 42%",
    "--border":"270 10% 15%","--input":"270 10% 15%","--ring":"270 80% 62%","--popover":"270 14% 7%","--popover-foreground":"270 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(130,71,229,0.16) 0%, transparent 55%)"},

  // ── ADDITIONAL OG THEMES (4) ──
  { id: "og-fire", name: "OG Fire", category: "OG", vars: {
    "--background":"10 18% 4%","--foreground":"10 5% 88%","--card":"10 14% 7%","--card-foreground":"10 5% 88%",
    "--primary":"15 95% 55%","--primary-foreground":"0 0% 3%","--accent":"40 90% 50%","--accent-foreground":"0 0% 3%",
    "--secondary":"10 14% 12%","--secondary-foreground":"10 4% 76%","--muted":"10 10% 9%","--muted-foreground":"10 4% 42%",
    "--border":"10 10% 14%","--input":"10 10% 14%","--ring":"15 95% 55%","--popover":"10 14% 7%","--popover-foreground":"10 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 80%, rgba(255,80,0,0.2) 0%, transparent 50%), radial-gradient(ellipse at 30% 40%, rgba(255,160,0,0.12) 0%, transparent 40%)"},
  { id: "og-ice", name: "OG Ice", category: "OG", vars: {
    "--background":"205 20% 4%","--foreground":"205 6% 90%","--card":"205 16% 7%","--card-foreground":"205 6% 90%",
    "--primary":"205 85% 60%","--primary-foreground":"0 0% 3%","--accent":"195 65% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"205 16% 12%","--secondary-foreground":"205 4% 78%","--muted":"205 12% 9%","--muted-foreground":"205 4% 44%",
    "--border":"205 12% 15%","--input":"205 12% 15%","--ring":"205 85% 60%","--popover":"205 16% 7%","--popover-foreground":"205 6% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 20%, rgba(0,180,255,0.15) 0%, transparent 50%)"},
  { id: "og-shadow", name: "OG Shadow", category: "OG", vars: {
    "--background":"0 0% 3%","--foreground":"0 0% 75%","--card":"0 0% 6%","--card-foreground":"0 0% 75%",
    "--primary":"0 0% 65%","--primary-foreground":"0 0% 3%","--accent":"170 60% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 10%","--secondary-foreground":"0 0% 64%","--muted":"0 0% 8%","--muted-foreground":"0 0% 32%",
    "--border":"0 0% 12%","--input":"0 0% 12%","--ring":"170 60% 40%","--popover":"0 0% 6%","--popover-foreground":"0 0% 75%",
  }, gradient: "radial-gradient(ellipse at 50% 100%, rgba(0,200,160,0.1) 0%, transparent 50%)"},
  { id: "og-royal", name: "OG Royal", category: "OG", vars: {
    "--background":"240 20% 4%","--foreground":"240 6% 88%","--card":"240 16% 7%","--card-foreground":"240 6% 88%",
    "--primary":"42 92% 58%","--primary-foreground":"0 0% 3%","--accent":"240 70% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 16% 12%","--secondary-foreground":"240 4% 76%","--muted":"240 12% 9%","--muted-foreground":"240 4% 42%",
    "--border":"240 12% 15%","--input":"240 12% 15%","--ring":"42 92% 58%","--popover":"240 16% 7%","--popover-foreground":"240 6% 88%",
  }, gradient: "radial-gradient(ellipse at 30% 30%, rgba(255,200,0,0.14) 0%, transparent 45%), radial-gradient(ellipse at 70% 70%, rgba(60,80,220,0.12) 0%, transparent 40%)"},

  // ── ADDITIONAL SOLANA (4) ──
  { id: "sol-mint", name: "SOL Mint", category: "Solana", vars: {
    "--background":"170 20% 4%","--foreground":"170 6% 88%","--card":"170 16% 7%","--card-foreground":"170 6% 88%",
    "--primary":"170 90% 50%","--primary-foreground":"0 0% 3%","--accent":"155 70% 36%","--accent-foreground":"0 0% 100%",
    "--secondary":"170 16% 12%","--secondary-foreground":"170 4% 76%","--muted":"170 12% 9%","--muted-foreground":"170 4% 42%",
    "--border":"170 12% 14%","--input":"170 12% 14%","--ring":"170 90% 50%","--popover":"170 16% 7%","--popover-foreground":"170 6% 88%",
  }, gradient: "radial-gradient(ellipse at 40% 60%, rgba(0,255,180,0.13) 0%, transparent 50%)"},
  { id: "sol-dusk", name: "SOL Dusk", category: "Solana", vars: {
    "--background":"295 16% 4%","--foreground":"295 5% 88%","--card":"295 12% 7%","--card-foreground":"295 5% 88%",
    "--primary":"295 75% 60%","--primary-foreground":"0 0% 100%","--accent":"170 85% 46%","--accent-foreground":"0 0% 3%",
    "--secondary":"295 12% 12%","--secondary-foreground":"295 4% 76%","--muted":"295 8% 9%","--muted-foreground":"295 4% 42%",
    "--border":"295 8% 14%","--input":"295 8% 14%","--ring":"295 75% 60%","--popover":"295 12% 7%","--popover-foreground":"295 5% 88%",
  }, gradient: "linear-gradient(135deg, rgba(220,31,255,0.14) 0%, rgba(0,255,163,0.12) 100%)"},
  { id: "pump-fun", name: "Pump.fun", category: "Solana", vars: {
    "--background":"300 18% 4%","--foreground":"300 5% 88%","--card":"300 14% 7%","--card-foreground":"300 5% 88%",
    "--primary":"300 85% 58%","--primary-foreground":"0 0% 3%","--accent":"170 90% 48%","--accent-foreground":"0 0% 3%",
    "--secondary":"300 14% 12%","--secondary-foreground":"300 4% 76%","--muted":"300 10% 9%","--muted-foreground":"300 4% 42%",
    "--border":"300 10% 14%","--input":"300 10% 14%","--ring":"300 85% 58%","--popover":"300 14% 7%","--popover-foreground":"300 5% 88%",
  }, gradient: "radial-gradient(ellipse at 30% 40%, rgba(255,0,255,0.14) 0%, transparent 45%), radial-gradient(ellipse at 70% 60%, rgba(0,255,163,0.12) 0%, transparent 40%)"},
  { id: "jito-green", name: "Jito", category: "Solana", vars: {
    "--background":"150 20% 4%","--foreground":"150 6% 88%","--card":"150 16% 7%","--card-foreground":"150 6% 88%",
    "--primary":"150 80% 48%","--primary-foreground":"0 0% 3%","--accent":"135 60% 34%","--accent-foreground":"0 0% 100%",
    "--secondary":"150 16% 12%","--secondary-foreground":"150 4% 76%","--muted":"150 12% 9%","--muted-foreground":"150 4% 42%",
    "--border":"150 12% 14%","--input":"150 12% 14%","--ring":"150 80% 48%","--popover":"150 16% 7%","--popover-foreground":"150 6% 88%",
  }, gradient: "radial-gradient(ellipse at 60% 40%, rgba(0,220,120,0.14) 0%, transparent 50%)"},

  // ── ADDITIONAL CYBER (4) ──
  { id: "akira", name: "Akira", category: "Cyber", vars: {
    "--background":"0 14% 4%","--foreground":"0 5% 88%","--card":"0 10% 7%","--card-foreground":"0 5% 88%",
    "--primary":"0 85% 55%","--primary-foreground":"0 0% 100%","--accent":"50 90% 52%","--accent-foreground":"0 0% 3%",
    "--secondary":"0 10% 12%","--secondary-foreground":"0 4% 76%","--muted":"0 6% 9%","--muted-foreground":"0 4% 42%",
    "--border":"0 6% 14%","--input":"0 6% 14%","--ring":"0 85% 55%","--popover":"0 10% 7%","--popover-foreground":"0 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 70%, rgba(255,30,30,0.16) 0%, transparent 50%)"},
  { id: "ghost-shell", name: "Ghost in the Shell", category: "Cyber", vars: {
    "--background":"195 22% 4%","--foreground":"195 6% 88%","--card":"195 18% 7%","--card-foreground":"195 6% 88%",
    "--primary":"195 90% 52%","--primary-foreground":"0 0% 3%","--accent":"270 70% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"195 18% 12%","--secondary-foreground":"195 4% 76%","--muted":"195 14% 9%","--muted-foreground":"195 4% 42%",
    "--border":"195 14% 15%","--input":"195 14% 15%","--ring":"195 90% 52%","--popover":"195 18% 7%","--popover-foreground":"195 6% 88%",
  }, gradient: "radial-gradient(ellipse at 30% 70%, rgba(0,220,255,0.14) 0%, transparent 45%), radial-gradient(ellipse at 70% 30%, rgba(150,60,240,0.12) 0%, transparent 40%)"},
  { id: "outrun", name: "Outrun", category: "Cyber", vars: {
    "--background":"240 22% 4%","--foreground":"300 6% 88%","--card":"240 18% 7%","--card-foreground":"300 6% 88%",
    "--primary":"345 90% 58%","--primary-foreground":"0 0% 100%","--accent":"50 100% 55%","--accent-foreground":"0 0% 3%",
    "--secondary":"240 18% 12%","--secondary-foreground":"300 4% 76%","--muted":"240 14% 9%","--muted-foreground":"240 4% 42%",
    "--border":"240 14% 15%","--input":"240 14% 15%","--ring":"345 90% 58%","--popover":"240 18% 7%","--popover-foreground":"300 6% 88%",
  }, gradient: "linear-gradient(180deg, transparent 50%, rgba(255,20,150,0.12) 75%, rgba(255,80,0,0.1) 100%), radial-gradient(ellipse at 50% 100%, rgba(255,20,150,0.15) 0%, transparent 40%)"},
  { id: "io-moon", name: "Io Moon", category: "Cyber", vars: {
    "--background":"50 15% 4%","--foreground":"50 6% 88%","--card":"50 12% 7%","--card-foreground":"50 6% 88%",
    "--primary":"50 85% 55%","--primary-foreground":"0 0% 3%","--accent":"20 70% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"50 12% 12%","--secondary-foreground":"50 4% 76%","--muted":"50 8% 9%","--muted-foreground":"50 4% 42%",
    "--border":"50 8% 14%","--input":"50 8% 14%","--ring":"50 85% 55%","--popover":"50 12% 7%","--popover-foreground":"50 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(255,180,0,0.14) 0%, transparent 55%)"},

  // ── ADDITIONAL GAMER (4) ──
  { id: "gm-atari", name: "Atari", category: "Gamer", vars: {
    "--background":"30 10% 4%","--foreground":"30 5% 84%","--card":"30 8% 7%","--card-foreground":"30 5% 84%",
    "--primary":"30 60% 52%","--primary-foreground":"0 0% 3%","--accent":"15 48% 36%","--accent-foreground":"0 0% 100%",
    "--secondary":"30 8% 12%","--secondary-foreground":"30 4% 72%","--muted":"30 5% 9%","--muted-foreground":"30 4% 38%",
    "--border":"30 5% 14%","--input":"30 5% 14%","--ring":"30 60% 52%","--popover":"30 8% 7%","--popover-foreground":"30 5% 84%",
  }},
  { id: "gm-dreamcast", name: "Dreamcast", category: "Gamer", vars: {
    "--background":"230 12% 5%","--foreground":"230 4% 84%","--card":"230 10% 8%","--card-foreground":"230 4% 84%",
    "--primary":"230 65% 58%","--primary-foreground":"0 0% 100%","--accent":"200 55% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 10% 13%","--secondary-foreground":"230 3% 72%","--muted":"230 6% 10%","--muted-foreground":"230 3% 38%",
    "--border":"230 6% 16%","--input":"230 6% 16%","--ring":"230 65% 58%","--popover":"230 10% 8%","--popover-foreground":"230 4% 84%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(60,100,220,0.13) 0%, transparent 55%)"},
  { id: "gm-moba", name: "MOBA", category: "Gamer", vars: {
    "--background":"200 20% 4%","--foreground":"200 5% 86%","--card":"200 16% 7%","--card-foreground":"200 5% 86%",
    "--primary":"200 80% 52%","--primary-foreground":"0 0% 3%","--accent":"50 90% 52%","--accent-foreground":"0 0% 3%",
    "--secondary":"200 16% 12%","--secondary-foreground":"200 4% 74%","--muted":"200 12% 9%","--muted-foreground":"200 4% 40%",
    "--border":"200 12% 14%","--input":"200 12% 14%","--ring":"200 80% 52%","--popover":"200 16% 7%","--popover-foreground":"200 5% 86%",
  }, gradient: "radial-gradient(ellipse at 30% 60%, rgba(0,180,255,0.13) 0%, transparent 45%), radial-gradient(ellipse at 70% 30%, rgba(255,200,0,0.1) 0%, transparent 40%)"},
  { id: "gm-fps", name: "FPS Mode", category: "Gamer", vars: {
    "--background":"0 0% 3%","--foreground":"0 0% 82%","--card":"0 0% 6%","--card-foreground":"0 0% 82%",
    "--primary":"80 90% 50%","--primary-foreground":"0 0% 3%","--accent":"60 80% 40%","--accent-foreground":"0 0% 3%",
    "--secondary":"0 0% 10%","--secondary-foreground":"0 0% 70%","--muted":"0 0% 8%","--muted-foreground":"0 0% 36%",
    "--border":"0 0% 13%","--input":"0 0% 13%","--ring":"80 90% 50%","--popover":"0 0% 6%","--popover-foreground":"0 0% 82%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(150,255,0,0.02) 0px, rgba(150,255,0,0.02) 1px, transparent 1px, transparent 18px)"},

  // ── ADDITIONAL NATURE (4) ──
  { id: "lava-field", name: "Lava Field", category: "Nature", vars: {
    "--background":"10 20% 4%","--foreground":"10 5% 86%","--card":"10 16% 7%","--card-foreground":"10 5% 86%",
    "--primary":"10 92% 55%","--primary-foreground":"0 0% 3%","--accent":"40 85% 48%","--accent-foreground":"0 0% 3%",
    "--secondary":"10 16% 12%","--secondary-foreground":"10 4% 74%","--muted":"10 12% 9%","--muted-foreground":"10 4% 40%",
    "--border":"10 12% 14%","--input":"10 12% 14%","--ring":"10 92% 55%","--popover":"10 16% 7%","--popover-foreground":"10 5% 86%",
  }, gradient: "radial-gradient(ellipse at 40% 80%, rgba(255,80,0,0.18) 0%, transparent 50%), radial-gradient(ellipse at 60% 40%, rgba(255,150,0,0.1) 0%, transparent 40%)"},
  { id: "arctic-dawn", name: "Arctic Dawn", category: "Nature", vars: {
    "--background":"200 24% 4%","--foreground":"200 6% 88%","--card":"200 20% 7%","--card-foreground":"200 6% 88%",
    "--primary":"200 75% 60%","--primary-foreground":"0 0% 3%","--accent":"220 60% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 20% 12%","--secondary-foreground":"200 4% 76%","--muted":"200 16% 9%","--muted-foreground":"200 4% 42%",
    "--border":"200 16% 15%","--input":"200 16% 15%","--ring":"200 75% 60%","--popover":"200 20% 7%","--popover-foreground":"200 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 0%, rgba(100,180,255,0.14) 0%, transparent 45%), radial-gradient(ellipse at 20% 80%, rgba(0,220,200,0.1) 0%, transparent 40%)"},
  { id: "galaxy-core", name: "Galaxy Core", category: "Nature", vars: {
    "--background":"255 20% 4%","--foreground":"255 5% 88%","--card":"255 16% 7%","--card-foreground":"255 5% 88%",
    "--primary":"255 70% 62%","--primary-foreground":"0 0% 100%","--accent":"320 75% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"255 16% 12%","--secondary-foreground":"255 4% 76%","--muted":"255 12% 9%","--muted-foreground":"255 4% 42%",
    "--border":"255 12% 15%","--input":"255 12% 15%","--ring":"255 70% 62%","--popover":"255 16% 7%","--popover-foreground":"255 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(120,60,255,0.16) 0%, transparent 45%), radial-gradient(ellipse at 80% 20%, rgba(255,60,180,0.12) 0%, transparent 40%)"},
  { id: "storm-front", name: "Storm Front", category: "Nature", vars: {
    "--background":"215 14% 4%","--foreground":"215 5% 84%","--card":"215 12% 7%","--card-foreground":"215 5% 84%",
    "--primary":"215 55% 55%","--primary-foreground":"0 0% 100%","--accent":"50 80% 50%","--accent-foreground":"0 0% 3%",
    "--secondary":"215 12% 12%","--secondary-foreground":"215 4% 72%","--muted":"215 8% 9%","--muted-foreground":"215 4% 38%",
    "--border":"215 8% 14%","--input":"215 8% 14%","--ring":"215 55% 55%","--popover":"215 12% 7%","--popover-foreground":"215 5% 84%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(60,100,200,0.12) 0%, transparent 55%), radial-gradient(ellipse at 70% 20%, rgba(255,200,0,0.08) 0%, transparent 35%)"},

  // ── ADDITIONAL LUXURY (4) ──
  { id: "champagne", name: "Champagne", category: "Luxury", vars: {
    "--background":"45 10% 5%","--foreground":"45 5% 84%","--card":"45 8% 8%","--card-foreground":"45 5% 84%",
    "--primary":"45 60% 62%","--primary-foreground":"0 0% 3%","--accent":"35 45% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"45 8% 13%","--secondary-foreground":"45 4% 72%","--muted":"45 5% 10%","--muted-foreground":"45 4% 38%",
    "--border":"45 5% 16%","--input":"45 5% 16%","--ring":"45 60% 62%","--popover":"45 8% 8%","--popover-foreground":"45 5% 84%",
  }, gradient: "linear-gradient(135deg, rgba(220,190,100,0.08) 0%, transparent 55%)"},
  { id: "black-pearl", name: "Black Pearl", category: "Luxury", vars: {
    "--background":"200 10% 3%","--foreground":"200 4% 80%","--card":"200 8% 6%","--card-foreground":"200 4% 80%",
    "--primary":"200 30% 55%","--primary-foreground":"200 10% 3%","--accent":"200 18% 28%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 8% 10%","--secondary-foreground":"200 3% 68%","--muted":"200 5% 8%","--muted-foreground":"200 3% 34%",
    "--border":"200 5% 13%","--input":"200 5% 13%","--ring":"200 30% 55%","--popover":"200 8% 6%","--popover-foreground":"200 4% 80%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(80,150,200,0.06) 0%, transparent 55%)"},
  { id: "emerald-royal", name: "Emerald Royal", category: "Luxury", vars: {
    "--background":"160 16% 4%","--foreground":"160 5% 84%","--card":"160 12% 7%","--card-foreground":"160 5% 84%",
    "--primary":"155 65% 48%","--primary-foreground":"0 0% 3%","--accent":"140 48% 32%","--accent-foreground":"0 0% 100%",
    "--secondary":"160 12% 12%","--secondary-foreground":"160 4% 72%","--muted":"160 8% 9%","--muted-foreground":"160 4% 38%",
    "--border":"160 8% 14%","--input":"160 8% 14%","--ring":"155 65% 48%","--popover":"160 12% 7%","--popover-foreground":"160 5% 84%",
  }, gradient: "radial-gradient(ellipse at 40% 40%, rgba(0,160,100,0.13) 0%, transparent 50%)"},
  { id: "titanium", name: "Titanium", category: "Luxury", vars: {
    "--background":"210 5% 5%","--foreground":"210 2% 82%","--card":"210 4% 8%","--card-foreground":"210 2% 82%",
    "--primary":"210 15% 62%","--primary-foreground":"210 5% 5%","--accent":"210 10% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 4% 13%","--secondary-foreground":"210 2% 70%","--muted":"210 3% 10%","--muted-foreground":"210 2% 36%",
    "--border":"210 3% 16%","--input":"210 3% 16%","--ring":"210 15% 62%","--popover":"210 4% 8%","--popover-foreground":"210 2% 82%",
  }},

  // ── ADDITIONAL TERMINAL (4) ──
  { id: "bios-screen", name: "BIOS Screen", category: "Terminal", vars: {
    "--background":"240 70% 6%","--foreground":"0 0% 96%","--card":"240 60% 10%","--card-foreground":"0 0% 96%",
    "--primary":"0 0% 96%","--primary-foreground":"240 70% 6%","--accent":"0 0% 70%","--accent-foreground":"240 70% 6%",
    "--secondary":"240 55% 14%","--secondary-foreground":"0 0% 86%","--muted":"240 50% 11%","--muted-foreground":"0 0% 58%",
    "--border":"240 55% 18%","--input":"240 55% 18%","--ring":"0 0% 96%","--popover":"240 60% 10%","--popover-foreground":"0 0% 96%",
  }},
  { id: "turbo-pascal", name: "Turbo Pascal", category: "Terminal", vars: {
    "--background":"240 60% 8%","--foreground":"60 100% 80%","--card":"240 55% 12%","--card-foreground":"60 100% 80%",
    "--primary":"60 100% 65%","--primary-foreground":"240 60% 8%","--accent":"200 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 50% 16%","--secondary-foreground":"60 80% 70%","--muted":"240 45% 12%","--muted-foreground":"60 50% 55%",
    "--border":"240 50% 20%","--input":"240 50% 20%","--ring":"60 100% 65%","--popover":"240 55% 12%","--popover-foreground":"60 100% 80%",
  }},
  { id: "ssh-dark", name: "SSH Dark", category: "Terminal", vars: {
    "--background":"0 0% 3%","--foreground":"140 40% 65%","--card":"0 0% 6%","--card-foreground":"140 40% 65%",
    "--primary":"140 50% 58%","--primary-foreground":"0 0% 3%","--accent":"140 30% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 10%","--secondary-foreground":"140 30% 55%","--muted":"0 0% 8%","--muted-foreground":"140 18% 38%",
    "--border":"140 12% 13%","--input":"140 12% 13%","--ring":"140 50% 58%","--popover":"0 0% 6%","--popover-foreground":"140 40% 65%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(0,180,80,0.02) 0px, rgba(0,180,80,0.02) 1px, transparent 1px, transparent 20px)"},
  { id: "vim-dark", name: "Vim Dark", category: "Terminal", vars: {
    "--background":"230 10% 4%","--foreground":"230 4% 82%","--card":"230 8% 7%","--card-foreground":"230 4% 82%",
    "--primary":"50 90% 58%","--primary-foreground":"0 0% 3%","--accent":"200 70% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 8% 12%","--secondary-foreground":"230 3% 70%","--muted":"230 5% 9%","--muted-foreground":"230 3% 36%",
    "--border":"230 5% 14%","--input":"230 5% 14%","--ring":"50 90% 58%","--popover":"230 8% 7%","--popover-foreground":"230 4% 82%",
  }},

  // ── ADDITIONAL MONO (4) ──
  { id: "slate-dark", name: "Slate Dark", category: "Mono", vars: {
    "--background":"218 10% 4%","--foreground":"218 4% 82%","--card":"218 8% 7%","--card-foreground":"218 4% 82%",
    "--primary":"218 18% 58%","--primary-foreground":"218 10% 4%","--accent":"218 10% 24%","--accent-foreground":"0 0% 100%",
    "--secondary":"218 8% 12%","--secondary-foreground":"218 3% 70%","--muted":"218 5% 9%","--muted-foreground":"218 3% 36%",
    "--border":"218 5% 14%","--input":"218 5% 14%","--ring":"218 18% 58%","--popover":"218 8% 7%","--popover-foreground":"218 4% 82%",
  }},
  { id: "zinc-dark", name: "Zinc Dark", category: "Mono", vars: {
    "--background":"240 4% 4%","--foreground":"240 2% 80%","--card":"240 3% 7%","--card-foreground":"240 2% 80%",
    "--primary":"240 4% 60%","--primary-foreground":"240 4% 4%","--accent":"240 3% 22%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 3% 11%","--secondary-foreground":"240 2% 68%","--muted":"240 2% 8%","--muted-foreground":"240 2% 34%",
    "--border":"240 2% 14%","--input":"240 2% 14%","--ring":"240 4% 60%","--popover":"240 3% 7%","--popover-foreground":"240 2% 80%",
  }},
  { id: "dim-blue", name: "Dim Blue", category: "Mono", vars: {
    "--background":"220 14% 5%","--foreground":"220 4% 80%","--card":"220 12% 8%","--card-foreground":"220 4% 80%",
    "--primary":"220 28% 56%","--primary-foreground":"220 14% 5%","--accent":"220 14% 24%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 12% 13%","--secondary-foreground":"220 3% 68%","--muted":"220 8% 10%","--muted-foreground":"220 3% 34%",
    "--border":"220 8% 16%","--input":"220 8% 16%","--ring":"220 28% 56%","--popover":"220 12% 8%","--popover-foreground":"220 4% 80%",
  }},
  { id: "truffle", name: "Truffle", category: "Mono", vars: {
    "--background":"30 6% 5%","--foreground":"30 2% 78%","--card":"30 5% 8%","--card-foreground":"30 2% 78%",
    "--primary":"30 20% 54%","--primary-foreground":"30 6% 5%","--accent":"25 12% 22%","--accent-foreground":"0 0% 100%",
    "--secondary":"30 5% 12%","--secondary-foreground":"30 2% 66%","--muted":"30 3% 9%","--muted-foreground":"30 2% 32%",
    "--border":"30 3% 14%","--input":"30 3% 14%","--ring":"30 20% 54%","--popover":"30 5% 8%","--popover-foreground":"30 2% 78%",
  }},

  // ── ADDITIONAL DEGEN (4) ──
  { id: "gm-fren", name: "GM Fren", category: "Degen", vars: {
    "--background":"50 15% 4%","--foreground":"50 5% 86%","--card":"50 12% 7%","--card-foreground":"50 5% 86%",
    "--primary":"50 95% 58%","--primary-foreground":"0 0% 3%","--accent":"40 75% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"50 12% 12%","--secondary-foreground":"50 4% 74%","--muted":"50 8% 9%","--muted-foreground":"50 4% 40%",
    "--border":"50 8% 14%","--input":"50 8% 14%","--ring":"50 95% 58%","--popover":"50 12% 7%","--popover-foreground":"50 5% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 30%, rgba(255,200,0,0.13) 0%, transparent 50%)"},
  { id: "rekt", name: "Rekt", category: "Degen", vars: {
    "--background":"0 10% 3%","--foreground":"0 4% 76%","--card":"0 8% 6%","--card-foreground":"0 4% 76%",
    "--primary":"0 70% 46%","--primary-foreground":"0 0% 100%","--accent":"0 45% 28%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 8% 10%","--secondary-foreground":"0 3% 64%","--muted":"0 5% 8%","--muted-foreground":"0 3% 30%",
    "--border":"0 5% 12%","--input":"0 5% 12%","--ring":"0 70% 46%","--popover":"0 8% 6%","--popover-foreground":"0 4% 76%",
  }},
  { id: "ser", name: "Ser", category: "Degen", vars: {
    "--background":"220 12% 4%","--foreground":"220 4% 82%","--card":"220 10% 7%","--card-foreground":"220 4% 82%",
    "--primary":"220 65% 58%","--primary-foreground":"0 0% 100%","--accent":"240 50% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 10% 12%","--secondary-foreground":"220 3% 70%","--muted":"220 6% 9%","--muted-foreground":"220 3% 36%",
    "--border":"220 6% 14%","--input":"220 6% 14%","--ring":"220 65% 58%","--popover":"220 10% 7%","--popover-foreground":"220 4% 82%",
  }},
  { id: "probably-nothing", name: "Probably Nothing", category: "Degen", vars: {
    "--background":"280 10% 4%","--foreground":"280 3% 80%","--card":"280 8% 7%","--card-foreground":"280 3% 80%",
    "--primary":"280 55% 58%","--primary-foreground":"0 0% 100%","--accent":"260 40% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 8% 12%","--secondary-foreground":"280 3% 68%","--muted":"280 5% 9%","--muted-foreground":"280 3% 34%",
    "--border":"280 5% 14%","--input":"280 5% 14%","--ring":"280 55% 58%","--popover":"280 8% 7%","--popover-foreground":"280 3% 80%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(160,80,255,0.1) 0%, transparent 55%)"},

  // ── CARTOON / BRIGHT (8) ──
  { id: "cartoon-red", name: "Cartoon Red", category: "Cartoon", vars: {
    "--background":"0 20% 5%","--foreground":"0 6% 88%","--card":"0 16% 8%","--card-foreground":"0 6% 88%",
    "--primary":"0 85% 55%","--primary-foreground":"0 0% 100%","--accent":"20 80% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 16% 13%","--secondary-foreground":"0 4% 76%","--muted":"0 12% 10%","--muted-foreground":"0 4% 42%",
    "--border":"0 12% 16%","--input":"0 12% 16%","--ring":"0 85% 55%","--popover":"0 16% 8%","--popover-foreground":"0 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 40%, rgba(255,60,60,0.16) 0%, transparent 50%)"},
  { id: "cartoon-blue", name: "Cartoon Blue", category: "Cartoon", vars: {
    "--background":"215 22% 5%","--foreground":"215 6% 88%","--card":"215 18% 8%","--card-foreground":"215 6% 88%",
    "--primary":"215 80% 56%","--primary-foreground":"0 0% 100%","--accent":"200 70% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"215 18% 13%","--secondary-foreground":"215 4% 76%","--muted":"215 14% 10%","--muted-foreground":"215 4% 42%",
    "--border":"215 14% 16%","--input":"215 14% 16%","--ring":"215 80% 56%","--popover":"215 18% 8%","--popover-foreground":"215 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 40%, rgba(60,130,255,0.15) 0%, transparent 50%)"},
  { id: "cartoon-green", name: "Cartoon Green", category: "Cartoon", vars: {
    "--background":"140 20% 5%","--foreground":"140 6% 88%","--card":"140 16% 8%","--card-foreground":"140 6% 88%",
    "--primary":"140 75% 48%","--primary-foreground":"0 0% 3%","--accent":"120 60% 36%","--accent-foreground":"0 0% 100%",
    "--secondary":"140 16% 13%","--secondary-foreground":"140 4% 76%","--muted":"140 12% 10%","--muted-foreground":"140 4% 42%",
    "--border":"140 12% 16%","--input":"140 12% 16%","--ring":"140 75% 48%","--popover":"140 16% 8%","--popover-foreground":"140 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 60%, rgba(60,220,100,0.14) 0%, transparent 50%)"},
  { id: "cartoon-yellow", name: "Cartoon Yellow", category: "Cartoon", vars: {
    "--background":"50 18% 5%","--foreground":"50 6% 88%","--card":"50 14% 8%","--card-foreground":"50 6% 88%",
    "--primary":"50 95% 55%","--primary-foreground":"0 0% 3%","--accent":"40 80% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"50 14% 13%","--secondary-foreground":"50 4% 76%","--muted":"50 10% 10%","--muted-foreground":"50 4% 42%",
    "--border":"50 10% 16%","--input":"50 10% 16%","--ring":"50 95% 55%","--popover":"50 14% 8%","--popover-foreground":"50 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 40%, rgba(255,220,0,0.15) 0%, transparent 50%)"},
  { id: "cartoon-purple", name: "Cartoon Purple", category: "Cartoon", vars: {
    "--background":"275 20% 5%","--foreground":"275 6% 88%","--card":"275 16% 8%","--card-foreground":"275 6% 88%",
    "--primary":"275 80% 60%","--primary-foreground":"0 0% 100%","--accent":"260 65% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"275 16% 13%","--secondary-foreground":"275 4% 76%","--muted":"275 12% 10%","--muted-foreground":"275 4% 42%",
    "--border":"275 12% 16%","--input":"275 12% 16%","--ring":"275 80% 60%","--popover":"275 16% 8%","--popover-foreground":"275 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 40%, rgba(160,80,255,0.15) 0%, transparent 50%)"},
  { id: "cartoon-pink", name: "Cartoon Pink", category: "Cartoon", vars: {
    "--background":"340 20% 5%","--foreground":"340 6% 88%","--card":"340 16% 8%","--card-foreground":"340 6% 88%",
    "--primary":"340 80% 60%","--primary-foreground":"0 0% 100%","--accent":"320 65% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"340 16% 13%","--secondary-foreground":"340 4% 76%","--muted":"340 12% 10%","--muted-foreground":"340 4% 42%",
    "--border":"340 12% 16%","--input":"340 12% 16%","--ring":"340 80% 60%","--popover":"340 16% 8%","--popover-foreground":"340 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 40%, rgba(255,60,150,0.15) 0%, transparent 50%)"},
  { id: "cartoon-orange", name: "Cartoon Orange", category: "Cartoon", vars: {
    "--background":"25 20% 5%","--foreground":"25 6% 88%","--card":"25 16% 8%","--card-foreground":"25 6% 88%",
    "--primary":"25 90% 55%","--primary-foreground":"0 0% 3%","--accent":"10 75% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"25 16% 13%","--secondary-foreground":"25 4% 76%","--muted":"25 12% 10%","--muted-foreground":"25 4% 42%",
    "--border":"25 12% 16%","--input":"25 12% 16%","--ring":"25 90% 55%","--popover":"25 16% 8%","--popover-foreground":"25 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 60%, rgba(255,120,30,0.15) 0%, transparent 50%)"},
  { id: "cartoon-teal", name: "Cartoon Teal", category: "Cartoon", vars: {
    "--background":"180 22% 5%","--foreground":"180 6% 88%","--card":"180 18% 8%","--card-foreground":"180 6% 88%",
    "--primary":"180 80% 48%","--primary-foreground":"0 0% 3%","--accent":"165 65% 36%","--accent-foreground":"0 0% 100%",
    "--secondary":"180 18% 13%","--secondary-foreground":"180 4% 76%","--muted":"180 14% 10%","--muted-foreground":"180 4% 42%",
    "--border":"180 14% 16%","--input":"180 14% 16%","--ring":"180 80% 48%","--popover":"180 18% 8%","--popover-foreground":"180 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 40%, rgba(0,200,200,0.15) 0%, transparent 50%)"},

  // ── SCI-FI / SPACE (8) ──
  { id: "deep-space", name: "Deep Space", category: "SciFi", vars: {
    "--background":"230 20% 3%","--foreground":"230 5% 88%","--card":"230 16% 6%","--card-foreground":"230 5% 88%",
    "--primary":"230 60% 55%","--primary-foreground":"0 0% 100%","--accent":"200 50% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 16% 11%","--secondary-foreground":"230 4% 76%","--muted":"230 12% 8%","--muted-foreground":"230 4% 42%",
    "--border":"230 12% 14%","--input":"230 12% 14%","--ring":"230 60% 55%","--popover":"230 16% 6%","--popover-foreground":"230 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(30,60,150,0.15) 0%, transparent 60%)"},
  { id: "mars-red", name: "Mars Red", category: "SciFi", vars: {
    "--background":"10 16% 4%","--foreground":"10 5% 86%","--card":"10 12% 7%","--card-foreground":"10 5% 86%",
    "--primary":"10 75% 50%","--primary-foreground":"0 0% 100%","--accent":"25 60% 36%","--accent-foreground":"0 0% 100%",
    "--secondary":"10 12% 12%","--secondary-foreground":"10 4% 74%","--muted":"10 8% 9%","--muted-foreground":"10 4% 40%",
    "--border":"10 8% 14%","--input":"10 8% 14%","--ring":"10 75% 50%","--popover":"10 12% 7%","--popover-foreground":"10 5% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 70%, rgba(180,60,20,0.16) 0%, transparent 55%)"},
  { id: "jupiter-storm", name: "Jupiter Storm", category: "SciFi", vars: {
    "--background":"30 14% 4%","--foreground":"30 5% 86%","--card":"30 10% 7%","--card-foreground":"30 5% 86%",
    "--primary":"30 70% 52%","--primary-foreground":"0 0% 3%","--accent":"350 60% 44%","--accent-foreground":"0 0% 100%",
    "--secondary":"30 10% 12%","--secondary-foreground":"30 4% 74%","--muted":"30 6% 9%","--muted-foreground":"30 4% 40%",
    "--border":"30 6% 14%","--input":"30 6% 14%","--ring":"30 70% 52%","--popover":"30 10% 7%","--popover-foreground":"30 5% 86%",
  }, gradient: "radial-gradient(ellipse at 40% 50%, rgba(200,120,50,0.14) 0%, transparent 45%), radial-gradient(ellipse at 70% 40%, rgba(200,80,80,0.1) 0%, transparent 40%)"},
  { id: "event-horizon", name: "Event Horizon", category: "SciFi", vars: {
    "--background":"0 0% 2%","--foreground":"40 5% 78%","--card":"0 0% 5%","--card-foreground":"40 5% 78%",
    "--primary":"40 80% 50%","--primary-foreground":"0 0% 2%","--accent":"20 60% 34%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 8%","--secondary-foreground":"40 4% 66%","--muted":"0 0% 6%","--muted-foreground":"0 0% 30%",
    "--border":"0 0% 10%","--input":"0 0% 10%","--ring":"40 80% 50%","--popover":"0 0% 5%","--popover-foreground":"40 5% 78%",
  }, gradient: "radial-gradient(circle at 50% 50%, rgba(200,100,0,0.12) 0%, rgba(100,30,0,0.06) 30%, transparent 60%)"},
  { id: "pulsar", name: "Pulsar", category: "SciFi", vars: {
    "--background":"200 22% 3%","--foreground":"200 6% 88%","--card":"200 18% 6%","--card-foreground":"200 6% 88%",
    "--primary":"200 90% 55%","--primary-foreground":"0 0% 3%","--accent":"180 75% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 18% 11%","--secondary-foreground":"200 4% 76%","--muted":"200 14% 8%","--muted-foreground":"200 4% 42%",
    "--border":"200 14% 14%","--input":"200 14% 14%","--ring":"200 90% 55%","--popover":"200 18% 6%","--popover-foreground":"200 6% 88%",
  }, gradient: "radial-gradient(circle at 50% 50%, rgba(0,200,255,0.12) 0%, transparent 45%)"},
  { id: "quasar", name: "Quasar", category: "SciFi", vars: {
    "--background":"280 18% 3%","--foreground":"280 5% 88%","--card":"280 14% 6%","--card-foreground":"280 5% 88%",
    "--primary":"280 80% 60%","--primary-foreground":"0 0% 100%","--accent":"200 80% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 14% 11%","--secondary-foreground":"280 4% 76%","--muted":"280 10% 8%","--muted-foreground":"280 4% 42%",
    "--border":"280 10% 14%","--input":"280 10% 14%","--ring":"280 80% 60%","--popover":"280 14% 6%","--popover-foreground":"280 5% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(140,0,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(0,200,255,0.1) 0%, transparent 40%)"},
  { id: "warp-drive", name: "Warp Drive", category: "SciFi", vars: {
    "--background":"220 18% 4%","--foreground":"220 5% 88%","--card":"220 14% 7%","--card-foreground":"220 5% 88%",
    "--primary":"220 75% 60%","--primary-foreground":"0 0% 100%","--accent":"185 85% 50%","--accent-foreground":"0 0% 3%",
    "--secondary":"220 14% 12%","--secondary-foreground":"220 4% 76%","--muted":"220 10% 9%","--muted-foreground":"220 4% 42%",
    "--border":"220 10% 15%","--input":"220 10% 15%","--ring":"220 75% 60%","--popover":"220 14% 7%","--popover-foreground":"220 5% 88%",
  }, gradient: "linear-gradient(135deg, rgba(0,200,255,0.1) 0%, rgba(60,100,220,0.1) 50%, rgba(200,0,255,0.08) 100%)"},
  { id: "zero-gravity", name: "Zero Gravity", category: "SciFi", vars: {
    "--background":"210 14% 4%","--foreground":"210 4% 85%","--card":"210 12% 7%","--card-foreground":"210 4% 85%",
    "--primary":"210 45% 55%","--primary-foreground":"0 0% 100%","--accent":"180 65% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 12% 12%","--secondary-foreground":"210 3% 73%","--muted":"210 8% 9%","--muted-foreground":"210 3% 38%",
    "--border":"210 8% 14%","--input":"210 8% 14%","--ring":"210 45% 55%","--popover":"210 12% 7%","--popover-foreground":"210 4% 85%",
  }, gradient: "radial-gradient(ellipse at 30% 30%, rgba(100,200,255,0.1) 0%, transparent 45%), radial-gradient(ellipse at 70% 70%, rgba(0,180,180,0.08) 0%, transparent 40%)"},

// ── ANIME / MANGA (8) ──
  { id: "anime-sakura", name: "Sakura", category: "Anime", vars: {
    "--background":"350 16% 5%","--foreground":"350 5% 86%","--card":"350 12% 8%","--card-foreground":"350 5% 86%",
    "--primary":"350 75% 62%","--primary-foreground":"0 0% 100%","--accent":"330 60% 46%","--accent-foreground":"0 0% 100%",
    "--secondary":"350 12% 13%","--secondary-foreground":"350 4% 74%","--muted":"350 8% 10%","--muted-foreground":"350 4% 42%",
    "--border":"350 8% 16%","--input":"350 8% 16%","--ring":"350 75% 62%","--popover":"350 12% 8%","--popover-foreground":"350 5% 86%",
  }, gradient: "radial-gradient(ellipse at 40% 40%, rgba(255,100,150,0.14) 0%, transparent 50%)"},
  { id: "anime-mecha", name: "Mecha", category: "Anime", vars: {
    "--background":"215 18% 4%","--foreground":"215 5% 87%","--card":"215 14% 7%","--card-foreground":"215 5% 87%",
    "--primary":"215 75% 56%","--primary-foreground":"0 0% 100%","--accent":"0 80% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"215 14% 12%","--secondary-foreground":"215 4% 75%","--muted":"215 10% 9%","--muted-foreground":"215 4% 42%",
    "--border":"215 10% 15%","--input":"215 10% 15%","--ring":"215 75% 56%","--popover":"215 14% 7%","--popover-foreground":"215 5% 87%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(60,120,220,0.14) 0%, transparent 50%)"},
  { id: "anime-dark", name: "Dark Anime", category: "Anime", vars: {
    "--background":"245 15% 4%","--foreground":"245 4% 85%","--card":"245 12% 7%","--card-foreground":"245 4% 85%",
    "--primary":"245 65% 58%","--primary-foreground":"0 0% 100%","--accent":"300 70% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"245 12% 12%","--secondary-foreground":"245 3% 73%","--muted":"245 8% 9%","--muted-foreground":"245 3% 40%",
    "--border":"245 8% 15%","--input":"245 8% 15%","--ring":"245 65% 58%","--popover":"245 12% 7%","--popover-foreground":"245 4% 85%",
  }, gradient: "radial-gradient(ellipse at 30% 40%, rgba(100,60,220,0.15) 0%, transparent 45%), radial-gradient(ellipse at 70% 60%, rgba(200,0,200,0.1) 0%, transparent 40%)"},
  { id: "shonen-fire", name: "Shonen Fire", category: "Anime", vars: {
    "--background":"15 16% 4%","--foreground":"15 5% 86%","--card":"15 12% 7%","--card-foreground":"15 5% 86%",
    "--primary":"15 90% 55%","--primary-foreground":"0 0% 3%","--accent":"0 80% 46%","--accent-foreground":"0 0% 100%",
    "--secondary":"15 12% 12%","--secondary-foreground":"15 4% 74%","--muted":"15 8% 9%","--muted-foreground":"15 4% 40%",
    "--border":"15 8% 14%","--input":"15 8% 14%","--ring":"15 90% 55%","--popover":"15 12% 7%","--popover-foreground":"15 5% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 60%, rgba(255,80,0,0.18) 0%, transparent 50%)"},
  { id: "isekai", name: "Isekai", category: "Anime", vars: {
    "--background":"270 16% 4%","--foreground":"270 4% 86%","--card":"270 12% 7%","--card-foreground":"270 4% 86%",
    "--primary":"270 70% 60%","--primary-foreground":"0 0% 100%","--accent":"50 85% 55%","--accent-foreground":"0 0% 3%",
    "--secondary":"270 12% 12%","--secondary-foreground":"270 3% 74%","--muted":"270 8% 9%","--muted-foreground":"270 3% 40%",
    "--border":"270 8% 15%","--input":"270 8% 15%","--ring":"270 70% 60%","--popover":"270 12% 7%","--popover-foreground":"270 4% 86%",
  }, gradient: "radial-gradient(ellipse at 60% 30%, rgba(150,80,255,0.14) 0%, transparent 45%), radial-gradient(ellipse at 40% 70%, rgba(255,200,0,0.1) 0%, transparent 40%)"},
  { id: "cyberpunk-red", name: "Cyberpunk Red", category: "Anime", vars: {
    "--background":"0 15% 4%","--foreground":"0 4% 86%","--card":"0 12% 7%","--card-foreground":"0 4% 86%",
    "--primary":"0 85% 55%","--primary-foreground":"0 0% 100%","--accent":"50 90% 52%","--accent-foreground":"0 0% 3%",
    "--secondary":"0 12% 12%","--secondary-foreground":"0 3% 74%","--muted":"0 8% 9%","--muted-foreground":"0 3% 40%",
    "--border":"0 8% 14%","--input":"0 8% 14%","--ring":"0 85% 55%","--popover":"0 12% 7%","--popover-foreground":"0 4% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(220,30,30,0.16) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(255,200,0,0.1) 0%, transparent 35%)"},
  { id: "pastel-goth", name: "Pastel Goth", category: "Anime", vars: {
    "--background":"290 14% 5%","--foreground":"290 4% 84%","--card":"290 12% 8%","--card-foreground":"290 4% 84%",
    "--primary":"290 60% 60%","--primary-foreground":"0 0% 100%","--accent":"350 65% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"290 12% 13%","--secondary-foreground":"290 3% 72%","--muted":"290 8% 10%","--muted-foreground":"290 3% 38%",
    "--border":"290 8% 16%","--input":"290 8% 16%","--ring":"290 60% 60%","--popover":"290 12% 8%","--popover-foreground":"290 4% 84%",
  }, gradient: "radial-gradient(ellipse at 40% 40%, rgba(180,80,255,0.13) 0%, transparent 45%), radial-gradient(ellipse at 65% 65%, rgba(255,80,150,0.1) 0%, transparent 40%)"},
  { id: "lofi-beats", name: "Lo-Fi Beats", category: "Anime", vars: {
    "--background":"220 12% 6%","--foreground":"220 4% 80%","--card":"220 10% 9%","--card-foreground":"220 4% 80%",
    "--primary":"220 40% 55%","--primary-foreground":"0 0% 100%","--accent":"350 50% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 10% 14%","--secondary-foreground":"220 3% 68%","--muted":"220 6% 11%","--muted-foreground":"220 3% 34%",
    "--border":"220 6% 17%","--input":"220 6% 17%","--ring":"220 40% 55%","--popover":"220 10% 9%","--popover-foreground":"220 4% 80%",
  }, gradient: "radial-gradient(ellipse at 50% 80%, rgba(60,80,180,0.12) 0%, transparent 50%)"},

  // ── GRADIENT SPECIAL (8) ──
  { id: "sunset-dusk", name: "Sunset Dusk", category: "Gradient", vars: {
    "--background":"20 18% 4%","--foreground":"20 5% 87%","--card":"20 14% 7%","--card-foreground":"20 5% 87%",
    "--primary":"20 88% 55%","--primary-foreground":"0 0% 3%","--accent":"350 80% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"20 14% 12%","--secondary-foreground":"20 4% 75%","--muted":"20 10% 9%","--muted-foreground":"20 4% 42%",
    "--border":"20 10% 14%","--input":"20 10% 14%","--ring":"20 88% 55%","--popover":"20 14% 7%","--popover-foreground":"20 5% 87%",
  }, gradient: "linear-gradient(135deg, rgba(255,80,0,0.14) 0%, rgba(255,150,0,0.1) 40%, rgba(200,0,100,0.1) 100%)"},
  { id: "ocean-depth", name: "Ocean Depth", category: "Gradient", vars: {
    "--background":"210 22% 4%","--foreground":"210 5% 87%","--card":"210 18% 7%","--card-foreground":"210 5% 87%",
    "--primary":"200 80% 55%","--primary-foreground":"0 0% 3%","--accent":"220 65% 44%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 18% 12%","--secondary-foreground":"210 4% 75%","--muted":"210 14% 9%","--muted-foreground":"210 4% 42%",
    "--border":"210 14% 15%","--input":"210 14% 15%","--ring":"200 80% 55%","--popover":"210 18% 7%","--popover-foreground":"210 5% 87%",
  }, gradient: "linear-gradient(180deg, rgba(0,80,160,0.1) 0%, rgba(0,160,200,0.14) 50%, rgba(0,60,120,0.1) 100%)"},
  { id: "aurora-green", name: "Aurora Green", category: "Gradient", vars: {
    "--background":"165 18% 4%","--foreground":"165 5% 87%","--card":"165 14% 7%","--card-foreground":"165 5% 87%",
    "--primary":"165 85% 50%","--primary-foreground":"0 0% 3%","--accent":"200 75% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"165 14% 12%","--secondary-foreground":"165 4% 75%","--muted":"165 10% 9%","--muted-foreground":"165 4% 42%",
    "--border":"165 10% 14%","--input":"165 10% 14%","--ring":"165 85% 50%","--popover":"165 14% 7%","--popover-foreground":"165 5% 87%",
  }, gradient: "radial-gradient(ellipse at 20% 30%, rgba(0,255,180,0.14) 0%, transparent 45%), radial-gradient(ellipse at 80% 70%, rgba(0,200,255,0.1) 0%, transparent 40%)"},
  { id: "fire-ice", name: "Fire & Ice", category: "Gradient", vars: {
    "--background":"0 0% 4%","--foreground":"0 0% 87%","--card":"0 0% 7%","--card-foreground":"0 0% 87%",
    "--primary":"200 90% 55%","--primary-foreground":"0 0% 3%","--accent":"10 90% 52%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 12%","--secondary-foreground":"0 0% 75%","--muted":"0 0% 9%","--muted-foreground":"0 0% 42%",
    "--border":"0 0% 14%","--input":"0 0% 14%","--ring":"200 90% 55%","--popover":"0 0% 7%","--popover-foreground":"0 0% 87%",
  }, gradient: "radial-gradient(ellipse at 20% 50%, rgba(0,200,255,0.14) 0%, transparent 45%), radial-gradient(ellipse at 80% 50%, rgba(255,60,0,0.14) 0%, transparent 45%)"},
  { id: "galaxy-fade", name: "Galaxy Fade", category: "Gradient", vars: {
    "--background":"260 18% 4%","--foreground":"260 4% 86%","--card":"260 14% 7%","--card-foreground":"260 4% 86%",
    "--primary":"260 70% 60%","--primary-foreground":"0 0% 100%","--accent":"340 75% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"260 14% 12%","--secondary-foreground":"260 3% 74%","--muted":"260 10% 9%","--muted-foreground":"260 3% 40%",
    "--border":"260 10% 15%","--input":"260 10% 15%","--ring":"260 70% 60%","--popover":"260 14% 7%","--popover-foreground":"260 4% 86%",
  }, gradient: "radial-gradient(ellipse at 30% 30%, rgba(120,50,255,0.14) 0%, transparent 45%), radial-gradient(ellipse at 70% 70%, rgba(255,60,180,0.12) 0%, transparent 45%)"},
  { id: "tropical-night", name: "Tropical Night", category: "Gradient", vars: {
    "--background":"175 18% 4%","--foreground":"175 4% 86%","--card":"175 14% 7%","--card-foreground":"175 4% 86%",
    "--primary":"175 80% 48%","--primary-foreground":"0 0% 3%","--accent":"50 90% 55%","--accent-foreground":"0 0% 3%",
    "--secondary":"175 14% 12%","--secondary-foreground":"175 3% 74%","--muted":"175 10% 9%","--muted-foreground":"175 3% 40%",
    "--border":"175 10% 14%","--input":"175 10% 14%","--ring":"175 80% 48%","--popover":"175 14% 7%","--popover-foreground":"175 4% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 80%, rgba(0,200,180,0.14) 0%, transparent 50%), radial-gradient(ellipse at 70% 10%, rgba(255,200,0,0.1) 0%, transparent 35%)"},
  { id: "candy-glow", name: "Candy Glow", category: "Gradient", vars: {
    "--background":"300 16% 4%","--foreground":"300 4% 86%","--card":"300 12% 7%","--card-foreground":"300 4% 86%",
    "--primary":"300 80% 62%","--primary-foreground":"0 0% 100%","--accent":"180 80% 50%","--accent-foreground":"0 0% 3%",
    "--secondary":"300 12% 12%","--secondary-foreground":"300 3% 74%","--muted":"300 8% 9%","--muted-foreground":"300 3% 40%",
    "--border":"300 8% 14%","--input":"300 8% 14%","--ring":"300 80% 62%","--popover":"300 12% 7%","--popover-foreground":"300 4% 86%",
  }, gradient: "linear-gradient(135deg, rgba(255,0,200,0.1) 0%, rgba(0,255,220,0.1) 100%)"},
  { id: "midnight-gold", name: "Midnight Gold", category: "Gradient", vars: {
    "--background":"40 14% 4%","--foreground":"40 4% 86%","--card":"40 10% 7%","--card-foreground":"40 4% 86%",
    "--primary":"40 90% 56%","--primary-foreground":"0 0% 3%","--accent":"250 70% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"40 10% 12%","--secondary-foreground":"40 3% 74%","--muted":"40 6% 9%","--muted-foreground":"40 3% 40%",
    "--border":"40 6% 14%","--input":"40 6% 14%","--ring":"40 90% 56%","--popover":"40 10% 7%","--popover-foreground":"40 4% 86%",
  }, gradient: "radial-gradient(ellipse at 30% 30%, rgba(255,185,0,0.14) 0%, transparent 45%), radial-gradient(ellipse at 70% 70%, rgba(100,60,220,0.12) 0%, transparent 40%)"},

  // ── STREET / URBAN (4) ──
  { id: "urban-concrete", name: "Urban Concrete", category: "Urban", vars: {
    "--background":"0 0% 5%","--foreground":"0 0% 78%","--card":"0 0% 8%","--card-foreground":"0 0% 78%",
    "--primary":"0 0% 65%","--primary-foreground":"0 0% 5%","--accent":"0 0% 25%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 12%","--secondary-foreground":"0 0% 66%","--muted":"0 0% 9%","--muted-foreground":"0 0% 32%",
    "--border":"0 0% 14%","--input":"0 0% 14%","--ring":"0 0% 65%","--popover":"0 0% 8%","--popover-foreground":"0 0% 78%",
  }, gradient: "repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 2px, transparent 2px, transparent 10px)"},
  { id: "graffiti-neon", name: "Graffiti", category: "Urban", vars: {
    "--background":"0 0% 3%","--foreground":"0 0% 88%","--card":"0 0% 6%","--card-foreground":"0 0% 88%",
    "--primary":"60 95% 55%","--primary-foreground":"0 0% 3%","--accent":"320 85% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 10%","--secondary-foreground":"0 0% 76%","--muted":"0 0% 8%","--muted-foreground":"0 0% 36%",
    "--border":"0 0% 13%","--input":"0 0% 13%","--ring":"60 95% 55%","--popover":"0 0% 6%","--popover-foreground":"0 0% 88%",
  }, gradient: "radial-gradient(ellipse at 20% 60%, rgba(255,220,0,0.1) 0%, transparent 40%), radial-gradient(ellipse at 80% 30%, rgba(255,0,150,0.1) 0%, transparent 35%)"},
  { id: "streetwear", name: "Streetwear", category: "Urban", vars: {
    "--background":"220 8% 4%","--foreground":"220 3% 82%","--card":"220 6% 7%","--card-foreground":"220 3% 82%",
    "--primary":"220 50% 52%","--primary-foreground":"0 0% 100%","--accent":"30 70% 48%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 6% 11%","--secondary-foreground":"220 2% 70%","--muted":"220 4% 8%","--muted-foreground":"220 2% 34%",
    "--border":"220 4% 13%","--input":"220 4% 13%","--ring":"220 50% 52%","--popover":"220 6% 7%","--popover-foreground":"220 3% 82%",
  }},
  { id: "neon-tokyo", name: "Neon Tokyo", category: "Urban", vars: {
    "--background":"340 18% 4%","--foreground":"340 4% 86%","--card":"340 14% 7%","--card-foreground":"340 4% 86%",
    "--primary":"340 85% 56%","--primary-foreground":"0 0% 100%","--accent":"185 90% 52%","--accent-foreground":"0 0% 3%",
    "--secondary":"340 14% 12%","--secondary-foreground":"340 3% 74%","--muted":"340 10% 9%","--muted-foreground":"340 3% 40%",
    "--border":"340 10% 14%","--input":"340 10% 14%","--ring":"340 85% 56%","--popover":"340 14% 7%","--popover-foreground":"340 4% 86%",
  }, gradient: "radial-gradient(ellipse at 30% 70%, rgba(255,0,120,0.14) 0%, transparent 45%), radial-gradient(ellipse at 70% 30%, rgba(0,220,255,0.12) 0%, transparent 40%)"},

  // ── SPECIAL OG SCAN BRANDED (8) ──
  { id: "ogscan-brand", name: "OG Scan Brand", category: "OG", vars: {
    "--background":"220 20% 4%","--foreground":"0 0% 92%","--card":"220 16% 7%","--card-foreground":"0 0% 92%",
    "--primary":"168 100% 48%","--primary-foreground":"0 0% 3%","--accent":"280 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 16% 12%","--secondary-foreground":"0 0% 80%","--muted":"220 12% 9%","--muted-foreground":"220 5% 44%",
    "--border":"220 12% 15%","--input":"220 12% 15%","--ring":"168 100% 48%","--popover":"220 16% 7%","--popover-foreground":"0 0% 92%",
  }, gradient: "radial-gradient(ellipse at 20% 80%, rgba(0,245,196,0.16) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.14) 0%, transparent 45%)"},
  { id: "ogscan-dark", name: "OG Scan Dark", category: "OG", vars: {
    "--background":"0 0% 2%","--foreground":"0 0% 90%","--card":"0 0% 5%","--card-foreground":"0 0% 90%",
    "--primary":"168 100% 48%","--primary-foreground":"0 0% 2%","--accent":"280 80% 55%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 9%","--secondary-foreground":"0 0% 78%","--muted":"0 0% 7%","--muted-foreground":"0 0% 36%",
    "--border":"0 0% 11%","--input":"0 0% 11%","--ring":"168 100% 48%","--popover":"0 0% 5%","--popover-foreground":"0 0% 90%",
  }, gradient: "radial-gradient(ellipse at 50% 50%, rgba(0,245,196,0.1) 0%, transparent 55%)"},
  { id: "ogscan-gold", name: "OG Scan Gold", category: "OG", vars: {
    "--background":"40 14% 4%","--foreground":"40 5% 88%","--card":"40 10% 7%","--card-foreground":"40 5% 88%",
    "--primary":"42 95% 56%","--primary-foreground":"0 0% 3%","--accent":"168 90% 46%","--accent-foreground":"0 0% 3%",
    "--secondary":"40 10% 12%","--secondary-foreground":"40 4% 76%","--muted":"40 6% 9%","--muted-foreground":"40 4% 42%",
    "--border":"40 6% 14%","--input":"40 6% 14%","--ring":"42 95% 56%","--popover":"40 10% 7%","--popover-foreground":"40 5% 88%",
  }, gradient: "radial-gradient(ellipse at 40% 40%, rgba(245,197,24,0.16) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(0,200,160,0.1) 0%, transparent 40%)"},
  { id: "ogscan-night", name: "OG Scan Night", category: "OG", vars: {
    "--background":"235 22% 4%","--foreground":"235 5% 88%","--card":"235 18% 7%","--card-foreground":"235 5% 88%",
    "--primary":"235 65% 60%","--primary-foreground":"0 0% 100%","--accent":"168 85% 46%","--accent-foreground":"0 0% 3%",
    "--secondary":"235 18% 12%","--secondary-foreground":"235 4% 76%","--muted":"235 14% 9%","--muted-foreground":"235 4% 42%",
    "--border":"235 14% 15%","--input":"235 14% 15%","--ring":"235 65% 60%","--popover":"235 18% 7%","--popover-foreground":"235 5% 88%",
  }, gradient: "radial-gradient(ellipse at 30% 70%, rgba(60,100,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(0,220,160,0.12) 0%, transparent 40%)"},
  { id: "ogscan-matrix", name: "OG Matrix", category: "OG", vars: {
    "--background":"140 18% 3%","--foreground":"140 8% 88%","--card":"140 14% 6%","--card-foreground":"140 8% 88%",
    "--primary":"140 85% 48%","--primary-foreground":"0 0% 3%","--accent":"168 90% 48%","--accent-foreground":"0 0% 3%",
    "--secondary":"140 14% 11%","--secondary-foreground":"140 5% 76%","--muted":"140 10% 8%","--muted-foreground":"140 4% 42%",
    "--border":"140 10% 13%","--input":"140 10% 13%","--ring":"140 85% 48%","--popover":"140 14% 6%","--popover-foreground":"140 8% 88%",
  }, gradient: "repeating-linear-gradient(0deg, rgba(0,220,100,0.03) 0px, rgba(0,220,100,0.03) 1px, transparent 1px, transparent 20px), radial-gradient(ellipse at 50% 50%, rgba(0,200,120,0.1) 0%, transparent 60%)"},
  { id: "ogscan-fire", name: "OG Inferno", category: "OG", vars: {
    "--background":"15 18% 4%","--foreground":"15 5% 86%","--card":"15 14% 7%","--card-foreground":"15 5% 86%",
    "--primary":"15 92% 55%","--primary-foreground":"0 0% 3%","--accent":"168 85% 46%","--accent-foreground":"0 0% 3%",
    "--secondary":"15 14% 12%","--secondary-foreground":"15 4% 74%","--muted":"15 10% 9%","--muted-foreground":"15 4% 40%",
    "--border":"15 10% 14%","--input":"15 10% 14%","--ring":"15 92% 55%","--popover":"15 14% 7%","--popover-foreground":"15 5% 86%",
  }, gradient: "radial-gradient(ellipse at 50% 80%, rgba(255,70,0,0.18) 0%, transparent 50%), radial-gradient(ellipse at 30% 20%, rgba(0,200,150,0.1) 0%, transparent 35%)"},
  { id: "ogscan-ice", name: "OG Arctic", category: "OG", vars: {
    "--background":"200 22% 4%","--foreground":"200 6% 88%","--card":"200 18% 7%","--card-foreground":"200 6% 88%",
    "--primary":"200 85% 58%","--primary-foreground":"0 0% 3%","--accent":"168 85% 46%","--accent-foreground":"0 0% 3%",
    "--secondary":"200 18% 12%","--secondary-foreground":"200 4% 76%","--muted":"200 14% 9%","--muted-foreground":"200 4% 42%",
    "--border":"200 14% 15%","--input":"200 14% 15%","--ring":"200 85% 58%","--popover":"200 18% 7%","--popover-foreground":"200 6% 88%",
  }, gradient: "radial-gradient(ellipse at 50% 20%, rgba(0,180,255,0.16) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,230,200,0.1) 0%, transparent 40%)"},
  { id: "ogscan-void", name: "OG Void", category: "OG", vars: {
    "--background":"0 0% 1%","--foreground":"0 0% 86%","--card":"0 0% 4%","--card-foreground":"0 0% 86%",
    "--primary":"168 100% 50%","--primary-foreground":"0 0% 1%","--accent":"280 85% 58%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 7%","--secondary-foreground":"0 0% 72%","--muted":"0 0% 5%","--muted-foreground":"0 0% 30%",
    "--border":"0 0% 9%","--input":"0 0% 9%","--ring":"168 100% 50%","--popover":"0 0% 4%","--popover-foreground":"0 0% 86%",
  }, gradient: "radial-gradient(circle at 50% 50%, rgba(0,255,180,0.08) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(200,0,255,0.06) 0%, transparent 60%)"},
];


interface ThemeContextType {
  currentTheme: string;
  customWallpaper: string | null;
  themeGradient: string | null;
  setTheme: (themeId: string) => void;
  setCustomWallpaper: (url: string | null) => void;
  uploadWallpaper: (file: File) => Promise<string | null>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeVars(themeId: string) {
  const preset = THEME_PRESETS.find(t => t.id === themeId);
  if (!preset) return;
  const root = document.documentElement;
  Object.entries(preset.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  // Sync OG palette tokens so legacy og-* utilities follow the active theme
  if (preset.vars["--primary"]) root.style.setProperty("--og-lime", preset.vars["--primary"]);
  if (preset.vars["--primary"]) root.style.setProperty("--og-gold", preset.vars["--primary"]);
  if (preset.vars["--accent"]) root.style.setProperty("--og-cyan", preset.vars["--accent"]);
  if (preset.vars["--background"]) root.style.setProperty("--og-ink", preset.vars["--background"]);
  if (preset.vars["--border"]) root.style.setProperty("--og-grid", preset.vars["--border"]);
  // Store gradient for AppLayout to pick up
  if (preset.gradient) {
    root.style.setProperty("--theme-gradient", preset.gradient);
    localStorage.setItem("og-theme-gradient", preset.gradient);
  } else {
    root.style.removeProperty("--theme-gradient");
    localStorage.removeItem("og-theme-gradient");
  }
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem("sol-theme") || "og-hacker";
  });
  const [customWallpaper, setCustomWallpaperState] = useState<string | null>(() => {
    return localStorage.getItem("sol-wallpaper") || null;
  });
  const [themeGradient, setThemeGradient] = useState<string | null>(() => {
    return localStorage.getItem("og-theme-gradient") || null;
  });

  // Load from profile on login
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("theme_preset, custom_wallpaper_url").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data?.theme_preset) {
          setCurrentTheme(data.theme_preset);
          localStorage.setItem("sol-theme", data.theme_preset);
        }
        if (data?.custom_wallpaper_url) {
          setCustomWallpaperState(data.custom_wallpaper_url);
          localStorage.setItem("sol-wallpaper", data.custom_wallpaper_url);
        }
      });
  }, [user]);

  // Apply on change
  useEffect(() => {
    applyThemeVars(currentTheme);
  }, [currentTheme]);

  const setTheme = useCallback((themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("sol-theme", themeId);
    applyThemeVars(themeId);
    const _preset = THEME_PRESETS.find(t => t.id === themeId);
    setThemeGradient(_preset?.gradient ?? null);
    if (user) {
      supabase.from("profiles").update({ theme_preset: themeId } as any).eq("user_id", user.id).then(() => {});
    }
  }, [user]);

  const setCustomWallpaper = useCallback((url: string | null) => {
    setCustomWallpaperState(url);
    if (url) localStorage.setItem("sol-wallpaper", url);
    else localStorage.removeItem("sol-wallpaper");
    if (user) {
      supabase.from("profiles").update({ custom_wallpaper_url: url } as any).eq("user_id", user.id).then(() => {});
    }
  }, [user]);

  const uploadWallpaper = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/wallpaper-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("wallpapers").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("wallpapers").getPublicUrl(path);
    const url = data.publicUrl;
    setCustomWallpaper(url);
    return url;
  }, [user, setCustomWallpaper]);

  return (
    <ThemeContext.Provider value={{ currentTheme, customWallpaper, themeGradient, setTheme, setCustomWallpaper, uploadWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};
