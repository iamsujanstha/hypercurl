import React, { useState, useMemo } from 'react';
import { 
  Play, 
  Square, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  Terminal, 
  Activity, 
  Clock, 
  BarChart2, 
  CheckCircle2, 
  AlertCircle,
  RotateCcw,
  Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  CartesianGrid,
  BarChart as RechartsBarChart,
  Bar,
  Cell
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
  const [activeView, setActiveView] = useState<'metrics' | 'raw'>('metrics');
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Exact CLI Command snippet
  const cliCommand = useMemo(() => {
    if (autocannonResult?.cliCommand) return autocannonResult.cliCommand;
    const cleanUrl = targetUrl || 'http://localhost:3000/api/health';
    return `autocannon -c ${connections} -d ${duration} -p ${pipelining} -m ${targetMethod} "${cleanUrl}"`;
  }, [autocannonResult, connections, duration, pipelining, targetMethod, targetUrl]);

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyRaw = () => {
    if (!autocannonResult?.formattedCliOutput) return;
    navigator.clipboard.writeText(autocannonResult.formattedCliOutput);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
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

  // Timeline chart data
  const timelineData = useMemo(() => {
    if (autocannonResult?.timeline?.length) {
      return autocannonResult.timeline.map(t => ({
        second: `${t.second}s`,
        rps: t.rps,
        latency: t.latency
      }));
    }
    return [];
  }, [autocannonResult]);

  // Latency percentile distribution chart data
  const percentileChartData = useMemo(() => {
    if (!autocannonResult?.latency) return [];
    const l = autocannonResult.latency;
    return [
      { name: 'p50', value: Number(l.p50?.toFixed(1) || 0) },
      { name: 'p75', value: Number(l.p75?.toFixed(1) || 0) },
      { name: 'p90', value: Number(l.p90?.toFixed(1) || 0) },
      { name: 'p95', value: Number(l.p95?.toFixed(1) || 0) },
      { name: 'p99', value: Number(l.p99?.toFixed(1) || 0) },
      { name: 'p99.9', value: Number(l.p99_9?.toFixed(1) || 0) },
    ];
  }, [autocannonResult]);

  // =========================================================================
  // 1. LIVE BENCHMARK EXECUTION STATE
  // =========================================================================
  if (isExecuting && autocannonProgress) {
    const percent = Math.min(100, Math.max(0, autocannonProgress.percent || 0));
    const currentRps = autocannonProgress.currentRps || 0;
    const currentLatency = autocannonProgress.currentLatency || 0;
    const elapsed = autocannonProgress.elapsedSeconds || 0;
    const totalDur = autocannonProgress.durationSeconds || duration || 10;
    const currentKB = autocannonProgress.currentBytesPerSec 
      ? (autocannonProgress.currentBytesPerSec / 1024).toFixed(0) 
      : '0';

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#07090E] text-slate-200 select-none overflow-y-auto font-sans">
        <div className="w-full max-w-xl bg-[#0C0F17] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Benchmark Running
                </h3>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1 truncate max-w-md">
                <span className="text-amber-400 font-bold">{targetMethod}</span> {targetUrl || 'http://localhost:3000'}
              </div>
            </div>

            <button
              type="button"
              onClick={onAbortBenchmark}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Square size={11} className="fill-white" />
              Stop Test
            </button>
          </div>

          {/* Clean Progress Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>Time Elapsed: <strong className="text-white">{elapsed}s</strong> of {totalDur}s</span>
              <span className="text-amber-400 font-bold">{percent}%</span>
            </div>
            
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Real-time Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#080A10] border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Current RPS</div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                {currentRps.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">req/sec</div>
            </div>

            <div className="bg-[#080A10] border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Latency</div>
              <div className="text-lg font-bold text-cyan-400 font-mono mt-0.5">
                {currentLatency.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">ms avg</div>
            </div>

            <div className="bg-[#080A10] border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Data Rate</div>
              <div className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                {currentKB}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">KB/sec</div>
            </div>

            <div className="bg-[#080A10] border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Sockets</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                {connections}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">concurrent</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono truncate bg-[#06080E] p-2 rounded border border-slate-850">
            $ {cliCommand}
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. EMPTY STATE
  // =========================================================================
  if (!autocannonResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#07090E] text-slate-400 select-none font-sans">
        <div className="max-w-md w-full bg-[#0C0F17] border border-slate-800 rounded-xl p-6 text-center space-y-4 shadow-lg">
          <div className="w-11 h-11 mx-auto rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap size={22} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
              Autocannon Load Engine Ready
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Measure HTTP throughput, latency percentiles, and socket saturation under high concurrent load.
            </p>
          </div>

          <div className="bg-[#06080E] p-3 rounded-lg border border-slate-850 text-left space-y-1 text-xs font-mono">
            <div className="text-slate-400 flex justify-between">
              <span>Target: <strong className="text-amber-400">{targetMethod}</strong> {targetUrl ? new URL(targetUrl).pathname : '/api/health'}</span>
              <span className="text-slate-400 font-bold">{connections}c • {duration}s</span>
            </div>
            <div className="text-slate-500 truncate text-[11px] pt-1">
              $ {cliCommand}
            </div>
          </div>

          <button
            type="button"
            onClick={onStartBenchmark}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Play size={13} className="fill-slate-950" />
            Start Load Test
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. COMPLETED BENCHMARK RESULTS
  // =========================================================================
  const l = autocannonResult.latency || ({} as any);
  const r = autocannonResult.requests || ({} as any);
  const t = autocannonResult.throughput || ({} as any);

  const totalReq = autocannonResult.totalRequests || 0;
  const totalMB = (autocannonResult.totalBytes || 0) / 1024 / 1024;
  const avgRps = r.average || 0;
  const avgLat = l.average || 0;
  const errors = (autocannonResult.errors || 0) + (autocannonResult.timeouts || 0);
  const status2xx = autocannonResult.statusCodes?.['2xx'] || (totalReq - errors);
  const successPercent = totalReq > 0 ? ((status2xx / totalReq) * 100).toFixed(1) : '100';

  return (
    <div className="flex flex-col h-full bg-[#07090E] text-slate-200 overflow-hidden font-sans select-text">
      
      {/* Top Header & Action Bar */}
      <div className="px-4 py-3 bg-[#0A0D15] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        
        {/* Left: Summary Tag */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center gap-1.5">
            <Zap size={12} />
            <span>AUTOCANNON</span>
          </div>

          <div className="text-xs text-slate-300 font-mono font-bold px-2.5 py-1 bg-[#121622] rounded border border-slate-800 truncate max-w-sm">
            <span className="text-amber-400">{autocannonResult.method || targetMethod}</span> {autocannonResult.url || targetUrl}
          </div>

          <div className="text-xs text-slate-400 font-mono px-2 py-1 rounded bg-[#0D1018] border border-slate-850">
            {autocannonResult.connections || connections} connections • {autocannonResult.durationSeconds || duration}s duration
          </div>
        </div>

        {/* Right: View Switch & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#07090E] p-0.5 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveView('metrics')}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeView === 'metrics' 
                  ? "bg-[#182030] text-amber-400 shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <BarChart2 size={12} /> Metrics
            </button>
            <button
              type="button"
              onClick={() => setActiveView('raw')}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeView === 'raw' 
                  ? "bg-[#182030] text-amber-400 shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Terminal size={12} /> Raw CLI Output
            </button>
          </div>

          <button
            type="button"
            onClick={onStartBenchmark}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1 transition-all cursor-pointer"
            title="Re-run load test"
          >
            <RotateCcw size={11} /> Re-run
          </button>

          <button
            type="button"
            onClick={handleCopyCli}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer",
              copiedCli 
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                : "bg-[#101420] hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-white"
            )}
            title="Copy exact Autocannon CLI command"
          >
            {copiedCli ? <Check size={11} /> : <Copy size={11} />}
            <span>{copiedCli ? 'Copied' : 'CLI'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="p-1.5 rounded bg-[#101420] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs cursor-pointer"
            title="Export JSON Report"
          >
            <Download size={12} />
          </button>

          {onClearResults && (
            <button
              type="button"
              onClick={onClearResults}
              className="p-1.5 rounded bg-[#101420] hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs cursor-pointer"
              title="Clear results"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

        {/* 1. KEY METRIC SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
          <div className="bg-[#0B0E17] border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Throughput</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {Math.round(avgRps).toLocaleString()} <span className="text-xs font-normal text-slate-400">RPS</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {totalReq.toLocaleString()} total reqs
            </div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Latency (Avg / p99)</span>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {avgLat.toFixed(1)} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              p99: {(l.p99 || 0).toFixed(1)}ms • max: {(l.max || 0).toFixed(1)}ms
            </div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Success Rate</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {successPercent}%
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {status2xx.toLocaleString()} 2xx responses
            </div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Errors & Timeouts</span>
            <div className={cn("text-xl font-bold font-mono mt-1", errors > 0 ? "text-rose-400" : "text-slate-400")}>
              {errors}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {autocannonResult.timeouts || 0} timeouts • {autocannonResult.resets || 0} resets
            </div>
          </div>
        </div>

        {/* 2. TAB CONTENT: DETAILED METRICS OR RAW STDOUT */}
        {activeView === 'metrics' ? (
          <div className="space-y-4">
            
            {/* LATENCY PERCENTILES TABLE */}
            <div className="bg-[#0B0E17] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-[#0E121B] border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} /> Latency Distribution (Milliseconds)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Sampled over {totalReq.toLocaleString()} responses
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#07090E] text-slate-400 text-[11px]">
                      <th className="py-2.5 px-4 font-bold text-slate-300">Metric</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-400">p50 (Median)</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-400">p75</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-400">p90</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-400">p95</th>
                      <th className="py-2.5 px-3 font-semibold text-cyan-400">p97.5</th>
                      <th className="py-2.5 px-3 font-semibold text-amber-400">p99</th>
                      <th className="py-2.5 px-3 font-semibold text-rose-400">p99.9</th>
                      <th className="py-2.5 px-3 font-semibold text-emerald-400">Average</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-400">StdDev</th>
                      <th className="py-2.5 px-3 font-semibold text-slate-400">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-[#0E1320] transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-400">Latency</td>
                      <td className="py-3 px-3 font-medium text-slate-200">{(l.p50 || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 text-slate-300">{(l.p75 || l.p50 || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 text-slate-300">{(l.p90 || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 text-slate-300">{(l.p95 || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 text-cyan-300">{(l.p97_5 || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 font-bold text-amber-300">{(l.p99 || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 font-bold text-rose-300">{(l.p99_9 || l.p99 || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 font-bold text-emerald-300">{(l.average || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 text-slate-400">{(l.stddev || 0).toFixed(1)} ms</td>
                      <td className="py-3 px-3 text-slate-300 font-medium">{(l.max || 0).toFixed(1)} ms</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* THROUGHPUT & DATA RATE TABLE */}
            <div className="bg-[#0B0E17] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-[#0E121B] border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={13} /> Throughput & Data Bandwidth
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {totalMB.toFixed(2)} MB total transferred
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#07090E] text-slate-400 text-[11px]">
                      <th className="py-2.5 px-4 font-bold text-slate-300">Metric</th>
                      <th className="py-2.5 px-4 font-semibold text-emerald-400">Average</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-400">Min</th>
                      <th className="py-2.5 px-4 font-semibold text-amber-400">Max (Peak)</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-400">StdDev</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-400">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr className="hover:bg-[#0E1320] transition-colors">
                      <td className="py-3 px-4 font-bold text-emerald-400">Requests / Sec</td>
                      <td className="py-3 px-4 font-bold text-emerald-300">{Math.round(r.average || 0).toLocaleString()} req/s</td>
                      <td className="py-3 px-4 text-slate-300">{Math.round(r.min || 0).toLocaleString()} req/s</td>
                      <td className="py-3 px-4 font-bold text-amber-300">{Math.round(r.max || 0).toLocaleString()} req/s</td>
                      <td className="py-3 px-4 text-slate-400">{Math.round(r.stddev || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-slate-200 font-semibold">{totalReq.toLocaleString()} reqs</td>
                    </tr>
                    <tr className="hover:bg-[#0E1320] transition-colors">
                      <td className="py-3 px-4 font-bold text-purple-400">Bytes / Sec</td>
                      <td className="py-3 px-4 font-bold text-purple-300">{((t.average || 0) / 1024).toFixed(0)} KB/s</td>
                      <td className="py-3 px-4 text-slate-300">{((t.min || 0) / 1024).toFixed(0)} KB/s</td>
                      <td className="py-3 px-4 font-bold text-amber-300">{((t.max || 0) / 1024).toFixed(0)} KB/s</td>
                      <td className="py-3 px-4 text-slate-400">{((t.stddev || 0) / 1024).toFixed(0)} KB/s</td>
                      <td className="py-3 px-4 text-slate-200 font-semibold">{totalMB.toFixed(2)} MB</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* STATUS BREAKDOWN & TIMELINE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* HTTP Status Code Breakdown */}
              <div className="bg-[#0B0E17] border border-slate-800 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono block">
                  Response Code Distribution
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center p-2 rounded bg-[#07090E] border border-slate-850">
                    <span className="text-emerald-400 font-bold">2xx Success</span>
                    <span className="text-white font-bold">{status2xx.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[#07090E] border border-slate-850">
                    <span className="text-blue-400 font-bold">3xx Redirects</span>
                    <span className="text-slate-300">{autocannonResult.statusCodes?.['3xx'] || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[#07090E] border border-slate-850">
                    <span className="text-amber-400 font-bold">4xx Client Errors</span>
                    <span className="text-slate-300">{autocannonResult.statusCodes?.['4xx'] || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[#07090E] border border-slate-850">
                    <span className="text-rose-400 font-bold">5xx Server Errors</span>
                    <span className={cn("font-bold", (autocannonResult.statusCodes?.['5xx'] || 0) > 0 ? "text-rose-400" : "text-slate-300")}>
                      {autocannonResult.statusCodes?.['5xx'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-[#07090E] border border-slate-850">
                    <span className="text-slate-400">Timeouts / Resets</span>
                    <span className={cn("font-bold", errors > 0 ? "text-rose-400" : "text-slate-400")}>
                      {errors}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline Chart */}
              <div className="lg:col-span-2 bg-[#0B0E17] border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-300">
                  <span>Throughput Timeline (Req/Sec)</span>
                  <span className="text-emerald-400">Peak: {Math.round(r.max || avgRps).toLocaleString()} RPS</span>
                </div>
                <div className="h-44 w-full">
                  {timelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData}>
                        <defs>
                          <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                        <XAxis dataKey="second" stroke="#64748B" fontSize={11} fontFamily="monospace" />
                        <YAxis stroke="#64748B" fontSize={11} fontFamily="monospace" />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}
                        />
                        <Area type="monotone" dataKey="rps" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#rpsGrad)" name="Requests/Sec" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                      Timeline available on benchmarks &gt; 1s
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* RAW CLI OUTPUT BLOCK */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 select-none">
              <span className="font-mono font-semibold">Standard Autocannon Terminal Output</span>
              <button
                type="button"
                onClick={handleCopyRaw}
                className="px-2.5 py-1 rounded bg-[#121622] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                {copiedRaw ? <Check size={11} className="text-amber-400" /> : <Copy size={11} />}
                <span>{copiedRaw ? 'Copied' : 'Copy Terminal Text'}</span>
              </button>
            </div>
            <pre className="bg-[#05070B] border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400/90 whitespace-pre overflow-x-auto shadow-inner leading-relaxed select-all">
              {autocannonResult.formattedCliOutput || 'No raw output available'}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
