import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, Repeat, ShieldAlert, Cpu, Flame, Globe, Terminal, Play, RefreshCw, Target, Activity, Server, Shield, Copy, Check, Sliders, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RequestConfig } from '@/server/modules/curl-engine';
import { TEST_MODULES, TestModuleId } from '../TestLabData';
import { Telemetry } from '@/features/api-tester/types';

interface TestLabSidebarProps {
  config: RequestConfig;
  loading: boolean;
  selectedModule: TestModuleId;
  setSelectedModule: (id: TestModuleId) => void;
  setSelectedResult: (res: any) => void;
  concurrency: number;
  setConcurrency: (val: number) => void;
  iterationsPerUser: number;
  setIterationsPerUser: (val: number) => void;
  retries: number;
  setRetries: (val: number) => void;
  // Autocannon specific parameters
  autocannonConnections: number;
  setAutocannonConnections: (val: number) => void;
  autocannonDuration: number;
  setAutocannonDuration: (val: number) => void;
  autocannonPipelining: number;
  setAutocannonPipelining: (val: number) => void;
  autocannonRate?: number;
  setAutocannonRate: (val: number | undefined) => void;
  autocannonTimeout: number;
  setAutocannonTimeout: (val: number) => void;
  securityChecks: { sqli: boolean; xss: boolean; pathTraversal: boolean; headersAuditor: boolean };
  setSecurityChecks: (checks: { sqli: boolean; xss: boolean; pathTraversal: boolean; headersAuditor: boolean }) => void;
  fuzzerChecks: { keyDeletions: boolean; typeMutations: boolean; bufferOverflow: boolean };
  setFuzzerChecks: (checks: { keyDeletions: boolean; typeMutations: boolean; bufferOverflow: boolean }) => void;
  chaosAmplitude: number;
  setChaosAmplitude: (val: number) => void;
  selectedRegions: string[];
  setSelectedRegions: (regions: string[]) => void;
  selectedPresetId: string;
  setSelectedPresetId: (id: string) => void;
  curlStrategy: string;
  onStartTest: () => void;
  onAbort: () => void;
  onChangeConfig?: (updates: Partial<RequestConfig>) => void;
  telemetry: Telemetry;
}

const getModuleIcon = (id: TestModuleId) => {
  switch (id) {
    case 'basic_query': return <Target size={15} />;
    case 'blast': return <Zap size={15} />;
    case 'race': return <Activity size={15} />;
    case 'replay': return <Repeat size={15} />;
    case 'load': return <Flame size={15} className="text-rose-400" />;
    case 'chaos': return <Flame size={15} />;
    case 'fuzzer': return <Cpu size={15} />;
    case 'security_audit': return <Shield size={15} />;
    case 'distributed': return <Globe size={15} />;
    case 'autocannon': return <Flame size={15} className="text-rose-400" />;
    default: return <Server size={15} />;
  }
};

const UI_MODULES = TEST_MODULES.map(mod => ({
  ...mod,
  icon: getModuleIcon(mod.id),
  category: mod.category as 'perf' | 'resilience' | 'security'
}));

