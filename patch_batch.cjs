const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/BatchViewer.tsx', 'utf8');

// 1. Add onClear to interface
code = code.replace(/onAbort: \(\) => void;/, "onAbort: () => void;\n  onClear?: () => void;");

// 2. Add onClear to component props
code = code.replace(/onAbort,(\s*)theme = 'dark'(\s*)}: BatchViewerProps\)/, "onAbort,\n  onClear,\n  theme = 'dark'\n}: BatchViewerProps)");

// 3. Update the TELEMETRY_LOGS header to support light theme and add CLEAR button
const logHeaderRegex = /<div className="px-6 py-2 border-b border-slate-900 bg-black\/40 flex items-center justify-between shrink-0">([\s\S]*?)<\/div>/;
const newLogHeader = `<div className={cn("px-6 py-2 border-b flex items-center justify-between shrink-0", theme === 'light' ? 'border-slate-200 bg-slate-100' : 'border-slate-900 bg-black/40')}>
             <span className={cn("text-xs font-black uppercase tracking-[0.2em]", theme === 'light' ? 'text-slate-500' : 'text-slate-400')}>RECENT REQUESTS</span>
             <div className="flex items-center gap-4">
                <div className={cn("text-xs font-mono font-bold uppercase", theme === 'light' ? 'text-slate-500' : 'text-slate-500')}>SHOWING LAST 55</div>
                {onClear && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border transition-colors cursor-pointer flex items-center gap-1.5",
                      theme === 'light'
                        ? "text-rose-600 border-rose-200 hover:bg-rose-50"
                        : "text-slate-300 border-slate-800 hover:text-white hover:bg-rose-600 hover:border-rose-650"
                    )}
                  >
                    <X size={12} /> Clear All
                  </button>
                )}
             </div>
          </div>`;
code = code.replace(logHeaderRegex, newLogHeader);

// 4. Update bg-black to use light theme dynamically
code = code.replace(/className="flex flex-col lg:flex-row h-full bg-black text-slate-300 divide-y lg:divide-y-0 lg:divide-x divide-slate-800\/60 overflow-hidden"/g,
    "className={cn('flex flex-col lg:flex-row h-full divide-y lg:divide-y-0 lg:divide-x overflow-hidden', theme === 'light' ? 'bg-white text-slate-900 divide-slate-200' : 'bg-black text-slate-300 divide-slate-800/60')}");

code = code.replace(/className=\{cn\("flex flex-col h-full bg-black overflow-hidden transition-all duration-300",/g,
    "className={cn('flex flex-col h-full overflow-hidden transition-all duration-300', theme === 'light' ? 'bg-white' : 'bg-black',");

code = code.replace(/<div className="p-5 p-6 border-b border-slate-900 bg-\[#0F1115\] shrink-0 space-y-4">/g,
    "<div className={cn('p-5 p-6 border-b shrink-0 space-y-4', theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-900 bg-[#0F1115]')}>");

code = code.replace(/<div className="flex-1 overflow-y-auto p-4 px-6 custom-scrollbar space-y-1\.5 bg-black">/g,
    "<div className={cn('flex-1 overflow-y-auto p-4 px-6 custom-scrollbar space-y-1.5', theme === 'light' ? 'bg-slate-50' : 'bg-black')}>");

code = code.replace(/className="flex-1 flex flex-col h-full bg-black relative"/g,
    "className={cn('flex-1 flex flex-col h-full relative', theme === 'light' ? 'bg-white' : 'bg-black')}");

code = code.replace(/className="p-3 px-4 border-b border-slate-900 bg-\[#0F1115\] flex items-center justify-between shrink-0 font-sans"/g,
    "className={cn('p-3 px-4 border-b flex items-center justify-between shrink-0 font-sans', theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-900 bg-[#0F1115]')}");

// 5. Tooltip fixing
const tooltipRegex = /<div className="bg-\[#090D14\]\/95 border border-slate-800 p-2 text-\[10px\] font-mono rounded shadow-lg text-slate-300">([\s\S]*?)<\/div>/g;
code = code.replace(tooltipRegex, (match, inner) => {
    return `<div className={cn("border p-2 text-[10px] font-mono rounded shadow-lg", theme === 'light' ? "bg-white/95 border-slate-200 text-slate-800" : "bg-[#090D14]/95 border-slate-800 text-slate-300")}>${inner}</div>`;
});

// Also fix the chart axes colors
code = code.replace(/tick=\{\{ fill: '#475569', fontSize: 9, fontFamily: 'monospace' \}\}/g, 
    "tick={{ fill: theme === 'light' ? '#64748B' : '#475569', fontSize: 9, fontFamily: 'monospace' }}");

fs.writeFileSync('src/features/api-tester/components/BatchViewer.tsx', code);
console.log("Updated BatchViewer");
