import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Trash2, 
  Search, 
  X, 
  RefreshCw, 
  Filter, 
  Circle, 
  ArrowUpDown,
  Columns,
  Maximize2,
  Minimize2,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  Split,
  Eye,
  Check,
  Ban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CurlResult } from '@/server/modules/curl-engine';
import { ResponseViewer, OutputTabType } from './ResponseViewer';

interface NetworkLogViewerProps {
  results: CurlResult[];
  loading: boolean;
  onAbort: () => void;
  theme?: 'dark' | 'light';
  activeTabId: string;
  onClearLogs: () => void;
}

type FilterType = 'all' | 'fetch' | 'doc' | 'json' | 'media' | 'ws' | 'other';
type LayoutMode = 'split' | 'table' | 'detail';

export function NetworkLogViewer({ 
  results, 
  loading, 
  onAbort, 
  theme = 'dark', 
  activeTabId,
  onClearLogs
}: NetworkLogViewerProps) {
  const [selectedResult, setSelectedResult] = useState<CurlResult | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<FilterType>('all');
  const [preserveLog, setPreserveLog] = useState(true);
  const [isRecording, setIsRecording] = useState(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [selectedDetailTab, setSelectedDetailTab] = useState<OutputTabType>('headers');

  // Sync selectedResult state with activeTab changes and new runs
  useEffect(() => {
    if (results && results.length > 0) {
      const exists = selectedResult && results.some(r => r.id === selectedResult.id);
      if (!exists) {
        setSelectedResult(results[results.length - 1]);
      }
    } else {
      setSelectedResult(null);
    }
  }, [results.length, activeTabId]);

  // Compute filtered results based on search & category
  const filteredResults = useMemo(() => {
    return results.filter(res => {
      // Search filter matching URL, method, status code
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase().trim();
        const urlMatch = (res.config?.url || '').toLowerCase().includes(query);
        const methodMatch = (res.config?.method || 'GET').toLowerCase().includes(query);
        const statusMatch = res.status.toString().includes(query);
        const bodyMatch = (res.body || '').toLowerCase().includes(query);
        if (!urlMatch && !methodMatch && !statusMatch && !bodyMatch) {
          return false;
        }
      }

      // Type filter
      if (activeTypeFilter === 'all') return true;

      const contentType = (res.headers['content-type'] || res.headers['Content-Type'] || '').toLowerCase();
      const url = (res.config?.url || '').toLowerCase();

      if (activeTypeFilter === 'fetch') {
        return contentType.includes('json') || contentType.includes('text') || res.config?.method !== 'GET';
      }
      if (activeTypeFilter === 'json') {
        return contentType.includes('json') || res.body?.trim().startsWith('{') || res.body?.trim().startsWith('[');
      }
      if (activeTypeFilter === 'doc') {
        return contentType.includes('html') || contentType.includes('xml') || url.endsWith('.html');
      }
      if (activeTypeFilter === 'media') {
        return contentType.includes('image') || contentType.includes('audio') || contentType.includes('video');
      }
      if (activeTypeFilter === 'ws') {
        return url.startsWith('ws://') || url.startsWith('wss://');
      }
      if (activeTypeFilter === 'other') {
        return !contentType.includes('json') && !contentType.includes('html');
      }

      return true;
    });
  }, [results, searchFilter, activeTypeFilter]);

  // Telemetry totals
  const totalTransferredBytes = useMemo(() => {
    return results.reduce((acc, r) => acc + (r.body ? r.body.length : 0), 0);
  }, [results]);

  const formattedTotalBytes = totalTransferredBytes > 1024 * 1024 
    ? `${(totalTransferredBytes / (1024 * 1024)).toFixed(2)} MB`
    : totalTransferredBytes > 1024 
    ? `${(totalTransferredBytes / 1024).toFixed(1)} KB`
    : `${totalTransferredBytes} B`;

  // Max response time for relative waterfall bars
  const maxResponseTime = useMemo(() => {
    const times = results.map(r => r.responseTime || 1);
    return Math.max(...times, 100);
  }, [results]);

  return (
    <div className="flex flex-col h-full bg-[#07090E] text-slate-200 overflow-hidden font-sans select-none">
      
      {/* ============================================================ */}
      {/* 1. GOOGLE DEVTOOLS NETWORK TOP TOOLBAR                       */}
      {/* ============================================================ */}
      <div className="flex flex-col border-b border-slate-850 bg-[#0B0E14] shrink-0">
        
        {/* Row 1: Controls & Search */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 border-b border-slate-850/80">
          
          <div className="flex items-center gap-2">
            {/* Record Toggle */}
            <button
              type="button"
              onClick={() => setIsRecording(!isRecording)}
              className={cn(
                "p-1 px-2 rounded flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer border",
                isRecording 
                  ? "bg-rose-950/40 text-rose-400 border-rose-800/40" 
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              )}
              title={isRecording ? "Stop recording network log" : "Record network log"}
            >
              <Circle size={10} className={isRecording ? "fill-rose-500 text-rose-500 animate-pulse" : "text-slate-500"} />
              <span className="hidden sm:inline font-mono text-[10px]">{isRecording ? 'RECORDING' : 'PAUSED'}</span>
            </button>

            {/* Clear Network Log */}
            <button
              type="button"
              onClick={onClearLogs}
              className="p-1 px-2 text-[11px] font-mono text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded border border-slate-800 transition-colors cursor-pointer flex items-center gap-1"
              title="Clear console & network log"
            >
              <Ban size={12} />
              <span className="hidden sm:inline text-[10px]">Clear</span>
            </button>

            <div className="w-px h-4 bg-slate-800 mx-1 hidden sm:block" />

            {/* Filter Input */}
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter (e.g. /api, status:200, GET)"
                className="bg-[#07090E] border border-slate-800 rounded pl-7 pr-7 py-1 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500 w-40 sm:w-56 font-mono"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Preserve Log Checkbox */}
            <label className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preserveLog}
                onChange={(e) => setPreserveLog(e.target.checked)}
                className="rounded accent-sky-500 bg-slate-900 border-slate-800 cursor-pointer"
              />
              <span>Preserve log</span>
            </label>
          </div>

          {/* Layout Mode Toggles */}
          <div className="flex items-center gap-1 bg-[#07090E] p-0.5 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={cn(
                "p-1 px-2 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer",
                layoutMode === 'split' ? "bg-slate-800 text-sky-400" : "text-slate-500 hover:text-slate-300"
              )}
              title="Split View (Table + Inspector)"
            >
              <Split size={11} />
              <span className="hidden lg:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('table')}
              className={cn(
                "p-1 px-2 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer",
                layoutMode === 'table' ? "bg-slate-800 text-sky-400" : "text-slate-500 hover:text-slate-300"
              )}
              title="Full Table View"
            >
              <Columns size={11} />
              <span className="hidden lg:inline">Table</span>
            </button>
            {selectedResult && (
              <button
                type="button"
                onClick={() => setLayoutMode('detail')}
                className={cn(
                  "p-1 px-2 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer",
                  layoutMode === 'detail' ? "bg-slate-800 text-sky-400" : "text-slate-500 hover:text-slate-300"
                )}
                title="Full Detail Inspector View"
              >
                <Eye size={11} />
                <span className="hidden lg:inline">Detail</span>
              </button>
            )}
          </div>

        </div>

        {/* Row 2: DevTools Category Filter Chips */}
        <div className="flex items-center gap-1 px-3 py-1 bg-[#090C12] overflow-x-auto no-scrollbar border-b border-slate-850/60 text-[11px]">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'fetch', label: 'Fetch/XHR' },
              { id: 'doc', label: 'Doc' },
              { id: 'json', label: 'JSON' },
              { id: 'media', label: 'Img/Media' },
              { id: 'ws', label: 'WS' },
              { id: 'other', label: 'Other' },
            ] as const
          ).map(chip => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveTypeFilter(chip.id)}
              className={cn(
                "px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer select-none shrink-0",
                activeTypeFilter === chip.id
                  ? "bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

      </div>

      {/* ============================================================ */}
      {/* 2. MAIN BODY: DEVTOOLS NETWORK TABLE + INSPECTOR SPLIT      */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-850">
        
        {/* LHS: Network Requests Table */}
        {(layoutMode === 'table' || layoutMode === 'split' || !selectedResult) && (
          <div className={cn(
            "flex flex-col h-full bg-[#07090E] overflow-hidden select-text",
            layoutMode === 'split' && selectedResult ? "w-full lg:w-[45%]" : "w-full"
          )}>
            
            {/* Spreadsheet Table Headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-[#0B0E14] border-b border-slate-850 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider select-none shrink-0">
              <div className="col-span-5 flex items-center gap-1">
                <span>Name</span>
              </div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-right">Type</div>
              <div className="col-span-3 text-right">Time / Waterfall</div>
            </div>

            {/* Table Rows Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-850/50 bg-[#07090E]">
              
              {/* Active Pending Animation if request in flight */}
              {loading && (
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-amber-500/10 border-l-2 border-amber-500 text-amber-400 font-mono text-[11px] items-center animate-pulse">
                  <div className="col-span-5 flex items-center gap-2 truncate">
                    <RefreshCw size={11} className="animate-spin text-amber-500 shrink-0" />
                    <span className="font-bold truncate">Awaiting Transmission...</span>
                  </div>
                  <div className="col-span-2 text-center font-bold text-[10px]">PENDING</div>
                  <div className="col-span-2 text-right text-slate-500 text-[10px]">fetch</div>
                  <div className="col-span-3 text-right text-amber-400 text-[10px]">In Flight</div>
                </div>
              )}

              {/* Transaction Rows */}
              {filteredResults.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-3 select-none">
                  <div className="p-3 rounded-full bg-slate-900/60 border border-slate-800 text-sky-400">
                    <Activity size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                      {results.length === 0 ? (isRecording ? "Recording Network Activity..." : "Network Recording Paused") : "No matching transactions"}
                    </p>
                    <p className="font-sans text-[11px] text-slate-500 max-w-sm">
                      {results.length === 0 
                        ? "Click the green Send button or press Enter to execute your request and inspect Headers, Payload, Preview, Response, and Latency Waterfall."
                        : "Clear the filter search above or switch category chips (All, Fetch, JSON, Doc) to reveal logged network transactions."
                      }
                    </p>
                  </div>
                </div>
              ) : (
                [...filteredResults].slice(-50).reverse().map((res) => {
                  const isSelected = selectedResult?.id === res.id;
                  const isSuccess = res.status >= 200 && res.status < 300;
                  const method = (res.config?.method || 'GET').toUpperCase();
                  
                  // Extract path and name
                  let pathName = res.config?.url || '';
                  try {
                    const u = new URL(res.config?.url || '');
                    pathName = u.pathname.split('/').filter(Boolean).pop() || u.pathname || '/';
                    if (u.search) pathName += u.search;
                  } catch {
                    pathName = res.config?.url || '';
                  }

                  // Determine type
                  const contentType = (res.headers['content-type'] || res.headers['Content-Type'] || '').toLowerCase();
                  const typeLabel = contentType.includes('json') ? 'json' :
                                   contentType.includes('html') ? 'document' :
                                   contentType.includes('image') ? 'image' : 'fetch';

                  const bodyLen = res.body ? res.body.length : 0;
                  const formattedSize = bodyLen > 1024 ? `${(bodyLen / 1024).toFixed(1)} KB` : `${bodyLen} B`;

                  // Waterfall relative progress width
                  const waterfallPercent = Math.min(100, Math.max(8, (res.responseTime / maxResponseTime) * 100));

                  return (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedResult(res);
                        if (layoutMode === 'table') {
                          setLayoutMode('split');
                        }
                      }}
                      className={cn(
                        "grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer items-center select-none border-l-2",
                        isSelected 
                          ? "bg-[#141A24] border-sky-400 text-white" 
                          : "border-transparent hover:bg-[#0E121B] text-slate-300"
                      )}
                    >
                      {/* Name & Method */}
                      <div className="col-span-5 flex items-center gap-1.5 min-w-0" title={res.config?.url}>
                        <span className={cn(
                          "text-[8.5px] font-black px-1.5 py-0.2 rounded-[2px] leading-tight font-mono shrink-0 border",
                          method === 'GET' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          method === 'POST' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          method === 'PUT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          method === 'DELETE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        )}>
                          {method}
                        </span>
                        <span className={cn(
                          "truncate text-[11.5px] font-sans font-medium",
                          isSelected ? "text-sky-300 font-bold" : "text-slate-200"
                        )}>
                          {pathName}
                        </span>
                      </div>

                      {/* Status Code */}
                      <div className="col-span-2 text-center">
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          isSuccess ? "text-emerald-400 bg-emerald-950/40" : "text-rose-400 bg-rose-950/40"
                        )}>
                          {res.status}
                        </span>
                      </div>

                      {/* Content Type & Size */}
                      <div className="col-span-2 text-right text-[10px] text-slate-400 flex flex-col items-end">
                        <span className="text-slate-300 font-sans">{typeLabel}</span>
                        <span className="text-slate-500 text-[9px]">{formattedSize}</span>
                      </div>

                      {/* Waterfall mini timeline */}
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        <div className="w-14 bg-slate-900 rounded-full h-1.5 overflow-hidden flex shrink-0">
                          <div 
                            className={cn("h-full rounded-full", isSuccess ? "bg-emerald-500" : "bg-rose-500")}
                            style={{ width: `${waterfallPercent}%` }}
                          />
                        </div>
                        <span className="text-[10.5px] font-bold text-slate-300 w-12 text-right shrink-0">{res.responseTime}ms</span>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom DevTools Status Bar */}
            <div className="px-3 py-1 bg-[#090C12] border-t border-slate-850 text-[10.5px] font-mono text-slate-400 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-3">
                <span><strong>{filteredResults.length}</strong> requests</span>
                <span>•</span>
                <span><strong>{formattedTotalBytes}</strong> transferred</span>
              </div>
              <div className="text-slate-500 text-[10px]">
                Google DevTools Network Mode
              </div>
            </div>

          </div>
        )}

        {/* RHS: Selected Transaction Details Inspector Drawer */}
        {selectedResult && (layoutMode === 'split' || layoutMode === 'detail') && (
          <div className={cn(
            "flex flex-col h-full bg-[#07090E] overflow-hidden",
            layoutMode === 'split' ? "w-full lg:flex-1" : "w-full"
          )}>
            {/* Inspector Top Bar */}
            <div className="px-3 py-2 bg-[#0B0E14] border-b border-slate-850 flex items-center justify-between shrink-0 font-sans">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-slate-400 font-bold uppercase shrink-0">
                  Transaction:
                </span>
                <span className="text-xs font-mono text-sky-400 font-bold truncate max-w-md" title={selectedResult.config?.url}>
                  {selectedResult.config?.url || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {layoutMode === 'split' ? (
                  <button
                    type="button"
                    onClick={() => setLayoutMode('detail')}
                    className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                    title="Maximize details panel"
                  >
                    <Maximize2 size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLayoutMode('split')}
                    className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                    title="Restore split view"
                  >
                    <Minimize2 size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedResult(null)}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                  title="Close details inspector"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Response Viewer Component */}
            <div className="flex-1 overflow-hidden">
              <ResponseViewer
                result={selectedResult}
                loading={false}
                onAbort={onAbort}
                theme={theme}
                defaultTab={selectedDetailTab}
              />
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
