const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', 'utf8');

const regex = /"absolute top-2\.5 right-2\.5 px-3 py-1\.5 rounded-lg bg-\[#141824\]\/90 backdrop-blur-sm hover:bg-\[#1C2132\] text-slate-300 border border-slate-700 font-bold transition-all cursor-pointer flex items-center gap-1\.5 shadow-sm"/g;

const replacement = `theme === 'light' 
                      ? "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      : "absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-[#141824]/90 backdrop-blur-sm hover:bg-[#1C2132] text-slate-300 border border-slate-700 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', code);
console.log("Replaced CLI copy buttons");
