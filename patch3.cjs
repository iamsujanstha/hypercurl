const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', 'utf8');

// Replace bodyType json tab
code = code.replace(
    /className=\{cn\("px-3 py-1 rounded text-\[10px\] font-bold uppercase transition-colors cursor-pointer", \(\!activeTab\.bodyType \|\| activeTab\.bodyType === 'json'\) \? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"\)\}/g,
    `className={cn("px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer", (!activeTab.bodyType || activeTab.bodyType === 'json') ? (theme === 'light' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-white') : (theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'))}`
);

// Replace bodyType binary tab
code = code.replace(
    /className=\{cn\("px-3 py-1 rounded text-\[10px\] font-bold uppercase transition-colors cursor-pointer", activeTab\.bodyType === 'binary' \? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"\)\}/g,
    `className={cn("px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer", activeTab.bodyType === 'binary' ? (theme === 'light' ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-white') : (theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'))}`
);

fs.writeFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', code);
console.log("Replaced body tabs");
