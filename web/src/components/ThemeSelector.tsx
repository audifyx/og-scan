import React from 'react';
import { THEME_CATEGORIES } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  currentTheme: string;
  onSelect: (id: string) => void;
}

export function ThemeSelector({ currentTheme, onSelect }: ThemeSelectorProps) {
  return (
    <div className="space-y-12 py-6">
      {Object.entries(THEME_CATEGORIES).map(([category, themes]) => (
        <section key={category} className="space-y-6">
          <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
            <div className="h-6 w-1 bg-white" /> {category} Themes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => onSelect(theme.id)}
                className={cn(
                  "relative p-4 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] flex items-center gap-4",
                  currentTheme === theme.id && "border-white/40 ring-1 ring-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                )}
              >
                <div 
                  className="h-8 w-8 rounded-full border border-white/20 shadow-lg" 
                  style={{ backgroundColor: theme.color }} 
                />
                <span className="text-sm font-semibold text-white/90">{theme.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
