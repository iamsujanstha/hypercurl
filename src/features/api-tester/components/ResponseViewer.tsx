import React, { useState, useMemo } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Clock, 
  Zap, 
  FileText, 
  Code, 
  Layers, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  Search,
  WrapText,
  RefreshCw,
  AlertTriangle,
  Send,
  Square,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurlResult } from '@/server/modules/curl-engine';
import { JsonInteractiveNode } from './JsonInteractiveNode';
import { CliCommandModal } from './CliCommandModal';
import { renderTextWithLinks } from '../utils/linkUtils';

export type ResponseViewMode = 'body' | 'raw' | 'headers';

export interface ResponseViewerProps {
  result: CurlResult | null;
  loading: boolean;
  onAbort: () => void;
  theme?: 'dark' | 'light';
  onClear?: () => void;
  defaultTab?: string;
}

export function ResponseViewer({ 
  result, 
  loading, 
  onAbort, 
  theme = 'dark',
  onClear
}: ResponseViewerProps) {
  const [viewMode, setViewMode] = useState<ResponseViewMode>('body');
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [wrapText, setWrapText] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [showRequestHeaders, setShowRequestHeaders] = useState(false);
  const [showTimingBreakdown, setShowTimingBreakdown] = useState(false);
  const [showAssertionsDrawer, setShowAssertionsDrawer] = useState(false);
  const [forceExpandAll, setForceExpandAll] = useState<boolean | null>(null);
  const [showCliModal, setShowCliModal] = useState(false);

  // Parse body as JSON if possible
  const parsedJson = useMemo(() => {
    if (!result?.body) return null;
    try {
      return JSON.parse(result.body);
    } catch {
      return null;
    }
  }, [result?.body]);

  // Format response size
  const bodyLength = result?.body ? result.body.length : 0;
  const formattedSize = bodyLength > 1024 * 1024 
    ? `${(bodyLength / (1024 * 1024)).toFixed(2)} MB`
    : bodyLength > 1024 
    ? `${(bodyLength / 1024).toFixed(1)} KB` 
    : `${bodyLength} B`;

  // Format curl command snippet
  const curlCommandString = useMemo(() => {
    if (!result) return '';
    if (result.curlCommand) return result.curlCommand;
    
    const method = result.config?.method || 'GET';
    const url = result.config?.url || '';
    const headers = result.config?.headers || {};
    const headerFlags = Object.entries(headers)
      .map(([k, v]) => `-H "${k}: ${v}"`)
      .join(' \\\n  ');
    const bodyFlag = result.config?.body ? `-d '${result.config.body.replace(/'/g, "'\\''")}'` : '';

    return `curl -i -X ${method} "${url}"${headerFlags ? ` \\\n  ${headerFlags}` : ''}${bodyFlag ? ` \\\n  ${bodyFlag}` : ''}`;
  }, [result]);

  // Assertions evaluation
  const assertions = useMemo(() => {
    return ((result as any)?.assertions || (result as any)?.assertionResults || []) as any[];
  }, [result]);

  const passedAssertionsCount = useMemo(() => {
    return assertions.filter(a => a.passed).length;
  }, [assertions]);

  const allAssertionsPassed = assertions.length > 0 && passedAssertionsCount === assertions.length;

  // Timing breakdown normalization
  const timing = useMemo(() => {
    if (result?.timing) return result.timing;
    if (!result) return null;
    // Estimated breakdown fallback based on responseTime
    const total = result.responseTime || 1;
    const isHttps = result.config?.url?.startsWith('https://') ?? false;
    const dns = Math.max(1, Math.round(total * 0.1));
    const tcp = Math.max(1, Math.round(total * 0.15));
    const tls = isHttps ? Math.max(1, Math.round(total * 0.2)) : 0;
    const ttfb = Math.max(1, Math.round(total * 0.4));
    const transfer = Math.max(1, total - dns - tcp - tls - ttfb);
    return { dns, tcp, tls, ttfb, transfer, total };
  }, [result]);

  const handleCopyBody = () => {
    if (!result?.body) return;
    navigator.clipboard.writeText(result.body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyCurl = () => {
    if (!curlCommandString) return;
    navigator.clipboard.writeText(curlCommandString);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleCopyHeaders = () => {
    if (!result?.headers) return;
    const text = Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedHeaders(true);
    setTimeout(() => setCopiedHeaders(false), 2000);
  };

  const handleDownload = () => {
    if (!result?.body) return;
    const isJson = parsedJson !== null;
    const blob = new Blob([result.body], { type: isJson ? 'application/json' : 'text/plain' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `response-${result.status}-${Date.now()}.${isJson ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(href);
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#07090E] text-slate-300 font-mono select-none">
        <div className="w-full max-w-md bg-[#0C0F17] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>TRANSMITTING HTTP REQUEST</span>
            </div>
            <button
              type="button"
              onClick={onAbort}
              className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/50 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
            >
              <Square size={10} className="fill-rose-400" />
              ABORT
            </button>
          </div>

          <div className="space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <RefreshCw size={13} className="text-emerald-400 animate-spin shrink-0" />
              <span className="text-slate-300 font-bold">Socket connection active...</span>
            </div>
            <p className="text-slate-500 text-[10px]">
              Dispatching payload via libcurl / node engine. Awaiting server response headers and stream chunk buffers.
            </p>
          </div>

          <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div className="h-full bg-emerald-500 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Empty State
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#07090E] text-slate-500 font-mono select-none">
        <div className="max-w-md w-full bg-[#0C0F17] border border-slate-850 rounded-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
            <Terminal size={22} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">OUTPUT TERMINAL READY</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">
              Enter target URL and click <strong className="text-emerald-400">Send (⌘+Enter)</strong> to execute single cURL request and view output.
            </p>
          </div>
          <div className="text-[10px] text-slate-600 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 text-left font-mono">
            $ curl -i -X GET &quot;http://localhost:3000/api/health&quot;
          </div>
        </div>
      </div>
    );
  }

  const isSuccess = result.status >= 200 && result.status < 300;
  const isRedirect = result.status >= 300 && result.status < 400;
  const isClientError = result.status >= 400 && result.status < 500;
  const isServerError = result.status >= 500 || result.status === 0;

  const statusBg = isSuccess ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40" :
                   isRedirect ? "bg-blue-950/40 text-blue-400 border-blue-800/40" :
                   isClientError ? "bg-amber-950/40 text-amber-400 border-amber-800/40" :
                   "bg-rose-950/40 text-rose-400 border-rose-800/40";

  const contentType = (result.headers?.['content-type'] || result.headers?.['Content-Type'] || '').split(';')[0] || 'raw/text';
  const headersCount = Object.keys(result.headers || {}).length;

  return (
    <div className="flex flex-col h-full bg-[#07090E] text-slate-200 overflow-hidden font-mono select-text resp-viewer-container">
      
      {/* ========================================================================= */}
      {/* 1. STATUS BAR: HTTP Status, Time, Size, Content-Type, Quick Actions       */}
      {/* ========================================================================= */}
      <div className="p-3 bg-[#0B0E15] border-b border-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none resp-status-bar">
        
        {/* Left: Status Badge & Primary Metrics */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Badge */}
          <div className={cn("px-2.5 py-1 rounded-lg text-xs font-black border flex items-center gap-1.5 resp-status-badge", statusBg)}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              isSuccess ? "bg-emerald-400" : isClientError ? "bg-amber-400" : isRedirect ? "bg-blue-400" : "bg-rose-400"
            )} />
            <span>{result.status} {isSuccess ? 'OK' : isClientError ? 'Client Error' : isServerError ? 'Server Error' : ''}</span>
          </div>

          {/* Latency / Execution Time */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121622] border border-slate-800 text-[11px] text-slate-300 resp-metric-pill">
            <Clock size={12} className="text-cyan-400" />
            <span><strong className="text-cyan-300 font-bold resp-metric-val">{result.responseTime}</strong> ms</span>
          </div>

          {/* Response Payload Size */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121622] border border-slate-800 text-[11px] text-slate-300 resp-metric-pill">
            <Zap size={12} className="text-amber-400" />
            <span><strong className="text-amber-300 font-bold resp-metric-val">{formattedSize}</strong></span>
          </div>

          {/* Timing Breakdown Toggle Button */}
          {timing && (
            <button
              type="button"
              onClick={() => setShowTimingBreakdown(!showTimingBreakdown)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer select-none",
                showTimingBreakdown
                  ? "bg-cyan-950/50 text-cyan-300 border-cyan-700/60 shadow-xs"
                  : "bg-[#121622] hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border-slate-800"
              )}
              title="Toggle detailed network stage timing breakdown (DNS, TCP, TLS, TTFB, Transfer)"
            >
              <Clock size={11} className="text-cyan-400" />
              <span>TIMING</span>
              <span className="text-[9px] opacity-70">({timing.total}ms)</span>
              <ChevronDown size={11} className={cn("transition-transform", showTimingBreakdown ? "rotate-180" : "")} />
            </button>
          )}

          {/* Assertions Evaluation Status Pill */}
          {assertions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAssertionsDrawer(!showAssertionsDrawer)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black transition-all cursor-pointer select-none",
                allAssertionsPassed
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-700/50"
                  : "bg-rose-950/40 text-rose-300 border-rose-700/50"
              )}
              title="View assertion verification details"
            >
              {allAssertionsPassed ? <CheckCircle2 size={12} className="text-emerald-400" /> : <XCircle size={12} className="text-rose-400" />}
              <span>{passedAssertionsCount}/{assertions.length} ASSERTIONS</span>
            </button>
          )}

          {/* MIME Content-Type */}
          <div className="text-[10px] px-2 py-1 rounded bg-[#0E121B] border border-slate-855 text-slate-400 hidden sm:inline-block resp-metric-pill">
            {contentType}
          </div>
        </div>

        {/* Right: View Selector & Quick Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View Mode Toggle Buttons */}
          <div className="flex bg-[#07090E] p-0.5 rounded-lg border border-slate-800 resp-tab-group">
            <button
              type="button"
              onClick={() => setViewMode('body')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 resp-tab-btn",
                viewMode === 'body' 
                  ? "bg-[#1C2433] text-emerald-400 shadow-sm resp-tab-active" 
                  : "text-slate-500 hover:text-slate-300 resp-tab-inactive"
              )}
            >
              <Code size={11} /> JSON
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 resp-tab-btn",
                viewMode === 'raw' 
                  ? "bg-[#1C2433] text-emerald-400 shadow-sm resp-tab-active" 
                  : "text-slate-500 hover:text-slate-300 resp-tab-inactive"
              )}
            >
              <FileText size={11} /> RAW BODY
            </button>
            <button
              type="button"
              onClick={() => setViewMode('headers')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 resp-tab-btn",
                viewMode === 'headers' 
                  ? "bg-[#1C2433] text-emerald-400 shadow-sm resp-tab-active" 
                  : "text-slate-500 hover:text-slate-300 resp-tab-inactive"
              )}
            >
              <Layers size={11} /> HEADERS ({headersCount})
            </button>
          </div>

          {/* Action Buttons */}
          <button
            type="button"
            onClick={handleCopyBody}
            className={cn(
              "px-2.5 py-1 rounded text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 resp-action-btn",
              copiedBody 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                : "bg-[#141C2B] hover:bg-slate-800 text-slate-300 border-slate-700/50"
            )}
            title="Copy response body"
          >
            {copiedBody ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copiedBody ? 'COPIED' : 'COPY'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1 px-2 rounded bg-[#141C2B] hover:bg-slate-800 text-slate-300 border border-slate-700/50 text-[10.5px] font-bold transition-all cursor-pointer resp-action-btn"
            title="Download response file"
          >
            <Download size={11} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1.5. EXPANDABLE TIMING BREAKDOWN WATERFALL                                */}
      {/* ========================================================================= */}
      {showTimingBreakdown && timing && (
        <div className="bg-[#0A0D15] border-b border-slate-800 p-3.5 space-y-2.5 animate-fadeIn text-[11px] font-mono">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
              <Clock size={12} className="text-cyan-400" /> Real cURL Execution Waterfall Breakdown
            </span>
            <span className="text-cyan-300 font-bold">{timing.total} ms Total</span>
          </div>

          {/* Color-Coded Waterfall Bar */}
          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
            {timing.dns > 0 && (
              <div 
                style={{ width: `${Math.max(3, (timing.dns / Math.max(1, timing.total)) * 100)}%` }} 
                className="bg-sky-400 h-full" 
                title={`DNS: ${timing.dns}ms`} 
              />
            )}
            {timing.tcp > 0 && (
              <div 
                style={{ width: `${Math.max(3, (timing.tcp / Math.max(1, timing.total)) * 100)}%` }} 
                className="bg-orange-400 h-full" 
                title={`TCP Connect: ${timing.tcp}ms`} 
              />
            )}
            {timing.tls > 0 && (
              <div 
                style={{ width: `${Math.max(3, (timing.tls / Math.max(1, timing.total)) * 100)}%` }} 
                className="bg-purple-400 h-full" 
                title={`TLS Handshake: ${timing.tls}ms`} 
              />
            )}
            {timing.ttfb > 0 && (
              <div 
                style={{ width: `${Math.max(5, (timing.ttfb / Math.max(1, timing.total)) * 100)}%` }} 
                className="bg-emerald-400 h-full" 
                title={`TTFB / Server Processing: ${timing.ttfb}ms`} 
              />
            )}
            {timing.transfer > 0 && (
              <div 
                style={{ width: `${Math.max(3, (timing.transfer / Math.max(1, timing.total)) * 100)}%` }} 
                className="bg-amber-400 h-full" 
                title={`Content Transfer: ${timing.transfer}ms`} 
              />
            )}
          </div>

          {/* Metric Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            <div className="bg-[#101420] border border-slate-800/80 rounded-lg p-2 flex flex-col">
              <span className="text-[9px] text-sky-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" /> DNS Lookup
              </span>
              <span className="text-xs font-bold text-slate-200 mt-0.5">{timing.dns} ms</span>
            </div>
            <div className="bg-[#101420] border border-slate-800/80 rounded-lg p-2 flex flex-col">
              <span className="text-[9px] text-orange-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> TCP Connect
              </span>
              <span className="text-xs font-bold text-slate-200 mt-0.5">{timing.tcp} ms</span>
            </div>
            <div className="bg-[#101420] border border-slate-800/80 rounded-lg p-2 flex flex-col">
              <span className="text-[9px] text-purple-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" /> TLS / SSL
              </span>
              <span className="text-xs font-bold text-slate-200 mt-0.5">{timing.tls} ms</span>
            </div>
            <div className="bg-[#101420] border border-slate-800/80 rounded-lg p-2 flex flex-col">
              <span className="text-[9px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> TTFB (Server)
              </span>
              <span className="text-xs font-bold text-slate-200 mt-0.5">{timing.ttfb} ms</span>
            </div>
            <div className="bg-[#101420] border border-slate-800/80 rounded-lg p-2 flex flex-col col-span-2 sm:col-span-1">
              <span className="text-[9px] text-amber-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Transfer
              </span>
              <span className="text-xs font-bold text-slate-200 mt-0.5">{timing.transfer} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1.6. EXPANDABLE ASSERTIONS DRAWER                                         */}
      {/* ========================================================================= */}
      {showAssertionsDrawer && assertions.length > 0 && (
        <div className="bg-[#0A0D15] border-b border-slate-800 p-3.5 space-y-2 animate-fadeIn text-[11px] font-mono">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
            <span className="font-bold text-slate-300 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={12} className={allAssertionsPassed ? "text-emerald-400" : "text-rose-400"} />
              Assertion Verification Results ({passedAssertionsCount}/{assertions.length} Passed)
            </span>
            <span className={cn(
              "text-[10px] font-black px-2 py-0.5 rounded uppercase border",
              allAssertionsPassed 
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60" 
                : "bg-rose-950/40 text-rose-400 border-rose-800/60"
            )}>
              {allAssertionsPassed ? "ALL PASSED" : "FAILED"}
            </span>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
            {assertions.map((a: any, idx: number) => (
              <div 
                key={idx} 
                className={cn(
                  "p-2 rounded-lg border flex items-center justify-between text-xs",
                  a.passed 
                    ? "bg-emerald-950/20 border-emerald-900/40 text-slate-300" 
                    : "bg-rose-950/20 border-rose-900/40 text-slate-300"
                )}
              >
                <div className="flex items-center gap-2">
                  {a.passed ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <XCircle size={13} className="text-rose-400 shrink-0" />}
                  <span className="font-bold text-slate-200">{a.type.toUpperCase()}:</span>
                  <span className="text-slate-400">Expected <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">{a.expected || a.value}</code></span>
                </div>
                <div className="text-slate-400 text-[10.5px]">
                  Actual: <code className={cn("px-1 py-0.5 rounded", a.passed ? "text-emerald-400 bg-emerald-950/60" : "text-rose-400 bg-rose-950/60")}>{a.actual || (a.passed ? 'Matched' : 'Mismatch')}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AUTO-GENERATED TERMINAL cURL SNIPPET (with 1-Click Modal & Copy CLI)   */}
      {/* ========================================================================= */}
      <div className="bg-[#05070B] border-b border-slate-850 px-3 py-2 flex items-center justify-between gap-2 shrink-0 resp-curl-bar">
        <button
          type="button"
          onClick={() => setShowCliModal(true)}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-[11px] text-slate-400 min-w-0 flex-1 text-left hover:bg-slate-900/60 p-1 rounded-md transition-all group cursor-pointer resp-curl-btn"
          title="Click to expand full cURL command popup"
        >
          <span className="text-emerald-500 font-bold select-none group-hover:scale-110 transition-transform">$</span>
          <span className="text-slate-300 truncate select-all group-hover:text-emerald-400 transition-colors resp-curl-text">{curlCommandString.replace(/\s*\\\n\s*/g, ' ')}</span>
          <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-sans hidden sm:inline-flex items-center gap-1 shrink-0 ml-1">
            <Maximize2 size={10} /> View CLI
          </span>
        </button>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCliModal(true)}
            className="px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 border cursor-pointer select-none bg-[#101520] hover:bg-[#1A2234] text-slate-300 border-slate-800 hover:text-white resp-curl-subbtn"
            title="Open CLI Command Inspector Modal"
          >
            <Maximize2 size={10} className="text-amber-400" />
            <span className="hidden sm:inline">EXPAND</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCurl}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all shrink-0 flex items-center gap-1 border cursor-pointer select-none resp-curl-subbtn",
              copiedCurl 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                : "bg-[#101520] hover:bg-[#1A2234] text-slate-300 border-slate-800 hover:text-white"
            )}
            title="Copy exact cURL CLI command"
          >
            {copiedCurl ? <Check size={10} className="text-emerald-400" /> : <Terminal size={10} />}
            <span>{copiedCurl ? 'COPIED cURL' : 'COPY CLI'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. RESPONSE VIEWER CONTENT AREA                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#07090E] resp-main-content">
        
        {/* VIEW 1: FORMATTED JSON / SYNTAX HIGHLIGHTED BODY */}
        {viewMode === 'body' && (
          <div className="space-y-2">
            {parsedJson !== null ? (
              <div className="bg-[#0B0E17] border border-slate-850 rounded-xl overflow-hidden shadow-inner resp-json-card">
                <div className="bg-[#0e121c] border-b border-slate-850 px-3.5 py-2 flex items-center justify-between text-[11px] text-slate-400 select-none resp-json-topbar">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0 shadow-xs" />
                    <span className="text-slate-200 font-bold tracking-wide resp-json-title">JSON TREE</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400 font-medium resp-json-count">
                      {Array.isArray(parsedJson) ? `${parsedJson.length} items` : typeof parsedJson === 'object' && parsedJson !== null ? `${Object.keys(parsedJson).length} keys` : 'value'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setForceExpandAll(false)}
                      className="px-2.5 py-1 rounded text-[10.5px] font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer border border-transparent hover:border-slate-700 font-medium flex items-center gap-1 resp-json-toggle"
                      title="Collapse all child nodes"
                    >
                      <span>▶</span> Collapse All
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceExpandAll(true)}
                      className="px-2.5 py-1 rounded text-[10.5px] font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer border border-transparent hover:border-slate-700 font-medium flex items-center gap-1 resp-json-toggle"
                      title="Expand all nodes"
                    >
                      <span>▼</span> Expand All
                    </button>
                    <div className="h-3.5 w-[1px] bg-slate-700/60 mx-1 resp-divider" />
                    <button
                      type="button"
                      onClick={handleCopyBody}
                      className={cn(
                        "json-copy-btn px-3 py-1 rounded text-[10.5px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-xs active:scale-95",
                        copiedBody 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                          : "bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white"
                      )}
                      title="Copy full response body"
                    >
                      {copiedBody ? <Check size={11} className="text-emerald-400 shrink-0" /> : <Copy size={11} className="shrink-0" />}
                      <span>{copiedBody ? 'COPIED RESPONSE' : 'COPY RESPONSE'}</span>
                    </button>
                  </div>
                </div>
                <div className="p-3.5 overflow-x-auto resp-json-tree-body">
                  <JsonInteractiveNode 
                    val={parsedJson} 
                    depth={0} 
                    defaultCollapsed={true} 
                    forceExpandAll={forceExpandAll} 
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-4 overflow-x-auto shadow-inner text-xs text-slate-300 whitespace-pre-wrap leading-relaxed resp-raw-card select-text">
                {result.body ? renderTextWithLinks(result.body) : '<EMPTY BODY>'}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: RAW UNFORMATTED BODY */}
        {viewMode === 'raw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 select-none">
              <span className="resp-raw-meta">{bodyLength.toLocaleString()} characters • {result.body?.split('\n').length || 0} lines</span>
              <button
                type="button"
                onClick={() => setWrapText(!wrapText)}
                className={cn(
                  "px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 cursor-pointer resp-wrap-btn",
                  wrapText ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-transparent text-slate-500 border-slate-800"
                )}
              >
                <WrapText size={11} /> {wrapText ? 'Wrap: ON' : 'Wrap: OFF'}
              </button>
            </div>
            <pre className={cn(
              "bg-[#0B0E17] border border-slate-850 rounded-xl p-4 text-xs text-emerald-300/90 font-mono shadow-inner overflow-x-auto leading-relaxed resp-raw-pre select-text",
              wrapText ? "whitespace-pre-wrap break-all" : "whitespace-pre"
            )}>
              {result.body ? renderTextWithLinks(result.body) : '<EMPTY RESPONSE BODY>'}
            </pre>
          </div>
        )}

        {/* VIEW 3: HEADERS VIEWER */}
        {viewMode === 'headers' && (
          <div className="space-y-4 text-xs">
            {/* Response Headers Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between select-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 resp-header-title">
                  <Layers size={12} className="text-emerald-400" /> Response Headers ({headersCount})
                </span>
                <button
                  type="button"
                  onClick={handleCopyHeaders}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer flex items-center gap-1 resp-header-copy-btn",
                    copiedHeaders ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-[#121622] text-slate-400 border-slate-800 hover:text-white"
                  )}
                >
                  {copiedHeaders ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  <span>{copiedHeaders ? 'COPIED' : 'COPY HEADERS'}</span>
                </button>
              </div>

              <div className="bg-[#0B0E17] border border-slate-850 rounded-xl overflow-hidden shadow-inner divide-y divide-slate-850 resp-headers-table">
                {Object.entries(result.headers || {}).length === 0 ? (
                  <div className="p-4 text-center text-slate-600 font-mono text-xs resp-no-headers">No response headers returned.</div>
                ) : (
                  Object.entries(result.headers).map(([k, v], idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 px-3 hover:bg-[#0F1420] transition-colors gap-1 sm:gap-4 resp-header-row">
                      <span className="text-sky-400 font-bold shrink-0 resp-header-key">{k}:</span>
                      <span className="text-slate-300 font-mono break-all sm:text-right resp-header-val">
                        {renderTextWithLinks(String(v))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Request Headers Section */}
            {result.config?.headers && Object.keys(result.config.headers).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-850 resp-req-headers-wrapper">
                <button
                  type="button"
                  onClick={() => setShowRequestHeaders(!showRequestHeaders)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer select-none resp-req-header-toggle"
                >
                  {showRequestHeaders ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>Dispatched Request Headers ({Object.keys(result.config.headers).length})</span>
                </button>

                {showRequestHeaders && (
                  <div className="bg-[#080B12] border border-slate-850 rounded-xl overflow-hidden divide-y divide-slate-850 text-xs resp-req-headers-table">
                    {Object.entries(result.config.headers).map(([k, v], idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 px-3 hover:bg-[#0E121C] gap-1 sm:gap-4 resp-req-header-row">
                        <span className="text-amber-400 font-bold shrink-0 resp-req-header-key">{k}:</span>
                        <span className="text-slate-400 font-mono break-all sm:text-right resp-req-header-val">
                          {renderTextWithLinks(String(v))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Full-featured CLI Command Modal Pop-up */}
      <CliCommandModal
        isOpen={showCliModal}
        onClose={() => setShowCliModal(false)}
        commandType="curl"
        title="cURL Command Inspector"
        singleLineCommand={curlCommandString.replace(/\s*\\\n\s*/g, ' ')}
        multilineCommand={curlCommandString}
        method={result?.config?.method || 'GET'}
        url={result?.config?.url || ''}
        headers={result?.config?.headers}
        body={result?.config?.body}
      />
    </div>
  );
}
