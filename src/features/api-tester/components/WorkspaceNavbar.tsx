import React from 'react';
import { Sun, Moon, Menu, Zap, CheckCircle2, ShieldAlert, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Telemetry, AppView, Environment } from '@/features/api-tester/types';

interface WorkspaceNavbarProps {
  view: AppView;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  telemetry: Telemetry;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  environments?: Environment[];
  activeEnvironmentId?: string;
  onSelectEnvironment?: (id: string) => void;
}

export function WorkspaceNavbar({
  view,
  theme,
  setTheme,
  telemetry,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  environments = [],
  activeEnvironmentId = 'env-local',
  onSelectEnvironment
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

  const activeEnv = environments.find(e => e.id === activeEnvironmentId) || environments[0];

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
          <span className={cn("font-bold uppercase", view === 'autocannon' ? "text-amber-400" : view === 'suites' || view === 'lab' ? "text-cyan-400" : "text-emerald-400")}>{getNavLabel(view)}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Environment Quick Switcher */}
        {environments.length > 0 && onSelectEnvironment && (
          <div className="flex items-center gap-1.5 bg-[#12161E]/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono shadow-xs">
            {activeEnv?.isProduction ? (
              <ShieldAlert size={13} className="text-rose-400 animate-pulse shrink-0" />
            ) : (
              <Server size={13} className="text-emerald-400 shrink-0" />
            )}
            <select
              value={activeEnvironmentId}
              onChange={(e) => onSelectEnvironment(e.target.value)}
              className={cn(
                "bg-transparent font-bold outline-none cursor-pointer text-[11px]",
                activeEnv?.isProduction ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"
              )}
            >
              {environments.map(env => (
                <option key={env.id} value={env.id} className="bg-slate-900 text-slate-200">
                  {env.name} {env.isProduction ? '(PROD)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Global Theme Toggle Switcher */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-lg cursor-pointer select-none transition-all active:scale-95 text-[10.5px] font-mono uppercase font-bold shadow-xs border",
            theme === 'light'
              ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400"
              : "bg-[#12161E]/80 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 border-slate-800"
          )}
          title={theme === 'dark' ? "Switch to High-Contrast Light Mode" : "Switch to Dark Mode"}
          type="button"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={12} className="text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">LIGHT MODE</span>
            </>
          ) : (
            <>
              <Moon size={12} className="text-indigo-600" />
              <span className="hidden sm:inline">DARK MODE</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
