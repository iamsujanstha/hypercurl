import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { TestLab } from '@/components/TestLab';
import { VariablesManager } from '@/components/VariablesManager';

// Import refactored domain components & hooks
import { 
  useApiTesterState,
  WorkspaceSidebar,
  WorkspaceNavbar,
  TabSystem,
  ApiClientWorkspace,
  WorkerPoolPopover,
  TerminalDialog,
  HistoryList,
  AutocannonStudio
} from '@/features/api-tester';

export function ApiTester({ variables: initialVariables = {} }: { variables?: Record<string, string> }) {
  const {
    state: {
      tabs,
      activeTabId,
      collections,
      isSidebarCollapsed,
      isWorkerPoolOpen,
      theme,
      dialog,
      view,
      splitPercent,
      graphqlQueryHeight,
      graphqlVariablesHeight,
      payloadJsonHeight,
      variables,
      activeTab
    },
    actions: {
      setActiveTabId,
      setIsSidebarCollapsed,
      setIsWorkerPoolOpen,
      setTheme,
      setDialog,
      showCustomAlert,
      setView,
      setIsDraggingSplit,
      startResizeQuery,
      startResizeVariables,
      startResizePayloadJson,
      setVariables,
      getResolvedConfig,
      updateActiveTab,
      updateActiveConfig,
      handleAbort,
      handleRun,
      createTab,
      closeTab,
      saveToCollection,
      handleStartLabTest,
      handleStartAutocannon,
      handleAbortAutocannon,
      addAssertion,
      removeAssertion,
      updateAssertion
    },
    telemetry,
    ws
  } = useApiTesterState(initialVariables);

  if (!activeTab) return null;

  return (
    <div className={cn("flex bg-[#0B0D11] h-screen text-slate-300 overflow-hidden font-sans select-none relative", theme === 'light' && "theme-light")}>
      {/* 1. Collapsible Sidebar */}
      <WorkspaceSidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        view={view}
        setView={setView}
        createTab={createTab}
      />

      {/* Backdrop overlay for mobile drawer dismiss clicks */}
      {!isSidebarCollapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-30 transition-opacity" 
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0B0D11] relative">
        {/* Top Navbar */}
        <WorkspaceNavbar 
          view={view}
          theme={theme}
          setTheme={setTheme}
          telemetry={telemetry}
          isWorkerPoolOpen={isWorkerPoolOpen}
          setIsWorkerPoolOpen={setIsWorkerPoolOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
        />

        {/* Worker Pool Floating Popover Dashboard */}
        <WorkerPoolPopover 
          isOpen={isWorkerPoolOpen}
          onClose={() => setIsWorkerPoolOpen(false)}
          telemetry={telemetry}
          ws={ws}
        />

        {/* Tab Selection Header Bar */}
        {(view === 'studio' || view === 'suites' || view === 'debugger' || view === 'lab' || view === 'autocannon') && (
          <TabSystem 
            tabs={tabs}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            closeTab={closeTab}
            createTab={createTab}
          />
        )}

        {/* Dynamic Workspace Switcher Panels */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {(view === 'studio' || view === 'debugger' || view === 'autocannon') && (
              <ApiClientWorkspace 
                activeTab={activeTab}
                activeTabId={activeTabId}
                tabs={tabs}
                updateActiveTab={updateActiveTab}
                updateActiveConfig={updateActiveConfig}
                saveToCollection={saveToCollection}
                handleAbort={handleAbort}
                handleRun={handleRun}
                getResolvedConfig={getResolvedConfig}
                showCustomAlert={showCustomAlert}
                
                splitPercent={splitPercent}
                setIsDraggingSplit={setIsDraggingSplit}
                theme={theme}

                graphqlQueryHeight={graphqlQueryHeight}
                graphqlVariablesHeight={graphqlVariablesHeight}
                payloadJsonHeight={payloadJsonHeight}

                startResizeQuery={startResizeQuery}
                startResizeVariables={startResizeVariables}
                startResizePayloadJson={startResizePayloadJson}

                addAssertion={addAssertion}
                removeAssertion={removeAssertion}
                updateAssertion={updateAssertion}
                variables={variables}
                setVariables={setVariables}

                handleStartAutocannon={handleStartAutocannon}
                handleAbortAutocannon={handleAbortAutocannon}
                telemetry={telemetry}
              />
            )}

            {(view === 'suites' || view === 'lab') && (
              <motion.div 
                key="suites"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-hidden"
              >
                <TestLab 
                  config={activeTab.config}
                  headersList={activeTab.headersList}
                  ws={ws}
                  activeTabId={activeTabId}
                  loading={activeTab.loading}
                  progress={activeTab.progress}
                  results={activeTab.batchResults}
                  labResults={activeTab.labResults || {}}
                  autocannonProgress={activeTab.autocannonProgress || null}
                  autocannonResult={activeTab.autocannonResult || null}
                  onStart={handleStartLabTest}
                  onAbort={handleAbort}
                  onStartAutocannon={handleStartAutocannon}
                  onAbortAutocannon={handleAbortAutocannon}
                  onClearAutocannon={() => {
                    updateActiveTab({ autocannonResult: null, autocannonProgress: null, loading: false });
                  }}
                  onChangeConfig={updateActiveConfig}
                  onClearLogs={(modId?: string) => {
                    if (modId) {
                      const nextLabResults = { ...(activeTab.labResults || {}) };
                      delete nextLabResults[modId];
                      updateActiveTab({ 
                        batchResults: [], 
                        progress: null, 
                        labResults: nextLabResults 
                      });
                    } else {
                      updateActiveTab({ 
                        batchResults: [], 
                        progress: null, 
                        labResults: {} 
                      });
                    }
                  }}
                  telemetry={telemetry}
                />
              </motion.div>
            )}

            {view === 'variables' && (
              <motion.div 
                key="variables"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto p-8 custom-scrollbar bg-[#0B0D11]"
              >
                <div className="max-w-4xl mx-auto">
                  <VariablesManager variables={variables} onVariablesChange={setVariables} />
                </div>
              </motion.div>
            )}

            {view === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto p-8 custom-scrollbar bg-[#0B0D11]"
              >
                <div className="max-w-4xl mx-auto flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-5 shrink-0 pb-2 border-b border-slate-800/60 select-none">
                     <h2 className="text-base font-black text-white font-mono tracking-widest flex items-center gap-2.5 uppercase">
                        System_History_Logs
                     </h2>
                     <div className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg font-bold select-none uppercase">
                       RETENTION: 100_ENTRIES
                     </div>
                  </div>
                  <HistoryList />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Static Nominal Status Footer Bar */}
        <footer className="h-8 border-t border-slate-850 bg-[#0F1115] flex items-center justify-between px-4 text-[10px] font-mono text-slate-500 shrink-0 select-none">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> SYSTEM: NOMINAL
            </span>
            <span>LATENCY: {telemetry.latency}</span>
            <span>THREADS: {telemetry.activeWorkers}/{telemetry.maxWorkers}</span>
            <span className="opacity-50">|</span>
            <span>CLIENTS: {telemetry.clientCount}</span>
          </div>
          <div className="flex gap-4">
            <span>v0.4.2-alpha</span>
            <span className="text-slate-350 hover:text-emerald-400 underline cursor-pointer">VIEW_RAW_LOGS</span>
          </div>
        </footer>
      </main>

      {/* 3. Global custom terminal modal dialog overlay */}
      <TerminalDialog 
        dialog={dialog}
        setDialog={setDialog}
        collections={collections}
      />
    </div>
  );
}
