import React from 'react';
import { BrainCircuit, Sparkles } from 'lucide-react';

interface OmegaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showBeacon?: boolean;
  className?: string;
}

export const OmegaLogo: React.FC<OmegaLogoProps> = ({
  size = 'md',
  showBeacon = true,
  className = '',
}) => {
  const sizeMap = {
    sm: {
      container: 'w-8 h-8 rounded-lg',
      omegaText: 'text-base',
      iconSize: 'w-3 h-3',
      beacon: 'w-1.5 h-1.5 -top-0.5 -right-0.5',
    },
    md: {
      container: 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl',
      omegaText: 'text-2xl sm:text-[26px]',
      iconSize: 'w-3.5 h-3.5',
      beacon: 'w-2 h-2 -top-0.5 -right-0.5',
    },
    lg: {
      container: 'w-16 h-16 rounded-2xl',
      omegaText: 'text-4xl',
      iconSize: 'w-5 h-5',
      beacon: 'w-2.5 h-2.5 top-0 right-0',
    },
  };

  const currentSize = sizeMap[size];

  return (
    <div
      id="omega-brand-emblem"
      className={`relative inline-flex items-center justify-center shrink-0 select-none group ${className}`}
    >
      {/* Outer subtle glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-indigo-500/10 blur-sm opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Main Bezel Container */}
      <div
        className={`${currentSize.container} relative flex items-center justify-center bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border border-slate-700/80 shadow-[0_4px_16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-transform duration-200 group-hover:scale-[1.02] overflow-hidden`}
      >
        {/* Subtle Background Radial Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(56,189,248,0.08),transparent_70%)] pointer-events-none" />
        
        {/* Subtle geometric grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:6px_6px] pointer-events-none" />

        {/* Central Unique Omega Symbol with Metallic Gradient */}
        <div className="relative flex items-center justify-center">
          <span
            className={`${currentSize.omegaText} font-serif font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
            style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
          >
            Ω
          </span>

          {/* Micro High-Tech Circuit Accent in the arch */}
          <div className="absolute -bottom-1 -right-1 opacity-70 group-hover:opacity-100 group-hover:text-cyan-300 transition-colors text-slate-400">
            <BrainCircuit className={currentSize.iconSize} />
          </div>
        </div>

        {/* Bottom subtle accent line */}
        <div className="absolute bottom-0 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      </div>

      {/* Sovereign Live Beacon Dot (Air-Gapped Active Indicator) */}
      {showBeacon && (
        <span
          className={`absolute ${currentSize.beacon} flex items-center justify-center z-10`}
          title="Air-Gapped Local Engine Online"
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500 border border-slate-900" />
        </span>
      )}
    </div>
  );
};
