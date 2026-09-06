const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/BatchViewer.tsx', 'utf8');

// Replace Abort button styles
code = code.replace(
    /className="text-\[10px\] font-bold text-slate-300 border border-slate-800 px-3 py-1 rounded hover:bg-rose-600 hover:text-white hover:border-rose-650 transition-all uppercase tracking-wider cursor-pointer"/,
    "className={cn('text-[10px] font-bold px-3 py-1 rounded transition-all uppercase tracking-wider cursor-pointer border', theme === 'light' ? 'text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200' : 'text-slate-300 border-slate-800 hover:bg-rose-600 hover:text-white hover:border-rose-650')}"
);

// Progress bar background
code = code.replace(
    /<div className="h-1\.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">/,
    "<div className={cn('h-1.5 rounded-full overflow-hidden border', theme === 'light' ? 'bg-slate-200 border-slate-300' : 'bg-slate-950 border-slate-900')}>"
);

// Stats container background
code = code.replace(
    /<div className="bg-slate-950\/40 p-3 rounded-lg border border-slate-900 space-y-2">/,
    "<div className={cn('p-3 rounded-lg border space-y-2', theme === 'light' ? 'bg-slate-100/50 border-slate-200' : 'bg-slate-950/40 border-slate-900')}>"
);

// Empty state loading indicator
code = code.replace(
    /<div className="h-full flex items-center justify-center border border-dashed border-slate-900 rounded bg-\[#090D14\]\/25">/,
    "<div className={cn('h-full flex items-center justify-center border border-dashed rounded', theme === 'light' ? 'border-slate-300 bg-slate-50' : 'border-slate-900 bg-[#090D14]/25')}>"
);

// List item hover states
code = code.replace(
    /"border-slate-800 hover:border-slate-500 hover:bg-slate-900\/40 text-slate-300"/,
    "theme === 'light' ? 'border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700 bg-white shadow-sm' : 'border-slate-800 hover:border-slate-500 hover:bg-slate-900/40 text-slate-300'"
);

// Selected list item
code = code.replace(
    /"border-emerald-500 bg-emerald-500\/15 text-white"/,
    "theme === 'light' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-1 ring-emerald-500/20' : 'border-emerald-500 bg-emerald-500/15 text-white'"
);

fs.writeFileSync('src/features/api-tester/components/BatchViewer.tsx', code);
console.log("Updated BatchViewer specifics");
