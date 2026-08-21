import React, { useState, useEffect, useMemo } from 'react';
import { 
  Terminal, 
  Copy, 
  AlertTriangle, 
  Layout, 
  Activity, 
  Info, 
  RefreshCw, 
  FileJson, 
  Cpu, 
  Server, 
  HardDrive, 
  Zap, 
  Check, 
  BarChart2,
  Code,
  ShieldCheck,
  WrapText,
  CornerDownRight,
  Clock,
  Send,
  Eye,
  FileText,
  AlignLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurlResult } from '@/server/modules/curl-engine';
import { JsonInteractiveNode } from './JsonInteractiveNode';

export type OutputTabType = 'headers' | 'payload' | 'preview' | 'response' | 'timing' | 'terminal' | 'assertions' | 'metrics';

interface ResponseViewerProps {
  result: CurlResult | null;
  loading: boolean;
  onAbort: () => void;
  theme?: 'dark' | 'light';
  defaultTab?: OutputTabType | 'log';
}

const OUTPUT_TABS_CONFIG: { 
  id: OutputTabType; 
  label: string; 
  icon: React.ComponentType<{ size?: number; className?: string }>; 
  iconColor: string; 
}[] = [
  { id: 'headers', label: 'Headers', icon: Code, iconColor: 'text-amber-400' },
  { id: 'payload', label: 'Payload', icon: Send, iconColor: 'text-cyan-400' },
  { id: 'preview', label: 'Preview', icon: Eye, iconColor: 'text-purple-400' },
  { id: 'response', label: 'Response', icon: FileText, iconColor: 'text-sky-400' },
  { id: 'timing', label: 'Timing', icon: Clock, iconColor: 'text-emerald-400' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, iconColor: 'text-emerald-400' },
  { id: 'assertions', label: 'Assertions', icon: ShieldCheck, iconColor: 'text-rose-400' },
  { id: 'metrics', label: 'System & CPU', icon: Cpu, iconColor: 'text-amber-400' },
];

