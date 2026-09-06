const fs = require('fs');
let code = fs.readFileSync('src/components/VariablesManager.tsx', 'utf8');
code = code.replace(/}\n  \}\];/, '}\nconst DEFAULT_ENVIRONMENTS: Environment[] = [];');
fs.writeFileSync('src/components/VariablesManager.tsx', code);
