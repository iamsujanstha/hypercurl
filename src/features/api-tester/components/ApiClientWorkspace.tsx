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
  CheckCircle2,
  AlertTriangle,
  Globe,
  Shuffle,
  ShieldAlert,
  SlidersHorizontal,
  Code,
  Check
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
  const [activeRequestTab, setActiveRequestTab] = useState<'params' | 'headers' | 'body' | 'auth' | 'assertions' | 'extractors' | 'loadSettings'>('params');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [showCurlModal, setShowCurlModal] = useState(false);

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 flex flex-col lg:flex-row gap-0 overflow-hidden font-sans bg-[#080A0F]"
    >
      {/* Mobile view sub-segmented control tabs */}
      <div className="lg:hidden flex bg-[#0E121A] border-b border-slate-850 p-1.5 shrink-0 h-11 items-center gap-1.5 select-none w-full">
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
          "border-r border-slate-850 flex flex-col bg-[#0B0D13] shrink-0",
          windowWidth >= 1024 ? "w-auto lg:flex-none h-full" : (activeMobilePanel === 'request' ? "w-full flex-1 overflow-hidden" : "hidden")
        )}
      >
        {/* Top Control Bar: Mode Title & Quick Tools */}
        <div className="p-3.5 pb-2.5 border-b border-slate-850 flex flex-col gap-2.5 shrink-0 bg-[#0E121B]">
          <div className="flex flex-wrap items-center justify-between gap-2 select-none">
            {/* API Client Brand & Chrome DevTools Tag */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10.5px] font-bold">
                <Terminal size={13} />
                <span>REQUEST COMPOSER</span>
              </div>
              <span className="text-[10px] font-sans text-slate-500 hidden sm:inline">
                • Chrome DevTools Network Inspector
              </span>
            </div>

            {/* Quick Actions (Save, Copy cURL) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyCurl}
                className={cn(
                  "px-2.5 py-1 rounded text-[10.5px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border",
                  copiedCurl
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-[#141C2B] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/50"
                )}
                title="Copy standard cURL command to clipboard"
              >
                {copiedCurl ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copiedCurl ? 'COPIED' : 'COPY cURL'}</span>
              </button>

              <button 
                type="button"
                onClick={saveToCollection}
                className="px-2.5 py-1 bg-[#141C2B] hover:bg-slate-800 rounded text-[10.5px] font-bold font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 uppercase transition-all border border-slate-700/50 cursor-pointer"
                title="Save request to workspace collection"
              >
                <Save size={11} className="text-emerald-400" /> SAVE
              </button>
            </div>
          </div>

          {/* Primary Request URL Bar & Execution Button */}
          <div className="flex rounded-xl bg-[#07090E] overflow-hidden border border-slate-800 focus-within:border-emerald-500/50 shadow-inner">
            <select
              value={activeTab.config.method}
              onChange={(e) => updateActiveConfig({ method: e.target.value as any })}
              className={cn(
                "bg-transparent font-extrabold font-mono text-xs sm:text-sm px-3.5 outline-none cursor-pointer border-r border-slate-800/80 h-11 appearance-none text-center select-none",
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
              className="flex-1 bg-transparent px-3.5 text-xs sm:text-sm font-mono text-slate-200 placeholder:text-slate-600 outline-none h-11 font-medium"
            />

            <button
              type="button"
              onClick={activeTab.loading ? handleAbort : handleRun}
              className={cn(
                "px-5 text-xs font-mono font-black tracking-wider transition-all text-white active:scale-95 h-11 flex items-center justify-center gap-2 border-l border-slate-800/80 cursor-pointer select-none",
                activeTab.loading 
                  ? "bg-rose-700 hover:bg-rose-650" 
                  : "bg-emerald-600 hover:bg-emerald-500"
              )}
            >
              {activeTab.loading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Play size={13} fill="currentColor" />
              )}
              <span>
                {activeTab.loading ? 'ABORT' : 'SEND'}
              </span>
            </button>
          </div>
        </div>

        {/* Request Sub-Tabs Bar */}
        <div className="flex bg-[#0A0D14] border-b border-slate-850 px-3 shrink-0 overflow-x-auto custom-scrollbar select-none">
          {[
            { id: 'params', label: `Params ${queryParams.length > 0 ? `(${queryParams.length})` : ''}`, icon: List },
            { id: 'headers', label: `Headers (${activeTab.headersList.length})`, icon: Code },
            { id: 'body', label: 'Body Payload', icon: FileJson },
            { id: 'auth', label: 'Auth', icon: ShieldCheck },
            { id: 'assertions', label: `Assertions (${activeTab.assertions?.length || 0})`, icon: CheckCircle2 },
            { id: 'extractors', label: `Extractors (${activeTab.extractors?.length || 0})`, icon: Layers },
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
                    ? "border-emerald-500 text-emerald-400 bg-slate-900/30"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                <Icon size={12} className={isActive ? "text-emerald-400" : "text-slate-500"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Sub-Panels */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0B0D13]">
          
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
                  className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 bg-[#141C2B] hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
                >
                  <Plus size={12} /> ADD PARAM
                </button>
              </div>

              <div className="space-y-2">
                {queryParams.length === 0 ? (
                  <div className="text-center p-6 bg-[#07090E] border border-slate-850 border-dashed rounded-xl text-slate-500 text-xs font-mono">
                    No query parameters in URL. Append ?key=value or click <strong className="text-emerald-400">ADD PARAM</strong>.
                  </div>
                ) : (
                  queryParams.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#07090E] p-2 rounded-lg border border-slate-850 font-mono text-xs">
                      <input
                        type="text"
                        value={p.key}
                        onChange={(e) => {
                          const next = [...queryParams];
                          next[idx].key = e.target.value;
                          updateUrlWithParams(next);
                        }}
                        placeholder="Key"
                        className="flex-1 bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 outline-none text-xs"
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
                        className="flex-1 bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 outline-none text-xs"
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
                    className="text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-[#141C2B] px-2 py-1 rounded border border-slate-700/50 cursor-pointer"
                  >
                    + JSON Header
                  </button>
                  <button 
                    type="button"
                    onClick={() => updateActiveTab({ headersList: [...activeTab.headersList, { id: uuidv4(), key: '', value: '' }] })}
                    className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 bg-[#141C2B] hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
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
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-[#07090E] flex flex-col shadow-inner">
                  {/* Query Pane */}
                  <div className="relative flex flex-col shrink-0" style={{ height: `${graphqlQueryHeight}px` }}>
                    <div className="px-3.5 py-2 bg-[#0E121B] border-b border-slate-850 select-none flex items-center justify-between shrink-0">
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
                    <div className="px-3.5 py-2 bg-[#0E121B] border-b border-slate-850 select-none flex items-center justify-between shrink-0">
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
                    <label className="text-xs uppercase font-black text-slate-400 tracking-wider flex items-center gap-2 font-mono">
                      <FileJson size={12} className="text-emerald-400" /> JSON / Raw Payload
                    </label>
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
                  </div>
                  <div className="relative flex flex-col" style={{ height: `${payloadJsonHeight}px` }}>
                    <textarea
                      value={activeTab.config.body}
                      onChange={(e) => updateActiveConfig({ body: e.target.value })}
                      className="w-full flex-1 bg-[#07090E] border border-slate-850 rounded-t-xl p-3.5 font-mono text-xs text-emerald-400 outline-none resize-none focus:border-emerald-500/40 leading-relaxed shadow-inner"
                      placeholder='{ "key": "value" }'
                    />
                    <div 
                      onMouseDown={startResizePayloadJson}
                      className="h-2 hover:h-2.5 bg-[#121622] cursor-row-resize flex items-center justify-center transition-all group z-10 rounded-b-xl shrink-0 border-t border-slate-800"
                      title="Drag to resize Payload JSON box"
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
              <div className="bg-[#07090E] p-4 rounded-xl border border-slate-850 font-mono text-xs space-y-3.5">
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
                    className="w-full bg-[#10141F] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-bold focus:border-emerald-500/40 text-xs"
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
                          className="w-full bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 text-xs"
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
                          className="w-full bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 text-xs"
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
                  className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 bg-[#141C2B] hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
                >
                  <Plus size={12} /> ADD RULE
                </button>
              </div>

              <div className="space-y-2">
                {(!activeTab.assertions || activeTab.assertions.length === 0) ? (
                  <div className="text-center p-6 bg-[#07090E] border border-slate-850 border-dashed rounded-xl text-slate-500 text-xs font-mono">
                    No active assertions. Add status code (e.g. 200) or latency checks.
                  </div>
                ) : (
                  activeTab.assertions.map((rule) => (
                    <div key={rule.id} className="flex flex-col gap-2 bg-[#07090E] p-3 rounded-xl border border-slate-850 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rule Matcher</span>
                        <button
                          type="button"
                          onClick={() => removeAssertion(rule.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <select
                          value={rule.type}
                          onChange={(e) => updateAssertion(rule.id, { type: e.target.value as any, value: e.target.value === 'graphql_no_errors' ? '' : rule.value })}
                          className="w-full bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 font-bold text-xs"
                        >
                          <option value="status">HTTP Status Code</option>
                          <option value="latency">Max Latency SLA (ms)</option>
                          <option value="body_contains">Body contains string</option>
                          <option value="json_path">JSON Path matcher</option>
                          <option value="header_matches">Header key/value match</option>
                        </select>

                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => updateAssertion(rule.id, { value: e.target.value })}
                          placeholder={
                            rule.type === 'status' ? "e.g. 200 or 2xx" :
                            rule.type === 'latency' ? "e.g. 500" :
                            rule.type === 'body_contains' ? "expected text" : "expected value"
                          }
                          className="w-full bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 placeholder-slate-600 outline-none text-xs"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* TAB 6: EXTRACTORS */}
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
                  className="text-emerald-400 hover:text-white transition-colors p-1 px-2.5 bg-[#141C2B] hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold border border-slate-700/50"
                >
                  <Plus size={12} /> ADD EXTRACTOR
                </button>
              </div>
              <div className="space-y-2">
                {(!activeTab.extractors || activeTab.extractors.length === 0) ? (
                  <div className="text-center p-6 bg-[#07090E] border border-slate-850 border-dashed rounded-xl text-slate-500 text-xs font-mono">
                    No chained extractors configured. Map response JSON path to environment variables.
                  </div>
                ) : (
                  activeTab.extractors.map((ext) => (
                    <div key={ext.id} className="flex gap-2 bg-[#07090E] p-3 rounded-xl border border-slate-850 font-mono text-xs items-center">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={ext.jsonPath}
                          onChange={(e) => {
                            const updatedList = activeTab.extractors?.map(item => item.id === ext.id ? { ...item, jsonPath: e.target.value } : item) || [];
                            updateActiveTab({ extractors: updatedList });
                          }}
                          placeholder="JSON Path e.g. token"
                          className="w-full bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 outline-none text-xs"
                        />
                        <input
                          type="text"
                          value={ext.variableName}
                          onChange={(e) => {
                            const updatedList = activeTab.extractors?.map(item => item.id === ext.id ? { ...item, variableName: e.target.value.toUpperCase() } : item) || [];
                            updateActiveTab({ extractors: updatedList });
                          }}
                          placeholder="Target Var e.g. AUTH_TOKEN"
                          className="w-full bg-[#10141F] border border-slate-800 rounded px-2.5 py-1.5 text-emerald-400 outline-none text-xs"
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

          {/* TAB 7: LOAD SETTINGS & PRESETS */}
          {activeRequestTab === 'loadSettings' && (
            <section className="space-y-4 animate-fadeIn font-mono text-xs">
              <div className="flex items-center justify-between select-none">
                <label className="text-xs uppercase font-black text-rose-400 tracking-wider flex items-center gap-2">
                  <Flame size={13} className="text-rose-400" /> Autocannon Benchmark Parameters
                </label>
              </div>

              {/* 1-Click Load Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { name: 'Smoke Test', conns: 10, dur: 5, pipe: 1, desc: 'Quick baseline check' },
                  { name: 'Sustained Stress', conns: 50, dur: 10, pipe: 1, desc: 'Real-world load' },
                  { name: 'Peak Blast', conns: 100, dur: 15, pipe: 4, desc: 'Max socket saturation' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      updateActiveTab({
                        testConfig: {
                          ...activeTab.testConfig,
                          connections: preset.conns,
                          duration: preset.dur,
                          pipelining: preset.pipe
                        }
                      });
                    }}
                    className="p-3 bg-[#07090E] hover:bg-[#0E131F] border border-slate-850 hover:border-rose-500/40 rounded-xl text-left transition-all cursor-pointer group"
                  >
                    <div className="font-bold text-slate-200 group-hover:text-rose-400 flex items-center justify-between">
                      <span>{preset.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{preset.conns}c • {preset.dur}s</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 mt-1 font-sans">{preset.desc}</p>
                  </button>
                ))}
              </div>

              {/* Sliders and Numerical Inputs */}
              <div className="bg-[#07090E] p-4 rounded-xl border border-slate-850 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Concurrent Sockets (Connections):</span>
                    <strong className="text-rose-400 font-black">{activeTab.testConfig?.connections || 50} connections</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="500"
                    step="5"
                    value={activeTab.testConfig?.connections || 50}
                    onChange={(e) => updateActiveTab({ testConfig: { ...activeTab.testConfig, connections: parseInt(e.target.value, 10) || 50 } })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Test Duration:</span>
                    <strong className="text-rose-400 font-black">{activeTab.testConfig?.duration || 10} seconds</strong>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="60"
                    step="1"
                    value={activeTab.testConfig?.duration || 10}
                    onChange={(e) => updateActiveTab({ testConfig: { ...activeTab.testConfig, duration: parseInt(e.target.value, 10) || 10 } })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">HTTP/1.1 Pipelining Factor:</span>
                    <strong className="text-rose-400 font-black">{activeTab.testConfig?.pipelining || 1}</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={activeTab.testConfig?.pipelining || 1}
                    onChange={(e) => updateActiveTab({ testConfig: { ...activeTab.testConfig, pipelining: parseInt(e.target.value, 10) || 1 } })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>
              </div>
            </section>
          )}

        </div>
      </div>

      {/* Vertical split draggable slider resizer bar */}
      <div 
        onMouseDown={() => setIsDraggingSplit(true)}
        className="hidden lg:flex w-1.5 hover:w-1.5 bg-[#0B0D13] hover:bg-emerald-500 cursor-col-resize items-center justify-center transition-all shrink-0 border-x border-slate-850 group z-20"
        title="Drag left or right to resize panels"
      >
        <div className="w-[1.5px] h-12 bg-slate-700 group-hover:bg-emerald-300 rounded" />
      </div>

      {/* RHS: Mode-Adaptive Chrome DevTools Network Inspector & Benchmarks */}
      <div 
        style={windowWidth >= 1024 ? resolvedRightWidthStyle : undefined}
        className={cn(
          "flex flex-col bg-[#07090E] overflow-hidden",
          windowWidth >= 1024 ? "w-auto lg:flex-1 h-full border-t lg:border-t-0 border-slate-850" : (activeMobilePanel === 'response' ? "w-full flex-1" : "hidden")
        )}
      >
        {currentTestMode === 'load' ? (
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
        ) : currentTestMode === 'race' ? (
          <BatchViewer 
            results={activeTab.batchResults || []} 
            progress={activeTab.progress} 
            concurrency={activeTab.testConfig?.concurrency || activeTab.batchConcurrency || 5} 
            onAbort={handleAbort} 
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
