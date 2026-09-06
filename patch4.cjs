const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', 'utf8');

// Quick and dirty replace to make the major panels respect light theme
code = code.replace(/bg-\[#080A0F\]/g, "${theme === 'light' ? 'bg-slate-50' : 'bg-[#080A0F]'}");
code = code.replace(/bg-\[#0E121A\]/g, "${theme === 'light' ? 'bg-white' : 'bg-[#0E121A]'}");
code = code.replace(/bg-\[#0B0D13\]/g, "${theme === 'light' ? 'bg-slate-50' : 'bg-[#0B0D13]'}");
code = code.replace(/bg-\[#0E121B\]/g, "${theme === 'light' ? 'bg-white' : 'bg-[#0E121B]'}");
code = code.replace(/bg-\[#07090E\]/g, "${theme === 'light' ? 'bg-white' : 'bg-[#07090E]'}");
code = code.replace(/bg-\[#0A0D14\]/g, "${theme === 'light' ? 'bg-slate-100' : 'bg-[#0A0D14]'}");
code = code.replace(/bg-\[#141C2B\]/g, "${theme === 'light' ? 'bg-white' : 'bg-[#141C2B]'}");
code = code.replace(/bg-\[#10141F\]/g, "${theme === 'light' ? 'bg-white' : 'bg-[#10141F]'}");
code = code.replace(/bg-\[#05070A\]/g, "${theme === 'light' ? 'bg-white' : 'bg-[#05070A]'}");
code = code.replace(/bg-\[#0C0F17\]/g, "${theme === 'light' ? 'bg-white' : 'bg-[#0C0F17]'}");
code = code.replace(/bg-\[#121622\]/g, "${theme === 'light' ? 'bg-slate-100' : 'bg-[#121622]'}");
code = code.replace(/bg-\[#182235\]/g, "${theme === 'light' ? 'bg-slate-100' : 'bg-[#182235]'}");

fs.writeFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', code);
console.log("Patched backgrounds");
