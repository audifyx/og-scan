import React from 'react';
import { THEME_CATEGORIES } from '@/lib/themes';
import { cn } from '@/lib/utils';

export function ThemeSelector({ currentTheme, onSelect }: { currentTheme: string, onSelect: (id: string) => void }) {
  return (
    <div className="space-y-10">
      {Object.entries(THEME_CATEGORIES).map(([category, themes]) => (
        <section key={category} className="space-y-4">
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-2">
            <span className="h-4 w-1 bg-cyan-400" /> {category} Themes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => onSelect(theme.id)}
                className={cn(
                  "group relative p-4 rounded-xl border border-white/10 bg-white/[0.02] transition-all hover:bg-white/[0.06]",
                  currentTheme === theme.id && "border-cyan-400 ring-1 ring-cyan-400/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: theme.color }} />
                  <span className="text-sm font-medium text-white/80">{theme.name}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
