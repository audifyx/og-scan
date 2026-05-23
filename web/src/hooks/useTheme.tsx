import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export interface ThemePreset {
  id: string;
  name: string;
  category: string;
  vars: Record<string, string>;
}

// 40 theme presets organized by category
export const THEME_PRESETS: ThemePreset[] = [
  // ── GLASS & BROKEN GLASS (8) ──
  { id: "broken-glass-gold", name: "Broken Glass Gold", category: "Glass", vars: {
    "--background":"0 0% 3%","--foreground":"40 10% 95%","--card":"0 0% 6%","--card-foreground":"40 10% 95%",
    "--primary":"43 90% 55%","--primary-foreground":"0 0% 3%","--accent":"35 80% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"38 30% 18%","--secondary-foreground":"40 10% 90%","--muted":"0 0% 10%","--muted-foreground":"0 0% 50%",
    "--border":"40 10% 14%","--input":"40 10% 14%","--ring":"43 90% 55%","--popover":"0 0% 7%","--popover-foreground":"40 10% 95%",
  }},
  { id: "broken-glass-blue", name: "Broken Glass Blue", category: "Glass", vars: {
    "--background":"220 20% 4%","--foreground":"210 20% 95%","--card":"220 15% 7%","--card-foreground":"210 20% 95%",
    "--primary":"210 80% 55%","--primary-foreground":"0 0% 100%","--accent":"220 70% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 25% 16%","--secondary-foreground":"210 20% 90%","--muted":"220 15% 10%","--muted-foreground":"220 10% 50%",
    "--border":"220 15% 15%","--input":"220 15% 15%","--ring":"210 80% 55%","--popover":"220 15% 7%","--popover-foreground":"210 20% 95%",
  }},
  { id: "broken-glass-emerald", name: "Broken Glass Emerald", category: "Glass", vars: {
    "--background":"160 15% 3%","--foreground":"150 10% 95%","--card":"160 10% 6%","--card-foreground":"150 10% 95%",
    "--primary":"155 70% 45%","--primary-foreground":"0 0% 3%","--accent":"165 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"160 20% 15%","--secondary-foreground":"150 10% 90%","--muted":"160 10% 10%","--muted-foreground":"160 5% 50%",
    "--border":"160 10% 14%","--input":"160 10% 14%","--ring":"155 70% 45%","--popover":"160 10% 7%","--popover-foreground":"150 10% 95%",
  }},
  { id: "broken-glass-purple", name: "Broken Glass Purple", category: "Glass", vars: {
    "--background":"270 15% 4%","--foreground":"270 10% 95%","--card":"270 10% 7%","--card-foreground":"270 10% 95%",
    "--primary":"270 60% 55%","--primary-foreground":"0 0% 100%","--accent":"280 50% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"270 20% 16%","--secondary-foreground":"270 10% 90%","--muted":"270 10% 10%","--muted-foreground":"270 5% 50%",
    "--border":"270 10% 14%","--input":"270 10% 14%","--ring":"270 60% 55%","--popover":"270 10% 7%","--popover-foreground":"270 10% 95%",
  }},
  { id: "broken-glass-rose", name: "Broken Glass Rose", category: "Glass", vars: {
    "--background":"350 15% 4%","--foreground":"350 10% 95%","--card":"350 10% 7%","--card-foreground":"350 10% 95%",
    "--primary":"345 70% 55%","--primary-foreground":"0 0% 100%","--accent":"340 60% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"350 20% 16%","--secondary-foreground":"350 10% 90%","--muted":"350 10% 10%","--muted-foreground":"350 5% 50%",
    "--border":"350 10% 14%","--input":"350 10% 14%","--ring":"345 70% 55%","--popover":"350 10% 7%","--popover-foreground":"350 10% 95%",
  }},
  { id: "frosted-glass", name: "Frosted Glass", category: "Glass", vars: {
    "--background":"220 10% 5%","--foreground":"0 0% 93%","--card":"220 8% 8%","--card-foreground":"0 0% 93%",
    "--primary":"0 0% 90%","--primary-foreground":"220 10% 5%","--accent":"220 15% 30%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 8% 14%","--secondary-foreground":"0 0% 85%","--muted":"220 8% 11%","--muted-foreground":"220 5% 45%",
    "--border":"220 8% 16%","--input":"220 8% 16%","--ring":"0 0% 90%","--popover":"220 8% 8%","--popover-foreground":"0 0% 93%",
  }},
  { id: "stained-glass", name: "Stained Glass", category: "Glass", vars: {
    "--background":"240 15% 4%","--foreground":"30 20% 95%","--card":"240 10% 7%","--card-foreground":"30 20% 95%",
    "--primary":"30 85% 55%","--primary-foreground":"0 0% 3%","--accent":"200 70% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"240 15% 15%","--secondary-foreground":"30 15% 85%","--muted":"240 10% 10%","--muted-foreground":"240 5% 45%",
    "--border":"240 10% 15%","--input":"240 10% 15%","--ring":"30 85% 55%","--popover":"240 10% 7%","--popover-foreground":"30 20% 95%",
  }},
  { id: "crystal-ice", name: "Crystal Ice", category: "Glass", vars: {
    "--background":"200 20% 4%","--foreground":"195 15% 95%","--card":"200 15% 7%","--card-foreground":"195 15% 95%",
    "--primary":"195 80% 60%","--primary-foreground":"200 20% 4%","--accent":"190 60% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"200 15% 14%","--secondary-foreground":"195 10% 85%","--muted":"200 10% 10%","--muted-foreground":"200 8% 48%",
    "--border":"200 12% 15%","--input":"200 12% 15%","--ring":"195 80% 60%","--popover":"200 15% 7%","--popover-foreground":"195 15% 95%",
  }},
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
  }},
  { id: "obsidian", name: "Obsidian", category: "Dark Elite", vars: {
    "--background":"260 10% 3%","--foreground":"260 5% 90%","--card":"260 8% 6%","--card-foreground":"260 5% 90%",
    "--primary":"260 50% 60%","--primary-foreground":"0 0% 100%","--accent":"260 35% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"260 10% 12%","--secondary-foreground":"260 5% 80%","--muted":"260 8% 9%","--muted-foreground":"260 5% 45%",
    "--border":"260 8% 14%","--input":"260 8% 14%","--ring":"260 50% 60%","--popover":"260 8% 6%","--popover-foreground":"260 5% 90%",
  }},
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
  }},
  { id: "deep-navy", name: "Deep Navy", category: "Dark Elite", vars: {
    "--background":"230 25% 4%","--foreground":"230 10% 92%","--card":"230 20% 7%","--card-foreground":"230 10% 92%",
    "--primary":"230 65% 58%","--primary-foreground":"0 0% 100%","--accent":"230 45% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"230 18% 14%","--secondary-foreground":"230 8% 82%","--muted":"230 15% 10%","--muted-foreground":"230 8% 46%",
    "--border":"230 15% 15%","--input":"230 15% 15%","--ring":"230 65% 58%","--popover":"230 20% 7%","--popover-foreground":"230 10% 92%",
  }},
  { id: "shadow-bronze", name: "Shadow Bronze", category: "Dark Elite", vars: {
    "--background":"30 10% 3%","--foreground":"30 8% 90%","--card":"30 8% 6%","--card-foreground":"30 8% 90%",
    "--primary":"30 60% 48%","--primary-foreground":"0 0% 100%","--accent":"25 45% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"30 10% 12%","--secondary-foreground":"30 5% 78%","--muted":"30 6% 9%","--muted-foreground":"30 5% 42%",
    "--border":"30 8% 14%","--input":"30 8% 14%","--ring":"30 60% 48%","--popover":"30 8% 6%","--popover-foreground":"30 8% 90%",
  }},
  // ── NEON (8) ──
  { id: "neon-green", name: "Neon Matrix", category: "Neon", vars: {
    "--background":"140 15% 3%","--foreground":"140 10% 92%","--card":"140 10% 6%","--card-foreground":"140 10% 92%",
    "--primary":"145 90% 50%","--primary-foreground":"0 0% 3%","--accent":"150 70% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"140 15% 12%","--secondary-foreground":"140 8% 82%","--muted":"140 10% 9%","--muted-foreground":"140 5% 45%",
    "--border":"140 10% 14%","--input":"140 10% 14%","--ring":"145 90% 50%","--popover":"140 10% 6%","--popover-foreground":"140 10% 92%",
  }},
  { id: "neon-pink", name: "Neon Pink", category: "Neon", vars: {
    "--background":"330 15% 3%","--foreground":"330 10% 92%","--card":"330 10% 6%","--card-foreground":"330 10% 92%",
    "--primary":"330 90% 60%","--primary-foreground":"0 0% 100%","--accent":"325 70% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"330 15% 12%","--secondary-foreground":"330 8% 82%","--muted":"330 10% 9%","--muted-foreground":"330 5% 45%",
    "--border":"330 10% 14%","--input":"330 10% 14%","--ring":"330 90% 60%","--popover":"330 10% 6%","--popover-foreground":"330 10% 92%",
  }},
  { id: "neon-cyan", name: "Neon Cyan", category: "Neon", vars: {
    "--background":"185 15% 3%","--foreground":"185 10% 92%","--card":"185 10% 6%","--card-foreground":"185 10% 92%",
    "--primary":"185 90% 50%","--primary-foreground":"0 0% 3%","--accent":"190 70% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"185 15% 12%","--secondary-foreground":"185 8% 82%","--muted":"185 10% 9%","--muted-foreground":"185 5% 45%",
    "--border":"185 10% 14%","--input":"185 10% 14%","--ring":"185 90% 50%","--popover":"185 10% 6%","--popover-foreground":"185 10% 92%",
  }},
  { id: "neon-orange", name: "Neon Blaze", category: "Neon", vars: {
    "--background":"20 15% 3%","--foreground":"20 10% 92%","--card":"20 10% 6%","--card-foreground":"20 10% 92%",
    "--primary":"25 90% 55%","--primary-foreground":"0 0% 3%","--accent":"20 70% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"20 15% 12%","--secondary-foreground":"20 8% 82%","--muted":"20 10% 9%","--muted-foreground":"20 5% 45%",
    "--border":"20 10% 14%","--input":"20 10% 14%","--ring":"25 90% 55%","--popover":"20 10% 6%","--popover-foreground":"20 10% 92%",
  }},
  { id: "neon-violet", name: "Neon Violet", category: "Neon", vars: {
    "--background":"280 15% 3%","--foreground":"280 10% 92%","--card":"280 10% 6%","--card-foreground":"280 10% 92%",
    "--primary":"280 85% 60%","--primary-foreground":"0 0% 100%","--accent":"275 65% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"280 15% 12%","--secondary-foreground":"280 8% 82%","--muted":"280 10% 9%","--muted-foreground":"280 5% 45%",
    "--border":"280 10% 14%","--input":"280 10% 14%","--ring":"280 85% 60%","--popover":"280 10% 6%","--popover-foreground":"280 10% 92%",
  }},
  { id: "neon-yellow", name: "Neon Electric", category: "Neon", vars: {
    "--background":"55 12% 3%","--foreground":"55 10% 92%","--card":"55 8% 6%","--card-foreground":"55 10% 92%",
    "--primary":"55 95% 55%","--primary-foreground":"0 0% 3%","--accent":"50 70% 38%","--accent-foreground":"0 0% 3%",
    "--secondary":"55 12% 12%","--secondary-foreground":"55 8% 82%","--muted":"55 8% 9%","--muted-foreground":"55 5% 45%",
    "--border":"55 8% 14%","--input":"55 8% 14%","--ring":"55 95% 55%","--popover":"55 8% 6%","--popover-foreground":"55 10% 92%",
  }},
  { id: "neon-red", name: "Neon Red", category: "Neon", vars: {
    "--background":"0 15% 3%","--foreground":"0 10% 92%","--card":"0 10% 6%","--card-foreground":"0 10% 92%",
    "--primary":"0 85% 55%","--primary-foreground":"0 0% 100%","--accent":"355 65% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 12% 12%","--secondary-foreground":"0 8% 82%","--muted":"0 8% 9%","--muted-foreground":"0 5% 45%",
    "--border":"0 8% 14%","--input":"0 8% 14%","--ring":"0 85% 55%","--popover":"0 10% 6%","--popover-foreground":"0 10% 92%",
  }},
  { id: "neon-teal", name: "Neon Teal", category: "Neon", vars: {
    "--background":"170 15% 3%","--foreground":"170 10% 92%","--card":"170 10% 6%","--card-foreground":"170 10% 92%",
    "--primary":"170 80% 48%","--primary-foreground":"0 0% 3%","--accent":"175 60% 35%","--accent-foreground":"0 0% 100%",
    "--secondary":"170 12% 12%","--secondary-foreground":"170 8% 82%","--muted":"170 8% 9%","--muted-foreground":"170 5% 45%",
    "--border":"170 8% 14%","--input":"170 8% 14%","--ring":"170 80% 48%","--popover":"170 10% 6%","--popover-foreground":"170 10% 92%",
  }},
  // ── LUXURY (8) ──
  { id: "royal-gold", name: "Royal Gold", category: "Luxury", vars: {
    "--background":"40 8% 4%","--foreground":"40 12% 92%","--card":"40 6% 7%","--card-foreground":"40 12% 92%",
    "--primary":"43 95% 58%","--primary-foreground":"40 8% 4%","--accent":"38 80% 42%","--accent-foreground":"0 0% 100%",
    "--secondary":"40 10% 13%","--secondary-foreground":"40 8% 82%","--muted":"40 6% 10%","--muted-foreground":"40 5% 45%",
    "--border":"40 8% 15%","--input":"40 8% 15%","--ring":"43 95% 58%","--popover":"40 6% 7%","--popover-foreground":"40 12% 92%",
  }},
  { id: "platinum-silver", name: "Platinum", category: "Luxury", vars: {
    "--background":"0 0% 4%","--foreground":"0 0% 90%","--card":"0 0% 7%","--card-foreground":"0 0% 90%",
    "--primary":"0 0% 78%","--primary-foreground":"0 0% 4%","--accent":"0 0% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 12%","--secondary-foreground":"0 0% 78%","--muted":"0 0% 9%","--muted-foreground":"0 0% 42%",
    "--border":"0 0% 14%","--input":"0 0% 14%","--ring":"0 0% 78%","--popover":"0 0% 7%","--popover-foreground":"0 0% 90%",
  }},
  { id: "ruby-red", name: "Ruby", category: "Luxury", vars: {
    "--background":"0 12% 4%","--foreground":"0 8% 92%","--card":"0 10% 7%","--card-foreground":"0 8% 92%",
    "--primary":"350 65% 50%","--primary-foreground":"0 0% 100%","--accent":"345 50% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 10% 13%","--secondary-foreground":"0 5% 80%","--muted":"0 8% 10%","--muted-foreground":"0 5% 45%",
    "--border":"0 8% 15%","--input":"0 8% 15%","--ring":"350 65% 50%","--popover":"0 10% 7%","--popover-foreground":"0 8% 92%",
  }},
  { id: "sapphire", name: "Sapphire", category: "Luxury", vars: {
    "--background":"225 20% 4%","--foreground":"225 10% 92%","--card":"225 15% 7%","--card-foreground":"225 10% 92%",
    "--primary":"225 70% 55%","--primary-foreground":"0 0% 100%","--accent":"220 55% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"225 15% 14%","--secondary-foreground":"225 8% 82%","--muted":"225 12% 10%","--muted-foreground":"225 5% 46%",
    "--border":"225 12% 16%","--input":"225 12% 16%","--ring":"225 70% 55%","--popover":"225 15% 7%","--popover-foreground":"225 10% 92%",
  }},
  { id: "emerald-luxury", name: "Emerald", category: "Luxury", vars: {
    "--background":"155 15% 3%","--foreground":"155 8% 92%","--card":"155 12% 6%","--card-foreground":"155 8% 92%",
    "--primary":"155 65% 45%","--primary-foreground":"0 0% 100%","--accent":"160 50% 32%","--accent-foreground":"0 0% 100%",
    "--secondary":"155 12% 12%","--secondary-foreground":"155 6% 80%","--muted":"155 8% 9%","--muted-foreground":"155 4% 44%",
    "--border":"155 8% 14%","--input":"155 8% 14%","--ring":"155 65% 45%","--popover":"155 12% 6%","--popover-foreground":"155 8% 92%",
  }},
  { id: "amethyst", name: "Amethyst", category: "Luxury", vars: {
    "--background":"275 12% 4%","--foreground":"275 8% 92%","--card":"275 10% 7%","--card-foreground":"275 8% 92%",
    "--primary":"275 55% 55%","--primary-foreground":"0 0% 100%","--accent":"270 40% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"275 10% 13%","--secondary-foreground":"275 5% 80%","--muted":"275 8% 10%","--muted-foreground":"275 4% 44%",
    "--border":"275 8% 15%","--input":"275 8% 15%","--ring":"275 55% 55%","--popover":"275 10% 7%","--popover-foreground":"275 8% 92%",
  }},
  { id: "onyx-gold", name: "Onyx & Gold", category: "Luxury", vars: {
    "--background":"0 0% 2%","--foreground":"43 15% 92%","--card":"0 0% 5%","--card-foreground":"43 15% 92%",
    "--primary":"43 85% 52%","--primary-foreground":"0 0% 2%","--accent":"38 70% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"0 0% 9%","--secondary-foreground":"43 10% 78%","--muted":"0 0% 7%","--muted-foreground":"0 0% 40%",
    "--border":"43 8% 12%","--input":"43 8% 12%","--ring":"43 85% 52%","--popover":"0 0% 5%","--popover-foreground":"43 15% 92%",
  }},
  { id: "champagne", name: "Champagne", category: "Luxury", vars: {
    "--background":"35 8% 4%","--foreground":"35 10% 90%","--card":"35 6% 7%","--card-foreground":"35 10% 90%",
    "--primary":"35 50% 65%","--primary-foreground":"35 8% 4%","--accent":"30 40% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"35 8% 12%","--secondary-foreground":"35 6% 78%","--muted":"35 5% 9%","--muted-foreground":"35 4% 44%",
    "--border":"35 6% 14%","--input":"35 6% 14%","--ring":"35 50% 65%","--popover":"35 6% 7%","--popover-foreground":"35 10% 90%",
  }},
  // ── GRADIENT (8) ──
  { id: "aurora", name: "Aurora Borealis", category: "Gradient", vars: {
    "--background":"220 18% 3%","--foreground":"180 10% 93%","--card":"220 14% 6%","--card-foreground":"180 10% 93%",
    "--primary":"160 70% 50%","--primary-foreground":"0 0% 3%","--accent":"200 60% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"220 12% 13%","--secondary-foreground":"180 8% 80%","--muted":"220 10% 9%","--muted-foreground":"220 5% 45%",
    "--border":"220 10% 14%","--input":"220 10% 14%","--ring":"160 70% 50%","--popover":"220 14% 6%","--popover-foreground":"180 10% 93%",
  }},
  { id: "sunset", name: "Sunset", category: "Gradient", vars: {
    "--background":"10 12% 4%","--foreground":"20 10% 92%","--card":"10 10% 7%","--card-foreground":"20 10% 92%",
    "--primary":"20 85% 55%","--primary-foreground":"0 0% 100%","--accent":"350 65% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"10 10% 13%","--secondary-foreground":"20 6% 80%","--muted":"10 8% 9%","--muted-foreground":"10 5% 44%",
    "--border":"10 8% 14%","--input":"10 8% 14%","--ring":"20 85% 55%","--popover":"10 10% 7%","--popover-foreground":"20 10% 92%",
  }},
  { id: "ocean-depth", name: "Ocean Depth", category: "Gradient", vars: {
    "--background":"210 22% 3%","--foreground":"200 12% 92%","--card":"210 18% 6%","--card-foreground":"200 12% 92%",
    "--primary":"200 75% 52%","--primary-foreground":"0 0% 100%","--accent":"210 55% 38%","--accent-foreground":"0 0% 100%",
    "--secondary":"210 15% 12%","--secondary-foreground":"200 8% 80%","--muted":"210 12% 9%","--muted-foreground":"210 6% 44%",
    "--border":"210 12% 14%","--input":"210 12% 14%","--ring":"200 75% 52%","--popover":"210 18% 6%","--popover-foreground":"200 12% 92%",
  }},
  { id: "northern-lights", name: "Northern Lights", category: "Gradient", vars: {
    "--background":"250 15% 3%","--foreground":"200 10% 93%","--card":"250 12% 6%","--card-foreground":"200 10% 93%",
    "--primary":"280 65% 58%","--primary-foreground":"0 0% 100%","--accent":"200 60% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"250 10% 12%","--secondary-foreground":"200 8% 80%","--muted":"250 8% 9%","--muted-foreground":"250 5% 44%",
    "--border":"250 8% 14%","--input":"250 8% 14%","--ring":"280 65% 58%","--popover":"250 12% 6%","--popover-foreground":"200 10% 93%",
  }},
  { id: "solar-flare", name: "Solar Flare", category: "Gradient", vars: {
    "--background":"15 12% 3%","--foreground":"40 12% 92%","--card":"15 10% 6%","--card-foreground":"40 12% 92%",
    "--primary":"40 90% 55%","--primary-foreground":"0 0% 3%","--accent":"15 75% 50%","--accent-foreground":"0 0% 100%",
    "--secondary":"15 10% 12%","--secondary-foreground":"40 8% 80%","--muted":"15 8% 9%","--muted-foreground":"15 5% 44%",
    "--border":"15 8% 14%","--input":"15 8% 14%","--ring":"40 90% 55%","--popover":"15 10% 6%","--popover-foreground":"40 12% 92%",
  }},
  { id: "galaxy", name: "Galaxy", category: "Gradient", vars: {
    "--background":"260 18% 3%","--foreground":"260 8% 92%","--card":"260 14% 6%","--card-foreground":"260 8% 92%",
    "--primary":"265 70% 60%","--primary-foreground":"0 0% 100%","--accent":"300 50% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"260 12% 12%","--secondary-foreground":"260 6% 80%","--muted":"260 10% 9%","--muted-foreground":"260 5% 44%",
    "--border":"260 10% 14%","--input":"260 10% 14%","--ring":"265 70% 60%","--popover":"260 14% 6%","--popover-foreground":"260 8% 92%",
  }},
  { id: "tropical", name: "Tropical", category: "Gradient", vars: {
    "--background":"175 15% 3%","--foreground":"170 10% 92%","--card":"175 12% 6%","--card-foreground":"170 10% 92%",
    "--primary":"170 75% 48%","--primary-foreground":"0 0% 3%","--accent":"140 60% 40%","--accent-foreground":"0 0% 100%",
    "--secondary":"175 10% 12%","--secondary-foreground":"170 6% 80%","--muted":"175 8% 9%","--muted-foreground":"175 5% 44%",
    "--border":"175 8% 14%","--input":"175 8% 14%","--ring":"170 75% 48%","--popover":"175 12% 6%","--popover-foreground":"170 10% 92%",
  }},
  { id: "lava", name: "Lava", category: "Gradient", vars: {
    "--background":"5 15% 3%","--foreground":"5 8% 92%","--card":"5 12% 6%","--card-foreground":"5 8% 92%",
    "--primary":"5 80% 52%","--primary-foreground":"0 0% 100%","--accent":"15 70% 45%","--accent-foreground":"0 0% 100%",
    "--secondary":"5 10% 12%","--secondary-foreground":"5 6% 80%","--muted":"5 8% 9%","--muted-foreground":"5 5% 44%",
    "--border":"5 8% 14%","--input":"5 8% 14%","--ring":"5 80% 52%","--popover":"5 12% 6%","--popover-foreground":"5 8% 92%",
  }},
];

interface ThemeContextType {
  currentTheme: string;
  customWallpaper: string | null;
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
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem("sol-theme") || "broken-glass-gold";
  });
  const [customWallpaper, setCustomWallpaperState] = useState<string | null>(() => {
    return localStorage.getItem("sol-wallpaper") || null;
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
    <ThemeContext.Provider value={{ currentTheme, customWallpaper, setTheme, setCustomWallpaper, uploadWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};
