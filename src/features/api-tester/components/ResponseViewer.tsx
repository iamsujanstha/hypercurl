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
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurlResult } from '@/server/modules/curl-engine';
import { JsonInteractiveNode } from './JsonInteractiveNode';

export type ResponseViewMode = 'body' | 'raw' | 'headers' | 'terminal';

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
  const [forceExpandAll, setForceExpandAll] = useState<boolean | null>(null);

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

  // Format terminal stdout (HTTP/1.1 response line + headers + body)
  const rawTerminalOutput = useMemo(() => {
    if (!result) return '';
    const statusText = result.status >= 200 && result.status < 300 ? 'OK' : 
                       result.status === 404 ? 'Not Found' : 
                       result.status === 500 ? 'Internal Server Error' : 
                       result.status === 401 ? 'Unauthorized' : 
                       result.status === 403 ? 'Forbidden' : 
                       result.status === 301 ? 'Moved Permanently' : 'Response';
    
    const headerLines = Object.entries(result.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    return `HTTP/1.1 ${result.status} ${statusText}\n${headerLines}\n\n${result.body || ''}`;
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
    <div className="flex flex-col h-full bg-[#07090E] text-slate-200 overflow-hidden font-mono select-text">
      
      {/* ========================================================================= */}
      {/* 1. STATUS BAR: HTTP Status, Time, Size, Content-Type, Quick Actions       */}
      {/* ========================================================================= */}
      <div className="p-3 bg-[#0B0E15] border-b border-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        
        {/* Left: Status Badge & Primary Metrics */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Badge */}
          <div className={cn("px-2.5 py-1 rounded-lg text-xs font-black border flex items-center gap-1.5", statusBg)}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              isSuccess ? "bg-emerald-400" : isClientError ? "bg-amber-400" : isRedirect ? "bg-blue-400" : "bg-rose-400"
            )} />
            <span>{result.status} {isSuccess ? 'OK' : isClientError ? 'Client Error' : isServerError ? 'Server Error' : ''}</span>
          </div>

          {/* Latency / Execution Time */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121622] border border-slate-800 text-[11px] text-slate-300">
            <Clock size={12} className="text-cyan-400" />
            <span><strong className="text-cyan-300 font-bold">{result.responseTime}</strong> ms</span>
          </div>

          {/* Response Payload Size */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121622] border border-slate-800 text-[11px] text-slate-300">
            <Zap size={12} className="text-amber-400" />
            <span><strong className="text-amber-300 font-bold">{formattedSize}</strong></span>
          </div>

          {/* MIME Content-Type */}
          <div className="text-[10px] px-2 py-1 rounded bg-[#0E121B] border border-slate-850 text-slate-400 hidden sm:inline-block">
            {contentType}
          </div>
        </div>

        {/* Right: View Selector & Quick Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View Mode Toggle Buttons */}
          <div className="flex bg-[#07090E] p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('body')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1",
                viewMode === 'body' 
                  ? "bg-[#1C2433] text-emerald-400 shadow-sm" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Code size={11} /> JSON
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1",
                viewMode === 'raw' 
                  ? "bg-[#1C2433] text-emerald-400 shadow-sm" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <FileText size={11} /> RAW BODY
            </button>
            <button
              type="button"
              onClick={() => setViewMode('headers')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1",
                viewMode === 'headers' 
                  ? "bg-[#1C2433] text-emerald-400 shadow-sm" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Layers size={11} /> HEADERS ({headersCount})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('terminal')}
              className={cn(
                "px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1",
                viewMode === 'terminal' 
                  ? "bg-[#1C2433] text-emerald-400 shadow-sm" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Terminal size={11} /> CLI STDOUT
            </button>
          </div>

          {/* Action Buttons */}
          <button
            type="button"
            onClick={handleCopyBody}
            className={cn(
              "px-2.5 py-1 rounded text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1",
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
            className="p-1 px-2 rounded bg-[#141C2B] hover:bg-slate-800 text-slate-300 border border-slate-700/50 text-[10.5px] font-bold transition-all cursor-pointer"
            title="Download response file"
          >
            <Download size={11} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. AUTO-GENERATED TERMINAL cURL SNIPPET (with 1-Click Copy CLI)           */}
      {/* ========================================================================= */}
      <div className="bg-[#05070B] border-b border-slate-850 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-[11px] text-slate-400 min-w-0">
          <span className="text-emerald-500 font-bold select-none">$</span>
          <span className="text-slate-300 truncate select-all">{curlCommandString.replace(/\s*\\\n\s*/g, ' ')}</span>
        </div>
        
        <button
          type="button"
          onClick={handleCopyCurl}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all shrink-0 flex items-center gap-1 border cursor-pointer select-none",
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

      {/* ========================================================================= */}
      {/* 3. RESPONSE VIEWER CONTENT AREA                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#07090E]">
        
        {/* VIEW 1: FORMATTED JSON / SYNTAX HIGHLIGHTED BODY */}
        {viewMode === 'body' && (
          <div className="space-y-2">
            {parsedJson !== null ? (
              <div className="bg-[#0B0E17] border border-slate-850 rounded-xl overflow-hidden shadow-inner">
                <div className="bg-[#0e121c] border-b border-slate-850 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 select-none">
                  <div className="flex items-center gap-2 font-mono text-[10.5px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-slate-300 font-semibold">JSON TREE</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-500">
                      {Array.isArray(parsedJson) ? `${parsedJson.length} items` : typeof parsedJson === 'object' && parsedJson !== null ? `${Object.keys(parsedJson).length} keys` : 'value'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setForceExpandAll(false)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Collapse all child nodes"
                    >
                      ▶ Collapse All
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceExpandAll(true)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Expand all nodes"
                    >
                      ▼ Expand All
                    </button>
                  </div>
                </div>
                <div className="p-3.5 overflow-x-auto">
                  <JsonInteractiveNode 
                    val={parsedJson} 
                    depth={0} 
                    defaultCollapsed={true} 
                    forceExpandAll={forceExpandAll} 
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#0B0E17] border border-slate-850 rounded-xl p-4 overflow-x-auto shadow-inner text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                {result.body || '<EMPTY BODY>'}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: RAW UNFORMATTED BODY */}
        {viewMode === 'raw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 select-none">
              <span>{bodyLength.toLocaleString()} characters • {result.body?.split('\n').length || 0} lines</span>
              <button
                type="button"
                onClick={() => setWrapText(!wrapText)}
                className={cn(
                  "px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 cursor-pointer",
                  wrapText ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-transparent text-slate-500 border-slate-800"
                )}
              >
                <WrapText size={11} /> {wrapText ? 'Wrap: ON' : 'Wrap: OFF'}
              </button>
            </div>
            <pre className={cn(
              "bg-[#0B0E17] border border-slate-850 rounded-xl p-4 text-xs text-emerald-300/90 font-mono shadow-inner overflow-x-auto leading-relaxed",
              wrapText ? "whitespace-pre-wrap break-all" : "whitespace-pre"
            )}>
              {result.body || '<EMPTY RESPONSE BODY>'}
            </pre>
          </div>
        )}

        {/* VIEW 3: HEADERS VIEWER */}
        {viewMode === 'headers' && (
          <div className="space-y-4 text-xs">
            {/* Response Headers Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between select-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-emerald-400" /> Response Headers ({headersCount})
                </span>
                <button
                  type="button"
                  onClick={handleCopyHeaders}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer flex items-center gap-1",
                    copiedHeaders ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-[#121622] text-slate-400 border-slate-800 hover:text-white"
                  )}
                >
                  {copiedHeaders ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  <span>{copiedHeaders ? 'COPIED' : 'COPY HEADERS'}</span>
                </button>
              </div>

              <div className="bg-[#0B0E17] border border-slate-850 rounded-xl overflow-hidden shadow-inner divide-y divide-slate-850">
                {Object.entries(result.headers || {}).length === 0 ? (
                  <div className="p-4 text-center text-slate-600 font-mono text-xs">No response headers returned.</div>
                ) : (
                  Object.entries(result.headers).map(([k, v], idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 px-3 hover:bg-[#0F1420] transition-colors gap-1 sm:gap-4">
                      <span className="text-sky-400 font-bold shrink-0">{k}:</span>
                      <span className="text-slate-300 font-mono break-all sm:text-right">{v}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Request Headers Section */}
            {result.config?.headers && Object.keys(result.config.headers).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowRequestHeaders(!showRequestHeaders)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer select-none"
                >
                  {showRequestHeaders ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>Dispatched Request Headers ({Object.keys(result.config.headers).length})</span>
                </button>

                {showRequestHeaders && (
                  <div className="bg-[#080B12] border border-slate-850 rounded-xl overflow-hidden divide-y divide-slate-850 text-xs">
                    {Object.entries(result.config.headers).map(([k, v], idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 px-3 hover:bg-[#0E121C] gap-1 sm:gap-4">
                        <span className="text-amber-400 font-bold shrink-0">{k}:</span>
                        <span className="text-slate-400 font-mono break-all sm:text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: RAW TERMINAL CLI OUTPUT (Authentic curl -i stdout) */}
        {viewMode === 'terminal' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 select-none">
              <span className="text-emerald-400 font-bold">curl -i stdout stream</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(rawTerminalOutput);
                  setCopiedBody(true);
                  setTimeout(() => setCopiedBody(false), 2000);
                }}
                className="px-2 py-0.5 rounded bg-[#121622] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                {copiedBody ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                <span>{copiedBody ? 'COPIED STDOUT' : 'COPY RAW STDOUT'}</span>
              </button>
            </div>
            <pre className="bg-[#04060A] border border-slate-850 rounded-xl p-4 text-xs font-mono text-emerald-300/90 whitespace-pre-wrap break-all shadow-inner leading-relaxed select-text">
              {rawTerminalOutput}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