export function TestLabSidebar({
  config,
  loading,
  selectedModule,
  setSelectedModule,
  setSelectedResult,
  concurrency,
  setConcurrency,
  iterationsPerUser,
  setIterationsPerUser,
  retries,
  setRetries,
  autocannonConnections,
  setAutocannonConnections,
  autocannonDuration,
  setAutocannonDuration,
  autocannonPipelining,
  setAutocannonPipelining,
  autocannonRate,
  setAutocannonRate,
  autocannonTimeout,
  setAutocannonTimeout,
  securityChecks,
  setSecurityChecks,
  fuzzerChecks,
  setFuzzerChecks,
  chaosAmplitude,
  setChaosAmplitude,
  selectedRegions,
  setSelectedRegions,
  selectedPresetId,
  setSelectedPresetId,
  curlStrategy,
  onStartTest,
  onAbort,
  onChangeConfig,
  telemetry
}: TestLabSidebarProps): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'perf' | 'resilience' | 'security'>('all');
  const [copiedCli, setCopiedCli] = useState(false);
  const [cliTab, setCliTab] = useState<'autocannon' | 'curl' | 'bash'>('autocannon');

  const isAutocannonModule = selectedModule === 'load' || selectedModule === 'autocannon';

  useEffect(() => {
    if (isAutocannonModule) {
      setCliTab('autocannon');
    }
  }, [isAutocannonModule]);

  const filteredModules = useMemo(() => {
    if (selectedCategory === 'all') return UI_MODULES;
    return UI_MODULES.filter(m => m.category === selectedCategory);
  }, [selectedCategory]);

  const totalIterations = concurrency * iterationsPerUser;

  // Generate Vertical Multiline Terminal Commands
  const autocannonCliCommand = useMemo(() => {
    const lines: string[] = ['autocannon'];
    lines.push(`-c ${autocannonConnections}`);
    lines.push(`-d ${autocannonDuration}`);
    if (autocannonPipelining > 1) lines.push(`-p ${autocannonPipelining}`);
    if (autocannonRate) lines.push(`-r ${autocannonRate}`);
    if (autocannonTimeout && autocannonTimeout !== 10) lines.push(`-t ${autocannonTimeout}`);
    if (config.method && config.method !== 'GET') lines.push(`-m ${config.method}`);
    
    if (config.headers && Object.keys(config.headers).length > 0) {
      Object.entries(config.headers).forEach(([k, v]) => {
        lines.push(`-H "${k}: ${v}"`);
      });
    }
    if (config.body && (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')) {
      lines.push(`-b '${config.body}'`);
    }
    const url = config.url || 'http://localhost:3000/api';
    lines.push(`"${url}"`);

    return lines.join(' \\\n  ');
  }, [config, autocannonConnections, autocannonDuration, autocannonPipelining, autocannonRate, autocannonTimeout]);

  const curlCliCommand = useMemo(() => {
    const lines: string[] = ['curl'];
    lines.push(`-X ${config.method || 'GET'}`);
    const url = config.url || 'http://localhost:3000/api';
    lines.push(`"${url}"`);

    if (config.headers && Object.keys(config.headers).length > 0) {
      Object.entries(config.headers).forEach(([k, v]) => {
        lines.push(`-H "${k}: ${v}"`);
      });
    }
    if (config.body) {
      lines.push(`-d '${config.body}'`);
    }
    return lines.join(' \\\n  ');
  }, [config]);

  const bashParallelCommand = useMemo(() => {
    const singleLineCurl = `curl -X ${config.method || 'GET'} "${config.url || 'http://localhost:3000/api'}" ${Object.entries(config.headers || {}).map(([k, v]) => `-H "${k}: ${v}"`).join(' ')} ${config.body ? `-d '${config.body}'` : ''}`.replace(/\s+/g, ' ').trim();
    return `seq ${totalIterations} | \\\n  xargs -P ${concurrency} -I {} \\\n  ${singleLineCurl}`;
  }, [totalIterations, concurrency, config]);

  const currentCliCommand = useMemo(() => {
    if (cliTab === 'autocannon') return autocannonCliCommand;
    if (cliTab === 'curl') return curlCliCommand;
    return bashParallelCommand;
  }, [cliTab, autocannonCliCommand, curlCliCommand, bashParallelCommand]);

  const handleCopyCommand = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="w-full h-full bg-[#0E121A] flex flex-col overflow-y-auto custom-scrollbar border-r border-[#1E293B]">
      <div className="p-4 space-y-5 flex-grow">
        
        {/* Category Filter Tabs */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-wider">
              1. SELECT TEST SUITE
            </span>
            <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              9 MODES READY
            </span>
          </div>

          <div className="flex bg-[#080A0F] p-1 border border-slate-800 rounded-lg gap-1">
            {[
              { id: 'all', label: 'ALL' },
              { id: 'perf', label: '⚡ LOAD/PERF' },
              { id: 'resilience', label: '🌪️ RESIL' },
              { id: 'security', label: '🛡️ SECURITY' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={cn(
                  "flex-1 py-1 text-[9px] font-mono font-black tracking-wider uppercase rounded transition-all cursor-pointer select-none",
                  selectedCategory === tab.id
                    ? "bg-[#1E293B] text-emerald-400 shadow-sm border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {filteredModules.map((module) => {
              const isActive = selectedModule === module.id;
              const isLoad = module.id === 'load' || module.id === 'autocannon';
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => {
                    setSelectedModule(module.id);
                    setSelectedResult(null); 
                  }}
                  className={cn(
                    "p-2.5 rounded-lg border text-left flex flex-col justify-between gap-1.5 transition-all cursor-pointer relative overflow-hidden select-none outline-none min-h-[72px]",
                    isActive 
                      ? isLoad
                        ? "bg-rose-500/15 border-rose-500/50 text-white shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                        : "bg-emerald-500/15 border-emerald-500/50 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
                      : "bg-[#080A0F]/70 border-slate-800/80 text-slate-400 hover:bg-slate-900/60 hover:border-slate-700 hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "p-1 rounded",
                      isActive 
                        ? isLoad ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300" 
                        : "bg-slate-800/50 text-slate-400"
                    )}>
                      {module.icon}
                    </div>
                    {isLoad && (
                      <span className="text-[8px] font-mono font-black uppercase px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        ⚡ CLI
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-black font-mono tracking-tight block uppercase leading-tight line-clamp-2">
                      {module.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Parameters Configuration */}
        <div className="space-y-3 bg-[#080A0F]/80 p-3.5 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] font-black uppercase text-slate-300 font-mono tracking-wider flex items-center gap-1.5">
              <Sliders size={12} className="text-emerald-400" />
              2. {isAutocannonModule ? 'AUTOCANNON PARAMETERS' : 'TEST OPTIONS'}
            </span>
            <span className="text-[9px] font-mono text-slate-400 uppercase">
              {isAutocannonModule ? 'Terminal Flags (-c, -d, -p)' : 'CONCURRENCY SETTINGS'}
            </span>
          </div>

          {/* AUTOCANNON LOAD TEST CONFIGURATION */}
          {isAutocannonModule && (
            <div className="space-y-3">
              {/* Connections (-c) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-300 font-bold flex items-center gap-1">
                    <Zap size={11} className="text-rose-400" />
                    CONNECTIONS <code className="text-rose-400 font-bold bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20">-c</code>
                  </span>
                  <span className="text-rose-400 font-black">{autocannonConnections} concurrent sockets</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[10, 50, 100, 250, 500].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAutocannonConnections(c)}
                      className={cn(
                        "py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer",
                        autocannonConnections === c
                          ? "bg-rose-600 text-white border-rose-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={autocannonConnections}
                  onChange={(e) => setAutocannonConnections(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={loading}
                  className="w-full bg-black border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:border-rose-500 font-bold outline-none"
                  placeholder="Custom connections count..."
                />
              </div>

              {/* Duration (-d) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-300 font-bold flex items-center gap-1">
                    <Clock size={11} className="text-blue-400" />
                    DURATION <code className="text-blue-400 font-bold bg-blue-500/10 px-1 py-0.2 rounded border border-blue-500/20">-d</code>
                  </span>
                  <span className="text-blue-400 font-black">{autocannonDuration} seconds</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[5, 10, 15, 30, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAutocannonDuration(d)}
                      className={cn(
                        "py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer",
                        autocannonDuration === d
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      )}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Pipelining (-p) & Timeout (-t) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-slate-300 uppercase font-bold flex items-center gap-1">
                    PIPELINING <code className="text-amber-400">-p</code>
                  </label>
                  <select
                    value={autocannonPipelining}
                    onChange={(e) => setAutocannonPipelining(parseInt(e.target.value) || 1)}
                    disabled={loading}
                    className="w-full bg-black border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-amber-300 font-bold outline-none cursor-pointer"
                  >
                    <option value={1}>1 (Standard HTTP)</option>
                    <option value={2}>2 (Pipelined 2x)</option>
                    <option value={5}>5 (High 5x)</option>
                    <option value={10}>10 (Extreme 10x)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-slate-300 uppercase font-bold flex items-center gap-1">
                    TIMEOUT <code className="text-emerald-400">-t</code>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={autocannonTimeout}
                    onChange={(e) => setAutocannonTimeout(Math.max(1, parseInt(e.target.value) || 10))}
                    disabled={loading}
                    className="w-full bg-black border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-white font-bold outline-none"
                    placeholder="Timeout (sec)..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* STANDARD CONCURRENCY CONTROLS (for Blast, Race, Fuzzer, Chaos, etc.) */}
          {!isAutocannonModule && selectedModule !== 'basic_query' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-300 uppercase font-extrabold flex items-center gap-1">
                    <Zap size={11} className="text-amber-400" /> WORKERS <code className="text-amber-400">-P</code>
                  </label>
                  <input 
                    type="number" 
                    min={1}
                    max={500}
                    value={concurrency}
                    onChange={(e) => {
                      setConcurrency(Math.max(1, parseInt(e.target.value) || 1));
                      setSelectedPresetId('');
                    }}
                    disabled={loading}
                    className="w-full bg-black border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-300 uppercase font-extrabold flex items-center gap-1">
                    <Repeat size={11} className="text-blue-400" /> ITERATIONS <code className="text-blue-400">seq N</code>
                  </label>
                  <input 
                    type="number" 
                    min={1}
                    max={1000}
                    value={iterationsPerUser}
                    onChange={(e) => {
                      setIterationsPerUser(Math.max(1, parseInt(e.target.value) || 1));
                      setSelectedPresetId('');
                    }}
                    disabled={loading}
                    className="w-full bg-black border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white font-bold outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-black/60 p-2 border border-slate-800 rounded-lg text-[10px] font-mono">
                <span className="text-slate-400 font-bold">Cumulative Total:</span>
                <span className="text-emerald-400 font-black">{totalIterations} requests dispatched</span>
              </div>
            </div>
          )}

          {/* Module specific options */}
          {selectedModule === 'security_audit' && (
            <div className="p-3 bg-rose-950/20 rounded-lg border border-rose-500/30 space-y-2">
              <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldAlert size={12} /> OWASP VULNERABILITY PROBES
              </div>
              <div className="space-y-1.5">
                {[
                  { key: 'sqli', label: 'SQL INJECTION (SQLI)' },
                  { key: 'xss', label: 'CROSS-SITE SCRIPTING (XSS)' },
                  { key: 'pathTraversal', label: 'PATH TRAVERSAL PROBE' },
                  { key: 'headersAuditor', label: 'SECURITY HEADERS HYGIENE' }
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={(securityChecks as any)[item.key]} 
                      onChange={(e) => setSecurityChecks({ ...securityChecks, [item.key]: e.target.checked })}
                      className="w-3.5 h-3.5 accent-rose-500 bg-black border-slate-700 rounded" 
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedModule === 'fuzzer' && (
            <div className="p-3 bg-purple-950/20 rounded-lg border border-purple-500/30 space-y-2">
              <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Cpu size={12} /> MUTATION FUZZER TARGETS
              </div>
              <div className="space-y-1.5">
                {[
                  { key: 'keyDeletions', label: 'DELETE INTEGRAL KEYS' },
                  { key: 'typeMutations', label: 'MUTATE VALUE TYPES' },
                  { key: 'bufferOverflow', label: 'BUFFER OVERFLOW (1000x STR)' }
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={(fuzzerChecks as any)[item.key]} 
                      onChange={(e) => setFuzzerChecks({ ...fuzzerChecks, [item.key]: e.target.checked })}
                      className="w-3.5 h-3.5 accent-purple-500 bg-black border-slate-700 rounded" 
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedModule === 'chaos' && (
            <div className="p-3 bg-orange-950/20 rounded-lg border border-orange-500/30 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-orange-400 font-bold uppercase">JITTER AMPLITUDE</span>
                <span className="text-orange-300 font-black">{chaosAmplitude}ms</span>
              </div>
              <input 
                type="range" 
                min={50} 
                max={1500} 
                step={50}
                value={chaosAmplitude}
                onChange={(e) => setChaosAmplitude(parseInt(e.target.value))}
                disabled={loading}
                className="w-full accent-orange-500 cursor-pointer h-1.5 bg-black rounded"
              />
            </div>
          )}

          {selectedModule === 'distributed' && (
            <div className="p-3 bg-indigo-950/20 rounded-lg border border-indigo-500/30 space-y-2">
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Globe size={12} /> SIMULATED REGIONAL NODES
              </div>
              <div className="space-y-1">
                {[
                  { id: 'us', label: '🇺🇸 NORTH AMERICA (US)' },
                  { id: 'eu', label: '🇩🇪 EUROPE (EU)' },
                  { id: 'apac', label: '🇯🇵 ASIA PACIFIC (APAC)' },
                  { id: 'latam', label: '🇧🇷 LATIN AMERICA (LATAM)' }
                ].map(region => (
                  <label key={region.id} className="flex items-center gap-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={selectedRegions.includes(region.id)} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRegions([...selectedRegions, region.id]);
                        else if (selectedRegions.length > 1) setSelectedRegions(selectedRegions.filter(r => r !== region.id));
                      }}
                      className="w-3.5 h-3.5 accent-indigo-500 bg-black border-slate-700 rounded" 
                    />
                    {region.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. TERMINAL CLI SNIPPETS (Vertical multiline, clean UI) */}
        <div className="space-y-2.5 bg-[#080A0F] p-3 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Terminal size={12} className="text-cyan-400" />
              TERMINAL CLI SNIPPET
            </span>
            <button
              type="button"
              onClick={() => handleCopyCommand(currentCliCommand)}
              className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] font-mono text-slate-200 transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="Copy CLI command to clipboard"
            >
              {copiedCli ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">COPIED</span>
                </>
              ) : (
                <>
                  <Copy size={11} className="text-slate-400" />
                  <span>COPY</span>
                </>
              )}
            </button>
          </div>

          {/* Sub-tabs for Autocannon vs cURL vs Bash */}
          <div className="flex bg-black/60 p-0.5 border border-slate-800 rounded-md gap-1">
            <button
              type="button"
              onClick={() => setCliTab('autocannon')}
              className={cn(
                "flex-1 py-1 text-[9px] font-mono font-bold uppercase rounded cursor-pointer transition-all",
                cliTab === 'autocannon' ? "bg-rose-600/30 text-rose-300 border border-rose-500/30 font-black" : "text-slate-400 hover:text-slate-200"
              )}
            >
              AUTOCANNON
            </button>
            <button
              type="button"
              onClick={() => setCliTab('curl')}
              className={cn(
                "flex-1 py-1 text-[9px] font-mono font-bold uppercase rounded cursor-pointer transition-all",
                cliTab === 'curl' ? "bg-blue-600/30 text-blue-300 border border-blue-500/30 font-black" : "text-slate-400 hover:text-slate-200"
              )}
            >
              CURL
            </button>
            <button
              type="button"
              onClick={() => setCliTab('bash')}
              className={cn(
                "flex-1 py-1 text-[9px] font-mono font-bold uppercase rounded cursor-pointer transition-all",
                cliTab === 'bash' ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-black" : "text-slate-400 hover:text-slate-200"
              )}
            >
              BASH XARGS
            </button>
          </div>

          {/* Command Code Snippet Box (Vertical Multiline - No Horizontal Scrolling) */}
          <div className="p-2.5 bg-black border border-slate-800/90 rounded-lg">
            <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all select-all text-slate-200">
              {cliTab === 'autocannon' && (
                <span className="text-rose-300">{autocannonCliCommand}</span>
              )}
              {cliTab === 'curl' && (
                <span className="text-blue-300">{curlCliCommand}</span>
              )}
              {cliTab === 'bash' && (
                <span className="text-emerald-300">{bashParallelCommand}</span>
              )}
            </pre>
          </div>
        </div>

      </div>

      {/* Roster execution action CTA button */}
      <div className="p-4 bg-[#080A0F] border-t border-[#1E293B] space-y-2 shrink-0">
        <button
          onClick={loading ? onAbort : onStartTest}
          disabled={!config.url}
          className={cn(
            "w-full py-3 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg select-none cursor-pointer font-black",
            loading 
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40 animate-pulse" 
              : isAutocannonModule
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30 border border-rose-500/40"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 border border-emerald-500/40"
          )}
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> ABORT RUNNER
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" /> 
              {isAutocannonModule ? 'RUN AUTOCANNON BENCHMARK' : 'START TEST SUITE'}
            </>
          )}
        </button>
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 px-1">
          <span>Target: {config.method || 'GET'} {config.url ? new URL(config.url).pathname : '/'}</span>
          <span>{telemetry.activeWorkers > 0 ? `⚡ ${telemetry.activeWorkers} Workers Active` : '🌱 Virtual Loop'}</span>
        </div>
      </div>
    </div>
  );
}
