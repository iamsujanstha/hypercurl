const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', 'utf8');

const regexSendBtn = /onClick=\{activeTab\.loading \? \(handleAbortAutocannon \|\| handleAbort\) : handleRun\}\s*className=\{cn\(\s*"px-5 text-xs font-mono font-black tracking-wider transition-all text-white active:scale-95 flex items-center justify-center gap-2 cursor-pointer select-none",\s*activeTab\.loading\s*\?\s*"bg-rose-700 hover:bg-rose-650 rounded-r-xl"\s*:\s*activeTab\.testMode === 'load'\s*\?\s*"bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black shadow-md shadow-amber-500\/20"\s*:\s*activeTab\.batchMode \?\s*"bg-cyan-600 hover:bg-cyan-500"\s*:\s*"bg-emerald-600 hover:bg-emerald-500"\s*\)\}/;

const replaceSendBtn = `onClick={activeTab.loading ? (handleAbortAutocannon || handleAbort) : handleRun}
                className={cn(
                  "px-5 text-xs font-mono font-black tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer select-none",
                  activeTab.loading 
                    ? "bg-rose-600 hover:bg-rose-500 text-white rounded-r-xl" 
                    : activeTab.testMode === 'load'
                      ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black shadow-md shadow-amber-500/20"
                      : activeTab.batchMode 
                        ? (theme === 'light' ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white") 
                        : (theme === 'light' ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white")
                )}`;

if (regexSendBtn.test(code)) {
    code = code.replace(regexSendBtn, replaceSendBtn);
    console.log("Replaced send btn");
}

const regexCaret = /onClick=\{\(\) => setShowSendDropdown\(!showSendDropdown\)\}\s*className=\{cn\(\s*"px-2\.5 flex items-center justify-center transition-all cursor-pointer border-l border-white\/15 text-white rounded-r-xl",\s*activeTab\.testMode === 'load' \? "bg-amber-600 hover:bg-amber-500 text-slate-950" : activeTab\.batchMode \? "bg-cyan-700 hover:bg-cyan-600" : "bg-emerald-700 hover:bg-emerald-600"\s*\)\}/;

const replaceCaret = `onClick={() => setShowSendDropdown(!showSendDropdown)}
                  className={cn(
                    "px-2.5 flex items-center justify-center transition-all cursor-pointer border-l rounded-r-xl",
                    activeTab.testMode === 'load' 
                      ? "bg-amber-600 hover:bg-amber-500 text-slate-950 border-slate-900/10" 
                      : activeTab.batchMode 
                        ? (theme === 'light' ? "bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-800/20" : "bg-cyan-700 hover:bg-cyan-600 text-white border-white/15") 
                        : (theme === 'light' ? "bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-800/20" : "bg-emerald-700 hover:bg-emerald-600 text-white border-white/15")
                  )}`;

if (regexCaret.test(code)) {
    code = code.replace(regexCaret, replaceCaret);
    console.log("Replaced caret");
}

fs.writeFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', code);
