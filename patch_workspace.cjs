const fs = require('fs');
let code = fs.readFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', 'utf8');

code = code.replace(
    /<BatchViewer\s*results=\{activeTab\.batchResults \|\| \[\]\}\s*progress=\{activeTab\.progress\}\s*concurrency=\{activeTab\.testConfig\?\.concurrency \|\| activeTab\.batchConcurrency \|\| 5\}\s*onAbort=\{handleAbort\}\s*theme=\{theme\}\s*\/>/,
    `<BatchViewer 
            results={activeTab.batchResults || []} 
            progress={activeTab.progress} 
            concurrency={activeTab.testConfig?.concurrency || activeTab.batchConcurrency || 5} 
            onAbort={handleAbort} 
            onClear={() => {
              if (window.confirm("Are you sure you want to clear all batch results?")) {
                updateActiveTab({ batchResults: [] });
              }
            }}
            theme={theme}
          />`
);

fs.writeFileSync('src/features/api-tester/components/ApiClientWorkspace.tsx', code);
console.log("Updated ApiClientWorkspace");
