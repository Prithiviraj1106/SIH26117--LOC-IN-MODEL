import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Building2, Layers, Shield, Cpu, Terminal } from 'lucide-react';
import { AppTheme } from '../types';
import { THEMES } from '../utils/theme';

interface ThemeSwitcherProps {
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
}

const THEME_ICONS: Record<string, React.ReactNode> = {
  Building2: <Building2 className="w-3.5 h-3.5" />,
  Layers: <Layers className="w-3.5 h-3.5" />,
  Shield: <Shield className="w-3.5 h-3.5" />,
  Cpu: <Cpu className="w-3.5 h-3.5" />,
  Terminal: <Terminal className="w-3.5 h-3.5" />
};

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  currentTheme,
  onSelectTheme
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeConfig = THEMES[currentTheme] || THEMES.slate;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        id="theme-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#111827] hover:bg-[#1F2937] text-slate-200 border border-slate-700/80 hover:border-slate-500 shadow-sm transition-all"
        title="Workspace Theme"
      >
        <Palette className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden sm:inline text-slate-300">{activeConfig.name}</span>
      </button>

      {isOpen && (
        <div 
          id="theme-switcher-popover"
          className="absolute right-0 mt-2 w-72 bg-[#0F172A] border border-slate-700/90 rounded-xl p-1.5 shadow-2xl z-50 backdrop-blur-lg animate-in fade-in zoom-in-95 duration-150 space-y-1"
        >
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
            <span>Workspace Theme</span>
            <span className="text-[9px] text-slate-400">Enterprise UI</span>
          </div>

          {(Object.keys(THEMES) as AppTheme[]).map((themeKey) => {
            const cfg = THEMES[themeKey];
            const isSelected = currentTheme === themeKey;
            const icon = THEME_ICONS[cfg.iconName] || <Building2 className="w-3.5 h-3.5" />;

            return (
              <button
                key={themeKey}
                id={`theme-opt-${themeKey}`}
                type="button"
                onClick={() => {
                  onSelectTheme(themeKey);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition ${
                  isSelected
                    ? 'bg-slate-800/90 text-white border border-slate-600/80 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
                }`}
              >
                <div className={`mt-0.5 p-1 rounded ${isSelected ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-100">{cfg.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-slate-200" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-normal">
                    {cfg.tagline}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
