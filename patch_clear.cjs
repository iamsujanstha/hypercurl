const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', 'utf8');

code = code.replace(
    /onClear=\{\(\) => \{\s*if \(window\.confirm\("Are you sure you want to clear all batch results\?"\)\) \{\s*updateActiveTab\(\{ batchResults: \[\] \}\);\s*\}\s*\}\}/,
    'onClear={() => updateActiveTab({ batchResults: [], labResults: {} })}'
);

fs.writeFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', code);
console.log("Patched onClear");
