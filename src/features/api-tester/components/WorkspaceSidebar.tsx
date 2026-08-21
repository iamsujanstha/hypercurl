import React from 'react';
import { motion } from 'motion/react';
import { Terminal, Plus, ChevronLeft, Layers, Sliders, History, Menu, Zap, Gauge, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppView } from '../types';

interface WorkspaceSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  view: AppView;
  setView: (view: AppView) => void;
  createTab: () => void;
}

export function WorkspaceSidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  view,
  setView,
  createTab
 }: WorkspaceSidebarProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const animatedWidth = isMobile 
    ? (isSidebarCollapsed ? '0px' : '260px')
    : (isSidebarCollapsed ? '56px' : '260px');

  const navItems: { 
    key: AppView; 
    label: string; 
    badge: string;
    sublabel: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accentColor: string;
    badgeBg: string;
  }[] = [
    { 
      key: 'studio', 
      label: 'API STUDIO', 
      badge: 'CURL',
      sublabel: 'Single Request & DevTools Tabs',
      icon: Terminal,
      accentColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    },
    { 
      key: 'autocannon', 
      label: 'AUTOCANNON', 
      badge: 'BENCHMARK',
      sublabel: 'High-Concurrency Socket Load',
      icon: Gauge,
      accentColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    },
    { 
      key: 'suites', 
      label: 'TEST SUITES', 
      badge: 'RUNNER',
      sublabel: 'Automated Workflows, SLAs & Assertions',
      icon: Layers,
      accentColor: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
    },
    { 
      key: 'variables', 
      label: 'ENVIRONMENTS', 
      badge: 'VARS',
      sublabel: 'Global {{KEYS}} & Secrets',
      icon: Sliders,
      accentColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    },
    { 
      key: 'history', 
      label: 'AUDIT LOGS', 
      badge: 'LOGS',
      sublabel: 'Execution History & Replay',
      icon: History,
      accentColor: 'text-purple-400',
      badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: animatedWidth }}
      className={cn(
        "bg-[#0F1115] flex flex-col shrink-0 overflow-hidden z-40 transition-all duration-150",
        isSidebarCollapsed ? "border-r-0" : "border-r border-slate-850",
        isMobile ? "absolute top-0 bottom-0 left-0 h-full shadow-2xl" : "relative"
      )}
    >
      <div className={cn(
        "h-12 flex items-center border-b border-slate-900/40 shrink-0",
        isSidebarCollapsed ? "justify-center px-0" : "justify-between px-3.5"
      )}>
        {!isSidebarCollapsed && (
          <span className="text-[10px] font-black tracking-[0.3em] text-white uppercase flex items-center gap-2 select-none animate-fade-in">
            <Zap size={14} className="text-emerald-500 animate-pulse" /> HYPERCURL
          </span>
        )}
        <button 
          type="button"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={cn(
            "text-slate-500 hover:text-white transition-colors p-1.5 cursor-pointer hover:bg-slate-800/40 rounded transition-all active:scale-95",
            isSidebarCollapsed ? "" : "ml-auto"
          )}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? <Menu size={16} className="text-emerald-500" /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 px-2 space-y-1.5">
        {!isSidebarCollapsed && (
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-2 select-none flex items-center justify-between pr-2">
            <span>WORKFLOWS</span>
            <span className="text-[8px] text-slate-600 font-mono">SELECT MODE</span>
          </div>
        )}
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.key || 
            (item.key === 'studio' && view === 'debugger') ||
            (item.key === 'suites' && view === 'lab');
          return (
            <button 
              key={item.key}
              type="button"
              onClick={() => {
                setView(item.key);
                if (isMobile) {
                  setIsSidebarCollapsed(true);
                }
              }}
              className={cn(
                "w-full flex items-center rounded-xl text-[11px] font-bold transition-all group cursor-pointer border-none shadow-none relative",
                isSidebarCollapsed ? "justify-center px-1.5 py-3" : "gap-3 px-3 py-2.5 text-left",
                isActive 
                  ? "bg-[#1E293B]/80 text-white border-l-2 border-emerald-500 rounded-l-none shadow-inner" 
                  : "text-slate-400 hover:bg-[#1E293B]/30 hover:text-slate-200"
              )}
              title={isSidebarCollapsed ? `${item.label} (${item.sublabel})` : ""}
            >
              <div className={cn(
                "p-1.5 rounded-lg shrink-0 transition-all",
                isActive ? "bg-slate-900 shadow-sm" : "group-hover:bg-slate-900/60"
              )}>
                <Icon size={16} className={cn(
                  "transition-transform shrink-0",
                  isActive ? item.accentColor : "text-slate-400 group-hover:scale-105"
                )} />
              </div>

              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 flex flex-col items-start leading-tight">
                  <div className="flex items-center justify-between w-full gap-1.5">
                    <span className={cn(
                      "tracking-wide font-mono text-[11px] font-black truncate uppercase",
                      isActive ? "text-slate-100" : "text-slate-300"
                    )}>
                      {item.label}
                    </span>
                    <span className={cn(
                      "text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0",
                      item.badgeBg
                    )}>
                      {item.badge}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-sans text-slate-500 truncate mt-0.5 font-normal">
                    {item.sublabel}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        {/* Informative Guidance Card when Sidebar is open */}
        {!isSidebarCollapsed && (
          <div className="mt-4 pt-3 border-t border-slate-900/80 px-2 space-y-2">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-850/80 text-[10px] space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-300 text-[10px]">
                <Sparkles size={12} className="text-emerald-400" />
                <span>ENGINES</span>
              </div>
              <p className="text-slate-400 text-[9.5px] leading-relaxed">
                • <strong className="text-emerald-400">cURL Engine:</strong> Native single-request inspection with complete headers, payload and response tabs.
              </p>
              <p className="text-slate-400 text-[9.5px] leading-relaxed">
                • <strong className="text-amber-400">Autocannon Engine:</strong> High-throughput HTTP socket load testing with latency percentiles and RPS charts.
              </p>
            </div>
          </div>
        )}
      </div>

      {!isSidebarCollapsed && (
        <div className="p-3 border-t border-slate-950 shrink-0">
          <button 
            type="button"
            onClick={createTab}
            className="w-full py-2.5 bg-[#141C2B] text-slate-200 hover:text-white hover:bg-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow border border-slate-800"
          >
            <Plus size={13} /> NEW_REQUEST
          </button>
        </div>
      )}
    </motion.aside>
  );
}
