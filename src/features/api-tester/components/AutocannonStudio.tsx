import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Square, RefreshCw, Flame, Gauge, Zap, Activity, Clock, 
  ShieldCheck, AlertTriangle, Layers, Copy, Check, Download, 
  BarChart2, Cpu, HardDrive, Sliders, Terminal, ArrowRight,
  Sparkles, CheckCircle2, XCircle, ChevronDown, Plus, Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip as RechartsTooltip, CartesianGrid, BarChart, Bar, Cell 
} from 'recharts';
import { cn } from '@/lib/utils';
import { Tab, AutocannonBenchmarkResult, AutocannonTickProgress, HttpMethod } from '../types';
import { AutocannonConfig } from '@/server/modules/autocannon-engine';

export interface AutocannonStudioProps {
  activeTab: Tab | null;
  tabs?: Tab[];
  variables?: Record<string, string>;
  onStartAutocannon: (config: AutocannonConfig) => void;
  onAbortAutocannon: () => void;
  isExecuting: boolean;
  autocannonProgress: AutocannonTickProgress['progress'] | null;
  autocannonResult: AutocannonBenchmarkResult | null;
  onSyncFromActiveTab?: () => void;
  onClearResults?: () => void;
  telemetry?: any;
}

interface BenchmarkPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  connections: number;
  duration: number;
  pipelining: number;
  rate?: number;
  color: string;
  borderColor: string;
}

const PRESETS: BenchmarkPreset[] = [
  {
    id: 'smoke',
    name: 'Quick Smoke Test',
    badge: 'BASELINE',
    description: 'Verify endpoint stability and baseline latency under gentle socket pressure.',
    connections: 10,
    duration: 5,
    pipelining: 1,
    color: 'text-cyan-400 bg-cyan-500/10',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/60'
  },
  {
    id: 'sustained',
    name: 'Sustained Concurrency',
    badge: 'STRESS',
    description: 'Simulate sustained real-world load to evaluate thread saturation and connection handling.',
    connections: 50,
    duration: 10,
    pipelining: 1,
    color: 'text-amber-400 bg-amber-500/10',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60'
  },
  {
    id: 'extreme',
    name: 'Extreme Pipelining',
    badge: 'MAX THROUGHPUT',
    description: 'Socket pipelining to measure maximum possible HTTP/1.1 I/O saturation.',
    connections: 100,
    duration: 15,
    pipelining: 4,
    color: 'text-rose-400 bg-rose-500/10',
    borderColor: 'border-rose-500/30 hover:border-rose-500/60'
  },
  {
    id: 'capacity',
    name: 'Peak Capacity Blast',
    badge: 'HEAVY LOAD',
    description: 'High-density concurrent connection blast to detect server connection bottlenecks.',
    connections: 250,
    duration: 20,
    pipelining: 1,
    color: 'text-purple-400 bg-purple-500/10',
    borderColor: 'border-purple-500/30 hover:border-purple-500/60'
  },
  {
    id: 'rate_limit',
    name: 'Rate-Limited Throttle',
    badge: 'RPS CAP',
    description: 'Fixed target rate limit (500 req/sec) to audit pacing and rate limiters.',
    connections: 50,
    duration: 10,
    pipelining: 1,
    rate: 500,
    color: 'text-emerald-400 bg-emerald-500/10',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60'
  }
];

