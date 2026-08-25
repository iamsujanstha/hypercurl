import React from 'react';
import { Sun, Moon, Menu, Zap, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Telemetry, AppView } from '@/features/api-tester/types';

interface WorkspaceNavbarProps {
  view: AppView;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  telemetry: Telemetry;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

export function WorkspaceNavbar({
  view,
  theme,
  setTheme,
  telemetry,
  isSidebarCollapsed,
  setIsSidebarCollapsed
}: WorkspaceNavbarProps) {
  const getNavLabel = (v: AppView) => {
    switch (v) {
      case 'studio':
      case 'debugger':
        return 'SINGLE REQUEST / CURL';
      case 'autocannon':
        return 'AUTOCANNON BENCHMARK';
      case 'suites':
      case 'lab':
        return 'TEST SUITES';
      case 'variables':
        return 'ENVIRONMENTS';
      case 'history':
        return 'AUDIT LOGS';
      default:
        return 'WORKSPACE';
    }
  };

  return (
    <nav className="flex items-center justify-between px-3 sm:px-4 h-12 border-b border-slate-850 bg-[#0F1115] shrink-0 select-none">
      <div className="flex items-center gap-2 sm:gap-5">
        <div className="flex items-center gap-2">
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="md:hidden text-slate-400 hover:text-white p-1 cursor-pointer hover:bg-slate-800/40 rounded transition-colors active:scale-95"
              aria-label="Open navigation sidebar"
              type="button"
            >
              <Menu size={18} />
            </button>
          )}
          <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-black font-extrabold text-xs font-mono">H</div>
          <span className="font-mono font-black tracking-widest text-xs sm:text-sm uppercase text-slate-100">HYPERCURL</span>
        </div>
        <div className="hidden sm:block h-4 w-px bg-slate-800"></div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-500">
          <span className="opacity-70 font-semibold uppercase">Mode</span>
          <span className="opacity-30">/</span>
          <span className="text-emerald-400 font-bold uppercase">{getNavLabel(view)}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Global Theme Toggle Switcher */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer select-none transition-all active:scale-95 text-[10px] font-mono uppercase font-bold",
            theme === 'light'
              ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
              : "bg-[#12161E]/80 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-slate-800/60"
          )}
          title={theme === 'dark' ? "Switch to High-Contrast Light Mode" : "Switch to Dark Mode"}
          type="button"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={10} className="text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">LIGHT_MODE</span>
            </>
          ) : (
            <>
              <Moon size={10} className="text-slate-400" />
              <span className="hidden sm:inline">DARK_MODE</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
