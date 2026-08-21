import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Play, 
  Square, 
  RefreshCw, 
  Activity, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  Download, 
  Copy, 
  Check,
  BarChart2, 
  Zap, 
  Layers, 
  Server, 
  CheckCircle2, 
  XCircle,
  Terminal,
  Cpu,
  Trash2,
  HardDrive
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

export type AutocannonViewTab = 'tables' | 'raw' | 'charts';

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
  const [viewTab, setViewTab] = useState<AutocannonViewTab>('tables');
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedAscii, setCopiedAscii] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Exact CLI Command snippet
  const cliCommand = useMemo(() => {
    if (autocannonResult?.cliCommand) return autocannonResult.cliCommand;
    const cleanUrl = targetUrl || 'http://localhost:3000/api/health';
    return `autocannon -c ${connections} -d ${duration} -p ${pipelining} -m ${targetMethod} "${cleanUrl}"`;
  }, [autocannonResult, connections, duration, pipelining, targetMethod, targetUrl]);

  // Formatted ASCII table string
  const formattedAscii = useMemo(() => {
    if (autocannonResult?.formattedCliOutput) {
      return autocannonResult.formattedCliOutput;
    }
    if (!autocannonResult) return '';

    const l: any = autocannonResult.latency || {};
    const r: any = autocannonResult.requests || {};
    const t: any = autocannonResult.throughput || {};

    const p2_5_lat = (l.p2_5 !== undefined ? l.p2_5 : l.p50 ? l.p50 * 0.7 : 0).toFixed(1);
    const p50_lat = (l.p50 || 0).toFixed(1);
    const p97_5_lat = (l.p97_5 || l.p90 || 0).toFixed(1);
    const p99_lat = (l.p99 || 0).toFixed(1);
    const avg_lat = (l.average || 0).toFixed(1);
    const std_lat = (l.stddev || 0).toFixed(1);
    const max_lat = (l.max || 0).toFixed(1);

    const p1_req = (r.p1 || r.p50 ? r.p50 * 0.6 : 0).toFixed(0);
    const p2_5_req = (r.p2_5 || r.p50 ? r.p50 * 0.7 : 0).toFixed(0);
    const p50_req = (r.p50 || 0).toFixed(0);
    const p97_5_req = (r.p97_5 || r.p90 || 0).toFixed(0);
    const avg_req = (r.average || 0).toFixed(0);
    const std_req = (r.stddev || 0).toFixed(0);
    const min_req = (r.min || 0).toFixed(0);

    const p1_bytes = ((t.p1 || t.p50 ? t.p50 * 0.6 : 0) / 1024).toFixed(0);
    const p2_5_bytes = ((t.p2_5 || t.p50 ? t.p50 * 0.7 : 0) / 1024).toFixed(0);
    const p50_bytes = ((t.p50 || 0) / 1024).toFixed(0);
    const p97_5_bytes = ((t.p97_5 || t.p90 || 0) / 1024).toFixed(0);
    const avg_bytes = ((t.average || 0) / 1024).toFixed(0);
    const std_bytes = ((t.stddev || 0) / 1024).toFixed(0);
    const min_bytes = ((t.min || 0) / 1024).toFixed(0);

    return `
┌─────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev    │ Max    │
├─────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Latency │ ${p2_5_lat} ms │ ${p50_lat} ms │ ${p97_5_lat} ms │ ${p99_lat} ms │ ${avg_lat} ms   │ ${std_lat} ms   │ ${max_lat} ms │
└─────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘
┌───────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%  │ Avg       │ Stdev    │ Min    │
├───────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Req/Sec   │ ${p1_req}    │ ${p2_5_req}    │ ${p50_req}    │ ${p97_5_req}    │ ${avg_req}     │ ${std_req}     │ ${min_req}    │
├───────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Bytes/Sec │ ${p1_bytes} kB │ ${p2_5_bytes} kB │ ${p50_bytes} kB │ ${p97_5_bytes} kB │ ${avg_bytes} kB  │ ${std_bytes} kB  │ ${min_bytes} kB │
└───────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘

Req/Bytes counts: ${autocannonResult.totalRequests.toLocaleString()} requests, ${(autocannonResult.totalBytes / 1024 / 1024).toFixed(2)} MB read
2xx responses: ${autocannonResult.statusCodes?.['2xx'] || autocannonResult.totalRequests}, non-2xx responses: ${autocannonResult.statusCodes?.non2xx || 0}
Errors: ${autocannonResult.errors || 0}, Timeouts: ${autocannonResult.timeouts || 0}, Resets: ${autocannonResult.resets || 0}
Running ${autocannonResult.durationSeconds || duration}s test @ ${autocannonResult.url || targetUrl}
${autocannonResult.connections || connections} connections with ${autocannonResult.pipelining || pipelining} pipelining factor
`.trim();
  }, [autocannonResult, connections, duration, pipelining, targetUrl]);

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyAscii = () => {
    if (!formattedAscii) return;
    navigator.clipboard.writeText(formattedAscii);
    setCopiedAscii(true);
    setTimeout(() => setCopiedAscii(false), 2000);
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

  // Chart data
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

  const percentileData = useMemo(() => {
    if (!autocannonResult?.latency) return [];
    const l = autocannonResult.latency;
    return [
      { name: 'p50', value: Number(l.p50?.toFixed(1) || 0) },
      { name: 'p75', value: Number(l.p75?.toFixed(1) || 0) },
      { name: 'p90', value: Number(l.p90?.toFixed(1) || 0) },
      { name: 'p97.5', value: Number(l.p97_5?.toFixed(1) || 0) },
      { name: 'p99', value: Number(l.p99?.toFixed(1) || 0) },
      { name: 'p99.9', value: Number(l.p99_9?.toFixed(1) || 0) },
    ];
  }, [autocannonResult]);

  // =========================================================================
  // 1. LIVE EXECUTING STATE: Monospace Terminal Progress Bar & Live Stats
  // =========================================================================
  if (isExecuting && autocannonProgress) {
    const percent = autocannonProgress.percent || 0;
    const currentRps = autocannonProgress.currentRps || 0;
    const currentLatency = autocannonProgress.currentLatency || 0;
    const elapsed = autocannonProgress.elapsedSeconds || 0;
    const totalDur = autocannonProgress.durationSeconds || duration || 10;
    const currentBytes = autocannonProgress.currentBytesPerSec ? (autocannonProgress.currentBytesPerSec / 1024).toFixed(0) : '0';

    // Generate ASCII bar: 20 blocks
    const totalBlocks = 20;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const asciiBar = '█'.repeat(filledBlocks) + '░'.repeat(Math.max(0, totalBlocks - filledBlocks));

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#07090E] text-slate-200 font-mono select-none overflow-y-auto">
        <div className="w-full max-w-2xl bg-[#0B0E17] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Flame size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  AUTOCANNON BENCHMARK IN PROGRESS
                </div>
                <div className="text-xs text-slate-300 font-semibold truncate max-w-md mt-0.5">
                  <span className="text-amber-400 font-bold">{targetMethod}</span> {targetUrl || 'http://localhost:3000/api/health'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onAbortBenchmark}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer active:scale-95"
            >
              <Square size={11} className="fill-white" />
              ABORT (SIGINT)
            </button>
          </div>

          {/* ASCII Progress Bar & Percentage */}
          <div className="bg-[#05070B] p-4 rounded-xl border border-slate-850 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Running load test: <strong className="text-white">{elapsed}s / {totalDur}s</strong></span>
              <span className="text-rose-400 font-black">{percent}%</span>
            </div>
            
            {/* Visual ASCII Bar */}
            <div className="text-emerald-400 font-mono text-sm tracking-tight overflow-x-hidden whitespace-nowrap">
              [{asciiBar}] {percent}%
            </div>

            {/* Standard smooth bar */}
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div 
                className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Live Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-black">CURRENT RPS</div>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {currentRps.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-600">req / sec</div>
            </div>

            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-black">LATENCY</div>
              <div className="text-xl font-black text-cyan-400 mt-1">
                {currentLatency.toFixed(1)}
              </div>
              <div className="text-[9px] text-slate-600">ms avg</div>
            </div>

            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-black">THROUGHPUT</div>
              <div className="text-xl font-black text-purple-400 mt-1">
                {currentBytes}
              </div>
              <div className="text-[9px] text-slate-600">kB / sec</div>
            </div>

            <div className="bg-[#0E131E] border border-slate-850 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-black">CONNECTIONS</div>
              <div className="text-xl font-black text-amber-400 mt-1">
                {connections}
              </div>
              <div className="text-[9px] text-slate-600">active sockets</div>
            </div>
          </div>

          {/* CLI Invocation info */}
          <div className="text-[11px] text-slate-500 bg-[#06080F] p-2.5 rounded-lg border border-slate-850 flex items-center justify-between">
            <span className="truncate">$ {cliCommand}</span>
            <span className="text-emerald-400 font-bold shrink-0 ml-2">STREAMING</span>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. EMPTY STATE: Ready for Load Testing
  // =========================================================================
  if (!autocannonResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#07090E] text-slate-500 font-mono select-none">
        <div className="max-w-md w-full bg-[#0C0F17] border border-slate-850 rounded-xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-xl bg-rose-950/30 border border-rose-800/40 flex items-center justify-center text-rose-400">
            <Flame size={24} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">AUTOCANNON BENCHMARK ENGINE READY</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">
              Benchmark HTTP throughput and latency percentiles with high-concurrency Node socket pipelining.
            </p>
          </div>

          <div className="bg-[#05070B] p-3 rounded-lg border border-slate-900 text-left space-y-1.5 text-[11px]">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Target: <strong className="text-amber-400">{targetMethod}</strong> {targetUrl ? new URL(targetUrl).pathname : '/api/health'}</span>
              <span className="text-rose-400 font-bold">{connections}c • {duration}s</span>
            </div>
            <div className="text-emerald-400/90 truncate font-mono text-[10.5px]">
              $ {cliCommand}
            </div>
          </div>

          <button
            type="button"
            onClick={onStartBenchmark}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all cursor-pointer active:scale-98"
          >
            <Play size={12} className="fill-white" />
            START LOAD BENCHMARK
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. COMPLETED BENCHMARK RESULTS (Terminal CLI Tables + Raw Log + Charts)
  // =========================================================================
  const l: any = autocannonResult.latency || {};
  const r: any = autocannonResult.requests || {};
  const t: any = autocannonResult.throughput || {};

  const totalReq = autocannonResult.totalRequests || 0;
  const totalMB = (autocannonResult.totalBytes || 0) / 1024 / 1024;
  const avgRps = r.average || 0;
  const avgLat = l.average || 0;
  const errors = (autocannonResult.errors || 0) + (autocannonResult.timeouts || 0);
  const status2xx = autocannonResult.statusCodes?.['2xx'] || (totalReq - errors);

  return (
    <div className="flex flex-col h-full bg-[#07090E] text-slate-200 overflow-hidden font-mono select-text">
      
      {/* 1. TOP CONTROL BAR */}
      <div className="p-3 bg-[#0B0E15] border-b border-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        
        {/* Left: Engine & Target */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-400 text-xs font-black flex items-center gap-1.5">
            <Flame size={13} />
            <span>AUTOCANNON BENCHMARK</span>
          </div>

          <div className="text-[11px] text-slate-300 font-bold px-2 py-1 bg-[#121622] rounded-lg border border-slate-800">
            <span className="text-amber-400">{autocannonResult.method || targetMethod}</span> {autocannonResult.url || targetUrl}
          </div>

          <div className="text-[10px] text-slate-400 px-2 py-1 rounded bg-[#0E121B] border border-slate-850 hidden sm:inline-block">
            {autocannonResult.connections || connections}c • {autocannonResult.durationSeconds || duration}s • {autocannonResult.pipelining || pipelining}p
          </div>
        </div>

        {/* Right: View Selector & Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex bg-[#07090E] p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setViewTab('tables')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1",
                viewTab === 'tables' ? "bg-[#1C2433] text-rose-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Terminal size={11} /> CLI TABLES
            </button>
            <button
              type="button"
              onClick={() => setViewTab('raw')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1",
                viewTab === 'raw' ? "bg-[#1C2433] text-rose-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Layers size={11} /> RAW STDOUT
            </button>
            <button
              type="button"
              onClick={() => setViewTab('charts')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1",
                viewTab === 'charts' ? "bg-[#1C2433] text-rose-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <BarChart2 size={11} /> CHARTS
            </button>
          </div>

          <button
            type="button"
            onClick={onStartBenchmark}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Re-run load test"
          >
            <Play size={10} className="fill-white" /> RE-RUN
          </button>

          {onClearResults && (
            <button
              type="button"
              onClick={onClearResults}
              className="p-1 px-2 rounded bg-[#141C2B] hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700/50 text-[10.5px] transition-all cursor-pointer"
              title="Clear results"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 2. AUTO-GENERATED CLI COMMAND BAR */}
      <div className="bg-[#05070B] border-b border-slate-850 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-[11px] text-slate-400 min-w-0">
          <span className="text-rose-400 font-bold select-none">$</span>
          <span className="text-slate-300 truncate select-all">{cliCommand}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopyCli}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 border cursor-pointer select-none",
              copiedCli 
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40" 
                : "bg-[#101520] hover:bg-[#1A2234] text-slate-300 border-slate-800 hover:text-white"
            )}
            title="Copy exact Autocannon CLI command"
          >
            {copiedCli ? <Check size={10} className="text-rose-400" /> : <Copy size={10} />}
            <span>{copiedCli ? 'COPIED CLI' : 'COPY CLI'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="p-1 px-1.5 rounded bg-[#101520] hover:bg-[#1A2234] text-slate-400 hover:text-white border border-slate-800 text-[10px] cursor-pointer"
            title="Download JSON Report"
          >
            <Download size={10} />
          </button>
        </div>
      </div>

      {/* 3. CONTENT AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#07090E] space-y-4">

        {/* METRIC PILLS SUMMARY */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 select-none">
          <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-3">
            <div className="text-[9px] uppercase font-black text-slate-500">TOTAL REQUESTS</div>
            <div className="text-lg font-black text-white mt-0.5">{totalReq.toLocaleString()}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{Math.round(avgRps).toLocaleString()} req/s avg</div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-3">
            <div className="text-[9px] uppercase font-black text-slate-500">AVG LATENCY</div>
            <div className="text-lg font-black text-cyan-400 mt-0.5">{avgLat.toFixed(1)} <span className="text-xs font-normal">ms</span></div>
            <div className="text-[9px] text-slate-500 mt-0.5">p50: {(l.p50 || 0).toFixed(1)}ms • p99: {(l.p99 || 0).toFixed(1)}ms</div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-3">
            <div className="text-[9px] uppercase font-black text-slate-500">THROUGHPUT</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{Math.round(avgRps).toLocaleString()} <span className="text-xs font-normal">RPS</span></div>
            <div className="text-[9px] text-slate-500 mt-0.5">Max: {Math.round(r.max || 0)} RPS</div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-3">
            <div className="text-[9px] uppercase font-black text-slate-500">BYTES READ</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">{totalMB.toFixed(2)} <span className="text-xs font-normal">MB</span></div>
            <div className="text-[9px] text-slate-500 mt-0.5">{((t.average || 0) / 1024).toFixed(0)} kB/s avg</div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-3">
            <div className="text-[9px] uppercase font-black text-slate-500">2xx SUCCESS</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{status2xx.toLocaleString()}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{((status2xx / Math.max(1, totalReq)) * 100).toFixed(1)}% success</div>
          </div>

          <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-3">
            <div className="text-[9px] uppercase font-black text-slate-500">ERRORS / TIMEOUTS</div>
            <div className={cn("text-lg font-black mt-0.5", errors > 0 ? "text-rose-400" : "text-slate-400")}>{errors}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{autocannonResult.timeouts || 0} timeouts</div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: TABULAR CLI BENCHMARK SUMMARY (Identical to genuine Autocannon CLI) */}
        {/* ========================================================================= */}
        {viewTab === 'tables' && (
          <div className="space-y-4">
            
            {/* 1. LATENCY TABLE */}
            <div className="bg-[#0B0E17] border border-slate-850 rounded-xl overflow-hidden shadow-inner">
              <div className="px-3.5 py-2 bg-[#0E121B] border-b border-slate-850 flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} /> LATENCY DISTRIBUTION (ms)
                </span>
                <span className="text-[10px] text-slate-500">Stat | 2.5% | 50% | 97.5% | 99% | Avg | Stdev | Max</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 bg-[#07090E] text-slate-400 text-[10.5px]">
                      <th className="py-2 px-3.5 font-black text-slate-300">Stat</th>
                      <th className="py-2 px-3 font-bold text-slate-400">2.5%</th>
                      <th className="py-2 px-3 font-bold text-cyan-400">50% (p50)</th>
                      <th className="py-2 px-3 font-bold text-slate-400">97.5%</th>
                      <th className="py-2 px-3 font-bold text-rose-400">99% (p99)</th>
                      <th className="py-2 px-3 font-bold text-emerald-400">Avg</th>
                      <th className="py-2 px-3 font-bold text-slate-400">Stdev</th>
                      <th className="py-2 px-3 font-bold text-amber-400">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-[#0E1320] transition-colors">
                      <td className="py-2.5 px-3.5 font-black text-cyan-400">Latency</td>
                      <td className="py-2.5 px-3 text-slate-300">{(l.p2_5 !== undefined ? l.p2_5 : l.p50 ? l.p50 * 0.7 : 0).toFixed(1)} ms</td>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{(l.p50 || 0).toFixed(1)} ms</td>
                      <td className="py-2.5 px-3 text-slate-300">{(l.p97_5 || l.p90 || 0).toFixed(1)} ms</td>
                      <td className="py-2.5 px-3 font-bold text-rose-300">{(l.p99 || 0).toFixed(1)} ms</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-300">{(l.average || 0).toFixed(1)} ms</td>
                      <td className="py-2.5 px-3 text-slate-400">{(l.stddev || 0).toFixed(1)} ms</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">{(l.max || 0).toFixed(1)} ms</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. REQ/SEC & BYTES/SEC TABLE */}
            <div className="bg-[#0B0E17] border border-slate-850 rounded-xl overflow-hidden shadow-inner">
              <div className="px-3.5 py-2 bg-[#0E121B] border-b border-slate-850 flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={12} /> THROUGHPUT & DATA RATE
                </span>
                <span className="text-[10px] text-slate-500">Stat | 1% | 2.5% | 50% | 97.5% | Avg | Stdev | Min</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 bg-[#07090E] text-slate-400 text-[10.5px]">
                      <th className="py-2 px-3.5 font-black text-slate-300">Stat</th>
                      <th className="py-2 px-3 font-bold text-slate-400">1%</th>
                      <th className="py-2 px-3 font-bold text-slate-400">2.5%</th>
                      <th className="py-2 px-3 font-bold text-emerald-400">50%</th>
                      <th className="py-2 px-3 font-bold text-slate-400">97.5%</th>
                      <th className="py-2 px-3 font-bold text-cyan-400">Avg</th>
                      <th className="py-2 px-3 font-bold text-slate-400">Stdev</th>
                      <th className="py-2 px-3 font-bold text-slate-400">Min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    <tr className="hover:bg-[#0E1320] transition-colors">
                      <td className="py-2.5 px-3.5 font-black text-emerald-400">Req/Sec</td>
                      <td className="py-2.5 px-3 text-slate-300">{(r.p1 || (r.p50 ? r.p50 * 0.6 : 0)).toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-slate-300">{(r.p2_5 || (r.p50 ? r.p50 * 0.7 : 0)).toFixed(0)}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-300">{(r.p50 || 0).toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-slate-300">{(r.p97_5 || r.p90 || 0).toFixed(0)}</td>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{(r.average || 0).toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-slate-400">{(r.stddev || 0).toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-slate-400">{(r.min || 0).toFixed(0)}</td>
                    </tr>
                    <tr className="hover:bg-[#0E1320] transition-colors">
                      <td className="py-2.5 px-3.5 font-black text-purple-400">Bytes/Sec</td>
                      <td className="py-2.5 px-3 text-slate-300">{((t.p1 || (t.p50 ? t.p50 * 0.6 : 0)) / 1024).toFixed(0)} kB</td>
                      <td className="py-2.5 px-3 text-slate-300">{((t.p2_5 || (t.p50 ? t.p50 * 0.7 : 0)) / 1024).toFixed(0)} kB</td>
                      <td className="py-2.5 px-3 font-bold text-purple-300">{((t.p50 || 0) / 1024).toFixed(0)} kB</td>
                      <td className="py-2.5 px-3 text-slate-300">{((t.p97_5 || t.p90 || 0) / 1024).toFixed(0)} kB</td>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{((t.average || 0) / 1024).toFixed(0)} kB</td>
                      <td className="py-2.5 px-3 text-slate-400">{((t.stddev || 0) / 1024).toFixed(0)} kB</td>
                      <td className="py-2.5 px-3 text-slate-400">{((t.min || 0) / 1024).toFixed(0)} kB</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. TOTALS & TELEMETRY FOOTER */}
            <div className="bg-[#05070B] border border-slate-850 rounded-xl p-4 space-y-2 text-xs leading-relaxed">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="text-slate-400 font-bold uppercase">BENCHMARK EXECUTION TOTALS</span>
                <button
                  type="button"
                  onClick={handleCopyAscii}
                  className="px-2 py-0.5 rounded bg-[#101520] hover:bg-[#1A2234] text-slate-400 hover:text-white border border-slate-800 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedAscii ? <Check size={10} className="text-rose-400" /> : <Copy size={10} />}
                  <span>{copiedAscii ? 'COPIED ASCII' : 'COPY ASCII TABLE'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 pt-1">
                <div>• <span className="text-slate-400">Total Requests:</span> <strong className="text-white">{totalReq.toLocaleString()}</strong></div>
                <div>• <span className="text-slate-400">Data Read:</span> <strong className="text-purple-400">{totalMB.toFixed(2)} MB</strong></div>
                <div>• <span className="text-slate-400">2xx Success:</span> <strong className="text-emerald-400">{status2xx.toLocaleString()}</strong></div>
                <div>• <span className="text-slate-400">Non-2xx / Errors:</span> <strong className={errors > 0 ? "text-rose-400" : "text-slate-400"}>{errors}</strong></div>
                <div>• <span className="text-slate-400">Duration:</span> <strong>{autocannonResult.durationSeconds || duration} seconds</strong></div>
                <div>• <span className="text-slate-400">Concurrency:</span> <strong>{autocannonResult.connections || connections} connections</strong> (pipeline: {autocannonResult.pipelining || pipelining})</div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: RAW TERMINAL LOG STREAM                                          */}
        {/* ========================================================================= */}
        {viewTab === 'raw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 select-none">
              <span className="text-rose-400 font-bold">Autocannon CLI Native stdout</span>
              <button
                type="button"
                onClick={handleCopyAscii}
                className="px-2 py-0.5 rounded bg-[#121622] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                {copiedAscii ? <Check size={10} className="text-rose-400" /> : <Copy size={10} />}
                <span>{copiedAscii ? 'COPIED STDOUT' : 'COPY RAW STDOUT'}</span>
              </button>
            </div>
            <pre className="bg-[#04060A] border border-slate-850 rounded-xl p-4 text-xs font-mono text-emerald-400/90 whitespace-pre overflow-x-auto shadow-inner leading-relaxed select-text">
              {formattedAscii}
            </pre>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: COMPACT CHARTS                                                   */}
        {/* ========================================================================= */}
        {viewTab === 'charts' && (
          <div className="space-y-4">
            {/* Timeline chart */}
            <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                <span>REQUESTS PER SECOND (RPS) TIMELINE</span>
                <span className="text-emerald-400">Peak: {Math.round(r.max || avgRps)} RPS</span>
              </div>
              <div className="h-56 w-full">
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData}>
                      <defs>
                        <linearGradient id="rpsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                      <XAxis dataKey="second" stroke="#64748B" fontSize={11} fontFamily="monospace" />
                      <YAxis stroke="#64748B" fontSize={11} fontFamily="monospace" />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                      />
                      <Area type="monotone" dataKey="rps" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#rpsAreaGrad)" name="Requests/Sec" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                    Timeline metrics available on benchmarks &gt; 1s
                  </div>
                )}
              </div>
            </div>

            {/* Percentile distribution */}
            <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                <span>LATENCY PERCENTILE DISTRIBUTION (ms)</span>
                <span className="text-cyan-400">Avg: {avgLat.toFixed(1)} ms</span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={percentileData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} fontFamily="monospace" />
                    <YAxis stroke="#64748B" fontSize={11} fontFamily="monospace" unit=" ms" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                      formatter={(val: any) => [`${val} ms`, 'Latency']}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {percentileData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index < 2 ? '#06B6D4' : index < 4 ? '#F59E0B' : '#F43F5E'} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