export function ResponseViewer({ 
  result, 
  loading, 
  onAbort, 
  theme = 'dark',
  defaultTab = 'headers'
}: ResponseViewerProps) {
  const [activeResTab, setActiveResTab] = useState<OutputTabType>(() => {
    if (defaultTab === 'log') return 'terminal';
    return (defaultTab as OutputTabType) || 'headers';
  });

  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState<'request' | 'response' | null>(null);
  const [wrapTerminalText, setWrapTerminalText] = useState(true);
  const [wrapResponseText, setWrapResponseText] = useState(true);
  const [rawHeadersMode, setRawHeadersMode] = useState<{ request: boolean; response: boolean }>({
    request: false,
    response: false
  });
  const [prettyPrintJson, setPrettyPrintJson] = useState(true);

  const [responseBoxHeight, setResponseBoxHeight] = useState<number>(450);
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startResizeResponse = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = responseBoxHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setResponseBoxHeight(Math.max(150, Math.min(1200, startHeight + deltaY)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (defaultTab) {
      setActiveResTab(defaultTab === 'log' ? 'terminal' : (defaultTab as OutputTabType));
    }
  }, [defaultTab, result?.id]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-[#07090E] space-y-8 min-h-[300px]">
        <div className="text-center space-y-4 relative z-10">
          <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
            <RefreshCw size={24} className="text-emerald-500 animate-spin" />
            <div className="absolute inset-0 bg-emerald-500/10 blur-2xl animate-pulse"></div>
          </div>
          <div className="space-y-1">
            <p className="text-emerald-400 font-bold text-xs tracking-widest uppercase">TRANSMITTING REQUEST...</p>
            <p className="text-slate-500 font-mono text-[10px]">Awaiting server network response</p>
          </div>
        </div>
        <button 
          onClick={onAbort}
          className="px-6 py-2 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white font-mono font-bold text-[10px] uppercase tracking-wider transition-all rounded active:scale-95 relative z-10 cursor-pointer"
        >
          Cancel Request
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-600 bg-[#07090E] min-h-[300px]">
        <div className="p-4 rounded-full border border-dashed border-slate-800 mb-4 opacity-40">
          <Activity size={32} className="text-slate-500" />
        </div>
        <h3 className="font-mono font-bold text-slate-400 text-xs tracking-wider uppercase mb-1">NO NETWORK TRANSACTION SELECTED</h3>
        <p className="text-[11px] max-w-[280px] font-sans text-slate-500">
          Send a request or select an entry from the Network log table to inspect Headers, Payload, Preview, Response, Timing, and CLI output.
        </p>
      </div>
    );
  }

  const isSuccess = result.status >= 200 && result.status < 300;
  
  // Calculate size in readable format
  const bodyLength = result.body ? result.body.length : 0;
  const formattedSize = bodyLength > 1024 
    ? `${(bodyLength / 1024).toFixed(1)} KB` 
    : `${bodyLength} B`;

  const reqLength = result.requestSize !== undefined ? result.requestSize : 0;
  const formattedReqSize = reqLength > 1024
    ? `${(reqLength / 1024).toFixed(1)} KB`
    : `${reqLength} B`;

  const curlCommandString = result.curlCommand || `curl -i -X ${result.config?.method || 'GET'} "${result.config?.url || ''}"`;

  // Parse URL & query params
  let parsedUrl: URL | null = null;
  let queryParamsList: [string, string][] = [];
  try {
    if (result.config?.url) {
      parsedUrl = new URL(result.config.url);
      queryParamsList = Array.from(parsedUrl.searchParams.entries());
    }
  } catch {
    // fallback
  }

  // Request Headers (reconstructed or from config)
  const requestHeaders = result.config?.headers || {
    'User-Agent': 'curl/8.4.0 (DevTools Network Inspector)',
    'Accept': '*/*',
    ...(result.config?.body ? { 'Content-Type': 'application/json' } : {})
  };

  // Timing waterfall calculation based on actual responseTime
  const totalTime = Math.max(result.responseTime, 1);
  const queueTime = Math.max(0.5, Number((totalTime * 0.03).toFixed(1)));
  const dnsTime = Math.max(0.8, Number((totalTime * 0.07).toFixed(1)));
  const connectTime = Math.max(1.2, Number((totalTime * 0.12).toFixed(1)));
  const sslTime = result.config?.url?.startsWith('https') ? Math.max(1.5, Number((totalTime * 0.14).toFixed(1))) : 0;
  const sendTime = Math.max(0.4, Number((totalTime * 0.04).toFixed(1)));
  const ttfbTime = Math.max(1.0, Number((totalTime - (queueTime + dnsTime + connectTime + sslTime + sendTime + (totalTime * 0.08))).toFixed(1)));
  const downloadTime = Math.max(0.6, Number((totalTime * 0.08).toFixed(1)));

  return (
    <div className="flex flex-col bg-[#07090E] h-full overflow-hidden font-sans select-text">
      
      {/* DevTools Chrome Sub-Tabs Bar */}
      <div className="flex flex-col border-b border-slate-850 bg-[#0B0E14] shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#090C12] border-b border-slate-850">
          
          {/* Chrome DevTools Tabs List */}
          <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {OUTPUT_TABS_CONFIG.map(tab => {
              const Icon = tab.icon;
              const isActive = activeResTab === tab.id;

              return (
                <button 
                  key={tab.id}
                  onClick={() => setActiveResTab(tab.id)}
                  className={cn(
                    "text-[11px] px-3 py-1 font-medium transition-all cursor-pointer select-none flex items-center gap-1.5 shrink-0 border-b-2", 
                    isActive 
                      ? "border-sky-400 text-sky-400 font-bold bg-[#141A24]" 
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#10141D]"
                  )}
                >
                  <Icon size={12} className={isActive ? tab.iconColor : 'opacity-60'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Telemetry Indicators */}
          <div className="flex items-center gap-2 text-[10.5px] font-mono shrink-0">
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold border",
              isSuccess 
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40" 
                : "bg-rose-950/40 text-rose-400 border-rose-800/40"
            )}>
              {result.status} {isSuccess ? 'OK' : ''}
            </span>
            <span className="text-slate-400 font-bold">{result.responseTime} ms</span>
            <span className="text-slate-500 font-medium">{formattedSize}</span>
          </div>
        </div>
      </div>

      {/* Tab Content Display Area */}
      <div 
        className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#07090E] text-slate-300 text-xs font-mono select-text"
      >
        
        {/* ============================================================ */}
        {/* 1. GOOGLE DEVTOOLS HEADERS TAB                               */}
        {/* ============================================================ */}
        {activeResTab === 'headers' && (
          <div className="space-y-6 max-w-5xl font-sans">
            
            {/* GENERAL SECTION */}
            <div className="space-y-2 border-b border-slate-800/80 pb-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <ChevronDown size={14} className="text-sky-400" /> General
                </h4>
              </div>
              <div className="bg-[#0B0E14] border border-slate-850 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold w-36 shrink-0">Request URL:</span>
                  <span className="text-sky-400 font-medium break-all selection:bg-sky-500/30">{result.config?.url || 'N/A'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold w-36 shrink-0">Request Method:</span>
                  <span className="text-emerald-400 font-bold">{result.config?.method || 'GET'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold w-36 shrink-0">Status Code:</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", isSuccess ? "bg-emerald-400" : "bg-rose-400")} />
                    <span className={cn("font-bold", isSuccess ? "text-emerald-400" : "text-rose-400")}>
                      {result.status} {isSuccess ? 'OK' : 'RESPONSE'}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold w-36 shrink-0">Remote Address:</span>
                  <span className="text-slate-300">{result.simulatedIp || '127.0.0.1:443'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-400 font-semibold w-36 shrink-0">Referrer Policy:</span>
                  <span className="text-slate-400">strict-origin-when-cross-origin</span>
                </div>
              </div>
            </div>

            {/* RESPONSE HEADERS SECTION */}
            <div className="space-y-2 border-b border-slate-800/80 pb-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <ChevronDown size={14} className="text-amber-400" /> Response Headers ({Object.keys(result.headers || {}).length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRawHeadersMode(prev => ({ ...prev, response: !prev.response }))}
                    className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 cursor-pointer"
                  >
                    {rawHeadersMode.response ? 'view parsed' : 'view source'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = Object.entries(result.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
                      navigator.clipboard.writeText(text);
                      setCopiedHeaders('response');
                      setTimeout(() => setCopiedHeaders(null), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 cursor-pointer flex items-center gap-1"
                  >
                    {copiedHeaders === 'response' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    <span>{copiedHeaders === 'response' ? 'copied' : 'copy'}</span>
                  </button>
                </div>
              </div>

              {rawHeadersMode.response ? (
                <div className="bg-[#0B0E14] border border-slate-850 rounded-lg p-3 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                  {`HTTP/1.1 ${result.status} ${isSuccess ? 'OK' : ''}\n` + 
                   Object.entries(result.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}
                </div>
              ) : (
                <div className="bg-[#0B0E14] border border-slate-850 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
                  {Object.entries(result.headers || {}).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2 border-b border-slate-900/60 pb-1 last:border-0 last:pb-0">
                      <span className="text-sky-300 font-semibold w-48 shrink-0 break-all">{key}:</span>
                      <span className="text-slate-300 break-all">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* REQUEST HEADERS SECTION */}
            <div className="space-y-2 border-b border-slate-800/80 pb-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <ChevronDown size={14} className="text-cyan-400" /> Request Headers ({Object.keys(requestHeaders).length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRawHeadersMode(prev => ({ ...prev, request: !prev.request }))}
                    className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 cursor-pointer"
                  >
                    {rawHeadersMode.request ? 'view parsed' : 'view source'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = Object.entries(requestHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
                      navigator.clipboard.writeText(text);
                      setCopiedHeaders('request');
                      setTimeout(() => setCopiedHeaders(null), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 cursor-pointer flex items-center gap-1"
                  >
                    {copiedHeaders === 'request' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    <span>{copiedHeaders === 'request' ? 'copied' : 'copy'}</span>
                  </button>
                </div>
              </div>

              {rawHeadersMode.request ? (
                <div className="bg-[#0B0E14] border border-slate-850 rounded-lg p-3 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                  {`${result.config?.method || 'GET'} ${parsedUrl ? parsedUrl.pathname + parsedUrl.search : '/'} HTTP/1.1\n` + 
                   Object.entries(requestHeaders).map(([k, v]) => `${k}: ${v}`).join('\n')}
                </div>
              ) : (
                <div className="bg-[#0B0E14] border border-slate-850 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
                  {Object.entries(requestHeaders).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2 border-b border-slate-900/60 pb-1 last:border-0 last:pb-0">
                      <span className="text-sky-300 font-semibold w-48 shrink-0 break-all">{key}:</span>
                      <span className="text-slate-300 break-all">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* QUERY STRING PARAMETERS (IF ANY) */}
            {queryParamsList.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <ChevronDown size={14} className="text-emerald-400" /> Query String Parameters ({queryParamsList.length})
                </h4>
                <div className="bg-[#0B0E14] border border-slate-850 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
                  {queryParamsList.map(([key, val], idx) => (
                    <div key={idx} className="flex items-start gap-2 border-b border-slate-900/60 pb-1 last:border-0 last:pb-0">
                      <span className="text-emerald-400 font-semibold w-48 shrink-0 break-all">{key}:</span>
                      <span className="text-slate-300 break-all">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ============================================================ */}
        {/* 2. GOOGLE DEVTOOLS PAYLOAD TAB                                */}
        {/* ============================================================ */}
        {activeResTab === 'payload' && (
          <div className="space-y-6 max-w-5xl font-sans">
            
            {/* QUERY STRING PARAMETERS SECTION (DEVTOOLS STYLE) */}
            {queryParamsList.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                    <ChevronDown size={14} className="text-emerald-400" /> Query String Parameters ({queryParamsList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const qs = queryParamsList.map(([k, v]) => `${k}: ${v}`).join('\n');
                      navigator.clipboard.writeText(qs);
                      setCopiedRaw(true);
                      setTimeout(() => setCopiedRaw(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 cursor-pointer flex items-center gap-1 font-mono"
                  >
                    {copiedRaw ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    <span>{copiedRaw ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
                <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-3 space-y-1 font-mono text-[11px]">
                  {queryParamsList.map(([k, v], idx) => (
                    <div key={idx} className="flex items-start gap-2 border-b border-slate-900/60 pb-1 last:border-0 last:pb-0">
                      <span className="text-emerald-400 font-semibold w-40 shrink-0 break-all">{k}:</span>
                      <span className="text-slate-300 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REQUEST PAYLOAD BODY SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Send size={13} className="text-cyan-400" /> Request Payload (Body)
                </h4>
                {result.config?.body && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(result.config?.body || '');
                      setCopiedRaw(true);
                      setTimeout(() => setCopiedRaw(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer flex items-center gap-1 font-mono"
                  >
                    {copiedRaw ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    <span>{copiedRaw ? 'COPIED' : 'COPY'}</span>
                  </button>
                )}
              </div>

              {result.config?.body ? (() => {
                try {
                  const parsed = JSON.parse(result.config.body);
                  return (
                    <div className="space-y-2">
                      <div className="text-[10.5px] font-mono text-slate-400 flex items-center gap-1.5">
                        <FileJson size={12} className="text-cyan-400" />
                        <span>Interactive JSON Payload (Click to expand/collapse keys)</span>
                      </div>
                      <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-4 font-mono text-xs">
                        <JsonInteractiveNode val={parsed} defaultCollapsed={false} isLast={true} />
                      </div>
                    </div>
                  );
                } catch {
                  return (
                    <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap break-all">
                      {result.config.body}
                    </div>
                  );
                }
              })() : queryParamsList.length === 0 ? (
                <div className="p-8 bg-[#0B0E14] border border-slate-850 rounded-xl text-slate-500 text-center font-mono text-xs">
                  <p className="text-slate-400 font-bold mb-1">No Request Payload</p>
                  <p className="text-[11px] text-slate-500">This request ({result.config?.method || 'GET'}) was submitted without a body payload or query string.</p>
                </div>
              ) : null}
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* 3. GOOGLE DEVTOOLS PREVIEW TAB                               */}
        {/* ============================================================ */}
        {activeResTab === 'preview' && (() => {
          const bodyStr = (result.body || '').trim();
          if (!bodyStr) {
            return (
              <div className="p-8 bg-[#0B0E14] border border-slate-850 rounded-xl text-slate-500 text-center font-mono text-xs">
                Empty response body preview (Status code: {result.status}).
              </div>
            );
          }

          // Try parsing JSON
          try {
            const json = JSON.parse(bodyStr);
            return (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                    <FileJson size={13} className="text-purple-400" /> Parsed JSON Object Tree (Click nodes to expand/collapse)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(json, null, 2));
                      setCopiedRaw(true);
                      setTimeout(() => setCopiedRaw(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer flex items-center gap-1 font-mono"
                  >
                    {copiedRaw ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    <span>{copiedRaw ? 'COPIED' : 'COPY JSON'}</span>
                  </button>
                </div>
                <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-4 font-mono text-xs">
                  <JsonInteractiveNode val={json} isLast={true} defaultCollapsed={false} />
                </div>
              </div>
            );
          } catch {
            // Check if HTML document
            if (bodyStr.startsWith('<!DOCTYPE') || bodyStr.startsWith('<html') || bodyStr.includes('<body')) {
              return (
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-400 text-[11px] font-bold">
                      <Layout size={14} /> Rendered HTML Document Preview
                    </div>
                    <button 
                      onClick={() => {
                        const blob = new Blob([result.body || ''], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      }}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline uppercase flex items-center gap-1"
                    >
                      <ExternalLink size={11} /> Open in New Tab
                    </button>
                  </div>
                  <div className="bg-white rounded-lg overflow-hidden border border-slate-700 min-h-[350px]">
                    <iframe
                      srcDoc={result.body}
                      title="HTML Preview"
                      sandbox="allow-scripts"
                      className="w-full h-[400px] border-0"
                    />
                  </div>
                </div>
              );
            }

            // Raw preview fallback
            return (
              <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap break-all">
                {bodyStr}
              </div>
            );
          }
        })()}

        {/* ============================================================ */}
        {/* 4. GOOGLE DEVTOOLS RESPONSE TAB (RAW BODY + LINE NUMBERS)    */}
        {/* ============================================================ */}
        {activeResTab === 'response' && (() => {
          const bodyStr = result.body || '';
          
          let displayBody = bodyStr;
          if (prettyPrintJson) {
            try {
              const parsed = JSON.parse(bodyStr);
              displayBody = JSON.stringify(parsed, null, 2);
            } catch {
              displayBody = bodyStr;
            }
          }

          const lines = displayBody.split('\n');

          return (
            <div className="space-y-3 font-sans">
              {/* Response action toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <FileText size={13} className="text-sky-400" />
                    <strong>{lines.length}</strong> lines
                  </span>
                  <span>•</span>
                  <span><strong>{formattedSize}</strong></span>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <button
                    type="button"
                    onClick={() => setPrettyPrintJson(!prettyPrintJson)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer",
                      prettyPrintJson 
                        ? "bg-slate-800 text-sky-400 border-slate-700" 
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                    )}
                    title="Toggle JSON Pretty-Print format"
                  >
                    {'{ }'} Pretty Print
                  </button>

                  <button
                    type="button"
                    onClick={() => setWrapResponseText(!wrapResponseText)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1",
                      wrapResponseText 
                        ? "bg-slate-800 text-emerald-400 border-slate-700" 
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                    )}
                  >
                    <WrapText size={11} />
                    <span>{wrapResponseText ? 'Wrap' : 'No Wrap'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(displayBody);
                      setCopiedRaw(true);
                      setTimeout(() => setCopiedRaw(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {copiedRaw ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedRaw ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Code display with line numbers */}
              <div className="bg-[#0B0E14] border border-slate-850 rounded-xl overflow-hidden shadow-inner">
                <div className="flex font-mono text-xs leading-relaxed overflow-x-auto custom-scrollbar">
                  
                  {/* Line numbers column */}
                  <div className="py-3 px-3 bg-[#080B10] text-slate-600 text-right select-none border-r border-slate-850 shrink-0 font-mono text-[11px]">
                    {lines.map((_, idx) => (
                      <div key={idx} className="h-5">{idx + 1}</div>
                    ))}
                  </div>

                  {/* Line content */}
                  <div className={cn(
                    "py-3 px-4 flex-1 text-slate-200 selection:bg-sky-500/30 text-[11.5px]",
                    wrapResponseText ? "whitespace-pre-wrap break-all" : "whitespace-pre"
                  )}>
                    {lines.map((line, idx) => (
                      <div key={idx} className="h-5 leading-5">{line || ' '}</div>
                    ))}
                  </div>

                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* 5. GOOGLE DEVTOOLS TIMING TAB (WATERFALL BREAKDOWN)          */}
        {/* ============================================================ */}
        {activeResTab === 'timing' && (
          <div className="space-y-6 max-w-4xl font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Clock size={13} className="text-emerald-400" /> Request Timing Breakdown
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Connection lifecycle and server processing metrics</p>
              </div>
              <div className="font-mono text-right">
                <span className="text-xs text-slate-400">Total Duration: </span>
                <strong className="text-emerald-400 text-sm font-black">{totalTime} ms</strong>
              </div>
            </div>

            {/* Waterfall Breakdown Chart */}
            <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-5 space-y-4">
              
              {/* Resource Scheduling */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Resource Scheduling</span>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-900">
                  <span className="text-slate-300">Queueing</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-slate-500 h-full rounded-full" style={{ width: `${Math.min(100, (queueTime / totalTime) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-slate-400 w-16 text-right">{queueTime} ms</span>
                  </div>
                </div>
              </div>

              {/* Connection Setup */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Connection Start</span>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-900">
                  <span className="text-slate-300">DNS Lookup</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-sky-400 h-full rounded-full" style={{ width: `${Math.min(100, (dnsTime / totalTime) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-sky-400 w-16 text-right">{dnsTime} ms</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-900">
                  <span className="text-slate-300">Initial Connection (TCP)</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min(100, (connectTime / totalTime) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-amber-400 w-16 text-right">{connectTime} ms</span>
                  </div>
                </div>
                {sslTime > 0 && (
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-900">
                    <span className="text-slate-300">SSL Handshake</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden flex">
                        <div className="bg-purple-400 h-full rounded-full" style={{ width: `${Math.min(100, (sslTime / totalTime) * 100)}%` }} />
                      </div>
                      <span className="font-mono text-purple-400 w-16 text-right">{sslTime} ms</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Request / Response Execution */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Request / Response</span>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-900">
                  <span className="text-slate-300">Request Sent</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${Math.min(100, (sendTime / totalTime) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-cyan-400 w-16 text-right">{sendTime} ms</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-900">
                  <span className="text-slate-200 font-bold">Waiting for server response (TTFB)</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(100, (ttfbTime / totalTime) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-emerald-400 font-bold w-16 text-right">{ttfbTime} ms</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-300">Content Download</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-900 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-blue-400 h-full rounded-full" style={{ width: `${Math.min(100, (downloadTime / totalTime) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-blue-400 w-16 text-right">{downloadTime} ms</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 6. TERMINAL CLI TAB                                          */}
        {/* ============================================================ */}
        {activeResTab === 'terminal' && (() => {
          const method = result.config?.method || 'GET';
          const url = result.config?.url || '';
          let hostname = 'target-host';
          try {
            hostname = new URL(url).hostname;
          } catch {
            hostname = url;
          }

          return (
            <div className="space-y-4 font-mono text-xs">
              <div className="rounded-xl border border-slate-800/90 bg-[#07090F] overflow-hidden shadow-2xl">
                {/* Terminal Header Chrome */}
                <div className="flex items-center justify-between px-3.5 py-2 bg-[#0E121B] border-b border-slate-800/80 select-none">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold ml-2">bash — curl transmission</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWrapTerminalText(!wrapTerminalText)}
                      className={cn(
                        "text-[9.5px] px-2 py-0.5 rounded border transition-colors cursor-pointer",
                        wrapTerminalText ? "bg-slate-800 text-emerald-400 border-slate-700" : "bg-black/50 text-slate-400 border-slate-800"
                      )}
                    >
                      {wrapTerminalText ? 'Wrap ON' : 'Wrap OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(curlCommandString);
                        setCopiedCurl(true);
                        setTimeout(() => setCopiedCurl(false), 2000);
                      }}
                      className="text-[9.5px] px-2 py-0.5 rounded bg-black/50 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Copy cURL command"
                    >
                      {copiedCurl ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      <span>{copiedCurl ? 'COPIED cURL' : 'COPY cURL'}</span>
                    </button>
                  </div>
                </div>

                {/* Terminal Body */}
                <div className={cn("p-4 space-y-3 bg-[#05070B] text-slate-300", wrapTerminalText ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto")}>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2 text-emerald-400">
                      <span className="text-slate-500 select-none font-bold">$</span>
                      <span className="font-bold text-white selection:bg-emerald-500/30">{curlCommandString}</span>
                    </div>
                  </div>

                  {/* Wire Handshakes */}
                  <div className="text-[11px] text-slate-500 space-y-0.5 border-l-2 border-slate-800 pl-3 my-2 select-none">
                    <div>* Trying {hostname}...</div>
                    <div>* Connected to {hostname} ({result.simulatedIp || '127.0.0.1'}) port {url.startsWith('https') ? '443' : '80'}</div>
                    {result.simulatedCountry && (
                      <div>* Simulated GeoIP Egress: {result.simulatedFlag} {result.simulatedCountry} ({result.simulatedRegion})</div>
                    )}
                    <div>* HTTP/1.1 {result.status} {isSuccess ? 'OK' : 'RESPONSE'} ({result.responseTime} ms)</div>
                  </div>

                  {result.error && (
                    <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded text-rose-400 font-mono text-[11px] space-y-1">
                      <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle size={12} /> Execution Error:
                      </div>
                      <div>{result.error}</div>
                    </div>
                  )}

                  {/* Wire output */}
                  <div className="pt-2 border-t border-slate-900 space-y-2">
                    <div className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider select-none flex items-center gap-1.5">
                      <CornerDownRight size={11} className="text-emerald-400" /> STDOUT / WIRE TRANSCRIPT:
                    </div>
                    
                    <pre className={cn(
                      "font-mono text-xs leading-relaxed text-emerald-400/90 selection:bg-emerald-500/30",
                      wrapTerminalText ? "whitespace-pre-wrap break-all" : "whitespace-pre"
                    )}>
                      {result.rawOutput ? result.rawOutput : (
                        <>
                          <span className="text-sky-400 font-bold block mb-1">
                            HTTP/1.1 {result.status} {isSuccess ? 'OK' : ''}
                          </span>
                          {Object.entries(result.headers || {}).map(([k, v]) => (
                            <span key={k} className="text-slate-400 block text-[11px]">
                              <strong className="text-sky-300 font-semibold">{k}:</strong> {v}
                            </span>
                          ))}
                          <span className="block my-2 text-slate-700">--- PAYLOAD BODY ---</span>
                          <span className="text-slate-200 block">
                            {result.body || '(empty response body)'}
                          </span>
                        </>
                      )}
                    </pre>
                  </div>

                  <div className="pt-3 border-t border-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 select-none">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", isSuccess ? "bg-emerald-400" : "bg-rose-400")} />
                      <span>Process completed with status <strong>{result.status}</strong> in <strong>{result.responseTime}ms</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* 7. ASSERTIONS TAB                                            */}
        {/* ============================================================ */}
        {activeResTab === 'assertions' && (() => {
          const assertionResults = (result as any).assertions || [];
          if (assertionResults.length === 0) {
            return (
              <div className="p-8 bg-[#0B0E14] border border-slate-850 rounded-xl text-slate-500 text-center font-mono text-xs space-y-2">
                <ShieldCheck size={28} className="mx-auto text-slate-600" />
                <div className="font-bold text-slate-400">NO TEST ASSERTIONS EVALUATED</div>
                <p className="text-[11px] font-sans text-slate-500">Configure assertion rules (Status Code, Latency SLA, Body Contains) in the request parameters panel.</p>
              </div>
            );
          }

          const passedCount = assertionResults.filter((a: any) => a.passed).length;
          const allPassed = passedCount === assertionResults.length;

          return (
            <div className="space-y-4 max-w-4xl font-sans">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <ShieldCheck size={14} className={allPassed ? "text-emerald-400" : "text-rose-400"} />
                  Test Assertions ({passedCount}/{assertionResults.length} Passed)
                </h4>
                <span className={cn(
                  "px-2.5 py-1 rounded text-xs font-bold font-mono border",
                  allPassed ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40" : "bg-rose-950/40 text-rose-400 border-rose-800/40"
                )}>
                  {allPassed ? 'ALL TESTS PASSED' : 'TESTS FAILED'}
                </span>
              </div>

              <div className="space-y-2">
                {assertionResults.map((item: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-3 rounded-lg border font-mono text-xs flex items-center justify-between",
                      item.passed 
                        ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300" 
                        : "bg-rose-950/20 border-rose-800/40 text-rose-300"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.passed ? <Check size={14} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={14} className="text-rose-400 shrink-0" />}
                      <div>
                        <div className="font-bold">{item.rule?.type?.toUpperCase() || 'ASSERTION'}: {item.rule?.expected}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">{item.message}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40">
                      {item.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* 8. SYSTEM TELEMETRY & CPU TAB                                */}
        {/* ============================================================ */}
        {activeResTab === 'metrics' && (() => {
          const metrics = result.systemMetrics;
          if (!metrics) {
            return (
              <div className="p-8 bg-[#0B0E14] border border-slate-850 rounded-xl text-slate-500 text-center font-mono text-xs">
                No server compute telemetry recorded for this request.
              </div>
            );
          }

          return (
            <div className="space-y-5 max-w-4xl font-sans">
              <div className="border-b border-slate-800 pb-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Cpu size={14} className="text-amber-400" /> Host Compute & Hardware Metrics
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Real-time CPU execution slice and V8 heap footprint</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-4 space-y-1 font-mono">
                  <div className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-400" /> Request CPU Time
                  </div>
                  <div className="text-xl font-bold text-amber-400">{metrics.cpuTotalMs} ms</div>
                  <div className="text-[10px] text-slate-400">User: {metrics.cpuUserMs}ms • Sys: {metrics.cpuSystemMs}ms</div>
                </div>

                <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-4 space-y-1 font-mono">
                  <div className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <HardDrive size={11} className="text-emerald-400" /> Memory Heap Used
                  </div>
                  <div className="text-xl font-bold text-emerald-400">{(metrics.memoryHeapUsedBytes / 1024 / 1024).toFixed(1)} MB</div>
                  <div className="text-[10px] text-slate-400">Total Heap: {(metrics.memoryHeapTotalBytes / 1024 / 1024).toFixed(1)} MB</div>
                </div>

                <div className="bg-[#0B0E14] border border-slate-850 rounded-xl p-4 space-y-1 font-mono">
                  <div className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1.5">
                    <Server size={11} className="text-sky-400" /> Host CPU Cores
                  </div>
                  <div className="text-xl font-bold text-sky-400">{metrics.cpuCores} Cores</div>
                  <div className="text-[10px] text-slate-400 truncate" title={metrics.cpuModel}>{metrics.cpuModel || 'Virtual Container'}</div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {/* Resize Handle for desktop */}
      <div 
        onMouseDown={startResizeResponse}
        className="hidden lg:flex h-1.5 hover:h-1.5 bg-[#0A0D14] hover:bg-sky-500 cursor-row-resize items-center justify-center transition-all group z-10 shrink-0 border-t border-slate-850"
        title="Drag up or down to resize response height"
      >
        <div className="w-12 h-1 bg-slate-700 group-hover:bg-sky-300 rounded" />
      </div>

    </div>
  );
}
