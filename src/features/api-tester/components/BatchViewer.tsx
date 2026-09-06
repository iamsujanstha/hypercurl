import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Search, X, Activity, RefreshCw } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';
import { CurlResult } from '@/server/modules/curl-engine';
import { ProgressUpdate } from '@/server/modules/runner';
import { ResponseViewer } from './ResponseViewer';

interface BatchViewerProps {
  results: CurlResult[];
  progress: ProgressUpdate | null;
  concurrency: number;
  onAbort: () => void;
  onClear?: () => void;
  theme?: 'dark' | 'light';
}

export function BatchViewer({ 
  results, 
  progress, 
  concurrency, 
  onAbort,
  onClear,
  theme = 'dark'
}: BatchViewerProps) {
  const [selectedResult, setSelectedResult] = useState<CurlResult | null>(null);

  const successCount = results.filter(r => r.status >= 200 && r.status < 300).length;
  const failureCount = results.length - successCount;
  const avgResponseTime = results.length > 0 
    ? (results.reduce((acc, r) => acc + r.responseTime, 0) / results.length)
    : 0;
  const avgResponseTimeStr = avgResponseTime.toFixed(0);

  const recentResults = useMemo(() => {
    return results.slice(-40).map((r, idx) => ({
      name: `R${results.length - results.slice(-40).length + idx + 1}`,
      latency: r.responseTime,
      status: r.status,
      success: r.status >= 200 && r.status < 300,
    }));
  }, [results]);

  // Compute filtered results (filters are requested to be removed, so we fallback to all results directly)
  const filteredResults = results;

  return (
    <div className={cn('flex flex-col lg:flex-row h-full divide-y lg:divide-y-0 lg:divide-x overflow-hidden', theme === 'light' ? 'bg-white text-slate-900 divide-slate-200' : 'bg-black text-slate-300 divide-slate-800/60')}>
      {/* Panel 1: STREAM_ORCHESTRATOR & Telemetry Logs */}
      <div className={cn('flex flex-col h-full overflow-hidden transition-all duration-300', theme === 'light' ? 'bg-white' : 'bg-black', selectedResult ? "w-full lg:w-[48%]" : "w-full")}>
        {/* Header of STREAM_ORCHESTRATOR */}
        <div className={cn('p-5 p-6 border-b shrink-0 space-y-4', theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-900 bg-[#0F1115]')}>
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                PROGRESS <span className="text-slate-100 dark:text-white ml-2 font-mono batch-progress-count">{progress ? progress.completed : results.length} / {progress ? progress.total : results.length}</span>
              </div>
              <div className="flex items-center gap-3">
                {progress && (
                  <>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/25 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                      <span className="text-[9px] font-black text-[#10B981] uppercase tracking-wider">RUNNING</span>
                    </div>
                    <button 
                      onClick={onAbort}
                      className={cn('text-[10px] font-bold px-3 py-1 rounded transition-all uppercase tracking-wider cursor-pointer border', theme === 'light' ? 'text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200' : 'text-slate-300 border-slate-800 hover:bg-rose-600 hover:text-white hover:border-rose-650')}
                      aria-label="Stop batch stream execution"
                    >
                      SIGINT
                    </button>
                  </>
                )}
                <div className="text-xs font-black text-emerald-500 font-mono">
                  {progress && progress.total > 0 ? ((progress.completed / progress.total) * 100).toFixed(1) : (results.length > 0 ? '100.0' : '0.0')}%
                </div>
              </div>
            </div>
            <div className={cn('h-1.5 rounded-full overflow-hidden border', theme === 'light' ? 'bg-slate-200 border-slate-300' : 'bg-slate-950 border-slate-900')}>
              <motion.div 
                 className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                 initial={{ width: 0 }}
                 animate={{ width: `${progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : (results.length > 0 ? 100 : 0)}%` }}
                 transition={{ type: 'spring', damping: 20, stiffness: 40 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
             {[
               { label: 'PASSED', val: successCount, color: 'text-emerald-400 font-bold' },
               { label: 'FAILED', val: failureCount, color: 'text-rose-400 font-bold' },
               { label: 'AVG_LAT', val: `${avgResponseTimeStr}ms`, color: 'text-blue-400 font-bold' },
               { label: 'THREAD', val: progress ? concurrency : '-', color: 'text-amber-400 font-bold' }
             ].map(stat => (
               <div key={stat.label} className="space-y-1">
                 <div className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">{stat.label}</div>
                 <div className={cn("text-base font-black font-mono leading-none", stat.color)}>{stat.val}</div>
               </div>
             ))}
          </div>

          {/* Real-time Latency Chart */}
          <div className={cn('p-3 rounded-lg border space-y-2', theme === 'light' ? 'bg-slate-100/50 border-slate-200' : 'bg-slate-950/40 border-slate-900')}>
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <span>LATENCY_FLUCTUATIONS (LAST 40 CALLS)</span>
              {results.length > 0 && <span className="text-blue-400 font-mono text-[10px]">{results[results.length - 1]?.responseTime}ms</span>}
            </div>
            <div className="h-16 w-full">
              {results.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentResults} margin={{ top: 2, right: 5, left: -25, bottom: 2 }}>
                    <XAxis dataKey="name" hide />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme === 'light' ? '#64748B' : '#475569', fontSize: 9, fontFamily: 'monospace' }} 
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className={cn("border p-2 text-[10px] font-mono rounded shadow-lg", theme === 'light' ? "bg-white/95 border-slate-200 text-slate-800" : "bg-[#090D14]/95 border-slate-800 text-slate-300")}>
                              <div className="text-slate-500 font-bold mb-1">{data.name}</div>
                              <div className="flex gap-2">
                                <span>LATENCY:</span>
                                <span className="text-blue-400 font-bold">{data.latency}ms</span>
                              </div>
                              <div className="flex gap-2">
                                <span>STATUS:</span>
                                <span className={data.success ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                                  {data.status}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="#10b981" 
                      strokeWidth={1.5} 
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!payload.success) {
                          return (
                            <circle key={props.key} cx={cx} cy={cy} r={2.5} fill="#f43f5e" stroke="none" />
                          );
                        }
                        return null;
                      }}
                      activeDot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={cn('h-full flex items-center justify-center border border-dashed rounded', theme === 'light' ? 'border-slate-300 bg-slate-50' : 'border-slate-900 bg-[#090D14]/25')}>
                  <span className="text-xs font-mono text-slate-505 uppercase tracking-widest">Awaiting transmissions</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Telemetry Logs List */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className={cn("px-6 py-2 border-b flex items-center justify-between shrink-0", theme === 'light' ? 'border-slate-200 bg-slate-100' : 'border-slate-900 bg-black/40')}>
             <span className={cn("text-xs font-black uppercase tracking-[0.2em]", theme === 'light' ? 'text-slate-500' : 'text-slate-400')}>RECENT REQUESTS</span>
             <div className="flex items-center gap-4">
                <div className={cn("text-xs font-mono font-bold uppercase", theme === 'light' ? 'text-slate-500' : 'text-slate-500')}>SHOWING LAST 55</div>
                {onClear && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border transition-colors cursor-pointer flex items-center gap-1.5",
                      theme === 'light'
                        ? "text-rose-600 border-rose-200 hover:bg-rose-50"
                        : "text-slate-300 border-slate-800 hover:text-white hover:bg-rose-600 hover:border-rose-650"
                    )}
                  >
                    <X size={12} /> Clear All
                  </button>
                )}
             </div>
          </div>

          {/* List Area */}
          <div className={cn('flex-1 overflow-y-auto p-4 px-6 custom-scrollbar space-y-1.5', theme === 'light' ? 'bg-slate-50' : 'bg-black')}>
            <AnimatePresence initial={false}>

              {[...filteredResults].slice(-55).reverse().map((res, i) => {
                const originalIndex = results.findIndex(r => r.id === res.id) + 1;
                const rt = res.responseTime;
                const isSelected = selectedResult?.id === res.id;
                const isSuccess = res.status >= 200 && res.status < 300;

                const bodyLength = res.body ? res.body.length : 0;
                const formattedSize = bodyLength > 1024 
                  ? `${(bodyLength / 1024).toFixed(1)} KB` 
                  : `${bodyLength} B`;

                const method = (res.config?.method || 'GET').toUpperCase();
                let pathStr = '';
                try {
                  const urlObj = new URL(res.config?.url || '');
                  pathStr = urlObj.pathname + urlObj.search;
                } catch {
                  pathStr = res.config?.url || '';
                }
                const displayPath = pathStr.length > 32 ? pathStr.slice(0, 30) + '...' : pathStr;

                return (
                  <motion.div 
                    key={res.id}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    onClick={() => setSelectedResult(res)}
                    className={cn(
                      "group flex border-l-2 py-2 px-3 transition-all cursor-pointer items-center min-h-[40px] gap-3 rounded-r",
                      isSelected 
                        ? theme === 'light' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-1 ring-emerald-500/20' : 'border-emerald-500 bg-emerald-500/15 text-white' 
                        : theme === 'light' ? 'border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700 bg-white shadow-sm' : 'border-slate-800 hover:border-slate-500 hover:bg-slate-900/40 text-slate-300'
                    )}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={`Iteration log ${originalIndex}: ${method} ${res.config?.url || 'N/A'}, status ${res.status !== 0 ? res.status : 'error'}`}
                  >
                    <span className={cn(
                      "text-xs font-mono w-6 shrink-0 transition-colors",
                      isSelected ? "text-emerald-500 font-bold dark:text-emerald-350" : "text-slate-500"
                    )}>
                      #{originalIndex}
                    </span>
                    
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded-[2px] leading-none tracking-wider font-mono border shrink-0",
                        method === 'GET' ? 'bg-sky-500/10 text-sky-450 border-sky-500/20' :
                        method === 'POST' ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' :
                        method === 'PUT' ? 'bg-amber-500/10 text-amber-450 border-amber-500/20' :
                        method === 'DELETE' ? 'bg-rose-500/10 text-rose-450 border-rose-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      )}>
                        {method}
                      </span>
                      <span className={cn(
                        "font-mono text-xs truncate tracking-tight transition-colors",
                        isSelected ? "text-slate-950 dark:text-white font-black" : "text-slate-400 group-hover:text-slate-200"
                      )} title={res.config?.url}>
                        {displayPath}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono shrink-0 text-xs">
                      <span className={cn("font-black text-xs w-8 text-right", isSuccess ? "bg-emerald-500/10 px-1 py-0.5 rounded text-emerald-400" : "bg-rose-500/10 px-1 py-0.5 rounded text-rose-400")}>
                        {res.status !== 0 ? res.status : 'ERR'}
                      </span>
                      <span className="text-blue-400 font-bold w-14 text-right">{rt}ms</span>
                      <span className={cn(
                        "w-12 text-right text-[11px] font-medium transition-colors",
                        isSelected ? "text-slate-700 dark:text-slate-205 font-bold" : "text-slate-500"
                      )}>{formattedSize}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {results.length === 0 && !progress && (
              <div className="h-full flex flex-col items-center justify-center opacity-25 text-center space-y-4 py-16">
                <div className="w-12 h-12 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center animate-spin-slow">
                   <Activity size={24} aria-hidden="true" />
                </div>
                <div className="uppercase tracking-[0.4em] font-black text-xs text-slate-400">Standby_Stream_Init</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel 2: Result details dynamically side-by-side! */}
      {selectedResult && (
        <div className={cn('flex-1 flex flex-col h-full relative', theme === 'light' ? 'bg-white' : 'bg-black')}>
          <div className={cn('p-3 px-4 border-b flex items-center justify-between shrink-0 font-sans', theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-900 bg-[#0F1115]')}>
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => setSelectedResult(null)}
                 className="text-xs font-mono text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
                 aria-label="Close batch log inspector"
               >
                 <X size={12} aria-hidden="true" /> CLOSE_DETAIL
               </button>
               <span className="w-px h-3 bg-slate-800 mx-1"></span>
               <span className="text-xs font-mono text-slate-405 uppercase font-medium">
                 REQ_DETAIL #{results.findIndex(r => r.id === selectedResult.id) + 1}
               </span>
            </div>
            <button 
              onClick={() => setSelectedResult(null)}
              className="text-slate-550 hover:text-white cursor-pointer"
              aria-label="Close details inspector icon"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ResponseViewer result={selectedResult} loading={false} onAbort={() => {}} theme={theme} defaultTab="response" />
          </div>
        </div>
      )}
    </div>
  );
}
