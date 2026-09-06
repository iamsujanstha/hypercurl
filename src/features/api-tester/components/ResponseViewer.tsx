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

export type ResponseViewMode = 'body' | 'headers' | 'test_results';

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
      {/* 1. STATUS BAR: Tabs and HTTP Metrics                                      */}
      {/* ========================================================================= */}
      <div className="px-3 py-2 bg-[#0B0E15] border-b border-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none resp-status-bar">
        
        {/* Left: View Mode Toggle Buttons (Tabs) */}
        <div className="flex bg-[#07090E] p-0.5 rounded border border-slate-800 resp-tab-group">
          <button
            type="button"
            onClick={() => setViewMode('body')}
            className={cn(
              "px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 resp-tab-btn",
              viewMode === 'body' 
                ? "bg-emerald-900/30 text-emerald-400 shadow-sm resp-tab-active" 
                : "text-slate-500 hover:text-slate-300 resp-tab-inactive"
            )}
          >
            Body
          </button>
          <button
            type="button"
            onClick={() => setViewMode('headers')}
            className={cn(
              "px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 resp-tab-btn",
              viewMode === 'headers' 
                ? "bg-emerald-900/30 text-emerald-400 shadow-sm resp-tab-active" 
                : "text-slate-500 hover:text-slate-300 resp-tab-inactive"
            )}
          >
            Headers <span className="text-[9px] opacity-70">({headersCount})</span>
          </button>
          {assertions.length > 0 && (
            <button
              type="button"
              onClick={() => { setViewMode('test_results'); }}
              className={cn(
                "px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 resp-tab-btn",
                viewMode === 'test_results'
                  ? "bg-emerald-900/30 text-emerald-400 shadow-sm resp-tab-active" 
                  : "text-slate-500 hover:text-slate-300 resp-tab-inactive"
              )}
            >
              Test Results <span className={cn("text-[9px]", allAssertionsPassed ? "text-emerald-400/70" : "text-rose-400/70")}>({passedAssertionsCount}/{assertions.length})</span>
            </button>
          )}
        </div>

        {/* Right: Status Badge & Primary Metrics */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium font-sans">Status:</span>
            <span className={cn(
              "font-bold",
              isSuccess ? "text-emerald-400" : isClientError ? "text-amber-400" : isRedirect ? "text-blue-400" : "text-rose-400"
            )}>
              {result.status} {isSuccess ? 'OK' : isClientError ? 'Client Error' : isServerError ? 'Server Error' : ''}
            </span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium font-sans">Time:</span>
            <span><strong className="text-emerald-400 font-bold">{result.responseTime}</strong> <span className="text-emerald-400/70">ms</span></span>
          </div>

          {/* Size */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium font-sans">Size:</span>
            <span><strong className="text-emerald-400 font-bold">{formattedSize}</strong></span>
          </div>
          
          <div className="h-4 w-[1px] bg-slate-700/50 mx-1 hidden sm:block" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyBody}
              className={cn(
                "p-1.5 rounded transition-all cursor-pointer flex items-center justify-center",
                copiedBody 
                  ? "text-emerald-400 bg-emerald-500/10" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
              title="Copy response body"
            >
              {copiedBody ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              title="Download response file"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* 2. RESPONSE VIEWER CONTENT AREA                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-[#07090E] resp-main-content">
        
        {/* VIEW 1: FORMATTED JSON / SYNTAX HIGHLIGHTED BODY */}
        {viewMode === 'body' && (
          <div className="h-full">
            {parsedJson !== null ? (
              <div className="h-full overflow-hidden flex flex-col">
                <div className="flex-1 p-3.5 overflow-auto resp-json-tree-body">
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

        {/* VIEW 2: TEST RESULTS VIEW */}
        {viewMode === 'test_results' && assertions.length > 0 && (
          <div className="p-4 space-y-2 animate-fadeIn text-[11px] font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="font-bold text-slate-300 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={14} className={allAssertionsPassed ? "text-emerald-400" : "text-rose-400"} />
                Test Results ({passedAssertionsCount}/{assertions.length} Passed)
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

            <div className="space-y-1 overflow-y-auto custom-scrollbar mt-2">
              {assertions.map((a: any, idx: number) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-3 p-2 border-b border-slate-800/50 text-xs"
                >
                  {a.passed ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> : <XCircle size={14} className="text-rose-400 shrink-0" />}
                  <span className="font-mono text-slate-300 w-24 shrink-0 truncate">{a.type}</span>
                  <span className="font-mono text-slate-500 flex-1 truncate">
                    <span className="opacity-50">Expected:</span> {a.expected || a.value}
                  </span>
                  {!a.passed && (
                    <span className="font-mono text-rose-400 truncate shrink-0 max-w-[200px]">
                      <span className="opacity-50">Actual:</span> {a.actual}
                    </span>
                  )}
                </div>
              ))}
            </div>
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
