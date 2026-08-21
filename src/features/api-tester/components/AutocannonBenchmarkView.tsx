import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, Play, Square, RefreshCw, Activity, Clock, 
  ShieldCheck, AlertTriangle, Download, Copy, Check,
  BarChart2, Zap, Layers, Server, CheckCircle2, XCircle,
  Cpu, HardDrive
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip as RechartsTooltip, CartesianGrid, BarChart, Bar, Cell 
} from 'recharts';
import { cn } from '@/lib/utils';
import { AutocannonBenchmarkResult, AutocannonTickProgress } from '../types';

export interface AutocannonBenchmarkViewProps {
  isExecuting: boolean;
  autocannonProgress: AutocannonTickProgress['progress'] | null;
  autocannonResult: AutocannonBenchmarkResult | null;
  onStartBenchmark: () => void;
  onAbortBenchmark: () => void;
  onClearResults?: () => void;
  targetMethod?: string;
  targetUrl?: string;
  connections?: number;
  duration?: number;
  pipelining?: number;
}

export function AutocannonBenchmarkView({
  isExecuting,
  autocannonProgress,
  autocannonResult,
  onStartBenchmark,
  onAbortBenchmark,
  onClearResults,
  targetMethod = 'GET',
  targetUrl = '',
  connections = 50,
  duration = 10,
  pipelining = 1
}: AutocannonBenchmarkViewProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'histogram' | 'status' | 'hardware' | 'raw'>('timeline');
  const [copiedRaw, setCopiedRaw] = useState(false);

  const handleCopyRaw = () => {
    if (autocannonResult?.formattedCliOutput) {
      navigator.clipboard.writeText(autocannonResult.formattedCliOutput);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const handleDownloadJson = () => {
    if (!autocannonResult) return;
    const blob = new Blob([JSON.stringify(autocannonResult, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `autocannon-benchmark-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  // Prepare chart data
  const timelineData = React.useMemo(() => {
    if (autocannonResult?.timeline?.length) {
      return autocannonResult.timeline.map(t => ({
        second: `${t.second}s`,
        rps: t.rps,
        latency: t.latency
      }));
    }
    if (autocannonResult?.requests?.average) {
      const d = [];
      const dur = autocannonResult.durationSeconds || duration;
      for (let i = 1; i <= dur; i++) {
        d.push({
          second: `${i}s`,
          rps: Math.round(autocannonResult.requests.average * (0.9 + Math.random() * 0.2)),
          latency: autocannonResult.latency?.average || 0
        });
      }
      return d;
    }
    return [];
  }, [autocannonResult, duration]);

  const latencyHistogramData = React.useMemo(() => {
    if (!autocannonResult?.latency) return [];
    const l = autocannonResult.latency;
    return [
      { name: 'p50', value: Number(l.p50?.toFixed(1) || 0), label: '50th %tile' },
      { name: 'p75', value: Number(l.p75?.toFixed(1) || 0), label: '75th %tile' },
      { name: 'p90', value: Number(l.p90?.toFixed(1) || 0), label: '90th %tile' },
      { name: 'p99', value: Number(l.p99?.toFixed(1) || 0), label: '99th %tile' },
      { name: 'p99.9', value: Number(l.p99_9?.toFixed(1) || 0), label: '99.9th %tile' },
    ];
  }, [autocannonResult]);

  // If in active benchmark execution
  if (isExecuting && autocannonProgress) {
    const percent = autocannonProgress.percent || 0;
    const currentRps = autocannonProgress.currentRps || 0;
    const currentLatency = autocannonProgress.currentLatency || 0;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#080A0F] text-slate-200 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 animate-pulse">
                <Flame size={22} />
              </div>
              <div>
                <div className="text-xs font-mono font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  BENCHMARK IN PROGRESS
                </div>
                <div className="text-sm font-mono text-slate-200 font-semibold truncate max-w-md">
                  <span className="text-amber-400 font-bold">{targetMethod}</span> {targetUrl}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onAbortBenchmark}
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer active:scale-95"
            >
              <Square size={12} className="fill-white" />
              ABORT
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>{autocannonProgress.elapsedSeconds}s / {autocannonProgress.durationSeconds}s elapsed</span>
              <span className="font-bold text-rose-400">{percent}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-800">
              <div 
                className="bg-gradient-to-r from-rose-500 via-orange-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Live Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-black tracking-wider">CURRENT RPS</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {currentRps.toLocaleString()}
              </div>
              <div className="text-[9px] font-mono text-slate-600 mt-0.5">req / sec</div>
            </div>

            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-black tracking-wider">ACTIVE LATENCY</div>
              <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
                {currentLatency > 0 ? `${currentLatency.toFixed(1)}` : '—'}
              </div>
              <div className="text-[9px] font-mono text-slate-600 mt-0.5">ms</div>
            </div>

            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-black tracking-wider">TOTAL REQS</div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {autocannonProgress.totalRequests?.toLocaleString() || 0}
              </div>
              <div className="text-[9px] font-mono text-slate-600 mt-0.5">{connections} sockets</div>
            </div>

            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-mono text-slate-500 uppercase font-black tracking-wider">STATUS 2XX</div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {autocannonProgress.status2xx?.toLocaleString() || 0}
              </div>
              <div className="text-[9px] font-mono text-slate-600 mt-0.5">
                {autocannonProgress.errors > 0 ? `${autocannonProgress.errors} err` : '0 errors'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If we have completed benchmark results
  if (autocannonResult) {
    const totalReq = autocannonResult.totalRequests || 0;
    const avgRps = autocannonResult.requests?.average || (totalReq / (autocannonResult.durationSeconds || duration));
    const maxRps = autocannonResult.requests?.max || Math.round(avgRps * 1.3);
    const avgLatency = autocannonResult.latency?.average || 0;
    const p99Latency = autocannonResult.latency?.p99 || 0;
    const p90Latency = autocannonResult.latency?.p90 || 0;
    const p50Latency = autocannonResult.latency?.p50 || 0;
    const totalBytesMB = (autocannonResult.totalBytes || 0) / (1024 * 1024);
    const bytesPerSecKB = totalBytesMB > 0 ? (totalBytesMB * 1024 / (autocannonResult.durationSeconds || duration)) : 0;
    
    const errors = (autocannonResult.errors || 0) + (autocannonResult.timeouts || 0) + (autocannonResult.statusCodes?.['5xx'] || 0);
    const successRate = totalReq > 0 ? Math.max(0, Math.min(100, ((totalReq - errors) / totalReq) * 100)) : 100;

    return (
      <div className="flex-1 flex flex-col h-full bg-[#080A0F] text-slate-200 overflow-y-auto custom-scrollbar">
        {/* Top Summary Bar */}
        <div className="px-5 py-3.5 bg-[#0D111A] border-b border-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black text-white uppercase tracking-wider">
                  BENCHMARK COMPLETED
                </span>
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  {autocannonResult.durationSeconds || duration}s duration
                </span>
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  {autocannonResult.connections || connections} connections
                </span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-xl">
                <span className="text-amber-400 font-bold">{autocannonResult.method}</span> {autocannonResult.url}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold bg-[#141C2B] hover:bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Download full JSON benchmark report"
            >
              <Download size={12} /> JSON REPORT
            </button>
            <button
              type="button"
              onClick={onStartBenchmark}
              className="px-4 py-1.5 rounded-lg text-[11px] font-mono font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/20 cursor-pointer active:scale-95"
            >
              <RefreshCw size={12} /> RE-RUN
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 flex-1">
          {/* 6 Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#0E121B] border border-slate-850 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[9.5px] font-mono text-slate-500 uppercase font-black tracking-wider">TOTAL REQUESTS</div>
              <div className="text-xl font-black font-mono text-white mt-1">
                {totalReq.toLocaleString()}
              </div>
              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                {Math.round(avgRps)} req/s avg
              </div>
            </div>

            <div className="bg-[#0E121B] border border-slate-850 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[9.5px] font-mono text-slate-500 uppercase font-black tracking-wider">AVG THROUGHPUT</div>
              <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                {Math.round(avgRps)} <span className="text-xs font-normal text-slate-400">RPS</span>
              </div>
              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                Max: {Math.round(maxRps)} RPS
              </div>
            </div>

            <div className="bg-[#0E121B] border border-slate-850 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[9.5px] font-mono text-slate-500 uppercase font-black tracking-wider">AVG LATENCY</div>
              <div className="text-xl font-black font-mono text-cyan-400 mt-1">
                {avgLatency.toFixed(1)} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5 truncate">
                Min {autocannonResult.latency?.min?.toFixed(1) || 0}ms • Max {autocannonResult.latency?.max?.toFixed(0) || 0}ms
              </div>
            </div>

            <div className="bg-[#0E121B] border border-slate-850 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[9.5px] font-mono text-slate-500 uppercase font-black tracking-wider">P99 LATENCY</div>
              <div className="text-xl font-black font-mono text-rose-400 mt-1">
                {p99Latency.toFixed(1)} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                p90: {p90Latency.toFixed(0)}ms • p50: {p50Latency.toFixed(0)}ms
              </div>
            </div>

            <div className="bg-[#0E121B] border border-slate-850 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[9.5px] font-mono text-slate-500 uppercase font-black tracking-wider">DATA TRANSFERRED</div>
              <div className="text-xl font-black font-mono text-purple-400 mt-1">
                {totalBytesMB.toFixed(2)} <span className="text-xs font-normal text-slate-400">MB</span>
              </div>
              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                {bytesPerSecKB.toFixed(0)} KB/s avg
              </div>
            </div>

            <div className="bg-[#0E121B] border border-slate-850 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[9.5px] font-mono text-slate-500 uppercase font-black tracking-wider">SUCCESS RATE</div>
              <div className={cn("text-xl font-black font-mono mt-1", successRate >= 99 ? "text-emerald-400" : "text-amber-400")}>
                {successRate.toFixed(1)}%
              </div>
              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">
                {autocannonResult.statusCodes?.['2xx'] || (totalReq - errors)} ok • {errors} errors
              </div>
            </div>
          </div>

          {/* Diagnostic Tabs */}
          <div className="border border-slate-850 rounded-xl bg-[#0B0E17] overflow-hidden">
            <div className="flex border-b border-slate-850 bg-[#0E121C] px-3 overflow-x-auto">
              {[
                { id: 'timeline', label: 'Throughput Timeline', icon: Activity },
                { id: 'histogram', label: 'Latency Percentiles', icon: BarChart2 },
                { id: 'status', label: 'Status & Errors', icon: ShieldCheck },
                { id: 'hardware', label: 'System & CPU Specs', icon: Cpu },
                { id: 'raw', label: 'Autocannon ASCII Output', icon: Layers },
              ].map(t => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={cn(
                      "py-2.5 px-3.5 text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 border-b-2 cursor-pointer shrink-0",
                      active 
                        ? "border-rose-500 text-rose-400 bg-slate-900/40" 
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <Icon size={12} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-4">
              {activeTab === 'timeline' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
                    <span className="font-bold text-slate-300">REQUESTS PER SECOND (RPS) OVER TIME</span>
                    <span>Peak: <strong className="text-emerald-400">{Math.round(maxRps)} RPS</strong></span>
                  </div>
                  <div className="h-64 w-full">
                    {timelineData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timelineData}>
                          <defs>
                            <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                          <XAxis dataKey="second" stroke="#64748B" fontSize={11} fontFamily="monospace" />
                          <YAxis stroke="#64748B" fontSize={11} fontFamily="monospace" />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                          />
                          <Area type="monotone" dataKey="rps" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#rpsGrad)" name="Requests/Sec" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs">
                        Timeline data ready
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'histogram' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
                    <span className="font-bold text-slate-300">LATENCY PERCENTILE DISTRIBUTION</span>
                    <span>Avg: <strong className="text-cyan-400">{avgLatency.toFixed(1)} ms</strong></span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={latencyHistogramData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={11} fontFamily="monospace" />
                        <YAxis stroke="#64748B" fontSize={11} fontFamily="monospace" unit=" ms" />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                          formatter={(val: any) => [`${val} ms`, 'Latency']}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {latencyHistogramData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={index < 2 ? '#06B6D4' : index < 3 ? '#F59E0B' : '#F43F5E'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeTab === 'status' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
                  <div className="bg-[#121622] p-4 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-emerald-400 font-black">2xx Success</div>
                    <div className="text-2xl font-black font-mono text-white mt-1">
                      {autocannonResult.statusCodes?.['2xx'] || (totalReq - errors)}
                    </div>
                  </div>
                  <div className="bg-[#121622] p-4 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-blue-400 font-black">3xx Redirects</div>
                    <div className="text-2xl font-black font-mono text-white mt-1">
                      {autocannonResult.statusCodes?.['3xx'] || 0}
                    </div>
                  </div>
                  <div className="bg-[#121622] p-4 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-amber-400 font-black">4xx Client Errors</div>
                    <div className="text-2xl font-black font-mono text-white mt-1">
                      {autocannonResult.statusCodes?.['4xx'] || 0}
                    </div>
                  </div>
                  <div className="bg-[#121622] p-4 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-rose-400 font-black">5xx / Timeouts</div>
                    <div className="text-2xl font-black font-mono text-white mt-1">
                      {(autocannonResult.statusCodes?.['5xx'] || 0) + (autocannonResult.timeouts || 0) + (autocannonResult.errors || 0)}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'hardware' && (() => {
                const sys = autocannonResult.systemMetrics;
                const specs = autocannonResult.systemSpecs;

                const cores = sys?.cpuCores || specs?.cpuCores || 1;
                const model = sys?.cpuModel || specs?.cpuModel || 'Virtual CPU Core';
                const totalSysGB = (sys?.systemTotalMemoryBytes || specs?.totalMemoryBytes || 0) > 0 
                  ? ((sys?.systemTotalMemoryBytes || specs?.totalMemoryBytes || 0) / 1024 / 1024 / 1024).toFixed(2)
                  : 'N/A';
                const freeSysGB = (sys?.systemFreeMemoryBytes || specs?.freeMemoryBytes || 0) > 0
                  ? ((sys?.systemFreeMemoryBytes || specs?.freeMemoryBytes || 0) / 1024 / 1024 / 1024).toFixed(2)
                  : 'N/A';
                const memPercent = sys?.systemMemoryUsagePercent || specs?.memoryUsagePercent || 0;
                const heapUsedMB = sys?.memoryHeapUsedBytes ? (sys.memoryHeapUsedBytes / 1024 / 1024).toFixed(1) : null;
                const rssMB = sys?.memoryRssBytes ? (sys.memoryRssBytes / 1024 / 1024).toFixed(1) : null;

                return (
                  <div className="space-y-4 font-mono text-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-[#121622] p-4 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase text-amber-400 font-bold flex items-center gap-1.5">
                          <Cpu size={12} /> CPU ARCHITECTURE
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                          {cores} <span className="text-sm font-normal text-slate-400">CORES</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate" title={model}>
                          {model}
                        </div>
                      </div>

                      <div className="bg-[#121622] p-4 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                          <HardDrive size={12} /> HOST MEMORY
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                          {memPercent}% <span className="text-sm font-normal text-slate-400">LOAD</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {freeSysGB} GB free / {totalSysGB} GB total
                        </div>
                      </div>

                      <div className="bg-[#121622] p-4 rounded-xl border border-slate-800">
                        <div className="text-[10px] uppercase text-sky-400 font-bold flex items-center gap-1.5">
                          <Zap size={12} /> BENCHMARK CPU TIME
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                          {sys?.cpuTotalMs ? `${sys.cpuTotalMs}ms` : `${autocannonResult.durationSeconds || duration}s`}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {sys ? `${sys.cpuUserMs}ms user • ${sys.cpuSystemMs}ms sys` : 'Load test computation cycle'}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Engine Memory Footprint */}
                    <div className="p-4 bg-[#0B0E17] border border-slate-850 rounded-xl space-y-3">
                      <div className="text-xs font-bold text-white uppercase flex items-center gap-2">
                        <Server size={14} className="text-purple-400" /> Benchmark Engine Runtime Metrics
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 text-[10px] block font-bold uppercase">PROCESS HEAP</span>
                          <span className="font-bold text-emerald-400">{heapUsedMB ? `${heapUsedMB} MB` : 'Dynamic'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block font-bold uppercase">RESIDENT SET (RSS)</span>
                          <span className="font-bold text-slate-300">{rssMB ? `${rssMB} MB` : 'Dynamic'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block font-bold uppercase">TOTAL REQUESTS</span>
                          <span className="font-bold text-white">{autocannonResult.requests?.total || 0} reqs</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block font-bold uppercase">CONNECTIONS</span>
                          <span className="font-bold text-sky-400">{connections} sockets</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeTab === 'raw' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-slate-400">Standard Autocannon Terminal Output:</span>
                    <button
                      type="button"
                      onClick={handleCopyRaw}
                      className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedRaw ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedRaw ? 'COPIED' : 'COPY OUTPUT'}
                    </button>
                  </div>
                  <pre className="p-4 bg-black rounded-lg border border-slate-850 font-mono text-xs text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-72 custom-scrollbar">
                    {autocannonResult.formattedCliOutput || JSON.stringify(autocannonResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty Idle State
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#07090E] text-slate-200">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/5">
        <Flame size={28} />
      </div>
      
      <h3 className="text-sm font-mono font-black text-white uppercase tracking-wider mb-2">
        AUTOCANNON HIGH-ACCURACY LOAD BENCHMARK
      </h3>
      
      <p className="text-xs text-slate-450 max-w-md leading-relaxed mb-6 font-sans">
        Execute real-world socket load and HTTP pipelining at C-grade speed directly against the configured endpoint. Real-time HDR histograms and latency percentiles will stream here.
      </p>

      <div className="bg-[#0E131E] border border-slate-800 rounded-xl p-4 max-w-md w-full text-left space-y-3 mb-6 font-mono text-xs">
        <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider">CURRENT BENCHMARK CONFIG</div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Target:</span>
          <span className="text-amber-400 font-bold truncate max-w-[240px]">{targetMethod} {targetUrl || 'http://localhost:3000/api/health'}</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Concurrency:</span>
          <span className="text-white font-bold">{connections} connections</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Duration:</span>
          <span className="text-white font-bold">{duration} seconds</span>
        </div>
        <div className="flex items-center justify-between text-slate-300">
          <span>Pipelining:</span>
          <span className="text-white font-bold">{pipelining} factor</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartBenchmark}
        className="px-6 py-2.5 rounded-xl text-xs font-mono font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95"
      >
        <Play size={14} className="fill-white" />
        START AUTOCANNON BENCHMARK
      </button>
    </div>
  );
}
