const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', 'utf8');

// The naive replacement added template literals inside strings instead of wrapping them in cn() or evaluating them properly in JSX
code = code.replace(/className="absolute inset-0 flex flex-col lg:flex-row gap-0 overflow-hidden font-sans \$\{theme === 'light' \? 'bg-slate-50' : 'bg-\[#080A0F\]'\}"/g, 
    "className={cn('absolute inset-0 flex flex-col lg:flex-row gap-0 overflow-hidden font-sans', theme === 'light' ? 'bg-slate-50' : 'bg-[#080A0F]')}");
    
code = code.replace(/className="lg:hidden flex \$\{theme === 'light' \? 'bg-white' : 'bg-\[#0E121A\]'\} border-b border-slate-850 p-1\.5 shrink-0 h-11 items-center gap-1\.5 select-none w-full"/g,
    "className={cn('lg:hidden flex border-b border-slate-850 p-1.5 shrink-0 h-11 items-center gap-1.5 select-none w-full', theme === 'light' ? 'bg-white' : 'bg-[#0E121A]')}");

code = code.replace(/className="p-3\.5 pb-2\.5 border-b border-slate-850 flex flex-col gap-2\.5 shrink-0 \$\{theme === 'light' \? 'bg-white' : 'bg-\[#0E121B\]'\}"/g,
    "className={cn('p-3.5 pb-2.5 border-b border-slate-850 flex flex-col gap-2.5 shrink-0', theme === 'light' ? 'bg-white' : 'bg-[#0E121B]')}");

code = code.replace(/className="flex rounded-xl \$\{theme === 'light' \? 'bg-white' : 'bg-\[#07090E\]'\} border border-slate-800 focus-within:border-emerald-500\/50 shadow-inner relative z-30"/g,
    "className={cn('flex rounded-xl border border-slate-800 focus-within:border-emerald-500/50 shadow-inner relative z-30', theme === 'light' ? 'bg-white' : 'bg-[#07090E]')}");

code = code.replace(/className="flex \$\{theme === 'light' \? 'bg-slate-100' : 'bg-\[#0A0D14\]'\} border-b border-slate-850 px-3 shrink-0 overflow-x-auto custom-scrollbar select-none"/g,
    "className={cn('flex border-b border-slate-850 px-3 shrink-0 overflow-x-auto custom-scrollbar select-none', theme === 'light' ? 'bg-slate-100' : 'bg-[#0A0D14]')}");

code = code.replace(/className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 custom-scrollbar \$\{theme === 'light' \? 'bg-slate-50' : 'bg-\[#0B0D13\]'\}"/g,
    "className={cn('flex-1 flex flex-col overflow-y-auto p-4 space-y-4 custom-scrollbar', theme === 'light' ? 'bg-slate-50' : 'bg-[#0B0D13]')}");

code = code.replace(/className="flex flex-col px-4 pt-4 pb-2 \$\{theme === 'light' \? 'bg-slate-50' : 'bg-\[#0B0D13\]'\} shrink-0"/g,
    "className={cn('flex flex-col px-4 pt-4 pb-2 shrink-0', theme === 'light' ? 'bg-slate-50' : 'bg-[#0B0D13]')}");

code = code.replace(/className="\$\{theme === 'light' \? 'bg-white' : 'bg-\[#05070A\]'\} border border-slate-800\/80 rounded px-2\.5 py-2 overflow-x-auto custom-scrollbar flex items-center shadow-inner"/g,
    "className={cn('border border-slate-800/80 rounded px-2.5 py-2 overflow-x-auto custom-scrollbar flex items-center shadow-inner', theme === 'light' ? 'bg-white' : 'bg-[#05070A]')}");

code = code.replace(/className="mt-auto pt-4">\s*<div className="\$\{theme === 'light' \? 'bg-white' : 'bg-\[#0C0F17\]'\} p-3\.5 rounded-xl border border-slate-800 font-mono text-\[11px\] shadow-inner relative group"/g,
    "className=\"mt-auto pt-4\">\n              <div className={cn('p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] shadow-inner relative group', theme === 'light' ? 'bg-white' : 'bg-[#0C0F17]')} ");

fs.writeFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', code);
console.log("Fixed naive replaces");
