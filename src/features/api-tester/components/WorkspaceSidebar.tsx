import React from 'react';
import { motion } from 'motion/react';
import { Terminal, Plus, ChevronLeft, Layers, Sliders, History, Menu, Zap, Sparkles } from 'lucide-react';
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
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accentColor: string;
    badgeBg: string;
  }[] = [
    { 
      key: 'studio', 
      label: 'API STUDIO', 
      badge: 'CURL',
      icon: Terminal,
      accentColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    },
    
    { 
      key: 'variables', 
      label: 'ENVIRONMENTS', 
      badge: 'VARS',
      icon: Sliders,
      accentColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    },
    { 
      key: 'history', 
      label: 'AUDIT LOGS', 
      badge: 'LOGS',
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
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.key || 
            (item.key === 'studio' && view === 'debugger') ||
            false;
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
                "w-full flex items-center text-[11px] font-bold transition-all group cursor-pointer relative overflow-hidden rounded-xl sidebar-nav-btn focus-visible:ring-2 focus-visible:ring-cyan-500/50 outline-none",
                isSidebarCollapsed ? "justify-center px-1.5 py-3" : "gap-3 px-3 py-2.5 text-left",
                isActive 
                  ? "bg-[#182235] text-white border border-slate-700 shadow-md ring-1 ring-white/10 sidebar-active-btn" 
                  : "text-slate-400 hover:bg-[#151D2A] hover:text-slate-100 border border-transparent hover:border-slate-800/80"
              )}
              title={isSidebarCollapsed ? item.label : ""}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <span className={cn(
                  "absolute left-0 top-1 bottom-1 w-1.5 rounded-r-full shadow-sm",
                  
                  item.key === 'variables' ? "bg-blue-400 shadow-blue-400/50" :
                  item.key === 'history' ? "bg-purple-400 shadow-purple-400/50" :
                  "bg-emerald-400 shadow-emerald-400/50"
                )} />
              )}

              <div className={cn(
                "p-1.5 rounded-lg shrink-0 transition-all",
                isActive 
                  ? "bg-slate-900/90 shadow-sm border border-slate-700/60 ring-1 ring-white/5" 
                  : "bg-slate-900/30 group-hover:bg-slate-900/70"
              )}>
                <Icon size={16} className={cn(
                  "transition-transform shrink-0",
                  isActive ? cn(item.accentColor, "scale-110 drop-shadow-sm") : "text-slate-400 group-hover:scale-105"
                )} />
              </div>

              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 flex flex-col items-start leading-tight">
                  <div className="flex items-center justify-between w-full gap-1.5">
                    <span className={cn(
                      "tracking-wide font-mono text-[11px] font-black truncate uppercase",
                      isActive ? "text-white" : "text-slate-300"
                    )}>
                      {item.label}
                    </span>
                    <span className={cn(
                      "text-[8px] font-mono font-black px-1.5 py-0.5 rounded border uppercase shrink-0 shadow-xs",
                      item.badgeBg,
                      isActive ? "ring-1 ring-white/10" : "opacity-80"
                    )}>
                      {item.badge}
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
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
