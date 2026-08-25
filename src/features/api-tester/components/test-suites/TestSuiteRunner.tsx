import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Square, Plus, Trash2, Edit3, Copy, Download, CheckCircle2, 
  XCircle, AlertCircle, Clock, ArrowRight, Layers, FileCode, 
  Terminal, Sliders, ChevronRight, Check, RefreshCw, Eye, 
  Sparkles, ExternalLink, ShieldCheck, Zap, Server, ChevronDown, ListChecks,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  TestSuite, TestSuiteStep, TestStepResult, TestSuiteRunResult, 
  AssertionRule, ResponseExtractorRule, Tab, HttpMethod, Telemetry 
} from '../../types';
import { DEFAULT_TEST_SUITES } from '../../data/defaultSuites';
import { evaluateAssertions } from '../../assertionEvaluator';
import { CurlResult } from '@/server/modules/curl-engine';
import { CliCommandModal } from '../CliCommandModal';

interface TestSuiteRunnerProps {
  tabs: Tab[];
  variables: Record<string, string>;
  setVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  telemetry: Telemetry;
}

export function TestSuiteRunner({
  tabs,
  variables,
  setVariables,
  telemetry
}: TestSuiteRunnerProps) {
  // Suites state persisted in localStorage
  const [suites, setSuites] = useState<TestSuite[]>(() => {
    const saved = localStorage.getItem('hypercurl_test_suites_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If the cached version contains the old gimmick tests, refresh with DEFAULT_TEST_SUITES
          const hasGimmicks = parsed.some((s: any) => 
            s.id === 'suite-order-atomic' || s.id === 'suite-rate-limiting-sla' || s.steps?.some((st: any) => st.url?.includes('race-demo') || st.url?.includes('orders/broken') || st.url?.includes('demo/rate-limited'))
          );
          if (!hasGimmicks) return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_TEST_SUITES;
  });

  const [activeSuiteId, setActiveSuiteId] = useState<string>(() => {
    return suites[0]?.id || 'suite-smoke-health';
  });

  const activeSuite = useMemo(() => {
    return suites.find(s => s.id === activeSuiteId) || suites[0];
  }, [suites, activeSuiteId]);

  // Persist suites changes
  useEffect(() => {
    localStorage.setItem('hypercurl_test_suites_v2', JSON.stringify(suites));
  }, [suites]);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [suiteRunResult, setSuiteRunResult] = useState<TestSuiteRunResult | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'assertions' | 'response' | 'request' | 'headers' | 'variables'>('assertions');
  
  // Modals / Drawers
  const [isEditingStep, setIsEditingStep] = useState<TestSuiteStep | null>(null);
  const [isCreatingSuite, setIsCreatingSuite] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDescription, setNewSuiteDescription] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [showStepCliModal, setShowStepCliModal] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Set default selected step when suite changes or finishes
  useEffect(() => {
    if (activeSuite && activeSuite.steps.length > 0) {
      if (!selectedStepId || !activeSuite.steps.some(s => s.id === selectedStepId)) {
        setSelectedStepId(activeSuite.steps[0].id);
      }
    }
  }, [activeSuite, selectedStepId]);

  // Selected step details
  const selectedStep = useMemo(() => {
    return activeSuite?.steps.find(s => s.id === selectedStepId) || activeSuite?.steps[0];
  }, [activeSuite, selectedStepId]);

  const selectedStepResult = useMemo(() => {
    return suiteRunResult?.stepResults.find(r => r.stepId === selectedStepId);
  }, [suiteRunResult, selectedStepId]);

  // Interpolate {{variables}}
  const resolveTemplate = (text: string, extraVars: Record<string, string> = {}) => {
    if (!text) return '';
    const allVars = { ...variables, ...extraVars };
    return text.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
      const trimmed = key.trim();
      return allVars[trimmed] !== undefined ? allVars[trimmed] : match;
    });
  };

  // Run the full active test suite sequentially
  const handleRunSuite = async () => {
    if (!activeSuite || activeSuite.steps.length === 0 || isRunning) return;

    setIsRunning(true);
    setCurrentStepIndex(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = Date.now();
    const runtimeVars: Record<string, string> = { ...variables };
    const stepResults: TestStepResult[] = [];

    const initialResult: TestSuiteRunResult = {
      suiteId: activeSuite.id,
      suiteName: activeSuite.name,
      startTime,
      totalDurationMs: 0,
      totalSteps: activeSuite.steps.length,
      passedSteps: 0,
      failedSteps: 0,
      stepResults: activeSuite.steps.map(s => ({
        stepId: s.id,
        stepName: s.name,
        method: s.method,
        url: s.url,
        resolvedHeaders: {},
        status: 'pending',
        durationMs: 0,
        assertions: []
      })),
      status: 'running'
    };

    setSuiteRunResult(initialResult);

    let failedCount = 0;
    let passedCount = 0;

    for (let i = 0; i < activeSuite.steps.length; i++) {
      if (controller.signal.aborted) {
        break;
      }

      const step = activeSuite.steps[i];
      setCurrentStepIndex(i);
      setSelectedStepId(step.id);

      // Delay if configured
      if (step.delayBeforeMs && step.delayBeforeMs > 0) {
        await new Promise(r => setTimeout(r, step.delayBeforeMs));
      }

      // Resolve step URL, headers, body with variables
      const resolvedUrl = resolveTemplate(step.url, runtimeVars);
      const resolvedHeaders: Record<string, string> = {};
      step.headersList.forEach(h => {
        if (h.enabled && h.key) {
          resolvedHeaders[resolveTemplate(h.key, runtimeVars)] = resolveTemplate(h.value, runtimeVars);
        }
      });

      const resolvedBody = step.bodyType !== 'none' && step.body 
        ? resolveTemplate(step.body, runtimeVars) 
        : undefined;

      const stepStartTime = Date.now();
      let curlRes: CurlResult | undefined;
      let stepStatus: TestStepResult['status'] = 'passed';
      let errorMsg: string | undefined;
      let assertionResults: any[] = [];
      const extractedThisStep: Record<string, string> = {};

      try {
        const response = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: resolvedUrl,
            method: step.method,
            headers: resolvedHeaders,
            body: resolvedBody
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }

        curlRes = await response.json();

        // Evaluate Assertions
        assertionResults = evaluateAssertions(curlRes, step.assertions || []);
        const hasFailedAssertion = assertionResults.some(a => !a.passed);
        if (hasFailedAssertion || (curlRes && curlRes.status >= 500)) {
          stepStatus = 'failed';
        }

        // Extract Response Variables
        if (step.extractors && step.extractors.length > 0 && curlRes?.body) {
          try {
            const parsed = JSON.parse(curlRes.body);
            step.extractors.forEach(ext => {
              if (ext.jsonPath && ext.variableName) {
                const parts = ext.jsonPath.split('.');
                let val: any = parsed;
                for (const p of parts) {
                  if (val && typeof val === 'object' && p in val) {
                    val = val[p];
                  } else {
                    val = undefined;
                    break;
                  }
                }
                if (val !== undefined) {
                  const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                  extractedThisStep[ext.variableName] = strVal;
                  runtimeVars[ext.variableName] = strVal;
                }
              }
            });
          } catch (e) {}
        }
      } catch (err: any) {
        if (controller.signal.aborted) {
          stepStatus = 'skipped';
          errorMsg = 'Execution aborted by user.';
        } else {
          stepStatus = 'failed';
          errorMsg = err?.message || 'Network request failed';
          assertionResults = (step.assertions || []).map(a => ({
            ruleId: a.id,
            type: a.type,
            passed: false,
            actual: 'Error',
            expected: a.value,
            error: errorMsg
          }));
        }
      }

      const stepDuration = Date.now() - stepStartTime;
      if (stepStatus === 'passed') passedCount++;
      else if (stepStatus === 'failed') failedCount++;

      const thisStepResult: TestStepResult = {
        stepId: step.id,
        stepName: step.name,
        method: step.method,
        url: resolvedUrl,
        resolvedHeaders,
        resolvedBody,
        response: curlRes,
        status: stepStatus,
        durationMs: stepDuration,
        assertions: assertionResults,
        extractedVariables: extractedThisStep,
        error: errorMsg
      };

      stepResults.push(thisStepResult);

      // Update state incrementally
      setSuiteRunResult({
        suiteId: activeSuite.id,
        suiteName: activeSuite.name,
        startTime,
        totalDurationMs: Date.now() - startTime,
        totalSteps: activeSuite.steps.length,
        passedSteps: passedCount,
        failedSteps: failedCount,
        stepResults: [
          ...stepResults,
          ...activeSuite.steps.slice(i + 1).map(s => ({
            stepId: s.id,
            stepName: s.name,
            method: s.method,
            url: s.url,
            resolvedHeaders: {},
            status: 'pending' as const,
            durationMs: 0,
            assertions: []
          }))
        ],
        status: 'running'
      });

      // Stop on failure if active
      if (stepStatus === 'failed' && activeSuite.stopOnFailure) {
        break;
      }
    }

    const isAborted = controller.signal.aborted;
    setSuiteRunResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        endTime: Date.now(),
        totalDurationMs: Date.now() - startTime,
        status: isAborted ? 'aborted' : failedCount > 0 ? 'failed' : 'completed'
      };
    });

    setIsRunning(false);
    setCurrentStepIndex(null);
  };

  // Run a single test step
  const handleRunSingleStep = async (step: TestSuiteStep) => {
    if (isRunning) return;

    setSelectedStepId(step.id);
    const resolvedUrl = resolveTemplate(step.url);
    const resolvedHeaders: Record<string, string> = {};
    step.headersList.forEach(h => {
      if (h.enabled && h.key) {
        resolvedHeaders[resolveTemplate(h.key)] = resolveTemplate(h.value);
      }
    });
    const resolvedBody = step.bodyType !== 'none' && step.body ? resolveTemplate(step.body) : undefined;

    const startTime = Date.now();
    let curlRes: CurlResult | undefined;
    let stepStatus: TestStepResult['status'] = 'passed';
    let errorMsg: string | undefined;
    let assertionResults: any[] = [];
    const extractedThisStep: Record<string, string> = {};

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: resolvedUrl,
          method: step.method,
          headers: resolvedHeaders,
          body: resolvedBody
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      curlRes = await response.json();
      assertionResults = evaluateAssertions(curlRes, step.assertions || []);
      if (assertionResults.some(a => !a.passed) || (curlRes && curlRes.status >= 500)) {
        stepStatus = 'failed';
      }

      if (step.extractors && step.extractors.length > 0 && curlRes?.body) {
        try {
          const parsed = JSON.parse(curlRes.body);
          step.extractors.forEach(ext => {
            if (ext.jsonPath && ext.variableName) {
              const parts = ext.jsonPath.split('.');
              let val: any = parsed;
              for (const p of parts) {
                if (val && typeof val === 'object' && p in val) {
                  val = val[p];
                } else {
                  val = undefined;
                  break;
                }
              }
              if (val !== undefined) {
                const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                extractedThisStep[ext.variableName] = strVal;
              }
            }
          });
        } catch (e) {}
      }
    } catch (err: any) {
      stepStatus = 'failed';
      errorMsg = err?.message || 'Network request failed';
      assertionResults = (step.assertions || []).map(a => ({
        ruleId: a.id,
        type: a.type,
        passed: false,
        actual: 'Error',
        expected: a.value,
        error: errorMsg
      }));
    }

    const duration = Date.now() - startTime;
    const singleResult: TestStepResult = {
      stepId: step.id,
      stepName: step.name,
      method: step.method,
      url: resolvedUrl,
      resolvedHeaders,
      resolvedBody,
      response: curlRes,
      status: stepStatus,
      durationMs: duration,
      assertions: assertionResults,
      extractedVariables: extractedThisStep,
      error: errorMsg
    };

    setSuiteRunResult(prev => {
      const existing = prev?.stepResults.filter(r => r.stepId !== step.id) || [];
      const passed = (existing.filter(r => r.status === 'passed').length) + (stepStatus === 'passed' ? 1 : 0);
      const failed = (existing.filter(r => r.status === 'failed').length) + (stepStatus === 'failed' ? 1 : 0);

      return {
        suiteId: activeSuite.id,
        suiteName: activeSuite.name,
        startTime: prev?.startTime || Date.now(),
        totalDurationMs: (prev?.totalDurationMs || 0) + duration,
        totalSteps: activeSuite.steps.length,
        passedSteps: passed,
        failedSteps: failed,
        stepResults: [...existing, singleResult],
        status: failed > 0 ? 'failed' : 'completed'
      };
    });
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
      setCurrentStepIndex(null);
    }
  };

  // Import tabs as a new test suite
  const handleImportTabsAsSuite = () => {
    if (!tabs || tabs.length === 0) return;

    const importedSteps: TestSuiteStep[] = tabs.map((tab, idx) => ({
      id: `step-${Date.now()}-${idx}`,
      name: tab.name || `Request #${idx + 1}`,
      method: (tab.config.method as HttpMethod) || 'GET',
      url: tab.config.url || 'http://localhost:3000/api/health',
      headersList: (tab.headersList && tab.headersList.length > 0)
        ? tab.headersList.map(h => ({ ...h, enabled: true }))
        : [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
      bodyType: tab.config.body ? 'json' : 'none',
      body: tab.config.body || '',
      assertions: tab.assertions && tab.assertions.length > 0 
        ? tab.assertions 
        : [{ id: `a-${Date.now()}`, type: 'status', value: '200' }],
      extractors: tab.extractors || []
    }));

    const newSuite: TestSuite = {
      id: `suite-imported-${Date.now()}`,
      name: `Imported Suite (${tabs.length} Requests)`,
      description: `Auto-generated test workflow imported from ${tabs.length} active API Studio workspace tabs.`,
      category: 'custom',
      stopOnFailure: false,
      steps: importedSteps
    };

    setSuites(prev => [newSuite, ...prev]);
    setActiveSuiteId(newSuite.id);
  };

  // Create new blank suite
  const handleCreateSuite = () => {
    if (!newSuiteName.trim()) return;
    const newSuite: TestSuite = {
      id: `suite-custom-${Date.now()}`,
      name: newSuiteName.trim(),
      description: newSuiteDescription.trim() || 'Custom automated test suite.',
      category: 'custom',
      stopOnFailure: false,
      steps: [
        {
          id: `step-${Date.now()}-1`,
          name: '1. Initial Health Probe',
          method: 'GET',
          url: 'http://localhost:3000/api/health',
          headersList: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
          bodyType: 'none',
          assertions: [
            { id: 'a1', type: 'status', value: '200' },
            { id: 'a2', type: 'latency', value: '300' }
          ],
          extractors: []
        }
      ]
    };

    setSuites(prev => [newSuite, ...prev]);
    setActiveSuiteId(newSuite.id);
    setIsCreatingSuite(false);
    setNewSuiteName('');
    setNewSuiteDescription('');
  };

  // Delete suite
  const handleDeleteSuite = (suiteId: string) => {
    if (suites.length <= 1) return;
    const next = suites.filter(s => s.id !== suiteId);
    setSuites(next);
    if (activeSuiteId === suiteId) {
      setActiveSuiteId(next[0].id);
    }
  };

  // Save edited step
  const handleSaveStep = (updatedStep: TestSuiteStep) => {
    setSuites(prev => prev.map(s => {
      if (s.id !== activeSuite.id) return s;
      const isNew = !s.steps.some(st => st.id === updatedStep.id);
      return {
        ...s,
        steps: isNew ? [...s.steps, updatedStep] : s.steps.map(st => st.id === updatedStep.id ? updatedStep : st)
      };
    }));
    setIsEditingStep(null);
  };

  // Delete step
  const handleDeleteStep = (stepId: string) => {
    if (activeSuite.steps.length <= 1) return;
    setSuites(prev => prev.map(s => {
      if (s.id !== activeSuite.id) return s;
      return {
        ...s,
        steps: s.steps.filter(st => st.id !== stepId)
      };
    }));
    if (selectedStepId === stepId) {
      const remaining = activeSuite.steps.filter(st => st.id !== stepId);
      setSelectedStepId(remaining[0]?.id || null);
    }
  };

  // Method colors
  const getMethodBadgeClass = (m: string) => {
    switch (m) {
      case 'GET': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'PUT': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'DELETE': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'PATCH': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // Pass rate calculation
  const passRate = useMemo(() => {
    if (!suiteRunResult || suiteRunResult.stepResults.length === 0) return 0;
    const evaluated = suiteRunResult.stepResults.filter(r => r.status === 'passed' || r.status === 'failed');
    if (evaluated.length === 0) return 0;
    return Math.round((suiteRunResult.passedSteps / evaluated.length) * 100);
  }, [suiteRunResult]);

  // Export report generator
  const generateReport = () => {
    if (!suiteRunResult) return '';
    return JSON.stringify({
      suiteName: activeSuite.name,
      executedAt: new Date(suiteRunResult.startTime).toISOString(),
      status: suiteRunResult.status,
      durationMs: suiteRunResult.totalDurationMs,
      totalSteps: suiteRunResult.totalSteps,
      passedSteps: suiteRunResult.passedSteps,
      failedSteps: suiteRunResult.failedSteps,
      passRate: `${passRate}%`,
      steps: suiteRunResult.stepResults.map(r => ({
        stepName: r.stepName,
        method: r.method,
        url: r.url,
        status: r.status,
        durationMs: r.durationMs,
        assertions: r.assertions,
        extractedVariables: r.extractedVariables,
        responseStatus: r.response?.status,
        responseLatency: r.response?.responseTime
      }))
    }, null, 2);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0B0D11] text-slate-200 overflow-hidden font-sans select-none">
      {/* 1. TOP HEADER & WORKFLOW CONTROL BAR */}
      <div className="h-14 border-b border-slate-800/80 bg-[#0F1115] px-4 flex items-center justify-between shrink-0 gap-4">
        {/* Left: Suite Selector & Actions */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">SUITE:</span>
          </div>

          <div className="relative flex items-center">
            <select
              value={activeSuiteId}
              onChange={(e) => {
                setActiveSuiteId(e.target.value);
                setSuiteRunResult(null);
              }}
              className="bg-[#141822] text-xs font-mono font-bold text-cyan-300 border border-cyan-800/50 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer appearance-none pr-8 hover:bg-[#191F2C] transition-all shadow-sm"
            >
              {suites.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#141822] text-slate-200">
                  {s.name} ({s.steps.length} steps)
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-cyan-400 pointer-events-none" />
          </div>

          {/* New Suite Button */}
          <button
            type="button"
            onClick={() => setIsCreatingSuite(true)}
            className="p-1.5 rounded-lg bg-[#141822] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 transition-all cursor-pointer text-xs flex items-center gap-1 font-mono"
            title="Create a new automated test suite"
          >
            <Plus size={14} className="text-cyan-400" />
            <span className="hidden md:inline">NEW_SUITE</span>
          </button>

          {/* Import Tabs as Suite */}
          <button
            type="button"
            onClick={handleImportTabsAsSuite}
            className="p-1.5 rounded-lg bg-[#141822] hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-750 transition-all cursor-pointer text-xs flex items-center gap-1 font-mono"
            title="Import all open API Studio tabs as an automated sequential test suite"
          >
            <Sparkles size={14} className="text-emerald-400" />
            <span className="hidden md:inline">IMPORT_TABS</span>
          </button>

          {/* Reset to Standard Defaults */}
          <button
            type="button"
            onClick={() => {
              setSuites(DEFAULT_TEST_SUITES);
              setActiveSuiteId(DEFAULT_TEST_SUITES[0].id);
              setSuiteRunResult(null);
            }}
            className="p-1.5 rounded-lg bg-[#141822] hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-750 transition-all cursor-pointer text-xs flex items-center gap-1 font-mono"
            title="Reset test suites to clean default production suites"
          >
            <RefreshCw size={13} />
            <span className="hidden lg:inline">RESET_DEFAULTS</span>
          </button>
        </div>

        {/* Right: Suite Execution Controls */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={handleAbort}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/30 active:scale-95 transition-all animate-pulse"
            >
              <Square size={13} fill="currentColor" /> STOP SUITE
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunSuite}
              disabled={!activeSuite || activeSuite.steps.length === 0}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={13} fill="currentColor" /> RUN ALL STEPS
            </button>
          )}

          {/* Export Report */}
          {suiteRunResult && (
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141822] hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-750 font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="Export test results report"
            >
              <Download size={13} />
              <span className="hidden sm:inline">REPORT</span>
            </button>
          )}

          {/* Delete Suite (if > 1) */}
          {suites.length > 1 && (
            <button
              type="button"
              onClick={() => handleDeleteSuite(activeSuite.id)}
              className="p-1.5 rounded-lg bg-[#141822] hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-750 hover:border-rose-900/40 transition-all cursor-pointer text-xs"
              title="Delete this test suite"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. SUMMARY METRICS & PROGRESS HUD */}
      <div className="bg-[#0D1016] border-b border-slate-850 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase">STEPS:</span>
            <span className="text-xs font-mono font-bold text-slate-200">{activeSuite.steps.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase">PASSED:</span>
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> {suiteRunResult ? suiteRunResult.passedSteps : 0}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase">FAILED:</span>
            <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1">
              <XCircle size={12} /> {suiteRunResult ? suiteRunResult.failedSteps : 0}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase">PASS RATE:</span>
            <span className={cn(
              "text-xs font-mono font-bold px-2 py-0.5 rounded",
              passRate === 100 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
              passRate > 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
              "bg-slate-800 text-slate-400"
            )}>
              {suiteRunResult ? `${passRate}%` : '---'}
            </span>
          </div>

          {suiteRunResult?.totalDurationMs ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase">DURATION:</span>
              <span className="text-xs font-mono font-bold text-cyan-300">{suiteRunResult.totalDurationMs}ms</span>
            </div>
          ) : null}
        </div>

        {/* Live Progress or Status Indicator */}
        <div className="flex items-center gap-3">
          {isRunning ? (
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <RefreshCw size={13} className="animate-spin text-cyan-400" />
              <span>EXECUTING STEP {(currentStepIndex ?? 0) + 1}/{activeSuite.steps.length}</span>
            </div>
          ) : suiteRunResult?.status === 'completed' ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/40">
              <CheckCircle2 size={13} /> ALL STEPS PASSED
            </div>
          ) : suiteRunResult?.status === 'failed' ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-rose-400 font-bold bg-rose-950/40 px-2.5 py-1 rounded border border-rose-800/40">
              <XCircle size={13} /> {suiteRunResult.failedSteps} STEP(S) FAILED
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. MAIN WORKSPACE (2 PANES: LEFT STEPS LIST + RIGHT DEEP INSPECTOR) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT COLUMN: Steps Sequence List */}
        <div className="w-full md:w-[380px] lg:w-[440px] border-r border-slate-850 bg-[#0B0E14] flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-850 flex items-center justify-between bg-[#0F1218]">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="text-cyan-400" />
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">EXECUTION SEQUENCE</span>
            </div>
            
            <button
              type="button"
              onClick={() => {
                const newStep: TestSuiteStep = {
                  id: `step-${Date.now()}`,
                  name: `${activeSuite.steps.length + 1}. New Test Step`,
                  method: 'GET',
                  url: 'http://localhost:3000/api/health',
                  headersList: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
                  bodyType: 'none',
                  assertions: [{ id: `a-${Date.now()}`, type: 'status', value: '200' }],
                  extractors: []
                };
                handleSaveStep(newStep);
                setIsEditingStep(newStep);
              }}
              className="px-2 py-1 rounded bg-[#161C28] hover:bg-slate-800 text-cyan-400 border border-cyan-800/40 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus size={12} /> ADD_STEP
            </button>
          </div>

          {/* Steps List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {activeSuite.steps.map((step, idx) => {
              const result = suiteRunResult?.stepResults.find(r => r.stepId === step.id);
              const isSelected = selectedStepId === step.id;
              const isCurrentlyExecuting = isRunning && currentStepIndex === idx;

              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={cn(
                    "p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 relative group select-none",
                    isSelected 
                      ? "bg-[#141A26] border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30" 
                      : "bg-[#10131B] hover:bg-[#141822] border-slate-800/70 text-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-slate-500 w-4">{idx + 1}.</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-mono font-black tracking-wider border",
                        getMethodBadgeClass(step.method)
                      )}>
                        {step.method}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-200 truncate">{step.name}</span>
                    </div>

                      {/* Step Result Status Indicator */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrentlyExecuting ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800/60 animate-pulse shadow-xs">
                          <RefreshCw size={10} className="animate-spin" /> RUNNING
                        </span>
                      ) : result?.status === 'passed' ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40 shadow-xs">
                          <CheckCircle2 size={11} className="text-emerald-400" /> {result.durationMs}ms
                        </span>
                      ) : result?.status === 'failed' ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/40 shadow-xs">
                          <XCircle size={11} className="text-rose-400" /> FAIL
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/70 shadow-xs suite-pending-badge">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pl-6 gap-2">
                    <span className="truncate text-slate-400 font-normal">{step.url}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono font-medium text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/30">
                        {step.assertions.length} assertions
                      </span>
                      
                      {/* Action buttons on hover */}
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-all duration-150">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunSingleStep(step);
                          }}
                          className="p-1.5 rounded-md bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white border border-slate-700/60 hover:border-cyan-500 cursor-pointer shadow-xs transition-colors"
                          title="Run only this step"
                          aria-label={`Run step ${step.name}`}
                        >
                          <Play size={11} fill="currentColor" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingStep(step);
                          }}
                          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 cursor-pointer shadow-xs transition-colors"
                          title="Edit step configuration & assertions"
                          aria-label={`Edit step ${step.name}`}
                        >
                          <Edit3 size={11} />
                        </button>
                        {activeSuite.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStep(step.id);
                            }}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700/60 hover:border-rose-500 cursor-pointer shadow-xs transition-colors"
                            title="Delete step"
                            aria-label={`Delete step ${step.name}`}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Deep Step Inspector */}
        <div className="flex-1 flex flex-col bg-[#0E1117] overflow-hidden">
          {selectedStep ? (
            <>
              {/* Step Header */}
              <div className="p-3.5 border-b border-slate-800/80 bg-[#121620] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-mono font-black tracking-wider border",
                    getMethodBadgeClass(selectedStep.method)
                  )}>
                    {selectedStep.method}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-bold text-white flex items-center gap-2 truncate">
                      {selectedStep.name}
                    </div>
                    <div className="text-xs font-mono text-slate-400 truncate">
                      {resolveTemplate(selectedStep.url)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStepCliModal(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#182030] hover:bg-slate-850 text-slate-300 hover:text-emerald-400 border border-slate-750 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                    title="View & copy exact cURL command for this test step"
                  >
                    <Terminal size={12} className="text-emerald-400" />
                    <span>CLI cURL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunSingleStep(selectedStep)}
                    disabled={isRunning}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                  >
                    <Play size={12} fill="currentColor" /> RUN STEP
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingStep(selectedStep)}
                    className="px-3 py-1.5 rounded-lg bg-[#182030] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Edit3 size={12} /> EDIT CONFIG
                  </button>
                </div>
              </div>

              {/* Inspector Navigation Tabs */}
              <div className="flex items-center border-b border-slate-800 bg-[#0E121A] px-3 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setDetailTab('assertions')}
                  className={cn(
                    "px-3 py-2 text-xs font-mono font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all",
                    detailTab === 'assertions' 
                      ? "border-cyan-400 text-cyan-300 bg-cyan-950/20" 
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  <ShieldCheck size={13} />
                  <span>ASSERTIONS ({selectedStep.assertions.length})</span>
                  {selectedStepResult && (
                    <span className={cn(
                      "px-1.5 py-0.2 rounded text-[10px]",
                      selectedStepResult.assertions.every(a => a.passed) 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-rose-500/20 text-rose-400"
                    )}>
                      {selectedStepResult.assertions.filter(a => a.passed).length}/{selectedStepResult.assertions.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDetailTab('response')}
                  className={cn(
                    "px-3 py-2 text-xs font-mono font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all",
                    detailTab === 'response' 
                      ? "border-cyan-400 text-cyan-300 bg-cyan-950/20" 
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  <FileCode size={13} />
                  <span>RESPONSE BODY</span>
                  {selectedStepResult?.response && (
                    <span className={cn(
                      "px-1.5 py-0.2 rounded text-[10px] font-mono",
                      selectedStepResult.response.status >= 200 && selectedStepResult.response.status < 300 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-rose-500/20 text-rose-400"
                    )}>
                      {selectedStepResult.response.status}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDetailTab('request')}
                  className={cn(
                    "px-3 py-2 text-xs font-mono font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all",
                    detailTab === 'request' 
                      ? "border-cyan-400 text-cyan-300 bg-cyan-950/20" 
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Terminal size={13} />
                  <span>REQUEST PAYLOAD</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailTab('headers')}
                  className={cn(
                    "px-3 py-2 text-xs font-mono font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all",
                    detailTab === 'headers' 
                      ? "border-cyan-400 text-cyan-300 bg-cyan-950/20" 
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Sliders size={13} />
                  <span>HEADERS</span>
                </button>

                {selectedStep.extractors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDetailTab('variables')}
                    className={cn(
                      "px-3 py-2 text-xs font-mono font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all",
                      detailTab === 'variables' 
                        ? "border-cyan-400 text-cyan-300 bg-cyan-950/20" 
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Zap size={13} className="text-amber-400" />
                    <span>EXTRACTED VARS ({selectedStep.extractors.length})</span>
                  </button>
                )}
              </div>

              {/* Tab Content Display */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {/* 1. ASSERTIONS TAB */}
                {detailTab === 'assertions' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                        CONTRACT & SLA ASSERTIONS ({selectedStep.assertions.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingStep(selectedStep)}
                        className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add Rule
                      </button>
                    </div>

                    {selectedStep.assertions.length === 0 ? (
                      <div className="p-6 rounded-lg border border-dashed border-slate-800 text-center text-slate-500 font-mono text-xs">
                        No assertions configured for this step. Click 'Add Rule' to assert status codes, response times, or JSON schemas.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedStep.assertions.map((rule, idx) => {
                          const evalRes = selectedStepResult?.assertions.find(a => a.ruleId === rule.id);
                          return (
                            <div 
                              key={rule.id || idx}
                              className={cn(
                                "p-3 rounded-lg border transition-all font-mono flex flex-col gap-2 suite-assertion-card shadow-xs",
                                evalRes?.passed === true ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-200" :
                                evalRes?.passed === false ? "bg-rose-950/20 border-rose-800/40 text-rose-200" :
                                "bg-[#121620] border-slate-800/90 text-slate-200"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  {evalRes?.passed === true ? (
                                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                  ) : evalRes?.passed === false ? (
                                    <XCircle size={16} className="text-rose-400 shrink-0" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border border-slate-500/80 flex items-center justify-center text-slate-400 shrink-0">
                                      <Clock size={11} />
                                    </div>
                                  )}
                                  <span className="text-xs font-bold uppercase tracking-wide suite-assertion-type">
                                    {rule.type.replace('_', ' ')}
                                  </span>
                                  {!evalRes && (
                                    <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 font-semibold suite-pending-badge">
                                      PENDING
                                    </span>
                                  )}
                                </div>

                                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900/80 border border-slate-750 text-slate-300 suite-expected-badge">
                                  EXPECTED: <span className="text-cyan-400 font-bold">{rule.value}</span>
                                </span>
                              </div>

                              <div className="text-xs text-slate-400 pl-6 flex flex-wrap items-center gap-4">
                                {rule.extra && (
                                  <div>
                                    <span className="text-slate-400 font-semibold">TARGET: </span>
                                    <span className="text-slate-300 font-mono">{rule.extra}</span>
                                  </div>
                                )}
                                {evalRes && (
                                  <div>
                                    <span className="text-slate-400 font-semibold">ACTUAL: </span>
                                    <span className={cn("font-bold font-mono", evalRes.passed ? "text-emerald-400" : "text-rose-400")}>
                                      {evalRes.actual}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {evalRes?.error && (
                                <div className="text-[11px] text-rose-400 pl-6 font-mono mt-1">
                                  Error: {evalRes.error}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. RESPONSE BODY TAB */}
                {detailTab === 'response' && (
                  <div className="h-full flex flex-col space-y-3">
                    {selectedStepResult?.response ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                          <div className="flex items-center gap-3">
                            <span>STATUS: <strong className="text-emerald-400">{selectedStepResult.response.status}</strong></span>
                            <span>TIME: <strong className="text-cyan-400">{selectedStepResult.response.responseTime}ms</strong></span>
                            <span>SIZE: <strong className="text-slate-200">{selectedStepResult.response.size}</strong></span>
                          </div>
                        </div>

                        <div className="flex-1 bg-[#090B0E] border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-auto custom-scrollbar">
                          <pre className="whitespace-pre-wrap">{selectedStepResult.response.body || '(Empty Response Body)'}</pre>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 rounded-lg border border-dashed border-slate-800 text-center text-slate-500 font-mono text-xs">
                        No response captured yet. Click 'Run Step' or 'Run All Steps' to execute.
                      </div>
                    )}
                  </div>
                )}

                {/* 3. REQUEST PAYLOAD TAB */}
                {detailTab === 'request' && (
                  <div className="space-y-4 font-mono text-xs">
                    <div>
                      <div className="text-slate-500 uppercase text-[10px] font-bold mb-1">RESOLVED URL</div>
                      <div className="p-2.5 bg-[#090B0E] border border-slate-800 rounded text-cyan-300">
                        {resolveTemplate(selectedStep.url)}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500 uppercase text-[10px] font-bold mb-1">REQUEST BODY ({selectedStep.bodyType || 'none'})</div>
                      <div className="p-2.5 bg-[#090B0E] border border-slate-800 rounded text-slate-300 overflow-auto max-h-[300px] custom-scrollbar">
                        <pre className="whitespace-pre-wrap">
                          {selectedStep.body ? resolveTemplate(selectedStep.body) : '(No request body payload)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. HEADERS TAB */}
                {detailTab === 'headers' && (
                  <div className="space-y-4 font-mono text-xs">
                    <div>
                      <div className="text-slate-500 uppercase text-[10px] font-bold mb-1">CONFIGURED REQUEST HEADERS</div>
                      <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-[#121620] text-slate-400 text-[10px] uppercase">
                            <tr>
                              <th className="p-2">Header Name</th>
                              <th className="p-2">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 bg-[#090B0E]">
                            {selectedStep.headersList.map(h => (
                              <tr key={h.id}>
                                <td className="p-2 text-cyan-400">{h.key}</td>
                                <td className="p-2 text-slate-300">{resolveTemplate(h.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {selectedStepResult?.response?.headers && (
                      <div>
                        <div className="text-slate-500 uppercase text-[10px] font-bold mb-1">RESPONSE HEADERS</div>
                        <div className="border border-slate-800 rounded-lg overflow-hidden max-h-[240px] overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left">
                            <thead className="bg-[#121620] text-slate-400 text-[10px] uppercase">
                              <tr>
                                <th className="p-2">Header</th>
                                <th className="p-2">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-[#090B0E]">
                              {Object.entries(selectedStepResult.response.headers).map(([k, v]) => (
                                <tr key={k}>
                                  <td className="p-2 text-emerald-400">{k}</td>
                                  <td className="p-2 text-slate-300">{String(v)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. EXTRACTED VARIABLES TAB */}
                {detailTab === 'variables' && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="text-slate-400 uppercase text-[10px] font-bold">
                      DYNAMIC CHAINING VARIABLES (Pass to subsequent steps via <code className="text-amber-400">{`{{variableName}}`}</code>)
                    </div>

                    <div className="space-y-2">
                      {selectedStep.extractors.map(ext => {
                        const capturedVal = selectedStepResult?.extractedVariables?.[ext.variableName];
                        return (
                          <div key={ext.id} className="p-3 bg-[#121620] border border-slate-800 rounded-lg flex items-center justify-between">
                            <div>
                              <div className="text-amber-400 font-bold">{`{{${ext.variableName}}}`}</div>
                              <div className="text-[11px] text-slate-500">JSON Path: {ext.jsonPath}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase">Captured Value</div>
                              <div className="text-emerald-400 font-bold">{capturedVal || '(Pending Run)'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500 font-mono text-xs">
              Select or add a test step on the left to inspect its configuration and assertion results.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: STEP EDITOR (ADD / EDIT) */}
      {isEditingStep && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-[#121620] border border-slate-750 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#151B28]">
              <div className="flex items-center gap-2">
                <Edit3 size={16} className="text-cyan-400" />
                <span className="text-sm font-mono font-bold text-white uppercase">CONFIGURE TEST STEP</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingStep(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 font-mono text-xs">
              {/* Step Name */}
              <div>
                <label className="text-slate-400 block mb-1 uppercase font-bold">Step Name</label>
                <input
                  type="text"
                  value={isEditingStep.name}
                  onChange={(e) => setIsEditingStep({ ...isEditingStep, name: e.target.value })}
                  className="w-full bg-[#0A0D13] border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="e.g., 1. Health Probe"
                />
              </div>

              {/* Method + URL */}
              <div className="flex gap-2">
                <div className="w-28 shrink-0">
                  <label className="text-slate-400 block mb-1 uppercase font-bold">Method</label>
                  <select
                    value={isEditingStep.method}
                    onChange={(e) => setIsEditingStep({ ...isEditingStep, method: e.target.value as HttpMethod })}
                    className="w-full bg-[#0A0D13] border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-slate-400 block mb-1 uppercase font-bold">Endpoint URL</label>
                  <input
                    type="text"
                    value={isEditingStep.url}
                    onChange={(e) => setIsEditingStep({ ...isEditingStep, url: e.target.value })}
                    className="w-full bg-[#0A0D13] border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                    placeholder="http://localhost:3000/api/health"
                  />
                </div>
              </div>

              {/* Request Body Payload */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 uppercase font-bold">JSON Payload Body</label>
                  <div className="flex gap-2 text-[10px]">
                    {(['none', 'json', 'raw'] as const).map(bt => (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setIsEditingStep({ ...isEditingStep, bodyType: bt })}
                        className={cn(
                          "px-2 py-0.5 rounded cursor-pointer uppercase",
                          isEditingStep.bodyType === bt ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400"
                        )}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>
                {isEditingStep.bodyType !== 'none' && (
                  <textarea
                    rows={4}
                    value={isEditingStep.body || ''}
                    onChange={(e) => setIsEditingStep({ ...isEditingStep, body: e.target.value })}
                    className="w-full bg-[#0A0D13] border border-slate-800 rounded p-3 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono text-xs"
                    placeholder='{ "key": "value" }'
                  />
                )}
              </div>

              {/* Assertions Editor */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-cyan-400" /> Assertion Rules
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newRule: AssertionRule = {
                        id: `a-${Date.now()}`,
                        type: 'status',
                        value: '200'
                      };
                      setIsEditingStep({
                        ...isEditingStep,
                        assertions: [...isEditingStep.assertions, newRule]
                      });
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={11} /> Add Rule
                  </button>
                </div>

                <div className="space-y-2">
                  {isEditingStep.assertions.map((rule, rIdx) => (
                    <div key={rule.id || rIdx} className="flex items-center gap-2 bg-[#0A0D13] p-2 rounded border border-slate-800">
                      <select
                        value={rule.type}
                        onChange={(e) => {
                          const updated = [...isEditingStep.assertions];
                          updated[rIdx] = { ...rule, type: e.target.value as any };
                          setIsEditingStep({ ...isEditingStep, assertions: updated });
                        }}
                        className="bg-[#121620] text-cyan-300 border border-slate-750 rounded px-2 py-1 text-xs"
                      >
                        <option value="status">Status Code</option>
                        <option value="latency">Max Latency (ms)</option>
                        <option value="json_path">JSON Path</option>
                        <option value="header_matches">Header Contains</option>
                        <option value="body_contains">Body Contains</option>
                      </select>

                      {(rule.type === 'json_path' || rule.type === 'header_matches') && (
                        <input
                          type="text"
                          value={rule.extra || ''}
                          onChange={(e) => {
                            const updated = [...isEditingStep.assertions];
                            updated[rIdx] = { ...rule, extra: e.target.value };
                            setIsEditingStep({ ...isEditingStep, assertions: updated });
                          }}
                          placeholder={rule.type === 'json_path' ? 'e.g., data.id or status' : 'header name'}
                          className="w-32 bg-[#121620] border border-slate-750 rounded px-2 py-1 text-white"
                        />
                      )}

                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => {
                          const updated = [...isEditingStep.assertions];
                          updated[rIdx] = { ...rule, value: e.target.value };
                          setIsEditingStep({ ...isEditingStep, assertions: updated });
                        }}
                        placeholder="Expected value (e.g. 200, ok)"
                        className="flex-1 bg-[#121620] border border-slate-750 rounded px-2 py-1 text-white"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const updated = isEditingStep.assertions.filter((_, i) => i !== rIdx);
                          setIsEditingStep({ ...isEditingStep, assertions: updated });
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Variable Extractors */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400" /> Response Variable Extraction
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newExt: ResponseExtractorRule = {
                        id: `e-${Date.now()}`,
                        jsonPath: 'data.token',
                        variableName: 'token'
                      };
                      setIsEditingStep({
                        ...isEditingStep,
                        extractors: [...isEditingStep.extractors, newExt]
                      });
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[11px] cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={11} /> Add Extractor
                  </button>
                </div>

                <div className="space-y-2">
                  {isEditingStep.extractors.map((ext, eIdx) => (
                    <div key={ext.id || eIdx} className="flex items-center gap-2 bg-[#0A0D13] p-2 rounded border border-slate-800">
                      <span className="text-slate-500 text-[10px]">JSON PATH:</span>
                      <input
                        type="text"
                        value={ext.jsonPath}
                        onChange={(e) => {
                          const updated = [...isEditingStep.extractors];
                          updated[eIdx] = { ...ext, jsonPath: e.target.value };
                          setIsEditingStep({ ...isEditingStep, extractors: updated });
                        }}
                        placeholder="e.g. data.id or token"
                        className="flex-1 bg-[#121620] border border-slate-750 rounded px-2 py-1 text-white"
                      />

                      <span className="text-slate-500 text-[10px]">SAVE AS:</span>
                      <input
                        type="text"
                        value={ext.variableName}
                        onChange={(e) => {
                          const updated = [...isEditingStep.extractors];
                          updated[eIdx] = { ...ext, variableName: e.target.value };
                          setIsEditingStep({ ...isEditingStep, extractors: updated });
                        }}
                        placeholder="varName"
                        className="w-32 bg-[#121620] border border-slate-750 rounded px-2 py-1 text-amber-300 font-bold"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const updated = isEditingStep.extractors.filter((_, i) => i !== eIdx);
                          setIsEditingStep({ ...isEditingStep, extractors: updated });
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-[#151B28]">
              <button
                type="button"
                onClick={() => setIsEditingStep(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveStep(isEditingStep)}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs cursor-pointer shadow-md"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CREATE NEW SUITE */}
      {isCreatingSuite && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#121620] border border-slate-750 rounded-xl shadow-2xl p-5 space-y-4 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Plus size={16} className="text-cyan-400" /> CREATE TEST SUITE
              </span>
              <button type="button" onClick={() => setIsCreatingSuite(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-bold uppercase">Suite Name</label>
              <input
                type="text"
                value={newSuiteName}
                onChange={(e) => setNewSuiteName(e.target.value)}
                placeholder="e.g., Payments Microservice Regression"
                className="w-full bg-[#0A0D13] border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                autoFocus
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-bold uppercase">Description</label>
              <textarea
                rows={3}
                value={newSuiteDescription}
                onChange={(e) => setNewSuiteDescription(e.target.value)}
                placeholder="Description of the test workflow and SLA objectives..."
                className="w-full bg-[#0A0D13] border border-slate-800 rounded p-3 text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingSuite(false)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSuite}
                disabled={!newSuiteName.trim()}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                Create Suite
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: EXPORT TEST REPORT */}
      {isReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-[#121620] border border-slate-750 rounded-xl shadow-2xl p-5 space-y-4 font-mono text-xs flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <span className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Download size={16} className="text-cyan-400" /> TEST EXECUTION REPORT
              </span>
              <button type="button" onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="flex-1 bg-[#090B0E] border border-slate-800 rounded-lg p-3 overflow-auto custom-scrollbar text-slate-300">
              <pre className="whitespace-pre-wrap">{generateReport()}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-slate-500">JSON formatted report ready for CI/CD audit logs.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateReport());
                    setCopiedReport(true);
                    setTimeout(() => setCopiedReport(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedReport ? <Check size={13} /> : <Copy size={13} />}
                  {copiedReport ? 'COPIED' : 'COPY REPORT'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([generateReport()], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `test-report-${activeSuite.id}-${Date.now()}.json`;
                    a.click();
                  }}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  Download JSON
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* CLI Command Modal for Test Suite Step */}
      {selectedStep && (
        <CliCommandModal
          isOpen={showStepCliModal}
          onClose={() => setShowStepCliModal(false)}
          commandType="curl"
          title={`cURL Inspector: ${selectedStep.name}`}
          singleLineCommand={(() => {
            const resolvedUrl = resolveTemplate(selectedStep.url);
            const headers = selectedStep.headers || {};
            const headerFlags = Object.entries(headers)
              .map(([k, v]) => `-H "${k}: ${resolveTemplate(String(v))}"`)
              .join(' ');
            const resolvedBody = selectedStep.body ? resolveTemplate(selectedStep.body) : '';
            const bodyFlag = resolvedBody ? `-d '${resolvedBody.replace(/'/g, "'\\''")}'` : '';
            return `curl -i -X ${selectedStep.method} "${resolvedUrl}" ${headerFlags} ${bodyFlag}`.replace(/\s+/g, ' ').trim();
          })()}
          multilineCommand={(() => {
            const resolvedUrl = resolveTemplate(selectedStep.url);
            const headers = selectedStep.headers || {};
            const headerFlags = Object.entries(headers)
              .map(([k, v]) => `-H "${k}: ${resolveTemplate(String(v))}"`)
              .join(' \\\n  ');
            const resolvedBody = selectedStep.body ? resolveTemplate(selectedStep.body) : '';
            const bodyFlag = resolvedBody ? `-d '${resolvedBody.replace(/'/g, "'\\''")}'` : '';
            return `curl -i -X ${selectedStep.method} "${resolvedUrl}"${headerFlags ? ` \\\n  ${headerFlags}` : ''}${bodyFlag ? ` \\\n  ${bodyFlag}` : ''}`;
          })()}
          method={selectedStep.method}
          url={resolveTemplate(selectedStep.url)}
          headers={selectedStep.headers}
          body={selectedStep.body ? resolveTemplate(selectedStep.body) : undefined}
        />
      )}
    </div>
  );
}
