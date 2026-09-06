import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Zap, 
  Play, 
  RefreshCw, 
  Save, 
  Copy, 
  List, 
  FileJson, 
  Database, 
  Layers,
  Plus,
  ShieldCheck,
  X,
  Gauge,
  Flame,
  Activity,
  Sliders,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Shuffle,
  ShieldAlert,
  SlidersHorizontal,
  Code,
  Check,
  UploadCloud,
  ChevronDown,
  Info,
  Radio,
  ExternalLink
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { Tab, AssertionRule, TestExecutionMode } from '@/features/api-tester/types';
import { HeaderRow } from './HeaderRow';
import { BatchViewer } from './BatchViewer';
import { ResponseViewer } from './ResponseViewer';
import { AutocannonBenchmarkView } from './AutocannonBenchmarkView';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'GRAPHQL'];

const TEST_MODES: { 
  id: TestExecutionMode; 
  label: string; 
  badge: string; 
  icon: React.ComponentType<{ size?: number; className?: string }>; 
  color: string; 
  bgColor: string; 
  borderColor: string; 
  description: string;
}[] = [
  {
    id: 'functional',
    label: 'Single Request',
    badge: '1-SHOT',
    icon: Zap,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Direct request execution with latency, status codes, and assertion inspection.'
  },
  {
    id: 'load',
    label: 'Autocannon Load Test',
    badge: 'BENCHMARK',
    icon: Flame,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    description: 'High-accuracy C-grade socket benchmark with throughput RPS and p50-p99.9 latency percentiles.'
  },
  {
    id: 'race',
    label: 'Concurrency & Race',
    badge: 'BURST',
    icon: Activity,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Simultaneous parallel bursts to detect race conditions, state leaks, and double writes.'
  }
];

interface ApiClientWorkspaceProps {
  activeTab: Tab;
  activeTabId: string;
  tabs?: Tab[];
  updateActiveTab: (updates: Partial<Tab>) => void;
  updateActiveConfig: (updates: any) => void;
  saveToCollection: () => void;
  handleAbort: () => void;
  handleRun: () => void;
  handleStartAutocannon?: (config: any) => void;
  handleAbortAutocannon?: () => void;
  handleStartLabTest?: (moduleId: string, settings: any) => void;
  getResolvedConfig: (tab: Tab) => any;
  showCustomAlert: (title: string, message: string) => void;
  
  splitPercent: number;
  setIsDraggingSplit: (dragging: boolean) => void;
  theme: 'dark' | 'light';

  graphqlQueryHeight: number;
  graphqlVariablesHeight: number;
  payloadJsonHeight: number;
  
  startResizeQuery: (e: React.MouseEvent) => void;
  startResizeVariables: (e: React.MouseEvent) => void;
  startResizePayloadJson: (e: React.MouseEvent) => void;

  addAssertion: (rule: AssertionRule) => void;
  removeAssertion: (id: string) => void;
  updateAssertion: (id: string, updates: Partial<AssertionRule>) => void;
  variables?: Record<string, string>;
  setVariables?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  telemetry?: any;
}

