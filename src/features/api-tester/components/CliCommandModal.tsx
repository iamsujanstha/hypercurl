import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Copy, 
  Check, 
  X, 
  Flame, 
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CliCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  commandType?: 'curl' | 'autocannon' | 'general';
  title?: string;
  singleLineCommand: string;
  multilineCommand?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

// Dictionary of known CLI flags and their explanations
const CURL_FLAG_DEFINITIONS: Record<string, { name: string; desc: string }> = {
  '-i': { name: 'Include Response Headers', desc: 'Outputs HTTP response status line and all response headers along with the body' },
  '--include': { name: 'Include Response Headers', desc: 'Outputs HTTP response headers along with the body' },
  '-s': { name: 'Silent Mode', desc: 'Runs in silent mode, hiding progress meters and non-error diagnostics' },
  '--silent': { name: 'Silent Mode', desc: 'Runs silently without showing progress meters or error info' },
  '-S': { name: 'Show Error', desc: 'When used with silent mode (-s), still displays error messages if the request fails' },
  '--show-error': { name: 'Show Error', desc: 'Displays errors even when running in silent mode' },
  '-L': { name: 'Follow Redirects', desc: 'Automatically follows HTTP 3xx server location redirects' },
  '--location': { name: 'Follow Redirects', desc: 'Follows server redirects (HTTP 301, 302, 307, 308)' },
  '-X': { name: 'HTTP Method / Verb', desc: 'Specifies the HTTP request method (e.g. GET, POST, PUT, DELETE, PATCH)' },
  '--request': { name: 'HTTP Method / Verb', desc: 'Specifies custom request command method' },
  '-H': { name: 'Request Header', desc: 'Passes custom HTTP header(s) such as Authorization, Content-Type, Accept' },
  '--header': { name: 'Request Header', desc: 'Passes custom HTTP header to the server' },
  '-d': { name: 'Request Data / Body', desc: 'Sends the specified data payload in POST/PUT requests' },
  '--data': { name: 'Request Data / Body', desc: 'Sends data in an HTTP POST request' },
  '--data-raw': { name: 'Raw Request Data', desc: 'Sends raw data payload without treating @ symbol as a file lookup' },
  '-k': { name: 'Insecure SSL', desc: 'Allows insecure SSL connections without verifying server certificates' },
  '--insecure': { name: 'Insecure SSL', desc: 'Bypasses SSL/TLS certificate verification' },
  '-u': { name: 'User Authentication', desc: 'Specifies credentials (user:password) for Basic/Digest authentication' },
  '--user': { name: 'User Authentication', desc: 'Specifies server authentication credentials' },
  '-m': { name: 'Max Timeout', desc: 'Maximum time in seconds allowed for the entire operation' },
  '--max-time': { name: 'Max Timeout', desc: 'Maximum time in seconds for the transfer' },
  '-A': { name: 'User Agent', desc: 'Custom User-Agent header string sent with the request' },
  '--user-agent': { name: 'User Agent', desc: 'Custom User-Agent header string sent with the request' },
  '-b': { name: 'Cookie Data', desc: 'Passes cookie string or file to send with the request' },
  '--cookie': { name: 'Cookie Data', desc: 'Passes cookie data to the server' },
  '--compressed': { name: 'Compressed Response', desc: 'Requests compressed response from server using gzip/deflate' }
};

const AUTOCANNON_FLAG_DEFINITIONS: Record<string, { name: string; desc: string }> = {
  '-c': { name: 'Connections', desc: 'Number of concurrent virtual connections / clients' },
  '--connections': { name: 'Connections', desc: 'Number of concurrent virtual connections' },
  '-d': { name: 'Duration', desc: 'Duration of the benchmark run in seconds' },
  '--duration': { name: 'Duration', desc: 'Duration of the benchmark run in seconds' },
  '-p': { name: 'Pipelining', desc: 'Number of pipelined HTTP requests sent per connection' },
  '--pipelining': { name: 'Pipelining', desc: 'Number of pipelined HTTP requests sent per connection' },
  '-m': { name: 'HTTP Method', desc: 'HTTP request method (GET, POST, PUT, DELETE, etc.)' },
  '--method': { name: 'HTTP Method', desc: 'HTTP request method' },
  '-H': { name: 'Custom Header', desc: 'Custom HTTP header sent with benchmark requests' },
  '--headers': { name: 'Custom Header', desc: 'Custom HTTP header sent with benchmark requests' },
  '-b': { name: 'Request Body', desc: 'Request body payload sent with each request' },
  '--body': { name: 'Request Body', desc: 'Request body payload sent with each request' },
  '-t': { name: 'Timeout', desc: 'Socket timeout per request in seconds' },
  '--timeout': { name: 'Timeout', desc: 'Socket timeout per request in seconds' },
  '-a': { name: 'Request Amount', desc: 'Total number of requests to execute before stopping' },
  '--amount': { name: 'Request Amount', desc: 'Total number of requests to execute before stopping' }
};

