import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, X, Plus, Minus, Zap, Server, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Telemetry } from '@/features/api-tester/types';

interface WorkerPoolPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: Telemetry;
  ws: WebSocket | null;
}

export function WorkerPoolPopover({
  isOpen,
  onClose,
  telemetry,
  ws
}: WorkerPoolPopoverProps) {
  const specs = telemetry.systemSpecs;
  const totalSysGB = specs?.totalMemoryBytes 
    ? (specs.totalMemoryBytes / 1024 / 1024 / 1024).toFixed(1) 
    : 'N/A';
  const freeSysGB = specs?.freeMemoryBytes 
    ? (specs.freeMemoryBytes / 1024 / 1024 / 1024).toFixed(1) 
    : 'N/A';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute right-4 top-14 w-84 bg-[#12161E] border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden font-mono text-xs text-slate-300"
        >
          <div className="p-3 border-b border-slate-800 bg-[#161B25] flex justify-between items-center select-none">
            <span className="text-[9px] font-black text-white tracking-widest uppercase flex items-center gap-2">
              <Cpu size={12} className="text-emerald-500" /> SYSTEM CORES & THREADS
            </span>
            <button 
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          {/* Host Hardware Specifications Ribbon */}
          {specs && (
            <div className="p-3 bg-black/60 border-b border-slate-800/60 space-y-2 select-none">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                  <Server size={11} className="text-sky-400" /> CPU CORES:
                </span>
                <span className="text-white font-black">{specs.cpuCores} Physical/Virtual Cores</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                  <HardDrive size={11} className="text-emerald-400" /> HOST MEMORY:
                </span>
                <span className="text-emerald-400 font-bold">{freeSysGB} GB Free / {totalSysGB} GB ({specs.memoryUsagePercent}% Used)</span>
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full" 
                  style={{ width: `${Math.min(100, Math.max(2, specs.memoryUsagePercent))}%` }}
                />
              </div>
            </div>
          )}

          <div className="px-3.5 py-2 bg-black/30 text-[9px] font-sans text-slate-400 border-b border-slate-800/40 leading-relaxed select-none">
            Native multi-threaded workers distribute concurrent load tests across CPU cores.
          </div>

          <div className="p-4 space-y-4">
            {/* Control Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => ws?.send(JSON.stringify({ type: 'spawn-worker' }))}
                className="flex-1 py-1.5 bg-emerald-600/25 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white text-[9px] font-black rounded transition-all uppercase flex items-center justify-center gap-1 shadow-sm h-7 cursor-pointer active:scale-95"
              >
                <Plus size={10} /> Spawn Worker
              </button>
              <button
                type="button"
                onClick={() => ws?.send(JSON.stringify({ type: 'terminate-worker' }))}
                className="flex-1 py-1.5 bg-rose-600/25 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 text-rose-400 hover:text-white text-[9px] font-black rounded transition-all uppercase flex items-center justify-center gap-1 shadow-sm h-7 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                disabled={(!telemetry.spawnedWorkers || telemetry.spawnedWorkers.length === 0)}
              >
                <Minus size={10} /> Kill Last
              </button>
            </div>

            {/* Capacity Adjuster */}
            <div className="space-y-1.5 select-none animate-fadeIn">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Pool Max Capacity</span>
                <span className="text-[#38BDF8] font-black">{telemetry.maxWorkers} THREADS</span>
              </div>
              <input 
                type="range"
                min="10"
                max="128"
                step="5"
                value={telemetry.maxWorkers}
                onChange={(e) => ws?.send(JSON.stringify({ type: 'set-max-workers', limit: parseInt(e.target.value) }))}
                className="w-full h-1 bg-slate-800 rounded-lg outline-none cursor-ew-resize accent-emerald-500"
              />
            </div>

            {/* Thread pool stats banner */}
            <div className="text-[10px] bg-slate-905/30 backdrop-blur-sm p-2 rounded-lg border border-slate-900/40 flex justify-between text-[#94A3B8] font-bold select-none">
              <span>THREADS: {telemetry.activeWorkers}/{telemetry.maxWorkers}</span>
              <span>WS CLIENTS: {telemetry.clientCount}</span>
            </div>

            {/* Active Worker Grid List */}
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {!telemetry.spawnedWorkers || telemetry.spawnedWorkers.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-900/40 rounded-lg text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  No background active threads.
                </div>
              ) : (
                telemetry.spawnedWorkers.map((worker) => (
                  <div 
                    key={worker.id}
                    className="p-2.5 bg-slate-900/10 border border-slate-905/60 rounded-lg flex items-center justify-between text-[10px] transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Cpu size={12.5} className={cn(
                        worker.status === 'ACTIVE' ? "text-amber-400 animate-pulse" : "text-slate-500"
                      )} />
                      <div className="min-w-0">
                        <div className="text-slate-200 font-bold truncate tracking-tight">{worker.name}</div>
                        <div className="text-[9.5px] text-[#94A3B8] truncate flex items-center gap-1.5 uppercase font-medium tracking-tight">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            worker.status === 'ACTIVE' ? "bg-amber-400 animate-pulse" : "bg-slate-500"
                          )}></span>
                          <span className="truncate">{worker.task}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0 p-0.5">
                      <span className="text-[8.5px] text-[#64748B] font-bold">{worker.activeTime}s</span>
                      <button
                        type="button"
                        onClick={() => ws?.send(JSON.stringify({ type: 'trigger-math-workload', id: worker.id }))}
                        className={cn(
                          "p-1 border border-transparent rounded-md transition-all cursor-pointer",
                          worker.status === 'ACTIVE' 
                            ? "text-[#F59E0B] hover:bg-amber-500/10" 
                            : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                        )}
                        title="Stress Test Thread (CPU Math)"
                        disabled={worker.status === 'ACTIVE'}
                      >
                        <Zap size={10.5} className={cn(worker.status === 'ACTIVE' && "animate-bounce")} />
                      </button>
                      <button
                        type="button"
                        onClick={() => ws?.send(JSON.stringify({ type: 'terminate-worker', id: worker.id }))}
                        className="p-1 hover:bg-[#B91C1C]/10 border border-transparent rounded-md text-slate-400 hover:text-[#EF4444] transition-all cursor-pointer"
                        title="Kill Thread"
                      >
                        <X size={10.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