export function ApiClientWorkspace({
  activeTab,
  activeTabId,
  tabs = [],
  updateActiveTab,
  updateActiveConfig,
  saveToCollection,
  handleAbort,
  handleRun,
  handleStartAutocannon,
  handleAbortAutocannon,
  handleStartLabTest,
  getResolvedConfig,
  showCustomAlert,
  
  splitPercent,
  setIsDraggingSplit,
  theme,

  graphqlQueryHeight,
  graphqlVariablesHeight,
  payloadJsonHeight,

  startResizeQuery,
  startResizeVariables,
  startResizePayloadJson,

  addAssertion,
  removeAssertion,
  updateAssertion,
  variables = {},
  setVariables,
  telemetry
}: ApiClientWorkspaceProps) {
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [activeMobilePanel, setActiveMobilePanel] = useState<'request' | 'response'>('request');
  const [activeRequestTab, setActiveRequestTab] = useState<'params' | 'headers' | 'body' | 'auth' | 'assertions' | 'extractors' | 'batch' | 'loadSettings'>('params');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedAutocannonCli, setCopiedAutocannonCli] = useState(false);
  const [copiedBatchCli, setCopiedBatchCli] = useState(false);
  const [showCurlModal, setShowCurlModal] = useState(false);
  const [showSendDropdown, setShowSendDropdown] = useState(false);

  const currentTestMode = activeTab.testMode || 'functional';
  const activeModeMeta = TEST_MODES.find(m => m.id === currentTestMode) || TEST_MODES[0];

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeTab.loading) {
      setActiveMobilePanel('response');
    }
  }, [activeTab.loading]);

  // Parse query parameters from URL
  const queryParams = useMemo(() => {
    try {
      if (!activeTab.config.url) return [];
      const questionIndex = activeTab.config.url.indexOf('?');
      if (questionIndex === -1) return [];
      const search = activeTab.config.url.slice(questionIndex + 1);
      const params = new URLSearchParams(search);
      const list: { id: string; key: string; value: string; enabled: boolean }[] = [];
      params.forEach((value, key) => {
        list.push({ id: `${key}-${value}`, key, value, enabled: true });
      });
      return list;
    } catch {
      return [];
    }
  }, [activeTab.config.url]);

  const updateUrlWithParams = (newParams: { key: string; value: string; enabled: boolean }[]) => {
    try {
      const baseUrl = activeTab.config.url.split('?')[0] || '';
      const activeEntries = newParams.filter(p => p.enabled && p.key.trim());
      if (activeEntries.length === 0) {
        updateActiveConfig({ url: baseUrl });
        return;
      }
      const searchParams = new URLSearchParams();
      activeEntries.forEach(p => {
        searchParams.append(p.key.trim(), p.value);
      });
      updateActiveConfig({ url: `${baseUrl}?${searchParams.toString()}` });
    } catch (e) {
      console.error(e);
    }
  };

  const resolvedWidthStyle = useMemo(() => {
    return windowWidth >= 1024 
      ? { width: `${splitPercent}%` } 
      : { width: '100%' };
  }, [splitPercent, windowWidth]);

  const resolvedRightWidthStyle = useMemo(() => {
    return windowWidth >= 1024 
      ? { width: `${100 - splitPercent}%` } 
      : { width: '100%' };
  }, [splitPercent, windowWidth]);

  // Generate clean curl command
  const curlCommandString = useMemo(() => {
    const resolved = getResolvedConfig(activeTab);
    const isGraphql = resolved.method === 'GRAPHQL';
    const method = isGraphql ? 'POST' : resolved.method;
    const finalHeaders = { ...resolved.headers };
    if (isGraphql && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    
    const headerString = Object.entries(finalHeaders)
      .map(([k,v]) => `-H "${k}: ${v}"`)
      .join(' ');
      
    return `curl -X ${method} "${resolved.url}" ${headerString} ${resolved.body ? `-d '${resolved.body.replace(/'/g, "'\\''")}'` : ''}`.trim();
  }, [activeTab, getResolvedConfig]);

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommandString);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  // Generate live Autocannon CLI command snippet
  const autocannonCliString = useMemo(() => {
    const resolved = getResolvedConfig(activeTab);
    const tc = activeTab.testConfig || {};
    const conns = tc.connections ?? 50;
    const dur = tc.duration ?? 10;
    const pipe = tc.pipelining ?? 1;
    const warmup = tc.warmupDuration ?? 0;
    const timeoutSec = tc.timeout ?? 10;
    const isRate = tc.isRateLimited && tc.rateLimit;

    const parts = ['autocannon'];
    parts.push(`-c ${conns}`);
    parts.push(`-d ${dur}`);
    if (pipe > 1) parts.push(`-p ${pipe}`);
    if (warmup > 0) parts.push(`-w ${warmup}`);
    if (timeoutSec && timeoutSec !== 10) parts.push(`-t ${timeoutSec}`);
    if (isRate) parts.push(`--rate ${tc.rateLimit}`);
    if (resolved.method && resolved.method !== 'GET') parts.push(`-m ${resolved.method}`);

    const headerEntries = Object.entries(resolved.headers || {});
    headerEntries.forEach(([k, v]) => {
      parts.push(`-H "${k}: ${v}"`);
    });

    if (resolved.body && (resolved.method === 'POST' || resolved.method === 'PUT' || resolved.method === 'PATCH')) {
      parts.push(`-b '${resolved.body.replace(/'/g, "'\\''")}'`);
    }

    parts.push(`"${resolved.url || 'http://localhost:3000/api/health'}"`);
    return parts.join(' ');
  }, [activeTab, getResolvedConfig]);

  const handleCopyAutocannonCli = () => {
    navigator.clipboard.writeText(autocannonCliString);
    setCopiedAutocannonCli(true);
    setTimeout(() => setCopiedAutocannonCli(false), 2000);
  };

  // Generate live Batch CLI command snippet
  
  const [copiedSingleCli, setCopiedSingleCli] = useState(false);
  const singleCliString = useMemo(() => {
    const resolved = getResolvedConfig(activeTab);
    const isGraphql = resolved.method === 'GRAPHQL';
    const method = isGraphql ? 'POST' : resolved.method;
    
    let cmd = `curl -X ${method}`;
    const finalHeaders = { ...resolved.headers };
    if (isGraphql && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    
    for (const [k, v] of Object.entries(finalHeaders)) {
      cmd += ` -H "${k}: ${v}"`;
    }
    
    if (resolved.body) {
      cmd += ` -d '${resolved.body.replace(/'/g, "'\\''")}'`;
    }
    cmd += ` "${resolved.url || 'http://localhost:3000/api/health'}"`;
    return cmd;
  }, [activeTab, getResolvedConfig]);

  const handleCopySingleCli = () => {
    navigator.clipboard.writeText(singleCliString);
    setCopiedSingleCli(true);
    setTimeout(() => setCopiedSingleCli(false), 2000);
  };

  const batchCliString = useMemo(() => {
    const resolved = getResolvedConfig(activeTab);
    const iters = activeTab.batchIterations || 10;
    const conc = activeTab.batchConcurrency || 5;
    const isGraphql = resolved.method === 'GRAPHQL';
    const method = isGraphql ? 'POST' : resolved.method;
    
    let cmd = `seq 1 ${iters} | xargs -n1 -P ${conc} curl -s -X ${method}`;
    const finalHeaders = { ...resolved.headers };
    if (isGraphql && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    
    for (const [k, v] of Object.entries(finalHeaders)) {
      cmd += ` -H "${k}: ${v}"`;
    }
    
    if (resolved.body) {
      cmd += ` -d '${resolved.body.replace(/'/g, "'\\''")}'`;
    }
    cmd += ` "${resolved.url || 'http://localhost:3000/api/health'}"`;
    return cmd;
  }, [activeTab, getResolvedConfig]);

  const handleCopyBatchCli = () => {
    navigator.clipboard.writeText(batchCliString);
    setCopiedBatchCli(true);
    setTimeout(() => setCopiedBatchCli(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className={cn('absolute inset-0 flex flex-col lg:flex-row gap-0 overflow-hidden font-sans', theme === 'light' ? 'bg-slate-50' : 'bg-[#080A0F]')}
    >
      {/* Mobile view sub-segmented control tabs */}
      <div className={cn('lg:hidden flex border-b border-slate-850 p-1.5 shrink-0 h-11 items-center gap-1.5 select-none w-full', theme === 'light' ? 'bg-white' : 'bg-[#0E121A]')}>
        <button
          onClick={() => setActiveMobilePanel('request')}
          className={cn(
            "flex-1 py-1.5 px-3 rounded text-[11px] font-mono font-bold uppercase transition-all tracking-wider text-center cursor-pointer",
            activeMobilePanel === 'request'
              ? "bg-[#1E293B] text-emerald-400 border border-emerald-500/25 shadow-sm"
              : "text-slate-500 hover:text-slate-300"
          )}
          type="button"
        >
          {activeTab.config.method} REQUEST
        </button>
        <button
          onClick={() => setActiveMobilePanel('response')}
          className={cn(
            "flex-1 py-1.5 px-3 rounded text-[11px] font-mono font-bold uppercase transition-all tracking-wider text-center cursor-pointer relative",
            activeMobilePanel === 'response'
              ? "bg-[#1E293B] text-emerald-400 border border-emerald-500/25 shadow-sm"
              : "text-slate-500 hover:text-slate-300"
          )}
          type="button"
        >
          RESPONSE & METRICS
          {activeTab.loading && (
            <span className="absolute right-3.5 top-2.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* LHS: Unified, Clean Request Composer */}
      <div 
        style={windowWidth >= 1024 ? resolvedWidthStyle : undefined}
        className={cn(
          "border-r border-slate-850 flex flex-col ${theme === 'light' ? 'bg-slate-50' : 'bg-[#0B0D13]'} shrink-0",
          windowWidth >= 1024 ? "w-auto lg:flex-none h-full" : (activeMobilePanel === 'request' ? "w-full flex-1 overflow-hidden" : "hidden")
        )}
      >
        {/* Top Control Bar: Mode Title & Quick Tools */}
        <div className={cn('p-3.5 pb-2.5 border-b border-slate-850 flex flex-col gap-2.5 shrink-0', theme === 'light' ? 'bg-white' : 'bg-[#0E121B]')}>
          {/* Primary Request URL Bar & Execution Button */}
          <div className={cn('flex rounded-xl border border-slate-800 focus-within:border-emerald-500/50 shadow-inner relative z-30', theme === 'light' ? 'bg-white' : 'bg-[#07090E]')}>
            <select
              value={activeTab.config.method}
              onChange={(e) => updateActiveConfig({ method: e.target.value as any })}
              className={cn(
                "bg-transparent font-extrabold font-mono text-xs sm:text-sm px-3.5 outline-none cursor-pointer border-r border-slate-800/80 h-11 appearance-none text-center select-none rounded-l-xl",
                activeTab.config.method === 'GET' ? "text-emerald-400" :
                activeTab.config.method === 'POST' ? "text-blue-400" :
                activeTab.config.method === 'PUT' ? "text-amber-400" :
                activeTab.config.method === 'DELETE' ? "text-rose-400" : "text-purple-400"
              )}
            >
              {METHODS.map(m => (
                <option key={m} value={m} className="bg-slate-900 border-none font-bold text-slate-300">
                  {m}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={activeTab.config.url}
              onChange={(e) => updateActiveConfig({ url: e.target.value })}
              placeholder="https://api.example.com/v1/resource or {{BASE_URL}}/endpoint"
              className="flex-1 bg-transparent px-3.5 text-xs sm:text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none h-11 font-medium min-w-0"
            />

            <div className="flex h-11 border-l border-slate-800/80 relative rounded-r-xl">
              <button
                type="button"
                onClick={activeTab.loading ? (handleAbortAutocannon || handleAbort) : handleRun}
                className={cn(
                  "px-5 text-xs font-mono font-black tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer select-none",
                  activeTab.loading 
                    ? "bg-rose-600 hover:bg-rose-500 text-white rounded-r-xl" 
                    : activeTab.testMode === 'load'
                      ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black shadow-md shadow-amber-500/20"
                      : activeTab.batchMode 
                        ? (theme === 'light' ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white") 
                        : (theme === 'light' ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white")
                )}
                title={
                  activeTab.testMode === 'load'
                    ? "Execute Autocannon high-concurrency benchmark"
                    : activeTab.batchMode
                      ? "Execute concurrent batch request"
                      : "Send single request"
                }
              >
                {activeTab.loading ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : activeTab.testMode === 'load' ? (
                  <Flame size={14} className="fill-slate-950 text-slate-950" />
                ) : activeTab.batchMode ? (
                  <Activity size={13} />
                ) : (
                  <Play size={13} fill="currentColor" />
                )}
                <span>
                  {activeTab.loading ? 'ABORT' : (activeTab.testMode === 'load' ? 'BENCHMARK' : activeTab.batchMode ? 'RUN BATCH' : 'SEND')}
                </span>
              </button>
              
              {!activeTab.loading && (
                <button
                  type="button"
                  onClick={() => setShowSendDropdown(!showSendDropdown)}
                  className={cn(
                    "px-2.5 flex items-center justify-center transition-all cursor-pointer border-l rounded-r-xl",
                    activeTab.testMode === 'load' 
                      ? "bg-amber-600 hover:bg-amber-500 text-slate-950 border-slate-900/10" 
                      : activeTab.batchMode 
                        ? (theme === 'light' ? "bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-800/20" : "bg-cyan-700 hover:bg-cyan-600 text-white border-white/15") 
                        : (theme === 'light' ? "bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-800/20" : "bg-emerald-700 hover:bg-emerald-600 text-white border-white/15")
                  )}
                  title="Choose execution mode"
                >
                  <ChevronDown size={14} className={cn("transition-transform duration-200", showSendDropdown && "rotate-180")} />
                </button>
              )}

              {showSendDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSendDropdown(false)} />
                  <div className={cn("absolute right-0 top-[48px] w-72 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col p-1.5 animate-fadeIn", theme === 'light' ? 'bg-white border border-slate-200' : 'bg-[#0F121C] border border-slate-700/80')}>
                    <div className="p-1 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          updateActiveTab({ batchMode: false, testMode: 'functional' });
                          if (activeRequestTab === 'batch' || activeRequestTab === 'loadSettings') {
                            setActiveRequestTab('params');
                          }
                          setShowSendDropdown(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2.5 cursor-pointer transition-colors",
                          !activeTab.batchMode && activeTab.testMode !== 'load' 
                            ? (theme === 'light' ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30") 
                            : (theme === 'light' ? "text-slate-700 hover:bg-slate-50" : "text-slate-300 hover:${theme === 'light' ? 'bg-slate-100' : 'bg-[#182235]'}")
                        )}
                      >
                        <div className={cn("p-1.5 rounded-md", !activeTab.batchMode && activeTab.testMode !== 'load' ? (theme === 'light' ? "bg-emerald-100 text-emerald-600" : "bg-emerald-500/20 text-emerald-400") : (theme === 'light' ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400"))}>
                          <Play size={14} fill="currentColor" />
                        </div>
                        <div className="flex flex-col">
                          <span className={cn("font-bold", theme === 'light' ? "text-slate-900" : "text-slate-200")}>Single Request</span>
                          <span className={cn("text-[10px] font-normal", theme === 'light' ? "text-slate-500" : "text-slate-400")}>Standard 1-shot HTTP call</span>
                        </div>
                        {!activeTab.batchMode && activeTab.testMode !== 'load' && <Check size={16} className={cn("ml-auto", theme === 'light' ? "text-emerald-500" : "text-emerald-400")} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateActiveTab({ batchMode: true, testMode: 'race' });
                          setActiveRequestTab('batch');
                          setShowSendDropdown(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2.5 cursor-pointer transition-colors",
                          activeTab.batchMode && activeTab.testMode !== 'load'
                            ? (theme === 'light' ? "bg-cyan-50 text-cyan-700 border border-cyan-200" : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30")
                            : (theme === 'light' ? "text-slate-700 hover:bg-slate-50" : "text-slate-300 hover:${theme === 'light' ? 'bg-slate-100' : 'bg-[#182235]'}")
                        )}
                      >
                        <div className={cn("p-1.5 rounded-md", activeTab.batchMode && activeTab.testMode !== 'load' ? (theme === 'light' ? "bg-cyan-100 text-cyan-600" : "bg-cyan-500/20 text-cyan-400") : (theme === 'light' ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400"))}>
                          <Activity size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className={cn("font-bold", theme === 'light' ? "text-cyan-700" : "text-cyan-400")}>Batch & Race</span>
                          <span className={cn("text-[10px] font-normal", theme === 'light' ? "text-slate-500" : "text-slate-400")}>Concurrent batch testing</span>
                        </div>
                        {activeTab.batchMode && activeTab.testMode !== 'load' && <Check size={16} className={cn("ml-auto", theme === 'light' ? "text-cyan-600" : "text-cyan-400")} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateActiveTab({ batchMode: false, testMode: 'load' });
                          setActiveRequestTab('loadSettings');
                          setShowSendDropdown(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2.5 cursor-pointer transition-colors",
                          activeTab.testMode === 'load'
                            ? (theme === 'light' ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-amber-500/15 text-amber-400 border border-amber-500/30")
                            : (theme === 'light' ? "text-slate-700 hover:bg-slate-50" : "text-slate-300 hover:${theme === 'light' ? 'bg-slate-100' : 'bg-[#182235]'}")
                        )}
                      >
                        <div className={cn("p-1.5 rounded-md", activeTab.testMode === 'load' ? (theme === 'light' ? "bg-amber-100 text-amber-600" : "bg-amber-500/20 text-amber-400") : (theme === 'light' ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400"))}>
                          <Flame size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className={cn("font-bold", theme === 'light' ? "text-amber-600" : "text-amber-400")}>Concurrent API Test</span>
                          <span className={cn("text-[10px] font-normal", theme === 'light' ? "text-slate-500" : "text-slate-400")}>Autocannon benchmark</span>
                        </div>
                        {activeTab.testMode === 'load' && <Check size={16} className={cn("ml-auto", theme === 'light' ? "text-amber-600" : "text-amber-400")} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Request Sub-Tabs Bar */}
        <div className={cn('flex border-b border-slate-850 px-3 shrink-0 overflow-x-auto custom-scrollbar select-none', theme === 'light' ? 'bg-slate-100' : 'bg-[#0A0D14]')}>
          {[
            { id: 'params', label: `Params ${queryParams.length > 0 ? `(${queryParams.length})` : ''}`, icon: List },
            { id: 'headers', label: `Headers (${activeTab.headersList.length})`, icon: Code },
            { id: 'body', label: 'Body Payload', icon: FileJson },
            { id: 'auth', label: 'Auth', icon: ShieldCheck },
            { id: 'assertions', label: `Assertions (${activeTab.assertions?.length || 0})`, icon: CheckCircle2 },
            { id: 'extractors', label: `Extractors (${activeTab.extractors?.length || 0})`, icon: Layers },
            ...(activeTab.batchMode ? [{ id: 'batch', label: `Batch & Race`, icon: Activity }] : []),
            ...(activeTab.testMode === 'load' && !activeTab.batchMode ? [{ id: 'loadSettings', label: `Benchmark Config`, icon: Flame }] : []),
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeRequestTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveRequestTab(tab.id as any)}
                className={cn(
                  "py-2.5 px-3 flex items-center gap-1.5 text-[10.5px] font-mono font-bold uppercase transition-all tracking-wider border-b-2 whitespace-nowrap cursor-pointer",
                  isActive
                    ? (tab.id === 'batch'
                        ? "border-cyan-500 text-cyan-400 bg-cyan-950/30"
                        : tab.id === 'loadSettings'
                          ? "border-amber-500 text-amber-400 bg-amber-950/30"
                          : "border-emerald-500 text-emerald-400 bg-slate-900/30")
                    : (tab.id === 'batch' && activeTab.batchMode && activeTab.testMode !== 'load'
                        ? "border-cyan-500/40 text-cyan-400/80 hover:text-cyan-300"
                        : tab.id === 'loadSettings' && activeTab.testMode === 'load'
                          ? "border-amber-500/40 text-amber-400/80 hover:text-amber-300"
                          : "border-transparent text-slate-500 hover:text-slate-300")
                )}
              >
                <Icon size={12} className={
                  isActive 
                    ? (tab.id === 'batch' ? "text-cyan-400" : tab.id === 'loadSettings' ? "text-amber-400" : "text-emerald-400")
                    : (tab.id === 'batch' && activeTab.batchMode && activeTab.testMode !== 'load' ? "text-cyan-400" : tab.id === 'loadSettings' && activeTab.testMode === 'load' ? "text-amber-400" : "text-slate-500")
                } />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Sub-Panels */}
        <div className={cn('flex-1 flex flex-col overflow-y-auto p-4 space-y-4 custom-scrollbar', theme === 'light' ? 'bg-slate-50' : 'bg-[#0B0D13]')}>
          
          {/* TAB 1: URL QUERY PARAMS */}
          {activeRequestTab === 'params' && (
            <section className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between select-none">
                <label className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                  <List size={12} className="text-emerald-400" /> Query Parameters
                </label>
                <button 
                  type="button"
                  onClick={() => {
                    const currentUrl = activeTab.config.url || '';
                    const hasQuery = currentUrl.includes('?');
                    const updated = hasQuery ? `${currentUrl}&param=${Date.now()}` : `${currentUrl}?param=${Date.now()}`;
                    updateActiveConfig({ url: updated });
                  }}
                  className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 ${theme === 'light' ? 'bg-white' : 'bg-[#141C2B]'} hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
                >
                  <Plus size={12} /> ADD PARAM
                </button>
              </div>

              <div className="space-y-2">
                {queryParams.length === 0 ? (
                  <div className="text-center p-6 ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} border border-slate-850 border-dashed rounded-xl text-slate-500 text-xs font-mono">
                    No query parameters in URL. Append ?key=value or click <strong className="text-emerald-400">ADD PARAM</strong>.
                  </div>
                ) : (
                  queryParams.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} p-2 rounded-lg border border-slate-850 font-mono text-xs">
                      <input
                        type="text"
                        value={p.key}
                        onChange={(e) => {
                          const next = [...queryParams];
                          next[idx].key = e.target.value;
                          updateUrlWithParams(next);
                        }}
                        placeholder="Key"
                        className="flex-1 ${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'} border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 outline-none text-xs"
                      />
                      <span className="text-slate-600 font-bold">=</span>
                      <input
                        type="text"
                        value={p.value}
                        onChange={(e) => {
                          const next = [...queryParams];
                          next[idx].value = e.target.value;
                          updateUrlWithParams(next);
                        }}
                        placeholder="Value"
                        className="flex-1 ${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'} border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 outline-none text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = queryParams.filter((_, i) => i !== idx);
                          updateUrlWithParams(next);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1.5 cursor-pointer"
                        title="Delete parameter"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* TAB 2: HEADERS */}
          {activeRequestTab === 'headers' && (
            <section className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between select-none">
                <label className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                  <Code size={12} className="text-emerald-400" /> Request Headers ({activeTab.headersList.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const exists = activeTab.headersList.some(h => h.key.toLowerCase() === 'content-type');
                      if (!exists) {
                        updateActiveTab({
                          headersList: [...activeTab.headersList, { id: uuidv4(), key: 'Content-Type', value: 'application/json' }]
                        });
                      }
                    }}
                    className="text-[10px] font-mono text-slate-400 hover:text-slate-200 ${theme === 'light' ? 'bg-white' : 'bg-[#141C2B]'} px-2 py-1 rounded border border-slate-700/50 cursor-pointer"
                  >
                    + JSON Header
                  </button>
                  <button 
                    type="button"
                    onClick={() => updateActiveTab({ headersList: [...activeTab.headersList, { id: uuidv4(), key: '', value: '' }] })}
                    className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 ${theme === 'light' ? 'bg-white' : 'bg-[#141C2B]'} hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
                  >
                    <Plus size={12} /> ADD HEADER
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {activeTab.headersList.map((h) => (
                  <HeaderRow
                    key={h.id}
                    h={h}
                    onUpdateKey={(newKey) => {
                      const updatedList = activeTab.headersList.map(item => item.id === h.id ? { ...item, key: newKey } : item);
                      updateActiveTab({ headersList: updatedList });
                    }}
                    onUpdateValue={(newVal) => {
                      const updatedList = activeTab.headersList.map(item => item.id === h.id ? { ...item, value: newVal } : item);
                      updateActiveTab({ headersList: updatedList });
                    }}
                    onDelete={() => {
                      const filteredList = activeTab.headersList.filter(item => item.id !== h.id);
                      updateActiveTab({ headersList: filteredList });
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* TAB 3: BODY PAYLOAD & GRAPHQL */}
          {activeRequestTab === 'body' && (
            <section className="space-y-3 animate-fadeIn">
              {activeTab.config.method === 'GRAPHQL' ? (
                <div className="border border-slate-850 rounded-xl overflow-hidden ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} flex flex-col shadow-inner">
                  {/* Query Pane */}
                  <div className="relative flex flex-col shrink-0" style={{ height: `${graphqlQueryHeight}px` }}>
                    <div className="px-3.5 py-2 ${theme === 'light' ? 'bg-white' : 'bg-[#0E121B]'} border-b border-slate-850 select-none flex items-center justify-between shrink-0">
                      <span className="text-[10px] uppercase font-black text-violet-400 tracking-wider flex items-center gap-2 font-mono">
                        <Layers size={12} className="text-violet-400" /> GraphQL Query
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeTab.config.url) {
                            showCustomAlert('INTROSPECTION FAILED', 'Provide a GQL endpoint URL first.');
                            return;
                          }
                          try {
                            const queryIntro = `query IntrospectionQuery { __schema { types { name kind fields { name type { name kind } } } } }`;
                            const response = await fetch('/api/execute', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                method: 'POST',
                                url: activeTab.config.url,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ query: queryIntro })
                              })
                            });
                            const res = await response.json();
                            if (res && res.body) {
                              const parsed = JSON.parse(res.body);
                              if (parsed?.data?.__schema) {
                                const typesCount = parsed.data.__schema.types.length;
                                showCustomAlert(
                                  '⚡ SCHEMA INTROSPECTED', 
                                  `Successfully extracted schema with ${typesCount} types!`
                                );
                              }
                            }
                          } catch(ex: any) {
                            showCustomAlert('INTROSPECTION FAILED', ex.message || 'Error querying schema.');
                          }
                        }}
                        className="text-[9px] font-bold font-mono text-violet-400 hover:text-white uppercase transition-colors bg-violet-950/30 border border-violet-800/40 px-2 py-0.5 rounded cursor-pointer"
                      >
                        INTROSPECT SCHEMA
                      </button>
                    </div>
                    <textarea
                      value={activeTab.graphqlQuery || ''}
                      onChange={(e) => updateActiveTab({ graphqlQuery: e.target.value })}
                      placeholder="query MyQuery { ... }"
                      className="w-full flex-1 bg-transparent p-3.5 font-mono text-xs text-violet-300 outline-none resize-none leading-relaxed"
                    />
                    <div 
                      onMouseDown={startResizeQuery}
                      className="h-1 bg-slate-900 hover:bg-violet-500 cursor-row-resize flex items-center justify-center transition-all shrink-0"
                      title="Drag to resize Query box"
                    />
                  </div>

                  {/* Variables Pane */}
                  <div className="relative flex flex-col shrink-0" style={{ height: `${graphqlVariablesHeight}px` }}>
                    <div className="px-3.5 py-2 ${theme === 'light' ? 'bg-white' : 'bg-[#0E121B]'} border-b border-slate-850 select-none flex items-center justify-between shrink-0">
                      <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider flex items-center gap-2 font-mono">
                        <Database size={11} className="text-blue-400" /> Variables JSON
                      </span>
                      <button 
                        type="button"
                        onClick={() => {
                           try {
                             const parsedObj = JSON.parse(activeTab.graphqlVariables || '{}');
                             updateActiveTab({ graphqlVariables: JSON.stringify(parsedObj, null, 2) });
                           } catch (e) {
                             showCustomAlert('INVALID JSON', 'Malformed syntax in GraphQL variables.');
                           }
                        }}
                        className="text-[9px] font-bold font-mono text-slate-400 hover:text-blue-400 uppercase transition-colors cursor-pointer"
                      >
                        Format Vars
                      </button>
                    </div>
                    <textarea
                      value={activeTab.graphqlVariables || ''}
                      onChange={(e) => updateActiveTab({ graphqlVariables: e.target.value })}
                      placeholder='{ "id": 1 }'
                      className="w-full flex-1 bg-transparent p-3.5 font-mono text-xs text-blue-300 outline-none resize-none leading-relaxed"
                    />
                    <div 
                      onMouseDown={startResizeVariables}
                      className="h-1 bg-slate-900 hover:bg-blue-500 cursor-row-resize flex items-center justify-center transition-all shrink-0"
                      title="Drag to resize Variables box"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between select-none">
                    <div className="flex items-center gap-4">
                      <label className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                        <FileJson size={12} className="text-emerald-400" /> Request Payload
                      </label>
                      <div className="flex ${theme === 'light' ? 'bg-white' : 'bg-[#141C2B]'} rounded-lg p-0.5 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => updateActiveTab({ bodyType: 'json' })}
                          className={cn("px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer", (!activeTab.bodyType || activeTab.bodyType === 'json') ? (theme === 'light' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-white') : (theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'))}
                        >
                          Raw / JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => updateActiveTab({ bodyType: 'binary' })}
                          className={cn("px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer", activeTab.bodyType === 'binary' ? (theme === 'light' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-white') : (theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'))}
                        >
                          Binary File
                        </button>
                      </div>
                    </div>
                    {(!activeTab.bodyType || activeTab.bodyType === 'json') && (
                      <button 
                        type="button"
                        onClick={() => {
                           try {
                             const parsedObj = JSON.parse(activeTab.config.body || '');
                             updateActiveConfig({ body: JSON.stringify(parsedObj, null, 2) });
                           } catch (e) {
                             showCustomAlert('INVALID JSON', 'Malformed syntax in request payload.');
                           }
                        }}
                        className="text-xs font-bold font-mono text-slate-400 hover:text-emerald-400 uppercase transition-colors cursor-pointer"
                      >
                        Prettify JSON
                      </button>
                    )}
                  </div>
                  <div className="relative flex flex-col" style={{ height: `${payloadJsonHeight}px` }}>
                    {activeTab.bodyType === 'binary' ? (
                      <div className="w-full flex-1 ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} border border-slate-850 rounded-t-xl p-6 flex flex-col items-center justify-center border-dashed gap-4 group">
                        <UploadCloud size={32} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                        <div className="text-center space-y-1">
                          <p className="text-sm font-bold text-slate-300">Upload Binary File</p>
                          <p className="text-xs font-mono text-slate-500 max-w-[280px]">
                            File contents will be sent raw (e.g. <span className="text-emerald-400/80">--data-binary</span>)
                          </p>
                        </div>
                        {activeTab.config.bodyFileName && (
                          <div className="bg-slate-900/80 border border-emerald-500/30 px-4 py-2 rounded-lg flex flex-col items-center gap-1">
                            <span className="text-emerald-400 font-mono text-xs font-bold">{activeTab.config.bodyFileName}</span>
                            <span className="text-slate-400 font-mono text-[10px]">{(activeTab.config.bodyFileSize || 0).toLocaleString()} bytes</span>
                            <button
                              type="button"
                              onClick={() => updateActiveConfig({ bodyFile: undefined, bodyFileName: undefined, bodyFileSize: undefined })}
                              className="text-rose-400 text-[10px] uppercase font-bold mt-1 hover:text-rose-300"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <input 
                          type="file" 
                          id="body-file-upload"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            try {
                              showCustomAlert('UPLOADING', `Uploading ${file.name}...`);
                              const response = await fetch('/api/upload-file', {
                                method: 'POST',
                                body: formData
                              });
                              const res = await response.json();
                              if (res.success) {
                                updateActiveConfig({
                                  bodyFile: res.path,
                                  bodyFileName: res.originalName,
                                  bodyFileSize: res.size
                                });
                                showCustomAlert('UPLOAD COMPLETE', `${file.name} is ready for testing.`);
                              } else {
                                showCustomAlert('UPLOAD FAILED', res.error || 'Failed to upload file.');
                              }
                            } catch (err: any) {
                              showCustomAlert('UPLOAD ERROR', err.message);
                            }
                          }}
                        />
                        <label 
                          htmlFor="body-file-upload"
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors border border-slate-700"
                        >
                          Select File
                        </label>
                      </div>
                    ) : (
                      <textarea
                        value={activeTab.config.body}
                        onChange={(e) => updateActiveConfig({ body: e.target.value })}
                        className="w-full flex-1 ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} border border-slate-850 rounded-t-xl p-3.5 font-mono text-xs text-emerald-400 outline-none resize-none focus:border-emerald-500/40 leading-relaxed shadow-inner"
                        placeholder='{ "key": "value" }'
                      />
                    )}
                    <div 
                      onMouseDown={startResizePayloadJson}
                      className="h-2 hover:h-2.5 ${theme === 'light' ? 'bg-slate-100' : 'bg-[#121622]'} cursor-row-resize flex items-center justify-center transition-all group z-10 rounded-b-xl shrink-0 border-t border-slate-800"
                      title="Drag to resize Payload box"
                    >
                      <div className="h-[2px] w-12 bg-slate-700 group-hover:bg-emerald-400 rounded" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TAB 4: AUTH */}
          {activeRequestTab === 'auth' && (
            <section className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between select-none">
                <label className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                  <ShieldCheck size={12} className="text-emerald-400" /> Authentication
                </label>
              </div>
              <div className="${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} p-4 rounded-xl border border-slate-850 font-mono text-xs space-y-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Auth Type</label>
                  <select
                    value={activeTab.authConfig?.type || 'none'}
                    onChange={(e) => {
                      const type = e.target.value as any;
                      updateActiveTab({
                        authConfig: {
                          type,
                          oauth2Client: type === 'oauth2_client' ? { clientId: '', clientSecret: '', tokenUrl: '' } : undefined,
                          oauth2Pkce: type === 'oauth2_pkce' ? { clientId: '', authUrl: '', codeVerifier: '', codeChallenge: '', challengeMethod: 'S256' } : undefined,
                          mtls: type === 'mtls' ? { clientCert: '', privateKey: '' } : undefined,
                          awsV4: type === 'aws_v4' ? { accessKeyId: '', secretAccessKey: '', region: 'us-east-1', service: 'execute-api' } : undefined,
                        }
                      });
                    }}
                    className="w-full ${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'} border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-bold focus:border-emerald-500/40 text-xs"
                  >
                    <option value="none">No Auth (Inherited / Public)</option>
                    <option value="oauth2_client">OAuth 2.0 (Client Credentials Flow)</option>
                    <option value="oauth2_pkce">OAuth 2.0 (PKCE Authorization)</option>
                    <option value="mtls">Mutual TLS (mTLS Cert Binding)</option>
                    <option value="aws_v4">AWS Signature version 4</option>
                  </select>
                </div>

                {activeTab.authConfig?.type === 'oauth2_client' && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[8px] uppercase tracking-wider text-slate-500 font-black">Client ID</label>
                        <input
                          type="text"
                          value={activeTab.authConfig.oauth2Client?.clientId || ''}
                          onChange={(e) => {
                            updateActiveTab({
                              authConfig: {
                                ...activeTab.authConfig!,
                                oauth2Client: { ...activeTab.authConfig!.oauth2Client!, clientId: e.target.value }
                              }
                            });
                          }}
                          placeholder="CLIENT_ID"
                          className="w-full ${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'} border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] uppercase tracking-wider text-slate-500 font-black">Client Secret</label>
                        <input
                          type="password"
                          value={activeTab.authConfig.oauth2Client?.clientSecret || ''}
                          onChange={(e) => {
                            updateActiveTab({
                              authConfig: {
                                ...activeTab.authConfig!,
                                oauth2Client: { ...activeTab.authConfig!.oauth2Client!, clientSecret: e.target.value }
                              }
                            });
                          }}
                          placeholder="••••••••••••"
                          className="w-full ${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'} border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 5: ASSERTIONS */}
          {activeRequestTab === 'assertions' && (
            <section className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between select-none">
                <label className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                  <ShieldCheck size={12} className="text-emerald-400" /> Assertion Rules ({activeTab.assertions?.length || 0})
                </label>
                <button 
                  type="button"
                  onClick={() => addAssertion({ id: uuidv4(), type: 'status', value: '200' })}
                  className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 ${theme === 'light' ? 'bg-white' : 'bg-[#141C2B]'} hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
                >
                  <Plus size={12} /> ADD RULE
                </button>
              </div>

              <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'}">
                {(!activeTab.assertions || activeTab.assertions.length === 0) ? (
                  <div className="text-center p-6 text-slate-500 text-xs font-mono">
                    No active assertions. Add status code (e.g. 200) or latency checks.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    {activeTab.assertions.map((rule) => (
                      <div key={rule.id} className="flex items-center gap-2 p-2">
                        <select
                          value={rule.type}
                          onChange={(e) => updateAssertion(rule.id, { type: e.target.value as any, value: e.target.value === 'graphql_no_errors' ? '' : rule.value })}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 font-mono text-xs outline-none w-40 shrink-0 cursor-pointer"
                        >
                          <option value="status">Status Code</option>
                          <option value="latency">Max Latency (ms)</option>
                          <option value="body_contains">Body Contains</option>
                          <option value="json_path">JSON Path</option>
                          <option value="header_matches">Header Matches</option>
                        </select>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => updateAssertion(rule.id, { value: e.target.value })}
                          placeholder={
                            rule.type === 'status' ? "e.g. 200" :
                            rule.type === 'latency' ? "e.g. 500" :
                            rule.type === 'body_contains' ? "expected text" : "expected value"
                          }
                          className="flex-1 bg-transparent border-b border-transparent focus:border-emerald-500 text-emerald-400 placeholder-slate-600 outline-none text-xs font-mono px-2 py-1 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => removeAssertion(rule.id)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 cursor-pointer rounded hover:bg-slate-800 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          
          {activeRequestTab === 'extractors' && (
            <section className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between select-none">
                <label className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                  <Layers size={12} className="text-emerald-400" /> Variable Extractors ({activeTab.extractors?.length || 0})
                </label>
                <button 
                  type="button"
                  onClick={() => {
                    const nextExtractors = activeTab.extractors ? [...activeTab.extractors] : [];
                    updateActiveTab({ extractors: [...nextExtractors, { id: uuidv4(), jsonPath: '', variableName: '' }] });
                  }}
                  className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 ${theme === 'light' ? 'bg-white' : 'bg-[#141C2B]'} hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
                >
                  <Plus size={12} /> ADD EXTRACTOR
                </button>
              </div>
              <div className="space-y-2">
                {(!activeTab.extractors || activeTab.extractors.length === 0) ? (
                  <div className="text-center p-6 ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} border border-slate-850 border-dashed rounded-xl text-slate-500 text-xs font-mono">
                    No chained extractors configured. Map response JSON path to environment variables.
                  </div>
                ) : (
                  activeTab.extractors.map((ext) => (
                    <div key={ext.id} className="flex gap-2 ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} p-3 rounded-xl border border-slate-850 font-mono text-xs items-center">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={ext.jsonPath}
                          onChange={(e) => {
                            const updatedList = activeTab.extractors?.map(item => item.id === ext.id ? { ...item, jsonPath: e.target.value } : item) || [];
                            updateActiveTab({ extractors: updatedList });
                          }}
                          placeholder="JSON Path e.g. token"
                          className="w-full ${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'} border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 outline-none text-xs"
                        />
                        <input
                          type="text"
                          value={ext.variableName}
                          onChange={(e) => {
                            const updatedList = activeTab.extractors?.map(item => item.id === ext.id ? { ...item, variableName: e.target.value.toUpperCase() } : item) || [];
                            updateActiveTab({ extractors: updatedList });
                          }}
                          placeholder="Target Var e.g. AUTH_TOKEN"
                          className="w-full ${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'} border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 outline-none text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedList = activeTab.extractors?.filter(item => item.id !== ext.id) || [];
                          updateActiveTab({ extractors: updatedList });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1.5 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* TAB: CONCURRENT BATCH RUNNER (RACE MODE) */}
          {activeRequestTab === 'batch' && (
            <section className="space-y-4 animate-fadeIn font-mono text-xs">
              {/* Batch Configuration Sliders */}
              <div className="flex flex-col gap-3.5">
                <div className="${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} p-4 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Total Iterations:</span>
                    <strong className="text-cyan-400 font-black text-sm">{activeTab.batchIterations || 10} requests</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={activeTab.batchIterations || 10}
                    onChange={(e) => updateActiveTab({ batchIterations: parseInt(e.target.value, 10) || 10 })}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[5, 10, 25, 50, 100].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => updateActiveTab({ batchIterations: cnt })}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer",
                          activeTab.batchIterations === cnt 
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" 
                            : "bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200"
                        )}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} p-4 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Concurrency (Simultaneous Sockets):</span>
                    <strong className="text-cyan-400 font-black text-sm">{activeTab.batchConcurrency || 5} concurrent</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={activeTab.batchConcurrency || 5}
                    onChange={(e) => updateActiveTab({ batchConcurrency: parseInt(e.target.value, 10) || 5 })}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[1, 2, 5, 10, 20].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateActiveTab({ batchConcurrency: c })}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer",
                          activeTab.batchConcurrency === c 
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" 
                            : "bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200"
                        )}
                      >
                        {c}c
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CLI Command Bar */}
              <div className="${theme === 'light' ? 'bg-white' : 'bg-[#0C0F17]'} p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] shadow-inner relative group">
                <div className="min-h-[6rem] max-h-40 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar pr-2 text-slate-300">
                  <span className="text-cyan-500 font-bold mr-2 select-none">$</span>
                  <span className="select-all leading-relaxed">{batchCliString}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBatchCli}
                  className={cn(
                    theme === 'light' 
                      ? "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      : "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-[#141824]/90 backdrop-blur-sm hover:bg-[#1C2132] text-slate-300 border border-slate-700 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
                    !copiedBatchCli && "opacity-0 group-hover:opacity-100"
                  )}
                >
                  {copiedBatchCli ? <Check size={12} className="text-cyan-400" /> : <Copy size={12} />}
                  <span>{copiedBatchCli ? 'Copied' : 'Copy CLI'}</span>
                </button>
              </div>
            </section>
          )}

          {/* TAB 7: BENCHMARK CONFIGURATION */}
          {activeRequestTab === 'loadSettings' && !activeTab.batchMode && activeTab.testMode === 'load' && (
            <section className="space-y-4 animate-fadeIn text-xs">
              {/* Quick Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Quick Presets
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { name: 'Smoke Test', conns: 10, dur: 5, pipe: 1, desc: '10 sockets for 5s' },
                    { name: 'Standard Load', conns: 50, dur: 10, pipe: 1, desc: '50 sockets for 10s' },
                    { name: 'Stress Test', conns: 200, dur: 20, pipe: 2, desc: '200 sockets for 20s (2x pipe)' },
                  ].map((preset, idx) => {
                    const isCurrent = 
                      (activeTab.testConfig?.connections || 50) === preset.conns &&
                      (activeTab.testConfig?.duration || 10) === preset.dur &&
                      (activeTab.testConfig?.pipelining || 1) === preset.pipe;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          updateActiveTab({
                            testConfig: {
                              ...activeTab.testConfig,
                              connections: preset.conns,
                              duration: preset.dur,
                              pipelining: preset.pipe,
                            }
                          });
                        }}
                        className={cn(
                          "p-3 rounded-lg text-left transition-all cursor-pointer border flex flex-col justify-between",
                          isCurrent
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                            : "${theme === 'light' ? 'bg-white' : 'bg-[#0C0F17]'} hover:${theme === 'light' ? 'bg-slate-100' : 'bg-[#121622]'} border-slate-800 text-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between font-bold text-xs font-mono">
                          <span className={isCurrent ? "text-amber-300" : ""}>{preset.name}</span>
                          {isCurrent && <Check size={13} className="text-amber-400" />}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono mt-1">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Core Parameters */}
              <div className="${theme === 'light' ? 'bg-white' : 'bg-[#0C0F17]'} p-4 rounded-xl border border-slate-800 space-y-4">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono block border-b border-slate-800 pb-2">
                  Test Parameters
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sockets (Connections) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-semibold font-mono">Concurrent Sockets (-c):</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={activeTab.testConfig?.connections || 50}
                        onChange={(e) => updateActiveTab({ 
                          testConfig: { 
                            ...activeTab.testConfig, 
                            connections: Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)) 
                          } 
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold text-right px-2 py-0.5 rounded outline-none text-xs"
                      />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="500"
                      step="5"
                      value={activeTab.testConfig?.connections || 50}
                      onChange={(e) => updateActiveTab({ 
                        testConfig: { 
                          ...activeTab.testConfig, 
                          connections: parseInt(e.target.value, 10) || 50 
                        } 
                      })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-semibold font-mono">Duration in Seconds (-d):</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={activeTab.testConfig?.duration || 10}
                        onChange={(e) => updateActiveTab({ 
                          testConfig: { 
                            ...activeTab.testConfig, 
                            duration: Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)) 
                          } 
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold text-right px-2 py-0.5 rounded outline-none text-xs"
                      />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      step="1"
                      value={activeTab.testConfig?.duration || 10}
                      onChange={(e) => updateActiveTab({ 
                        testConfig: { 
                          ...activeTab.testConfig, 
                          duration: parseInt(e.target.value, 10) || 10 
                        } 
                      })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                  {/* Pipelining Factor */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-300 font-semibold">Pipelining (-p):</span>
                      <span className="text-slate-400">{activeTab.testConfig?.pipelining || 1}x</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={activeTab.testConfig?.pipelining || 1}
                      onChange={(e) => updateActiveTab({ 
                        testConfig: { 
                          ...activeTab.testConfig, 
                          pipelining: Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 1)) 
                        } 
                      })}
                      className="w-full bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold px-2 py-1 rounded outline-none text-xs"
                      placeholder="1"
                    />
                  </div>

                  {/* Socket Timeout */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-300 font-semibold">Timeout (-t):</span>
                      <span className="text-slate-400">{activeTab.testConfig?.timeout || 10}s</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={activeTab.testConfig?.timeout || 10}
                      onChange={(e) => updateActiveTab({ 
                        testConfig: { 
                          ...activeTab.testConfig, 
                          timeout: Math.max(1, parseInt(e.target.value, 10) || 10) 
                        } 
                      })}
                      className="w-full bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold px-2 py-1 rounded outline-none text-xs"
                      placeholder="10"
                    />
                  </div>

                  {/* Optional Rate Limit (RPS) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="text-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(activeTab.testConfig?.isRateLimited)}
                          onChange={(e) => updateActiveTab({
                            testConfig: {
                              ...activeTab.testConfig,
                              isRateLimited: e.target.checked,
                              rateLimit: activeTab.testConfig?.rateLimit || 500
                            }
                          })}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>RPS Cap (--rate):</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      disabled={!activeTab.testConfig?.isRateLimited}
                      min="10"
                      max="50000"
                      value={activeTab.testConfig?.rateLimit || 500}
                      onChange={(e) => updateActiveTab({
                        testConfig: {
                          ...activeTab.testConfig,
                          rateLimit: parseInt(e.target.value, 10) || 500
                        }
                      })}
                      className={cn(
                        "w-full border font-mono font-bold px-2 py-1 rounded outline-none text-xs",
                        activeTab.testConfig?.isRateLimited 
                          ? "bg-slate-900 border-slate-700 text-amber-400" 
                          : "bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed"
                      )}
                      placeholder="Uncapped"
                    />
                  </div>
                </div>
              </div>

              {/* CLI Command Bar */}
              <div className="${theme === 'light' ? 'bg-white' : 'bg-[#0C0F17]'} p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] shadow-inner relative group">
                <div className="min-h-[6rem] max-h-40 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar pr-2 text-slate-300">
                  <span className="text-amber-500 font-bold mr-2 select-none">$</span>
                  <span className="select-all leading-relaxed">{autocannonCliString}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAutocannonCli}
                  className={cn(
                    theme === 'light' 
                      ? "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      : "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-[#141824]/90 backdrop-blur-sm hover:bg-[#1C2132] text-slate-300 border border-slate-700 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
                    !copiedAutocannonCli && "opacity-0 group-hover:opacity-100"
                  )}
                >
                  {copiedAutocannonCli ? <Check size={12} className="text-amber-400" /> : <Copy size={12} />}
                  <span>{copiedAutocannonCli ? 'Copied' : 'Copy CLI'}</span>
                </button>
              </div>
            </section>
          )}
          {/* Single Request CLI - Bottom Pinned */}
          {(!activeTab.batchMode && activeTab.testMode !== 'load' && activeRequestTab !== 'batch' && activeRequestTab !== 'loadSettings') && (
            <div className="mt-auto pt-4">
              <div className={cn('p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] shadow-inner relative group', theme === 'light' ? 'bg-white' : 'bg-[#0C0F17]')} >
                <div className="min-h-[6rem] max-h-40 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar pr-2 text-slate-300">
                  <span className="text-emerald-500 font-bold mr-2 select-none">$</span>
                  <span className="select-all leading-relaxed">{singleCliString}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopySingleCli}
                  className={cn(
                    theme === 'light' 
                      ? "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      : "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-[#141824]/90 backdrop-blur-sm hover:bg-[#1C2132] text-slate-300 border border-slate-700 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
                    !copiedSingleCli && "opacity-0 group-hover:opacity-100"
                  )}
                >
                  {copiedSingleCli ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedSingleCli ? 'Copied' : 'Copy CLI'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vertical split draggable slider resizer bar */}
      <div 
        onMouseDown={() => setIsDraggingSplit(true)}
        className="hidden lg:flex w-1.5 hover:w-1.5 ${theme === 'light' ? 'bg-slate-50' : 'bg-[#0B0D13]'} hover:bg-emerald-500 cursor-col-resize items-center justify-center transition-all shrink-0 border-x border-slate-850 group z-20"
        title="Drag left or right to resize panels"
      >
        <div className="w-[1.5px] h-12 bg-slate-700 group-hover:bg-emerald-300 rounded" />
      </div>

      {/* RHS: Mode-Adaptive Inspector & Benchmarks */}
      <div 
        style={windowWidth >= 1024 ? resolvedRightWidthStyle : undefined}
        className={cn(
          "flex flex-col ${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'} overflow-hidden",
          windowWidth >= 1024 ? "w-auto lg:flex-1 h-full border-t lg:border-t-0 border-slate-850" : (activeMobilePanel === 'response' ? "w-full flex-1" : "hidden")
        )}
      >
        {currentTestMode === 'load' && !activeTab.batchMode ? (
          <AutocannonBenchmarkView
            isExecuting={Boolean(activeTab.loading)}
            autocannonProgress={activeTab.autocannonProgress || null}
            autocannonResult={activeTab.autocannonResult || null}
            onStartBenchmark={handleRun}
            onAbortBenchmark={handleAbortAutocannon || handleAbort}
            targetMethod={activeTab.config.method}
            targetUrl={activeTab.config.url}
            connections={activeTab.testConfig?.connections || 50}
            duration={activeTab.testConfig?.duration || 10}
            pipelining={activeTab.testConfig?.pipelining || 1}
            onClearResults={() => {
              updateActiveTab({
                autocannonResult: undefined,
                autocannonProgress: null
              });
            }}
          />
        ) : (activeTab.batchMode || currentTestMode === 'race') ? (
          <BatchViewer 
            results={activeTab.batchResults || []} 
            progress={activeTab.progress} 
            concurrency={activeTab.testConfig?.concurrency || activeTab.batchConcurrency || 5} 
            onAbort={handleAbort} 
            onClear={() => updateActiveTab({ batchResults: [], labResults: {} })}
            theme={theme}
          />
        ) : (
          <ResponseViewer
            result={activeTab.result || (Array.isArray(activeTab.results) && activeTab.results.length > 0 ? activeTab.results[activeTab.results.length - 1] : null)}
            loading={Boolean(activeTab.loading)}
            onAbort={handleAbort}
            theme={theme}
            onClear={() => updateActiveTab({ result: null, results: [] })}
          />
        )}
      </div>
    </motion.div>
  );
}