export function AutocannonStudio({
  activeTab,
  variables = {},
  onStartAutocannon,
  onAbortAutocannon,
  isExecuting,
  autocannonProgress,
  autocannonResult,
  onClearResults,
}: AutocannonStudioProps) {
  // Test configuration state
  const [url, setUrl] = useState<string>(activeTab?.config.url || 'http://localhost:3000/api/health');
  const [method, setMethod] = useState<HttpMethod>((activeTab?.config.method as HttpMethod) || 'GET');
  const [connections, setConnections] = useState<number>(50);
  const [duration, setDuration] = useState<number>(10);
  const [pipelining, setPipelining] = useState<number>(1);
  const [rateLimit, setRateLimit] = useState<number | undefined>(undefined);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [timeout, setTimeoutSec] = useState<number>(10);
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'headers' | 'body' | 'cli'>('config');
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);
  const [selectedResultTab, setSelectedResultTab] = useState<'overview' | 'charts' | 'percentiles' | 'ascii'>('overview');

  // Headers and Body state
  const [headersList, setHeadersList] = useState<{ id: string; key: string; value: string }[]>(
    activeTab?.headersList || [{ id: '1', key: 'Content-Type', value: 'application/json' }]
  );
  const [requestBody, setRequestBody] = useState<string>(activeTab?.config.body || '');

  // Keep synced if active tab changes and url was empty
  useEffect(() => {
    if (activeTab?.config.url && (!url || url === 'http://localhost:3000/api/health')) {
      setUrl(activeTab.config.url);
      if (activeTab.config.method) setMethod(activeTab.config.method as HttpMethod);
      if (activeTab.headersList?.length) setHeadersList(activeTab.headersList);
      if (activeTab.config.body) setRequestBody(activeTab.config.body);
    }
  }, [activeTab]);

  const handleImportActiveTab = () => {
    if (!activeTab) return;
    setUrl(activeTab.config.url || 'http://localhost:3000/api/health');
    setMethod((activeTab.config.method as HttpMethod) || 'GET');
    setHeadersList(activeTab.headersList || [{ id: '1', key: 'Content-Type', value: 'application/json' }]);
    setRequestBody(activeTab.config.body || '');
  };

  const handleApplyPreset = (preset: BenchmarkPreset) => {
    setConnections(preset.connections);
    setDuration(preset.duration);
    setPipelining(preset.pipelining);
    if (preset.rate) {
      setIsRateLimited(true);
      setRateLimit(preset.rate);
    } else {
      setIsRateLimited(false);
      setRateLimit(undefined);
    }
  };

  const getResolvedUrl = (rawUrl: string): string => {
    let resolved = rawUrl;
    Object.entries(variables).forEach(([k, v]) => {
      resolved = resolved.replace(new RegExp(`{{${k}}}`, 'g'), v);
    });
    return resolved;
  };

  const handleRun = () => {
    const finalUrl = getResolvedUrl(url.trim());
    if (!finalUrl) return;

    const headersMap: Record<string, string> = {};
    headersList.forEach(h => {
      if (h.key.trim()) {
        let val = h.value;
        Object.entries(variables).forEach(([k, v]) => {
          val = val.replace(new RegExp(`{{${k}}}`, 'g'), v);
        });
        headersMap[h.key.trim()] = val;
      }
    });

    let finalBody = requestBody;
    if (finalBody) {
      Object.entries(variables).forEach(([k, v]) => {
        finalBody = finalBody.replace(new RegExp(`{{${k}}}`, 'g'), v);
      });
    }

    const config: AutocannonConfig = {
      url: finalUrl,
      method,
      headers: headersMap,
      body: (method === 'POST' || method === 'PUT' || method === 'PATCH') ? finalBody : undefined,
      connections,
      duration,
      pipelining,
      rate: isRateLimited && rateLimit ? rateLimit : undefined,
      timeout,
      title: `${method} ${finalUrl}`
    };

    onStartAutocannon(config);
  };

  // Generate equivalent CLI command
  const generatedCliCommand = useMemo(() => {
    const headerFlags = headersList
      .filter(h => h.key.trim())
      .map(h => `-H "${h.key.trim()}: ${h.value}"`)
      .join(' ');
    const rateFlag = isRateLimited && rateLimit ? `--renderStatusCodes --rate ${rateLimit}` : '';
    const bodyFlag = (method === 'POST' || method === 'PUT' || method === 'PATCH') && requestBody ? `-b '${requestBody}'` : '';
    return `autocannon -c ${connections} -d ${duration} -p ${pipelining} -m ${method} ${headerFlags} ${bodyFlag} ${rateFlag} "${url}"`.trim();
  }, [connections, duration, pipelining, method, headersList, requestBody, isRateLimited, rateLimit, url]);

  const handleCopyCli = () => {
    navigator.clipboard.writeText(generatedCliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyAscii = () => {
    if (autocannonResult?.formattedCliOutput) {
      navigator.clipboard.writeText(autocannonResult.formattedCliOutput);
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2000);
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0D14] text-slate-200 overflow-y-auto custom-scrollbar">
      {/* Top Banner Header */}
      <div className="border-b border-slate-850 bg-[#0F131D]/80 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
            <Flame size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-wider text-white uppercase font-mono">
                AUTOCANNON LOAD BENCHMARK STUDIO
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 tracking-wider">
                HTTP/1.1 C-GRADE SPEED
              </span>
            </div>
            <p className="text-xs text-slate-450 mt-0.5">
              High-concurrency HTTP load testing & socket pipelining with real-time HDR histograms — completely managed in UI without terminal commands.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab && (
            <button
              type="button"
              onClick={handleImportActiveTab}
              className="px-3 py-2 rounded-lg text-xs font-mono font-bold bg-[#141C2B] hover:bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:text-white"
              title="Import URL, Method, Headers and Body from active API Client tab"
            >
              <Sparkles size={13} className="text-amber-400" />
              IMPORT ACTIVE TAB
            </button>
          )}

          {isExecuting ? (
            <button
              type="button"
              onClick={onAbortAutocannon}
              className="px-5 py-2.5 rounded-xl text-xs font-mono font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30 cursor-pointer animate-pulse active:scale-95"
            >
              <Square size={14} className="fill-white" />
              ABORT LOAD TEST
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              className="px-6 py-2.5 rounded-xl text-xs font-mono font-black bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white flex items-center gap-2.5 transition-all shadow-lg shadow-rose-500/20 cursor-pointer active:scale-95 border border-rose-400/30"
            >
              <Play size={14} className="fill-white" />
              RUN AUTOCANNON BENCHMARK
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Real-time Execution HUD (Appears during benchmark execution) */}
        <AnimatePresence>
          {isExecuting && autocannonProgress && (
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.98 }}
              className="rounded-2xl bg-gradient-to-br from-[#1A101F] via-[#121624] to-[#0D121F] border-2 border-rose-500/50 p-6 shadow-2xl shadow-rose-500/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 animate-spin">
                    <RefreshCw size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      BENCHMARK IN FLIGHT ({connections} CONNECTIONS • {duration}s)
                    </div>
                    <div className="text-sm font-mono text-slate-200 mt-0.5 truncate max-w-xl">
                      Target: <span className="text-amber-400 font-bold">{method}</span> {url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">ELAPSED TIME</div>
                    <div className="text-xl font-black font-mono text-white">
                      {autocannonProgress.elapsedSeconds}s <span className="text-xs font-normal text-slate-500">/ {autocannonProgress.durationSeconds}s</span>
                    </div>
                  </div>
                  <div className="w-16 text-center">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">PROGRESS</div>
                    <div className="text-xl font-black font-mono text-rose-400">
                      {autocannonProgress.percent}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800/80 rounded-full h-3 mb-6 overflow-hidden p-0.5 border border-slate-700/50">
                <motion.div 
                  className="bg-gradient-to-r from-rose-500 via-orange-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${autocannonProgress.percent}%` }}
                />
              </div>

              {/* Real-time Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 relative z-10">
                <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <Zap size={12} className="text-amber-400" /> REQ / SEC
                  </div>
                  <div className="text-xl font-black font-mono text-white">
                    {autocannonProgress.currentRps > 0 ? Math.round(autocannonProgress.currentRps).toLocaleString() : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Instant Throughput
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <Clock size={12} className="text-cyan-400" /> LATENCY (AVG)
                  </div>
                  <div className="text-xl font-black font-mono text-cyan-300">
                    {autocannonProgress.currentLatency > 0 ? `${autocannonProgress.currentLatency.toFixed(1)} ms` : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Socket Roundtrip
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <HardDrive size={12} className="text-purple-400" /> BYTES / SEC
                  </div>
                  <div className="text-xl font-black font-mono text-purple-300">
                    {autocannonProgress.currentBytesPerSec > 0 ? `${(autocannonProgress.currentBytesPerSec / 1024).toFixed(0)} kB/s` : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Data Transfer Rate
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <CheckCircle2 size={12} className="text-emerald-400" /> HTTP 2xx
                  </div>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    {autocannonProgress.status2xx.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Successful Responses
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <AlertTriangle size={12} className="text-amber-400" /> 4xx / 5xx
                  </div>
                  <div className="text-xl font-black font-mono text-amber-400">
                    {(autocannonProgress.status4xx + autocannonProgress.status5xx).toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Client/Server Errors
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <XCircle size={12} className="text-rose-400" /> TIMEOUTS
                  </div>
                  <div className="text-xl font-black font-mono text-rose-400">
                    {autocannonProgress.timeouts.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Dropped / Resets
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Grid: Left Side Config & Presets, Right Side Live Dashboard/Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT PANEL: Presets & Benchmark Configuration (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Quick Presets Carousel */}
            <div className="bg-[#0F131D] border border-slate-850 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-mono font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Layers size={14} className="text-rose-400" /> 1-CLICK BENCHMARK PRESETS
                </h2>
                <span className="text-[10px] font-mono text-slate-500">QUICK CONCURRENCY</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer bg-[#141A29]/60 hover:bg-[#1A2236] group relative overflow-hidden",
                      connections === preset.connections && duration === preset.duration && pipelining === preset.pipelining
                        ? "border-rose-500 bg-rose-500/10 shadow-md shadow-rose-500/10"
                        : preset.borderColor
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-black font-mono uppercase tracking-wider", preset.color)}>
                        {preset.badge}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {preset.connections}c • {preset.duration}s {preset.pipelining > 1 ? `• p${preset.pipelining}` : ''}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-bold text-white group-hover:text-rose-300 transition-colors">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-slate-450 mt-1 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Endpoint & Advanced Controls */}
            <div className="bg-[#0F131D] border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h2 className="text-xs font-mono font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Sliders size={14} className="text-cyan-400" /> TARGET & LOAD PARAMETERS
                </h2>
                <span className="text-[10px] font-mono text-emerald-400">AUTOCANNON v8.0</span>
              </div>

              {/* URL & Method Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  TARGET URL
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-750 bg-[#0A0D14] shadow-inner focus-within:border-rose-500 transition-colors">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as HttpMethod)}
                    className="bg-[#141C2B] text-amber-400 font-mono font-black text-xs px-3.5 py-2.5 outline-none border-r border-slate-750 cursor-pointer"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://localhost:3000/api/health or {{BASE_URL}}/orders"
                    className="w-full bg-transparent px-3 py-2.5 text-xs font-mono text-slate-200 outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Slider 1: Concurrent Connections */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={13} className="text-rose-400" /> CONCURRENT CONNECTIONS:
                  </span>
                  <span className="text-xs font-mono font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                    {connections} Sockets
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="5"
                  value={connections}
                  onChange={(e) => setConnections(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between gap-1 text-[9px] font-mono text-slate-500">
                  <button type="button" onClick={() => setConnections(10)} className="hover:text-rose-400">10 (Smoke)</button>
                  <button type="button" onClick={() => setConnections(50)} className="hover:text-rose-400">50 (Medium)</button>
                  <button type="button" onClick={() => setConnections(100)} className="hover:text-rose-400">100 (Stress)</button>
                  <button type="button" onClick={() => setConnections(250)} className="hover:text-rose-400">250 (High)</button>
                  <button type="button" onClick={() => setConnections(500)} className="hover:text-rose-400">500 (Max)</button>
                </div>
              </div>

              {/* Slider 2: Test Duration */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={13} className="text-cyan-400" /> TEST DURATION:
                  </span>
                  <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                    {duration} Seconds
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between gap-1 text-[9px] font-mono text-slate-500">
                  <button type="button" onClick={() => setDuration(5)} className="hover:text-cyan-400">5s (Rapid)</button>
                  <button type="button" onClick={() => setDuration(10)} className="hover:text-cyan-400">10s (Standard)</button>
                  <button type="button" onClick={() => setDuration(20)} className="hover:text-cyan-400">20s (Extended)</button>
                  <button type="button" onClick={() => setDuration(30)} className="hover:text-cyan-400">30s (Heavy)</button>
                  <button type="button" onClick={() => setDuration(60)} className="hover:text-cyan-400">60s (Soak)</button>
                </div>
              </div>

              {/* Slider 3: HTTP Pipelining Factor */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} className="text-purple-400" /> HTTP PIPELINING FACTOR:
                  </span>
                  <span className="text-xs font-mono font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                    {pipelining}x factor
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  step="1"
                  value={pipelining}
                  onChange={(e) => setPipelining(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="text-[9px] text-slate-500">
                  Allows sending multiple HTTP requests without waiting for the corresponding responses.
                </div>
              </div>

              {/* Optional Rate Limiter & Timeout */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850/80">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>RATE LIMIT (RPS)</span>
                    <input 
                      type="checkbox" 
                      checked={isRateLimited} 
                      onChange={(e) => setIsRateLimited(e.target.checked)}
                      className="accent-emerald-500 cursor-pointer"
                    />
                  </label>
                  <input
                    type="number"
                    disabled={!isRateLimited}
                    value={rateLimit || ''}
                    onChange={(e) => setRateLimit(Number(e.target.value) || undefined)}
                    placeholder="Unlimited"
                    className="w-full bg-[#0A0D14] border border-slate-750 disabled:opacity-40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    TIMEOUT (SEC)
                  </label>
                  <input
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeoutSec(Number(e.target.value) || 10)}
                    className="w-full bg-[#0A0D14] border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Sub-tabs for Headers / Body / CLI command preview */}
              <div className="pt-2">
                <div className="flex border-b border-slate-800 text-[11px] font-mono font-bold gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('headers')}
                    className={cn(
                      "px-3 py-1.5 border-b-2 cursor-pointer transition-colors",
                      activeSubTab === 'headers' ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    HEADERS ({headersList.filter(h => h.key.trim()).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('body')}
                    className={cn(
                      "px-3 py-1.5 border-b-2 cursor-pointer transition-colors",
                      activeSubTab === 'body' ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    PAYLOAD BODY
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('cli')}
                    className={cn(
                      "px-3 py-1.5 border-b-2 cursor-pointer transition-colors",
                      activeSubTab === 'cli' ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    CLI EQUIVALENT
                  </button>
                </div>

                <div className="pt-3">
                  {activeSubTab === 'headers' && (
                    <div className="space-y-2">
                      {headersList.map((h, idx) => (
                        <div key={h.id} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Header Key (e.g. Authorization)"
                            value={h.key}
                            onChange={(e) => {
                              const next = [...headersList];
                              next[idx].key = e.target.value;
                              setHeadersList(next);
                            }}
                            className="w-1/2 bg-[#0A0D14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-rose-500"
                          />
                          <input
                            type="text"
                            placeholder="Header Value"
                            value={h.value}
                            onChange={(e) => {
                              const next = [...headersList];
                              next[idx].value = e.target.value;
                              setHeadersList(next);
                            }}
                            className="w-1/2 bg-[#0A0D14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-rose-500"
                          />
                          <button
                            type="button"
                            onClick={() => setHeadersList(headersList.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                            title="Remove Header"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setHeadersList([...headersList, { id: Date.now().toString(), key: '', value: '' }])}
                        className="text-[10px] font-mono font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 pt-1 cursor-pointer"
                      >
                        <Plus size={12} /> ADD HEADER
                      </button>
                    </div>
                  )}

                  {activeSubTab === 'body' && (
                    <div className="space-y-1.5">
                      <textarea
                        rows={4}
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        placeholder='{ "amount": 10, "userId": "usr_99" }'
                        className="w-full bg-[#0A0D14] border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 outline-none focus:border-rose-500 resize-y"
                      />
                      <div className="text-[10px] text-slate-500 font-mono">
                        Sent on POST, PUT, and PATCH benchmark requests.
                      </div>
                    </div>
                  )}

                  {activeSubTab === 'cli' && (
                    <div className="space-y-2">
                      <div className="relative group">
                        <pre className="bg-[#0A0D14] p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap select-all">
                          {generatedCliCommand}
                        </pre>
                        <button
                          type="button"
                          onClick={handleCopyCli}
                          className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer shadow transition-all"
                        >
                          {copiedCli ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          {copiedCli ? 'COPIED' : 'COPY'}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-450 font-mono leading-relaxed">
                        HyperCurl runs this exact benchmarking logic natively inside its server runtime, eliminating the need to install or run terminal tools manually.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Benchmark Analytics & Results Dashboard (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {autocannonResult ? (
              <div className="bg-[#0F131D] border border-slate-850 rounded-2xl p-6 shadow-xl space-y-6">
                
                {/* Result Header & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-850 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h2 className="text-sm font-mono font-black text-white uppercase tracking-wider">
                        BENCHMARK COMPLETED
                      </h2>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                        {autocannonResult.durationSeconds}s DURATION
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1 truncate max-w-lg">
                      <span className="text-amber-400 font-bold">{autocannonResult.method}</span> {autocannonResult.url}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onClearResults && (
                      <button
                        type="button"
                        onClick={onClearResults}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#141C2B] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-750 hover:border-rose-800/50 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                        title="Clear benchmark results"
                      >
                        <Trash2 size={13} /> CLEAR
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#141C2B] hover:bg-slate-800 text-slate-300 border border-slate-750 flex items-center gap-1.5 cursor-pointer hover:text-white transition-all shadow-sm"
                    >
                      <Download size={13} /> JSON REPORT
                    </button>
                    <button
                      type="button"
                      onClick={handleRun}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                    >
                      <RefreshCw size={13} /> RE-RUN
                    </button>
                  </div>
                </div>

                {/* Primary KPI Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-xl bg-[#141A29]/70 border border-slate-800/80 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-450 uppercase tracking-wider mb-1">
                      <span>TOTAL REQUESTS</span>
                      <Activity size={13} className="text-cyan-400" />
                    </div>
                    <div className="text-2xl font-black font-mono text-white">
                      {autocannonResult.totalRequests.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-cyan-400 mt-1">
                      {autocannonResult.durationSeconds > 0 ? `${(autocannonResult.totalRequests / autocannonResult.durationSeconds).toFixed(0)} req/s avg` : ''}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#141A29]/70 border border-slate-800/80 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-450 uppercase tracking-wider mb-1">
                      <span>AVG THROUGHPUT</span>
                      <Zap size={13} className="text-amber-400" />
                    </div>
                    <div className="text-2xl font-black font-mono text-amber-300">
                      {Math.round(autocannonResult.requests.average).toLocaleString()} <span className="text-xs font-normal text-slate-450">RPS</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      Max: {Math.round(autocannonResult.requests.max).toLocaleString()} RPS
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#141A29]/70 border border-slate-800/80 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-450 uppercase tracking-wider mb-1">
                      <span>AVG LATENCY</span>
                      <Clock size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-400">
                      {autocannonResult.latency.average.toFixed(1)} <span className="text-xs font-normal text-slate-450">ms</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      Min {autocannonResult.latency.min.toFixed(1)}ms • Max {autocannonResult.latency.max.toFixed(1)}ms
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#141A29]/70 border border-slate-800/80 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-450 uppercase tracking-wider mb-1">
                      <span>99TH PERCENTILE (P99)</span>
                      <Gauge size={13} className="text-rose-400" />
                    </div>
                    <div className="text-2xl font-black font-mono text-rose-400">
                      {autocannonResult.latency.p99.toFixed(1)} <span className="text-xs font-normal text-slate-450">ms</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      p90: {autocannonResult.latency.p90.toFixed(1)}ms • p99.9: {autocannonResult.latency.p99_9.toFixed(1)}ms
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#141A29]/70 border border-slate-800/80 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-450 uppercase tracking-wider mb-1">
                      <span>DATA TRANSFERRED</span>
                      <HardDrive size={13} className="text-purple-400" />
                    </div>
                    <div className="text-2xl font-black font-mono text-purple-300">
                      {(autocannonResult.totalBytes / 1024 / 1024).toFixed(2)} <span className="text-xs font-normal text-slate-450">MB</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      {((autocannonResult.throughput.average || 0) / 1024).toFixed(0)} kB/s avg
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#141A29]/70 border border-slate-800/80 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-450 uppercase tracking-wider mb-1">
                      <span>SUCCESS RATE</span>
                      <ShieldCheck size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-400">
                      {autocannonResult.totalRequests > 0 
                        ? `${((autocannonResult.statusCodes['2xx'] / autocannonResult.totalRequests) * 100).toFixed(1)}%`
                        : '0%'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      {autocannonResult.statusCodes['2xx']} ok • {autocannonResult.errors} errors
                    </div>
                  </div>
                </div>

                {/* Result Section Tabs (Overview Charts, Percentile Histogram, Terminal Output) */}
                <div className="border-b border-slate-800 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedResultTab('overview')}
                    className={cn(
                      "px-3.5 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5",
                      selectedResultTab === 'overview' ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <BarChart2 size={13} /> TIMELINE TREND
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResultTab('percentiles')}
                    className={cn(
                      "px-3.5 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5",
                      selectedResultTab === 'percentiles' ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Gauge size={13} /> LATENCY HISTOGRAM
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResultTab('ascii')}
                    className={cn(
                      "px-3.5 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5",
                      selectedResultTab === 'ascii' ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Terminal size={13} /> AUTOCANNON ASCII TABLE
                  </button>
                </div>

                {/* Tab Content 1: Timeline Trend Chart */}
                {selectedResultTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="h-64 w-full bg-[#0A0D14] p-4 rounded-xl border border-slate-850">
                      <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>THROUGHPUT (RPS) OVER TIME</span>
                        <span className="text-amber-400">Peak: {Math.round(autocannonResult.requests.max).toLocaleString()} RPS</span>
                      </div>
                      <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={autocannonResult.timeline.length > 0 ? autocannonResult.timeline : [
                          { second: 1, rps: autocannonResult.requests.average, latency: autocannonResult.latency.average, bytes: autocannonResult.throughput.average },
                          { second: autocannonResult.durationSeconds, rps: autocannonResult.requests.average, latency: autocannonResult.latency.average, bytes: autocannonResult.throughput.average }
                        ]}>
                          <defs>
                            <linearGradient id="rpsGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                          <XAxis dataKey="second" stroke="#64748B" tick={{ fontSize: 10, fill: '#64748B' }} unit="s" />
                          <YAxis stroke="#64748B" tick={{ fontSize: 10, fill: '#64748B' }} />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0F131D', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                            formatter={(value: any) => [`${Math.round(Number(value)).toLocaleString()} req/s`, 'Throughput']}
                            labelFormatter={(label) => `Second ${label}s`}
                          />
                          <Area type="monotone" dataKey="rps" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#rpsGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Status Code Breakdown Bar */}
                    <div className="p-4 rounded-xl bg-[#0A0D14] border border-slate-850 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        <span>HTTP STATUS CODE DISTRIBUTION</span>
                        <span>{autocannonResult.totalRequests.toLocaleString()} Total</span>
                      </div>
                      <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-800">
                        {autocannonResult.statusCodes['2xx'] > 0 && (
                          <div 
                            className="bg-emerald-500 h-full"
                            style={{ width: `${(autocannonResult.statusCodes['2xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`2xx: ${autocannonResult.statusCodes['2xx']}`}
                          />
                        )}
                        {autocannonResult.statusCodes['3xx'] > 0 && (
                          <div 
                            className="bg-blue-500 h-full"
                            style={{ width: `${(autocannonResult.statusCodes['3xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`3xx: ${autocannonResult.statusCodes['3xx']}`}
                          />
                        )}
                        {autocannonResult.statusCodes['4xx'] > 0 && (
                          <div 
                            className="bg-amber-500 h-full"
                            style={{ width: `${(autocannonResult.statusCodes['4xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`4xx: ${autocannonResult.statusCodes['4xx']}`}
                          />
                        )}
                        {autocannonResult.statusCodes['5xx'] > 0 && (
                          <div 
                            className="bg-rose-500 h-full"
                            style={{ width: `${(autocannonResult.statusCodes['5xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`5xx: ${autocannonResult.statusCodes['5xx']}`}
                          />
                        )}
                        {autocannonResult.errors > 0 && (
                          <div 
                            className="bg-purple-500 h-full"
                            style={{ width: `${(autocannonResult.errors / autocannonResult.totalRequests) * 100}%` }}
                            title={`Socket Errors: ${autocannonResult.errors}`}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-[10px] font-mono pt-1">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> 2xx: {autocannonResult.statusCodes['2xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-500" /> 3xx: {autocannonResult.statusCodes['3xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-500" /> 4xx: {autocannonResult.statusCodes['4xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-400">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> 5xx: {autocannonResult.statusCodes['5xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-purple-400">
                          <span className="w-2 h-2 rounded-full bg-purple-500" /> Socket Errors: {autocannonResult.errors}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content 2: Latency Histogram Percentiles */}
                {selectedResultTab === 'percentiles' && (
                  <div className="space-y-4">
                    <div className="h-64 w-full bg-[#0A0D14] p-4 rounded-xl border border-slate-850">
                      <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>LATENCY PERCENTILE CURVE (MS)</span>
                        <span className="text-rose-400">p99: {autocannonResult.latency.p99.toFixed(1)} ms</span>
                      </div>
                      <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={autocannonResult.percentiles}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                          <XAxis dataKey="percentile" stroke="#64748B" tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis stroke="#64748B" tick={{ fontSize: 10, fill: '#64748B' }} unit="ms" />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0F131D', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                            formatter={(value: any) => [`${Number(value).toFixed(1)} ms`, 'Latency']}
                          />
                          <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                            {autocannonResult.percentiles.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index >= 5 ? '#f43f5e' : index >= 3 ? '#fbbf24' : '#06b6d4'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {autocannonResult.percentiles.map((p) => (
                        <div key={p.percentile} className="p-2.5 rounded-lg bg-[#0A0D14] border border-slate-800 text-center">
                          <div className="text-[10px] font-mono text-slate-400 uppercase">{p.percentile}</div>
                          <div className="text-sm font-mono font-black text-slate-200 mt-0.5">
                            {p.value.toFixed(1)} ms
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab Content 3: Autocannon ASCII Table */}
                {selectedResultTab === 'ascii' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                      <span>ORIGINAL AUTOCANNON ASCII REPORT:</span>
                      <button
                        type="button"
                        onClick={handleCopyAscii}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer transition-all"
                      >
                        {copiedTable ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        {copiedTable ? 'COPIED TABLE' : 'COPY TABLE'}
                      </button>
                    </div>
                    <pre className="p-4 rounded-xl bg-[#0A0D14] border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                      {autocannonResult.formattedCliOutput}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              /* Empty State / Welcome to Benchmark Studio */
              <div className="bg-[#0F131D] border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[460px]">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/5">
                  <Flame size={32} />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-sm font-mono font-black text-white uppercase tracking-wider">
                    READY FOR HIGH-CONCURRENCY LOAD TESTING
                  </h3>
                  <p className="text-xs text-slate-450 leading-relaxed">
                    Select a 1-click preset on the left or configure custom socket concurrency and pipelining, then click <strong className="text-rose-400">RUN AUTOCANNON BENCHMARK</strong> to test socket throughput in real-time.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyPreset(PRESETS[0]);
                      handleRun();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-2 cursor-pointer transition-all shadow"
                  >
                    <Zap size={13} /> RUN 5s SMOKE TEST
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyPreset(PRESETS[1]);
                      handleRun();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-2 cursor-pointer transition-all shadow"
                  >
                    <Flame size={13} /> RUN 10s 50-CONN STRESS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
