import { AppTheme } from '../types';

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  tagline: string;
  iconName: string;
  rootBg: string;
  mainGradient: string;
  sidebarBg: string;
  cardBg: string;
  inputBg: string;
  borderColor: string;
  activeNavBg: string;
  userBubbleBg: string;
  badgeBg: string;
  badgeText: string;
  sendBtnBg: string;
  accentText: string;
}

export const THEMES: Record<AppTheme, ThemeConfig> = {
  slate: {
    id: 'slate',
    name: 'Executive Slate',
    tagline: 'Refined dark charcoal workspace inspired by Linear & Vercel',
    iconName: 'Building2',
    rootBg: 'bg-[#090D16]',
    mainGradient: 'bg-gradient-to-b from-[#0F172A] via-[#090D16] to-[#070A10]',
    sidebarBg: 'bg-[#0D131F] border-slate-800/80',
    cardBg: 'bg-[#111827]/80 border-slate-800/80',
    inputBg: 'bg-[#0F172A] border-slate-700/80 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400/20',
    borderColor: 'border-slate-800',
    activeNavBg: 'bg-slate-800 text-white font-medium border-slate-700 shadow-sm',
    userBubbleBg: 'bg-[#1E293B] border border-slate-700 text-slate-100',
    badgeBg: 'bg-slate-800/80 border-slate-700/60',
    badgeText: 'text-slate-300',
    sendBtnBg: 'bg-slate-100 hover:bg-white text-slate-900 font-semibold shadow-sm transition-all',
    accentText: 'text-slate-200'
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Monochrome',
    tagline: 'High-contrast studio minimalism with zero distraction',
    iconName: 'Layers',
    rootBg: 'bg-[#09090B]',
    mainGradient: 'bg-gradient-to-b from-[#141418] via-[#09090B] to-[#050507]',
    sidebarBg: 'bg-[#0E0E11] border-zinc-800/90',
    cardBg: 'bg-[#131317]/80 border-zinc-800/90',
    inputBg: 'bg-[#111115] border-zinc-800 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400/20',
    borderColor: 'border-zinc-800',
    activeNavBg: 'bg-zinc-800 text-zinc-100 font-medium border-zinc-700 shadow-sm',
    userBubbleBg: 'bg-[#1A1A22] border border-zinc-700 text-zinc-100',
    badgeBg: 'bg-zinc-800/80 border-zinc-700/60',
    badgeText: 'text-zinc-300',
    sendBtnBg: 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-sm transition-all',
    accentText: 'text-zinc-200'
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Cobalt',
    tagline: 'Corporate finance & intelligence deep navy workstation',
    iconName: 'Shield',
    rootBg: 'bg-[#060A13]',
    mainGradient: 'bg-gradient-to-b from-[#0B1528] via-[#060A13] to-[#03060C]',
    sidebarBg: 'bg-[#09101E] border-slate-800/80',
    cardBg: 'bg-[#0D172B]/80 border-slate-800/80',
    inputBg: 'bg-[#0B1425] border-slate-700/80 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/20',
    borderColor: 'border-slate-800',
    activeNavBg: 'bg-[#112344] text-sky-200 font-medium border-sky-900/60 shadow-sm',
    userBubbleBg: 'bg-[#101F3B] border border-slate-700 text-slate-100',
    badgeBg: 'bg-slate-800/80 border-slate-700/60',
    badgeText: 'text-sky-300',
    sendBtnBg: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold shadow-sm transition-all',
    accentText: 'text-sky-300'
  },
  titanium: {
    id: 'titanium',
    name: 'Brushed Titanium',
    tagline: 'Aerospace industrial cool graphite with precision contrast',
    iconName: 'Cpu',
    rootBg: 'bg-[#0D0F14]',
    mainGradient: 'bg-gradient-to-b from-[#161A22] via-[#0D0F14] to-[#08090C]',
    sidebarBg: 'bg-[#11141C] border-slate-800',
    cardBg: 'bg-[#171B25]/80 border-slate-800',
    inputBg: 'bg-[#141721] border-slate-700 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400/20',
    borderColor: 'border-slate-800',
    activeNavBg: 'bg-slate-800 text-slate-100 font-medium border-slate-700 shadow-sm',
    userBubbleBg: 'bg-[#1E2330] border border-slate-700 text-slate-100',
    badgeBg: 'bg-slate-800/80 border-slate-700/60',
    badgeText: 'text-slate-300',
    sendBtnBg: 'bg-slate-200 hover:bg-white text-slate-900 font-semibold shadow-sm transition-all',
    accentText: 'text-slate-300'
  },
  sovereign: {
    id: 'sovereign',
    name: 'Sovereign Dark',
    tagline: 'Refined deep matte forest slate with sage terminal highlights',
    iconName: 'Terminal',
    rootBg: 'bg-[#050C08]',
    mainGradient: 'bg-gradient-to-b from-[#0A1A11] via-[#050C08] to-[#020604]',
    sidebarBg: 'bg-[#08130D] border-emerald-950/80',
    cardBg: 'bg-[#0C1C13]/80 border-emerald-950/80',
    inputBg: 'bg-[#091710] border-emerald-900/60 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20',
    borderColor: 'border-emerald-950/80',
    activeNavBg: 'bg-[#10271C] text-emerald-300 font-medium border-emerald-900/60 shadow-sm',
    userBubbleBg: 'bg-[#0F261B] border border-emerald-900/60 text-emerald-50',
    badgeBg: 'bg-emerald-950/70 border-emerald-900/40',
    badgeText: 'text-emerald-300',
    sendBtnBg: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-sm transition-all',
    accentText: 'text-emerald-400'
  }
};
