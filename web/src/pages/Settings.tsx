import { useState } from 'react';
import { ThemeSelector } from '@/components/ThemeSelector';

export default function SettingsPage() {
  const [theme, setTheme] = useState('og-cyber');

  const handleThemeChange = async (id: string) => {
    setTheme(id);
    document.documentElement.setAttribute('data-theme', id);
    // Persist to local storage or API
    localStorage.setItem('ogscan-theme', id);
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] p-8 md:p-20 text-white">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">Settings</h1>
          <p className="text-white/50 mt-2">Customize your visual interface.</p>
        </div>
        
        <div className="border-t border-white/[0.08] pt-8">
          <ThemeSelector currentTheme={theme} onSelect={handleThemeChange} />
        </div>
      </div>
    </div>
  );
}