export function CliCommandModal({
  isOpen,
  onClose,
  commandType = 'curl',
  title,
  singleLineCommand
}: CliCommandModalProps) {
  const [copied, setCopied] = useState(false);

  // Command to display (clean single line)
  const commandToDisplay = (singleLineCommand || '').trim();

  // Detect which flags are used in this command
  const usedFlags = useMemo(() => {
    const definitions = commandType === 'autocannon' ? AUTOCANNON_FLAG_DEFINITIONS : CURL_FLAG_DEFINITIONS;
    const detected: Array<{ flag: string; name: string; desc: string }> = [];
    const seen = new Set<string>();

    // Extract all flags like -i, -s, -L, -X, -H, -d, --include, etc.
    const tokens = commandToDisplay.match(/(?:^|\s)(-[a-zA-Z]|--[a-zA-Z0-9-]+)(?=\s|$)/g) || [];

    for (const rawToken of tokens) {
      const flag = rawToken.trim();
      if (!seen.has(flag) && definitions[flag]) {
        seen.add(flag);
        detected.push({
          flag,
          name: definitions[flag].name,
          desc: definitions[flag].desc
        });
      }
    }

    return detected;
  }, [commandToDisplay, commandType]);

  if (!isOpen) return null;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(commandToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="cli-modal-shell w-full max-w-2xl bg-white dark:bg-[#0C1017] border border-slate-300 dark:border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Clean Modal Header */}
          <div className="cli-modal-header bg-slate-50 dark:bg-[#111622] border-b border-slate-200 dark:border-slate-750 px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center font-bold border",
                commandType === 'autocannon' 
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" 
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              )}>
                {commandType === 'autocannon' ? <Flame size={15} /> : <Terminal size={15} />}
              </div>
              <h3 className="cli-modal-title text-xs font-mono font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {title || (commandType === 'autocannon' ? 'Autocannon Command' : 'cURL Command')}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="cli-modal-close-btn w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-300 dark:border-slate-750"
              title="Close modal (Esc)"
            >
              <X size={14} />
            </button>
          </div>

          {/* Clean Body Content */}
          <div className="cli-modal-body p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1 bg-slate-100/75 dark:bg-[#090C12]">
            
            {/* Terminal Command Box */}
            <div className="cli-modal-terminal relative rounded-xl overflow-hidden border border-slate-800 dark:border-slate-800 bg-[#0B0F19] dark:bg-[#05070A] shadow-md">
              <div className="cli-modal-terminal-header bg-[#111827] dark:bg-[#10141E] px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-slate-300 dark:text-slate-400 font-bold ml-1 text-[11px]">
                    {commandType === 'autocannon' ? 'autocannon' : 'curl'}
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className={cn(
                    "cli-modal-copy-btn px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-xs active:scale-95",
                    copied
                      ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 hover:text-white"
                  )}
                  title="Copy command to clipboard"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copied ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>

              {/* Code Display with pristine contrast */}
              <div className="p-4 overflow-x-auto custom-scrollbar max-h-[260px] bg-[#0B0F19]">
                <pre className="cli-modal-code font-mono text-[12.5px] leading-relaxed text-[#34D399] selection:bg-emerald-800 selection:text-white whitespace-pre-wrap select-all font-semibold break-all">
                  {commandToDisplay}
                </pre>
              </div>
            </div>

            {/* Tags / Flags Explanation Card */}
            {usedFlags.length > 0 && (
              <div className="cli-modal-flags-card bg-white dark:bg-[#10141E] border border-slate-300 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-400 font-mono text-[11px] font-bold uppercase tracking-wide">
                  <Tag size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Command Flag Meanings</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {usedFlags.map(({ flag, name, desc }) => (
                    <div 
                      key={flag} 
                      className="cli-modal-flag-item bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2.5 text-xs font-mono"
                    >
                      <code className="text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/40 px-1.5 py-0.5 rounded font-bold text-[11px] shrink-0">
                        {flag}
                      </code>
                      <div className="min-w-0">
                        <div className="text-slate-900 dark:text-slate-200 font-bold text-[11.5px]">{name}</div>
                        <div className="text-slate-600 dark:text-slate-400 text-[10.5px] leading-snug mt-0.5">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Clean Modal Footer */}
          <div className="cli-modal-footer bg-slate-50 dark:bg-[#111622] border-t border-slate-200 dark:border-slate-750 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="cli-modal-footer-close px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-slate-300 dark:border-slate-700 shadow-xs"
            >
              Close
            </button>
            
            <button
              type="button"
              onClick={handleCopyCommand}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy cURL'}</span>
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
