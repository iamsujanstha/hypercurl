const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/BatchViewer.tsx', 'utf8');

code = code.replace(
    /className="text-slate-500 font-bold mb-1">\{data\.name\}<\/div>/g,
    'className="text-slate-500 font-bold mb-1">{data.name}</div>'
); // Wait, this doesn't help if it's already there but wait, if it was replaced, the `</div>` was lost!
// Ah, the regex matched `</div>` and it WAS replaced. The replacement string had `</div>` at the end!
// Let's look at the replacement string:
// `<div className={...}>${inner}</div>`
// `inner` is `                              <div className="text-slate-500 font-bold mb-1">{data.name}`
// So it became `<div className={...}>                              <div className="text-slate-500 font-bold mb-1">{data.name}</div>`
// Yes! So the inner `<div className="text-slate-500 font-bold mb-1">` got closed by the `</div>` that was supposed to close the outer div!
// This means the outer div is now unclosed!

// The easiest fix is just to replace that whole block with the correct one.
const oldBlock = `<div className={cn("border p-2 text-[10px] font-mono rounded shadow-lg", theme === 'light' ? "bg-white/95 border-slate-200 text-slate-800" : "bg-[#090D14]/95 border-slate-800 text-slate-300")}>                              <div className="text-slate-500 font-bold mb-1">{data.name}</div>                              <div className="flex gap-2">                                <span>LATENCY:</span>                                <span className="text-blue-400 font-bold">{data.latency}ms</span>                              </div>                              <div className="flex gap-2">                                <span>STATUS:</span>                                <span className={data.success ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>                                  {data.status}                                </span>                              </div>                            </div>`;

const correctBlock = `<div className={cn("border p-2 text-[10px] font-mono rounded shadow-lg", theme === 'light' ? "bg-white/95 border-slate-200 text-slate-800" : "bg-[#090D14]/95 border-slate-800 text-slate-300")}>
                              <div className="text-slate-500 font-bold mb-1">{data.name}</div>
                              <div className="flex gap-2">
                                <span>LATENCY:</span>
                                <span className="text-blue-400 font-bold">{data.latency}ms</span>
                              </div>
                              <div className="flex gap-2">
                                <span>STATUS:</span>
                                <span className={data.success ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                                  {data.status}
                                </span>
                              </div>
                            </div>`;

code = code.replace(/<div className=\{cn\("border p-2 text-\[10px\] font-mono rounded shadow-lg"[\s\S]*?\{data\.status\}[\s\S]*?<\/span>[\s\S]*?<\/div>[\s\S]*?<\/div>/, correctBlock);

fs.writeFileSync('src/features/api-tester/components/BatchViewer.tsx', code);
console.log("Fixed tooltip syntax");
