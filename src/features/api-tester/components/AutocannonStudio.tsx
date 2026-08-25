import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Square, RefreshCw, Flame, Gauge, Zap, Activity, Clock, 
  ShieldCheck, AlertTriangle, Layers, Copy, Check, Download, 
  BarChart2, Cpu, HardDrive, Sliders, Terminal, ArrowRight,
  Sparkles, CheckCircle2, XCircle, ChevronDown, Plus, Trash2,
  Share2, Shield, Info, Radio, Database
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
  const [activeSubTab, setActiveSubTab] = useState<'headers' | 'body' | 'cli'>('headers');
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);
  const [selectedResultTab, setSelectedResultTab] = useState<'overview' | 'percentiles' | 'status' | 'ascii'>('overview');

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
    const rateFlag = isRateLimited && rateLimit ? `--rate ${rateLimit}` : '';
    const bodyFlag = (method === 'POST' || method === 'PUT' || method === 'PATCH') && requestBody ? `-b '${requestBody}'` : '';
    return `autocannon -c ${connections} -d ${duration} -p ${pipelining} -m ${method} ${headerFlags} ${bodyFlag} ${rateFlag} "${url}"`.replace(/\s+/g, ' ').trim();
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

  // Method badge colors
  const getMethodBadgeColor = (m: HttpMethod) => {
    switch (m) {
      case 'GET': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'PUT': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'DELETE': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'PATCH': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full autocannon-studio-container text-slate-200 overflow-y-auto custom-scrollbar relative">
      
      {/* Ambient background glow orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Header */}
      <div className="autocannon-header-banner px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-sm transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-rose-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10 shrink-0 autocannon-flame-icon">
            <Flame size={24} className="animate-pulse drop-shadow-md text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base font-black tracking-wider uppercase font-mono autocannon-title">
                AUTOCANNON LOAD BENCHMARK STUDIO
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1.5 shadow-xs autocannon-badge">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                HTTP/1.1 HIGH-THROUGHPUT SOCKETS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 autocannon-subtitle">
              Native high-concurrency load testing & socket pipelining with real-time HDR latency histograms.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeTab && (
            <button
              type="button"
              onClick={handleImportActiveTab}
              className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold autocannon-secondary-btn flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Import URL, Method, Headers and Body from active API Client tab"
            >
              <Sparkles size={14} className="text-amber-500" />
              IMPORT ACTIVE TAB
            </button>
          )}

          {isExecuting ? (
            <button
              type="button"
              onClick={onAbortAutocannon}
              className="px-6 py-2.5 rounded-xl text-xs font-mono font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30 cursor-pointer animate-pulse active:scale-95 border border-rose-400/40"
            >
              <Square size={14} className="fill-white" />
              ABORT BENCHMARK
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              className="px-6 py-2.5 rounded-xl text-xs font-mono font-black bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 flex items-center gap-2.5 transition-all shadow-lg shadow-amber-500/25 cursor-pointer active:scale-95 border border-amber-400/50 font-bold"
            >
              <Play size={14} className="fill-slate-950 text-slate-950" />
              RUN AUTOCANNON BENCHMARK
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-[1680px] mx-auto w-full">
        
        {/* Real-time Execution In-Flight HUD */}
        <AnimatePresence>
          {isExecuting && autocannonProgress && (
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.99 }}
              className="rounded-2xl bg-gradient-to-br from-[#1F1610] via-[#161B28] to-[#0F1422] border-2 border-amber-500/50 p-6 shadow-2xl shadow-amber-500/15 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 animate-spin">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      BENCHMARK IN FLIGHT ({connections} CONNECTIONS • {duration}s)
                    </div>
                    <div className="text-sm font-mono text-slate-200 mt-0.5 truncate max-w-xl flex items-center gap-2">
                      Target: <span className="text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">{method}</span> {url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">ELAPSED TIME</div>
                    <div className="text-2xl font-black font-mono text-white">
                      {autocannonProgress.elapsedSeconds}s <span className="text-xs font-normal text-slate-400">/ {autocannonProgress.durationSeconds}s</span>
                    </div>
                  </div>
                  <div className="w-20 text-center">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">PROGRESS</div>
                    <div className="text-2xl font-black font-mono text-amber-400">
                      {autocannonProgress.percent}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900/90 rounded-full h-3.5 mb-6 overflow-hidden p-0.5 border border-slate-700/60 shadow-inner">
                <motion.div 
                  className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 h-full rounded-full transition-all duration-300 shadow-md"
                  style={{ width: `${autocannonProgress.percent}%` }}
                />
              </div>

              {/* Real-time Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 relative z-10">
                <div className="p-3.5 rounded-xl bg-black/50 border border-slate-800/90">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <Zap size={13} className="text-amber-400" /> REQ / SEC
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-300">
                    {autocannonProgress.currentRps > 0 ? Math.round(autocannonProgress.currentRps).toLocaleString() : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Instant Throughput
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-slate-800/90">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <Clock size={13} className="text-cyan-400" /> LATENCY (AVG)
                  </div>
                  <div className="text-2xl font-black font-mono text-cyan-300">
                    {autocannonProgress.currentLatency > 0 ? `${autocannonProgress.currentLatency.toFixed(1)} ms` : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Socket Roundtrip
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-slate-800/90">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <HardDrive size={13} className="text-purple-400" /> BYTES / SEC
                  </div>
                  <div className="text-2xl font-black font-mono text-purple-300">
                    {autocannonProgress.currentBytesPerSec > 0 ? `${(autocannonProgress.currentBytesPerSec / 1024).toFixed(0)} kB/s` : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Data Transfer Rate
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-slate-800/90">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <CheckCircle2 size={13} className="text-emerald-400" /> HTTP 2xx
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {autocannonProgress.status2xx.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Successful Responses
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-slate-800/90">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <AlertTriangle size={13} className="text-amber-400" /> 4xx / 5xx
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {(autocannonProgress.status4xx + autocannonProgress.status5xx).toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Client/Server Errors
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/50 border border-slate-800/90">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    <XCircle size={13} className="text-rose-400" /> TIMEOUTS
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-400">
                    {autocannonProgress.timeouts.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Dropped / Resets
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT PANEL: Benchmark Configuration (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-[#0F1420] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
                <h2 className="text-xs font-mono font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                  <Sliders size={15} className="text-amber-400" /> TARGET & LOAD PARAMETERS
                </h2>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  AUTOCANNON v8.0
                </span>
              </div>

              {/* URL & Method Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>TARGET URL</span>
                  <span className="text-[10px] text-slate-400 lowercase font-normal">supports {"{{variables}}"}</span>
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-750 bg-[#0A0D14] shadow-inner focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500/20 transition-all">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as HttpMethod)}
                    className={cn(
                      "font-mono font-black text-xs px-3.5 py-2.5 outline-none border-r border-slate-750 cursor-pointer transition-colors",
                      getMethodBadgeColor(method)
                    )}
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
                    className="w-full bg-transparent px-3.5 py-2.5 text-xs font-mono text-slate-100 outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Slider 1: Concurrent Connections */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={14} className="text-rose-400" /> CONCURRENT CONNECTIONS:
                  </span>
                  <span className="text-xs font-mono font-black text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-md border border-rose-500/30 shadow-xs">
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
                  className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {[
                    { val: 10, label: '10 Smoke' },
                    { val: 50, label: '50 Medium' },
                    { val: 100, label: '100 Stress' },
                    { val: 250, label: '250 High' },
                    { val: 500, label: '500 Max' }
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setConnections(p.val)}
                      className={cn(
                        "py-1 rounded text-[9px] font-mono text-center transition-all cursor-pointer border",
                        connections === p.val 
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold" 
                          : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider 2: Test Duration */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={14} className="text-cyan-400" /> TEST DURATION:
                  </span>
                  <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/30 shadow-xs">
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
                  className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {[
                    { val: 5, label: '5s Rapid' },
                    { val: 10, label: '10s Standard' },
                    { val: 20, label: '20s Extended' },
                    { val: 30, label: '30s Heavy' },
                    { val: 60, label: '60s Soak' }
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setDuration(p.val)}
                      className={cn(
                        "py-1 rounded text-[9px] font-mono text-center transition-all cursor-pointer border",
                        duration === p.val 
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold" 
                          : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider 3: HTTP Pipelining Factor */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-purple-400" /> HTTP PIPELINING FACTOR:
                  </span>
                  <span className="text-xs font-mono font-black text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/30 shadow-xs">
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
                  className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="text-[9.5px] text-slate-400 leading-relaxed font-sans">
                  Allows sending multiple HTTP requests on the same TCP socket connection without waiting for individual responses.
                </div>
              </div>

              {/* Optional Rate Limiter & Timeout */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>RATE LIMIT (RPS)</span>
                    <input 
                      type="checkbox" 
                      checked={isRateLimited} 
                      onChange={(e) => setIsRateLimited(e.target.checked)}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </label>
                  <input
                    type="number"
                    disabled={!isRateLimited}
                    value={rateLimit || ''}
                    onChange={(e) => setRateLimit(Number(e.target.value) || undefined)}
                    placeholder="Unlimited"
                    className="w-full bg-[#0A0D14] border border-slate-750 disabled:opacity-40 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                    TIMEOUT (SEC)
                  </label>
                  <input
                    type="number"
                    value={timeout}
                    onChange={(e) => setTimeoutSec(Number(e.target.value) || 10)}
                    className="w-full bg-[#0A0D14] border border-slate-750 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none focus:border-cyan-500"
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
                      "px-3 py-2 border-b-2 cursor-pointer transition-all flex items-center gap-1.5",
                      activeSubTab === 'headers' 
                        ? "border-amber-500 dark:border-amber-400 text-amber-600 dark:text-amber-400 font-black" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    HEADERS ({headersList.filter(h => h.key.trim()).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('body')}
                    className={cn(
                      "px-3 py-2 border-b-2 cursor-pointer transition-all flex items-center gap-1.5",
                      activeSubTab === 'body' 
                        ? "border-amber-500 dark:border-amber-400 text-amber-600 dark:text-amber-400 font-black" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    PAYLOAD BODY
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('cli')}
                    className={cn(
                      "px-3 py-2 border-b-2 cursor-pointer transition-all flex items-center gap-1.5",
                      activeSubTab === 'cli' 
                        ? "border-amber-500 dark:border-amber-400 text-amber-600 dark:text-amber-400 font-black" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    CLI EQUIVALENT
                  </button>
                </div>

                <div className="pt-3.5">
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
                            className="w-1/2 bg-[#0A0D14] border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 outline-none focus:border-amber-500"
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
                            className="w-1/2 bg-[#0A0D14] border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => setHeadersList(headersList.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-rose-400 p-1.5 cursor-pointer rounded hover:bg-rose-500/10 transition-colors"
                            title="Remove Header"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setHeadersList([...headersList, { id: Date.now().toString(), key: '', value: '' }])}
                        className="text-[10px] font-mono font-bold text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 flex items-center gap-1.5 pt-1 cursor-pointer"
                      >
                        <Plus size={13} /> ADD HEADER
                      </button>
                    </div>
                  )}

                  {activeSubTab === 'body' && (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        placeholder='{ "amount": 10, "userId": "usr_99" }'
                        className="w-full bg-[#0A0D14] border border-slate-750 rounded-xl p-3 text-xs font-mono text-slate-100 outline-none focus:border-amber-500 resize-y"
                      />
                      <div className="text-[10px] text-slate-400 font-mono">
                        Sent on POST, PUT, and PATCH benchmark requests.
                      </div>
                    </div>
                  )}

                  {activeSubTab === 'cli' && (
                    <div className="space-y-2.5">
                      <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-[#090C12] cli-terminal-container shadow-sm">
                        <div className="bg-[#121722] px-3 py-1.5 border-b border-slate-800 flex items-center justify-between cli-terminal-topbar">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                            <span className="text-[10px] font-mono text-slate-400 ml-2 font-bold cli-terminal-label">TERMINAL COMMAND</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyCli}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer shadow transition-all"
                          >
                            {copiedCli ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            {copiedCli ? 'COPIED' : 'COPY'}
                          </button>
                        </div>
                        <pre className="p-3.5 font-mono text-xs text-amber-400 dark:text-amber-300 overflow-x-auto whitespace-pre-wrap select-all font-semibold cli-terminal-code leading-relaxed">
                          {generatedCliCommand}
                        </pre>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono leading-relaxed">
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
              <div className="bg-[#0F1420] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-6">
                
                {/* Result Header & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4 autocannon-result-header">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                      <h2 className="text-sm font-mono font-black uppercase tracking-wider autocannon-completed-title text-white">
                        BENCHMARK COMPLETED
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold autocannon-duration-badge bg-slate-800/90 text-slate-200 border border-slate-700">
                        {autocannonResult.durationSeconds}s DURATION
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-300 mt-1.5 truncate max-w-lg flex items-center gap-2 autocannon-completed-url">
                      <span className="text-amber-500 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">{autocannonResult.method}</span>
                      <span className="truncate text-slate-300 autocannon-url-text">{autocannonResult.url}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onClearResults && (
                      <button
                        type="button"
                        onClick={onClearResults}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#141C2B] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-750 hover:border-rose-800/50 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 autocannon-secondary-btn"
                        title="Clear benchmark results"
                      >
                        <Trash2 size={13} /> CLEAR
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#141C2B] hover:bg-slate-800 text-slate-200 border border-slate-750 flex items-center gap-1.5 cursor-pointer hover:text-white transition-all shadow-sm active:scale-95 autocannon-secondary-btn"
                    >
                      <Download size={13} /> JSON REPORT
                    </button>
                    <button
                      type="button"
                      onClick={handleRun}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 autocannon-rerun-btn"
                    >
                      <RefreshCw size={13} /> RE-RUN
                    </button>
                  </div>
                </div>

                {/* Primary KPI Metric Cards (6 Cards with High Contrast) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  
                  {/* Card 1: Total Requests */}
                  <div className="p-4 rounded-xl bg-[#141A28] border border-cyan-500/20 shadow-md relative overflow-hidden group hover:border-cyan-500/40 transition-all autocannon-metric-card">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      <span className="font-semibold">TOTAL REQUESTS</span>
                      <Activity size={14} className="text-cyan-500 dark:text-cyan-400" />
                    </div>
                    <div className="text-3xl font-black font-mono text-white tracking-tight autocannon-val-main">
                      {autocannonResult.totalRequests.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 mt-1 font-semibold flex items-center gap-1">
                      <Zap size={11} />
                      {autocannonResult.durationSeconds > 0 ? `${(autocannonResult.totalRequests / autocannonResult.durationSeconds).toFixed(0)} req/s avg` : ''}
                    </div>
                  </div>

                  {/* Card 2: Avg Throughput */}
                  <div className="p-4 rounded-xl bg-[#141A28] border border-amber-500/20 shadow-md relative overflow-hidden group hover:border-amber-500/40 transition-all autocannon-metric-card">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      <span className="font-semibold">AVG THROUGHPUT</span>
                      <Zap size={14} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <div className="text-3xl font-black font-mono text-amber-500 dark:text-amber-300 tracking-tight autocannon-val-amber">
                      {Math.round(autocannonResult.requests.average).toLocaleString()} <span className="text-xs font-normal text-slate-400">RPS</span>
                    </div>
                    <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400/80 mt-1 font-semibold">
                      Max Peak: {Math.round(autocannonResult.requests.max).toLocaleString()} RPS
                    </div>
                  </div>

                  {/* Card 3: Avg Latency */}
                  <div className="p-4 rounded-xl bg-[#141A28] border border-emerald-500/20 shadow-md relative overflow-hidden group hover:border-emerald-500/40 transition-all autocannon-metric-card">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      <span className="font-semibold">AVG LATENCY</span>
                      <Clock size={14} className="text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div className="text-3xl font-black font-mono text-emerald-500 dark:text-emerald-400 tracking-tight autocannon-val-emerald">
                      {autocannonResult.latency.average.toFixed(1)} <span className="text-xs font-normal text-slate-400">ms</span>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400/80 mt-1 font-semibold">
                      Min {autocannonResult.latency.min.toFixed(1)}ms • Max {autocannonResult.latency.max.toFixed(1)}ms
                    </div>
                  </div>

                  {/* Card 4: 99th Percentile */}
                  <div className="p-4 rounded-xl bg-[#141A28] border border-rose-500/20 shadow-md relative overflow-hidden group hover:border-rose-500/40 transition-all autocannon-metric-card">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      <span className="font-semibold">99TH PERCENTILE (P99)</span>
                      <Gauge size={14} className="text-rose-500 dark:text-rose-400" />
                    </div>
                    <div className="text-3xl font-black font-mono text-rose-500 dark:text-rose-400 tracking-tight autocannon-val-rose">
                      {autocannonResult.latency.p99.toFixed(1)} <span className="text-xs font-normal text-slate-400">ms</span>
                    </div>
                    <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400/80 mt-1 font-semibold">
                      p90: {autocannonResult.latency.p90.toFixed(1)}ms • p99.9: {autocannonResult.latency.p99_9.toFixed(1)}ms
                    </div>
                  </div>

                  {/* Card 5: Data Transferred */}
                  <div className="p-4 rounded-xl bg-[#141A28] border border-purple-500/20 shadow-md relative overflow-hidden group hover:border-purple-500/40 transition-all autocannon-metric-card">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      <span className="font-semibold">DATA TRANSFERRED</span>
                      <HardDrive size={14} className="text-purple-500 dark:text-purple-400" />
                    </div>
                    <div className="text-3xl font-black font-mono text-purple-600 dark:text-purple-300 tracking-tight autocannon-val-purple">
                      {(autocannonResult.totalBytes / 1024 / 1024).toFixed(2)} <span className="text-xs font-normal text-slate-400">MB</span>
                    </div>
                    <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400/80 mt-1 font-semibold">
                      {((autocannonResult.throughput.average || 0) / 1024).toFixed(0)} kB/s avg speed
                    </div>
                  </div>

                  {/* Card 6: Success Rate */}
                  <div className="p-4 rounded-xl bg-[#141A28] border border-emerald-500/20 shadow-md relative overflow-hidden group hover:border-emerald-500/40 transition-all autocannon-metric-card">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      <span className="font-semibold">SUCCESS RATE</span>
                      <ShieldCheck size={14} className="text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div className={cn(
                      "text-3xl font-black font-mono tracking-tight",
                      autocannonResult.totalRequests > 0 && ((autocannonResult.statusCodes['2xx'] / autocannonResult.totalRequests) * 100) >= 95
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}>
                      {autocannonResult.totalRequests > 0 
                        ? `${((autocannonResult.statusCodes['2xx'] / autocannonResult.totalRequests) * 100).toFixed(1)}%`
                        : '0%'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 font-semibold">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{autocannonResult.statusCodes['2xx']} ok</span> • <span className="text-rose-600 dark:text-rose-400 font-bold">{autocannonResult.errors} errors</span>
                    </div>
                  </div>
                </div>

                {/* Result Section Tabs */}
                <div className="border-b border-slate-800 flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedResultTab('overview')}
                    className={cn(
                      "px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5",
                      selectedResultTab === 'overview' 
                        ? "border-amber-400 text-amber-400 font-black" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <BarChart2 size={14} /> TIMELINE TREND
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResultTab('percentiles')}
                    className={cn(
                      "px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5",
                      selectedResultTab === 'percentiles' 
                        ? "border-amber-400 text-amber-400 font-black" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Gauge size={14} /> LATENCY HISTOGRAM
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResultTab('status')}
                    className={cn(
                      "px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5",
                      selectedResultTab === 'status' 
                        ? "border-amber-400 text-amber-400 font-black" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Shield size={14} /> STATUS CODES
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedResultTab('ascii')}
                    className={cn(
                      "px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5",
                      selectedResultTab === 'ascii' 
                        ? "border-amber-400 text-amber-400 font-black" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Terminal size={14} /> AUTOCANNON ASCII TABLE
                  </button>
                </div>

                {/* Tab Content 1: Timeline Trend Chart */}
                {selectedResultTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="h-72 w-full bg-[#0A0D14] p-5 rounded-2xl border border-slate-800/90 shadow-inner">
                      <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Activity size={14} className="text-rose-400" /> THROUGHPUT (RPS) OVER TIME
                        </span>
                        <span className="text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px]">
                          PEAK: {Math.round(autocannonResult.requests.max).toLocaleString()} RPS
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={autocannonResult.timeline.length > 0 ? autocannonResult.timeline : [
                          { second: 1, rps: autocannonResult.requests.average, latency: autocannonResult.latency.average, bytes: autocannonResult.throughput.average },
                          { second: autocannonResult.durationSeconds, rps: autocannonResult.requests.average, latency: autocannonResult.latency.average, bytes: autocannonResult.throughput.average }
                        ]}>
                          <defs>
                            <linearGradient id="rpsStudioGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} />
                          <XAxis dataKey="second" stroke="#64748B" tick={{ fontSize: 10, fill: '#94A3B8' }} unit="s" />
                          <YAxis stroke="#64748B" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0F1420', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
                            formatter={(value: any) => [`${Math.round(Number(value)).toLocaleString()} req/s`, 'Throughput']}
                            labelFormatter={(label) => `Elapsed Second: ${label}s`}
                          />
                          <Area type="monotone" dataKey="rps" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#rpsStudioGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Status Code Breakdown Bar */}
                    <div className="p-4 rounded-2xl bg-[#0A0D14] border border-slate-800/90 space-y-2.5 shadow-inner">
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                        <span>HTTP STATUS CODE DISTRIBUTION</span>
                        <span className="text-slate-400 font-semibold">{autocannonResult.totalRequests.toLocaleString()} Total</span>
                      </div>
                      <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-slate-850 p-0.5 border border-slate-800">
                        {autocannonResult.statusCodes['2xx'] > 0 && (
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${(autocannonResult.statusCodes['2xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`2xx: ${autocannonResult.statusCodes['2xx']}`}
                          />
                        )}
                        {autocannonResult.statusCodes['3xx'] > 0 && (
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all"
                            style={{ width: `${(autocannonResult.statusCodes['3xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`3xx: ${autocannonResult.statusCodes['3xx']}`}
                          />
                        )}
                        {autocannonResult.statusCodes['4xx'] > 0 && (
                          <div 
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${(autocannonResult.statusCodes['4xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`4xx: ${autocannonResult.statusCodes['4xx']}`}
                          />
                        )}
                        {autocannonResult.statusCodes['5xx'] > 0 && (
                          <div 
                            className="bg-rose-500 h-full rounded-full transition-all"
                            style={{ width: `${(autocannonResult.statusCodes['5xx'] / autocannonResult.totalRequests) * 100}%` }}
                            title={`5xx: ${autocannonResult.statusCodes['5xx']}`}
                          />
                        )}
                        {autocannonResult.errors > 0 && (
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all"
                            style={{ width: `${(autocannonResult.errors / autocannonResult.totalRequests) * 100}%` }}
                            title={`Socket Errors: ${autocannonResult.errors}`}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-[10px] font-mono pt-1">
                        <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> 2xx: {autocannonResult.statusCodes['2xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-blue-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-blue-500" /> 3xx: {autocannonResult.statusCodes['3xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-amber-500" /> 4xx: {autocannonResult.statusCodes['4xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> 5xx: {autocannonResult.statusCodes['5xx']}
                        </span>
                        <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-purple-500" /> Socket Errors: {autocannonResult.errors}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content 2: Latency Histogram Percentiles */}
                {selectedResultTab === 'percentiles' && (
                  <div className="space-y-4">
                    <div className="h-72 w-full bg-[#0A0D14] p-5 rounded-2xl border border-slate-800/90 shadow-inner">
                      <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Gauge size={14} className="text-cyan-400" /> LATENCY PERCENTILE CURVE (MS)
                        </span>
                        <span className="text-rose-400 font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px]">
                          p99: {autocannonResult.latency.p99.toFixed(1)} ms
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={autocannonResult.percentiles}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" opacity={0.6} />
                          <XAxis dataKey="percentile" stroke="#64748B" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                          <YAxis stroke="#64748B" tick={{ fontSize: 10, fill: '#94A3B8' }} unit="ms" />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#0F1420', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
                            formatter={(value: any) => [`${Number(value).toFixed(1)} ms`, 'Latency']}
                          />
                          <Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]}>
                            {autocannonResult.percentiles.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index >= 5 ? '#f43f5e' : index >= 3 ? '#fbbf24' : '#10b981'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {autocannonResult.percentiles.map((p) => (
                        <div key={p.percentile} className="p-3 rounded-xl bg-[#0A0D14] border border-slate-800 text-center shadow-xs">
                          <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">{p.percentile}</div>
                          <div className="text-base font-mono font-black text-slate-100 mt-0.5">
                            {p.value.toFixed(1)} <span className="text-xs text-slate-500 font-normal">ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab Content 3: Status Codes Detailed View */}
                {selectedResultTab === 'status' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <div className="text-[10px] font-mono uppercase font-bold tracking-wider">2xx Success</div>
                        <div className="text-2xl font-black font-mono mt-1 text-emerald-300">
                          {autocannonResult.statusCodes['2xx'].toLocaleString()}
                        </div>
                        <div className="text-[10px] text-emerald-400/80 mt-1 font-mono">
                          {autocannonResult.totalRequests > 0 ? ((autocannonResult.statusCodes['2xx'] / autocannonResult.totalRequests) * 100).toFixed(1) : 0}% of traffic
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                        <div className="text-[10px] font-mono uppercase font-bold tracking-wider">3xx Redirection</div>
                        <div className="text-2xl font-black font-mono mt-1 text-blue-300">
                          {autocannonResult.statusCodes['3xx'].toLocaleString()}
                        </div>
                        <div className="text-[10px] text-blue-400/80 mt-1 font-mono">
                          {autocannonResult.totalRequests > 0 ? ((autocannonResult.statusCodes['3xx'] / autocannonResult.totalRequests) * 100).toFixed(1) : 0}% of traffic
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <div className="text-[10px] font-mono uppercase font-bold tracking-wider">4xx Client Errors</div>
                        <div className="text-2xl font-black font-mono mt-1 text-amber-300">
                          {autocannonResult.statusCodes['4xx'].toLocaleString()}
                        </div>
                        <div className="text-[10px] text-amber-400/80 mt-1 font-mono">
                          {autocannonResult.totalRequests > 0 ? ((autocannonResult.statusCodes['4xx'] / autocannonResult.totalRequests) * 100).toFixed(1) : 0}% of traffic
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                        <div className="text-[10px] font-mono uppercase font-bold tracking-wider">5xx Server Errors</div>
                        <div className="text-2xl font-black font-mono mt-1 text-rose-300">
                          {autocannonResult.statusCodes['5xx'].toLocaleString()}
                        </div>
                        <div className="text-[10px] text-rose-400/80 mt-1 font-mono">
                          {autocannonResult.totalRequests > 0 ? ((autocannonResult.statusCodes['5xx'] / autocannonResult.totalRequests) * 100).toFixed(1) : 0}% of traffic
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#0A0D14] border border-slate-800 space-y-2">
                      <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                        SOCKET INTEGRITY METRICS
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-1 text-center">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Socket Timeouts</span>
                          <p className="text-base font-mono font-bold text-rose-400 mt-0.5">{autocannonResult.timeouts}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">TCP Resets</span>
                          <p className="text-base font-mono font-bold text-purple-400 mt-0.5">{autocannonResult.resets || 0}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Mismatches</span>
                          <p className="text-base font-mono font-bold text-amber-400 mt-0.5">{autocannonResult.mismatches || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content 4: Autocannon ASCII Table */}
                {selectedResultTab === 'ascii' && (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                      <span>ORIGINAL AUTOCANNON ASCII REPORT:</span>
                      <button
                        type="button"
                        onClick={handleCopyAscii}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                      >
                        {copiedTable ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copiedTable ? 'COPIED TABLE' : 'COPY TABLE'}
                      </button>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#080B10]">
                      <div className="bg-[#121622] px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-mono text-slate-400 ml-2 font-bold">RAW TERMINAL REPORT</span>
                        </div>
                      </div>
                      <pre className="p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                        {autocannonResult.formattedCliOutput}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Empty State / Welcome to Benchmark Studio */
              <div className="bg-[#0F1420] border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-5 min-h-[500px] shadow-xl">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-2xl shadow-amber-500/5">
                  <Flame size={40} className="animate-pulse" />
                </div>
                <div className="max-w-lg space-y-2">
                  <h3 className="text-base font-mono font-black text-white uppercase tracking-wider">
                    READY FOR HIGH-CONCURRENCY LOAD TESTING
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Configure custom socket concurrency and HTTP pipelining, then click <strong className="text-amber-400">RUN AUTOCANNON BENCHMARK</strong> to test server socket throughput and compute HDR latency percentiles in real-time.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConnections(10);
                      setDuration(5);
                      handleRun();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 text-xs font-mono font-bold text-slate-300 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Zap size={12} className="text-amber-400" /> Quick Smoke Test (10 conn, 5s)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConnections(100);
                      setDuration(10);
                      handleRun();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 text-xs font-mono font-bold text-slate-300 border border-slate-800 hover:border-rose-500/40 cursor-pointer transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Gauge size={12} className="text-rose-400" /> Stress Test (100 conn, 10s)
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
