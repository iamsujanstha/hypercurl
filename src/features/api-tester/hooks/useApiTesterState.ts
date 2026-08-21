import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { RequestConfig, CurlResult } from '@/server/modules/curl-engine';
import { ProgressUpdate } from '@/server/modules/runner';
import { Tab, Collection, SavedRequest, Telemetry, DialogState, AssertionRule, AppView } from '@/features/api-tester/types';
import { evaluateAssertions } from '@/features/api-tester/assertionEvaluator';

export function useApiTesterState(initialVariables: Record<string, string> = {}) {
  // Persistence Keys
  const TABS_KEY = 'curl_commander_tabs';
  const ACTIVE_TAB_KEY = 'curl_commander_active_tab';
  const COLLECTIONS_KEY = 'curl_commander_collections';
  const SIDEBAR_KEY = 'curl_commander_sidebar_collapsed';

  // State
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem(TABS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(t => ({
            ...t,
            results: Array.isArray(t.results) ? t.results : (t.result ? [t.result] : []),
            batchResults: Array.isArray(t.batchResults) ? t.batchResults : [],
            labResults: t.labResults || {},
            batchMode: !!t.batchMode,
            showCurl: !!t.showCurl,
            loading: false,
            progress: null,
            headersList: Array.isArray(t.headersList) ? t.headersList : [{ id: '1', key: 'Content-Type', value: 'application/json' }],
            assertions: t.assertions || [{ id: 'def-status', type: 'status', value: '200' }],
            extractors: t.extractors || [],
            authConfig: t.authConfig || { type: 'none' }
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load tabs from localStorage', e);
    }
    
    const initialId = uuidv4();
    return [{
      id: initialId,
      name: 'NEW_REQUEST',
      config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: {}, body: '' },
      headersList: [{ id: '1', key: 'Content-Type', value: 'application/json' }],
      result: null,
      results: [],
      batchResults: [],
      batchMode: false,
      batchIterations: 10,
      batchConcurrency: 5,
      showCurl: false,
      loading: false,
      progress: null,
      assertions: [{ id: 'def-status', type: 'status', value: '200' }],
      extractors: [],
      authConfig: { type: 'none' }
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    if (saved && tabs.some(t => t.id === saved)) return saved;
    return tabs[0]?.id || '';
  });

  const [collections, setCollections] = useState<Collection[]>(() => {
    try {
      const saved = localStorage.getItem(COLLECTIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load collections from localStorage', e);
    }
    return [{ id: 'default', name: 'MY_COLLECTION', requests: [] }];
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  });

  const [isWorkerPoolOpen, setIsWorkerPoolOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('curl_commander_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('curl_commander_theme', theme);
    } catch (_) {}
  }, [theme]);

  // Custom terminal-styled modal state
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: 'ALERT',
    title: '',
    message: '',
    defaultValue: '',
    inputVal: '',
    selectedColId: '',
    onConfirm: () => {}
  });

  const showCustomAlert = (title: string, message: string, onConfirm?: () => void) => {
    setDialog({
      isOpen: true,
      type: 'ALERT',
      title,
      message,
      defaultValue: '',
      inputVal: '',
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      }
    });
  };

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialog({
      isOpen: true,
      type: 'CONFIRM',
      title,
      message,
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  const showCustomPrompt = (title: string, message: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setDialog({
      isOpen: true,
      type: 'PROMPT_TEXT',
      title,
      message,
      defaultValue,
      inputVal: defaultValue,
      onConfirm: (val) => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (val) onConfirm(val);
      }
    });
  };

  const showSaveRequestDialog = (defaultRequestName: string, onConfirm: (reqName: string, colId: string) => void) => {
    setDialog({
      isOpen: true,
      type: 'SAVE_REQUEST',
      title: 'SAVE REQUEST TO COLLECTION',
      message: 'Choose a descriptive identifier for your request and select a target collection.',
      defaultValue: defaultRequestName,
      inputVal: defaultRequestName,
      selectedColId: collections[0]?.id || 'default',
      onConfirm: (reqName, colId) => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (reqName && colId) onConfirm(reqName, colId);
      }
    });
  };

  const [telemetry, setTelemetry] = useState<Telemetry>(() => {
    return {
      redisStatus: 'CONNECTED',
      redisLatency: 2,
      activeWorkers: 0,
      maxWorkers: 64,
      latency: '10ms',
      redisType: 'IN_MEMORY_CACHE',
      clientCount: 1,
      spawnedWorkers: []
    };
  });

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [view, setView] = useState<AppView>('studio');

  const [splitPercent, setSplitPercent] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const [graphqlQueryHeight, setGraphqlQueryHeight] = useState<number>(260);
  const [graphqlVariablesHeight, setGraphqlVariablesHeight] = useState<number>(185);
  const [payloadJsonHeight, setPayloadJsonHeight] = useState<number>(192);

  const startResizeQuery = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = graphqlQueryHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setGraphqlQueryHeight(Math.max(100, Math.min(800, startHeight + deltaY)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startResizeVariables = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = graphqlVariablesHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setGraphqlVariablesHeight(Math.max(80, Math.min(600, startHeight + deltaY)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startResizePayloadJson = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = payloadJsonHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setPayloadJsonHeight(Math.max(100, Math.min(800, startHeight + deltaY)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (!isDraggingSplit) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newPercent = (e.clientX / window.innerWidth) * 100;
      if (newPercent >= 20 && newPercent <= 80) {
        setSplitPercent(newPercent);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit]);

  const [variables, setVariables] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('curl_commander_variables');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'BASE_URL': 'http://localhost:3000',
      'TOKEN': 'sk_test_5123456789',
      ...initialVariables
    };
  });

  useEffect(() => {
    localStorage.setItem('curl_commander_variables', JSON.stringify(variables));
  }, [variables]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);
  
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const subscriptionWsRef = useRef<WebSocket | null>(null);

  // Track activeTabId in ref to avoid re-initializing WS on every tab transition
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Sync Persistence
  useEffect(() => localStorage.setItem(TABS_KEY, JSON.stringify(tabs)), [tabs]);
  useEffect(() => localStorage.setItem(ACTIVE_TAB_KEY, activeTabId), [activeTabId]);
  useEffect(() => localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections)), [collections]);
  useEffect(() => localStorage.setItem(SIDEBAR_KEY, String(isSidebarCollapsed)), [isSidebarCollapsed]);

  // WebSocket Initialization
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              const lastResult = data.lastResult;
              if (lastResult) {
                lastResult.assertions = evaluateAssertions(lastResult, t.assertions || []);
              }
              const moduleKey = data.uiModule || data.testModule || 'blast';
              const currentLabResults = t.labResults?.[moduleKey] || [];
              const existingIds = new Set(currentLabResults.map((r: any) => r.id));
              
              let nextLabResultsForModule = currentLabResults;
              if (lastResult && !existingIds.has(lastResult.id)) {
                nextLabResultsForModule = [...currentLabResults, lastResult];
              }

              const nextLabResults = {
                ...(t.labResults || {}),
                [moduleKey]: nextLabResultsForModule
              };
              return {
                ...t,
                progress: { ...data, startTime: data.startTime || Date.now() },
                batchResults: nextLabResultsForModule,
                labResults: nextLabResults
              };
            }
            return t;
          }));
        } else if (data.type === 'complete') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              const moduleKey = data.uiModule || data.testModule || 'blast';
              const currentLabResults = t.labResults?.[moduleKey] || [];
              const existingIds = new Set(currentLabResults.map((r: any) => r.id));

              const newResults = (data.results || []).filter((r: any) => !existingIds.has(r.id));
              const evaluatedNew = newResults.map((r: any) => ({
                ...r,
                assertions: evaluateAssertions(r, t.assertions || [])
              }));

              const nextLabResultsForModule = [...currentLabResults, ...evaluatedNew];
              const nextLabResults = {
                ...(t.labResults || {}),
                [moduleKey]: nextLabResultsForModule
              };
              return { 
                ...t, 
                batchResults: nextLabResultsForModule,
                labResults: nextLabResults,
                progress: null, 
                loading: false 
              };
            }
            return t;
          }));
        } else if (data.type === 'error') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                loading: false,
                progress: null
              };
            }
            return t;
          }));
          showCustomAlert('TEST SUITE ERROR', data.error || 'Test suite execution encountered an issue.');
        } else if (data.type === 'telemetry') {
          setTelemetry(data.payload);
        } else if (data.type === 'autocannon-progress') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                loading: true,
                autocannonProgress: data.progress
              };
            }
            return t;
          }));
        } else if (data.type === 'autocannon-complete') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                loading: false,
                autocannonProgress: null,
                autocannonResult: data.result
              };
            }
            return t;
          }));
        } else if (data.type === 'autocannon-error') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                loading: false,
                autocannonProgress: null
              };
            }
            return t;
          }));
          showCustomAlert('AUTOCANNON ERROR', data.error || 'Benchmark execution failed.');
        } else if (data.type === 'autocannon-aborted') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                loading: false,
                autocannonProgress: null
              };
            }
            return t;
          }));
        } else if (data.type === 'telemetry_real_math_done') {
          setDialog({
            isOpen: true,
            type: 'ALERT',
            title: "⚡ REAL CPU THREAD SUCCESS",
            message: `Node.js background OS thread [${data.payload.workerName}] completed a real CPU-bound stress-test (15,000,000 Leibniz iterations) in the background!\n\n` +
                     `• Computed Pi: ${data.payload.result}\n` +
                     `• Thread active CPU duration: ${data.payload.elapsed} ms\n\n` +
                     `Because this ran on a native node:worker_threads Worker, the main Express event loop remained completely idle and responsive!`,
            defaultValue: '',
            inputVal: '',
            onConfirm: () => {
              setDialog(prev => ({ ...prev, isOpen: false }));
            }
          });
        }
      } catch (e) {
        console.error('WS Message parsing error:', e);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  const updateActiveTab = useCallback((updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  }, [activeTabId]);

  const updateActiveConfig = useCallback((updates: Partial<RequestConfig>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { 
      ...t, 
      config: { ...t.config, ...updates } 
    } : t));
  }, [activeTabId]);

  const resolveVars = useCallback((text: string) => {
    if (!text) return '';
    let resolved = text;
    Object.entries(variables).forEach(([key, value]) => {
      const target = key.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      resolved = resolved.replace(new RegExp(`\\{\\{${target}\\}\\}`, 'g'), value as string);
    });
    return resolved;
  }, [variables]);

  const getResolvedConfig = useCallback((tab: Tab): RequestConfig => {
    let body = resolveVars(tab.config.body || '');
    
    if (tab.config.method === 'GRAPHQL') {
      let queryStr = (tab.graphqlQuery || '').trim();
      let vars = {};
      let rawVars = resolveVars(tab.graphqlVariables || '').trim();

      // Smart rescue fallback for GraphQL requests that have empty query fields:
      if (!queryStr || !rawVars) {
        const bodyStr = (tab.config.body || '').trim();
        if (bodyStr) {
          try {
            const parsed = JSON.parse(bodyStr);
            if (parsed && typeof parsed === 'object') {
              if (!queryStr && parsed.query) {
                queryStr = parsed.query;
              }
              if (!rawVars && parsed.variables && typeof parsed.variables === 'object') {
                vars = parsed.variables;
              }
            } else if (!queryStr) {
              queryStr = bodyStr;
            }
          } catch {
            if (!queryStr) {
              queryStr = bodyStr;
            }
          }
        }
      }

      if (rawVars) {
        if (/^\s*(query|mutation|subscription|fragment)\b/i.test(rawVars)) {
          console.warn('Detected GraphQL query/syntax in variables field. Ignoring invalid variables JSON.');
        } else {
          try {
            vars = { ...vars, ...JSON.parse(rawVars) };
          } catch (e: any) {
            console.warn('Invalid GraphQL variables JSON:', e?.message || e);
          }
        }
      }
      
      body = JSON.stringify({
        query: resolveVars(queryStr),
        variables: vars
      });
    }

    const finalHeaders = tab.headersList.reduce((acc, h) => {
      const resolvedKey = resolveVars(h.key).trim();
      const resolvedValue = resolveVars(h.value).trim();
      if (resolvedKey) acc[resolvedKey] = resolvedValue;
      return acc;
    }, {} as Record<string, string>);

    // Apply custom enterprise authorization headers automatically
    if (tab.authConfig && tab.authConfig.type !== 'none') {
      const auth = tab.authConfig;
      if (auth.type === 'oauth2_client' || auth.type === 'oauth2_pkce') {
        const token = variables['ACCESS_TOKEN'] || variables['OAUTH_ACCESS_TOKEN'] || '';
        if (token) {
          finalHeaders['Authorization'] = `Bearer ${token}`;
        }
      } else if (auth.type === 'aws_v4' && auth.awsV4) {
        const aws = auth.awsV4;
        const amzDate = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
        finalHeaders['X-Amz-Date'] = amzDate;
        finalHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${aws.accessKeyId || 'AKIAIOSFODNN7EXAMPLE'}/20260605/${aws.region || 'us-east-1'}/${aws.service || 'execute-api'}/aws4_request, SignedHeaders=host;x-amz-date, Signature=MockAmzV4SignatureHashCalculatedForEnterpriseQA`;
      } else if (auth.type === 'mtls' && auth.mtls) {
        finalHeaders['X-mTLS-Client-Cert-Thumbprint'] = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';
      }
    }

    return {
      ...tab.config,
      url: resolveVars(tab.config.url),
      headers: finalHeaders,
      body
    };
  }, [resolveVars, variables]);

  const runCollection = (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col || col.requests.length === 0) return;
    
    const newId = uuidv4();
    const newTab: Tab = {
      id: newId,
      name: `BATCH: ${col.name}`,
      config: col.requests[0],
      headersList: col.requests[0].headersList,
      result: null,
      results: [],
      batchResults: [],
      batchMode: true,
      showCurl: false,
      loading: true,
      progress: null
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);

    const resolvedRequests = col.requests.map(req => {
      const dummyTab: Tab = {
        ...newTab,
        config: req,
        headersList: req.headersList,
        graphqlQuery: req.graphqlQuery,
        graphqlVariables: req.graphqlVariables
      };
      return getResolvedConfig(dummyTab);
    });

    if (ws) {
      ws.send(JSON.stringify({
        type: 'run-batch',
        tabId: newId,
        payload: {
          requests: resolvedRequests,
          iterations: resolvedRequests.length,
          concurrency: 1 // Sequential run context
        }
      }));
    }
  };

  const duplicateCollection = (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    setCollections(prev => [...prev, { ...col, id: uuidv4(), name: `${col.name}_COPY` }]);
  };

  const handleAbort = useCallback(() => {
    if (subscriptionWsRef.current) {
      subscriptionWsRef.current.close();
      subscriptionWsRef.current = null;
    }
    if (activeTab?.batchMode) {
      ws?.send(JSON.stringify({ type: 'abort-batch', tabId: activeTabId }));
    } else {
      abortController?.abort();
    }
    updateActiveTab({ loading: false });
  }, [activeTab, ws, abortController, activeTabId, updateActiveTab]);

  const handleRun = async () => {
    if (!activeTab || activeTab.loading) return;
    const resolvedConfig = getResolvedConfig(activeTab);

    // Dynamic GQL WebSocket/SSE Subscriptions execution stream handler
    if (activeTab.config.method === 'GRAPHQL' && /^\s*subscription\b/i.test(activeTab.graphqlQuery || '')) {
      let wsUrl = activeTab.config.url || '';
      if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
      else if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
      else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
        wsUrl = 'ws://' + wsUrl;
      }
      
      updateActiveTab({ loading: true, results: [] });
      showCustomAlert('CONNECTING SUBSCRIPTION', `Opening WebSocket subscription stream to broker:\n${wsUrl}`);
      
      try {
        const subWs = new WebSocket(wsUrl, ['graphql-ws', 'graphql-transport-ws']);
        subscriptionWsRef.current = subWs;
        
        subWs.onopen = () => {
          showCustomAlert('SUBSCRIPTION COMMITTED', 'WS Handshake complete. Multiplexing subscription stream frames.');
          subWs.send(JSON.stringify({ type: 'connection_init', payload: {} }));
          
          setTimeout(() => {
            if (subWs.readyState === WebSocket.OPEN) {
              const query = resolveVars(activeTab.graphqlQuery || '');
              const variablesPayload = activeTab.graphqlVariables ? JSON.parse(resolveVars(activeTab.graphqlVariables)) : {};
              
              // Frame for standard graphql-ws (subscriptions-transport-ws)
              subWs.send(JSON.stringify({
                id: 'sub-stream-node',
                type: 'start',
                payload: { query, variables: variablesPayload }
              }));
              
              // Frame for modern graphql-transport-ws (graphql-ws)
              subWs.send(JSON.stringify({
                id: 'sub-stream-node',
                type: 'subscribe',
                payload: { query, variables: variablesPayload }
              }));
            }
          }, 350);
        };
        
        subWs.onmessage = (event) => {
          try {
            const rawData = JSON.parse(event.data);
            if (rawData.type === 'ka' || rawData.type === 'ping') return;
            
            const messageResult = {
              id: uuidv4(),
              status: 200,
              headers: { 'Content-Type': 'application/json', 'X-Stream-Source': 'GraphQL-Subscriptions' },
              body: JSON.stringify(rawData.payload || rawData.data || rawData, null, 2),
              responseTime: 0,
              rawOutput: event.data,
              config: resolvedConfig
            };

            const currentResults = activeTabRef.current ? (activeTabRef.current.results || []) : [];
            updateActiveTab({
              result: messageResult,
              results: [...currentResults, messageResult]
            });
          } catch (err) {
            console.error('Error in subscription frames stream decoder:', err);
          }
        };
        
        subWs.onerror = () => {
          const errorResult = {
            id: uuidv4(),
            status: 502,
            headers: {},
            body: '',
            responseTime: 0,
            rawOutput: 'WebSocket Handshake Failed',
            error: 'Subscription broker disconnected or lacks CORS tunnel support.',
            config: resolvedConfig
          };
          const currentResults = activeTabRef.current ? (activeTabRef.current.results || []) : [];
          updateActiveTab({ 
            result: errorResult,
            results: [...currentResults, errorResult],
            loading: false
          });
        };
        
        subWs.onclose = () => {
          updateActiveTab({ loading: false });
        };
        
      } catch (e: any) {
        showCustomAlert('WS STREAM ERROR', e?.message || 'WebSocket configuration contains malformed endpoint strings.');
        updateActiveTab({ loading: false });
      }
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);

    const mode = activeTab.testMode || 'functional';

    if (mode === 'load') {
      handleStartAutocannon({
        url: resolvedConfig.url,
        method: resolvedConfig.method,
        headers: resolvedConfig.headers,
        body: resolvedConfig.body,
        connections: activeTab.testConfig?.connections || 50,
        duration: activeTab.testConfig?.duration || 10,
        pipelining: activeTab.testConfig?.pipelining || 1,
        rate: activeTab.testConfig?.rateLimit,
        title: `${activeTab.name} Load Test`
      });
      return;
    }

    if (mode === 'race') {
      handleStartLabTest('race', {
        concurrency: activeTab.testConfig?.concurrency || 20,
        iterations: activeTab.testConfig?.iterations || 20
      });
      return;
    }

    if (mode === 'security') {
      handleStartLabTest('security_audit', {
        securityChecks: activeTab.testConfig?.securityChecks || { sqli: true, xss: true, pathTraversal: true, headersAuditor: true }
      });
      return;
    }

    if (mode === 'chaos') {
      handleStartLabTest('chaos', {
        jitter: true,
        chaosAmplitude: activeTab.testConfig?.chaosAmplitude || 60,
        retries: activeTab.testConfig?.retries || 2
      });
      return;
    }

    if (mode === 'fuzz') {
      handleStartLabTest('fuzzer', {
        iterations: activeTab.testConfig?.iterations || 15,
        fuzzChecks: activeTab.testConfig?.fuzzChecks || { keyDeletions: true, typeMutations: true, bufferOverflow: false }
      });
      return;
    }

    if (mode === 'distributed') {
      handleStartLabTest('distributed', {
        regions: activeTab.testConfig?.regions || ['us', 'eu', 'apac', 'latam'],
        rotateIps: true
      });
      return;
    }

    if (activeTab.batchMode) {
      if (!ws) return;
      updateActiveTab({ loading: true, batchResults: [] });
      ws.send(JSON.stringify({
        type: 'run-batch',
        tabId: activeTabId,
        payload: {
          request: resolvedConfig,
          iterations: activeTab.batchIterations || 10,
          concurrency: activeTab.batchConcurrency || 5
        }
      }));
    } else {
      updateActiveTab({ loading: true });
      try {
        const response = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resolvedConfig),
          signal: controller.signal
        });

        if (!response.ok) {
          const text = await response.text();
          let errorMsg = `Server error: ${response.status}`;
          try {
            const errJson = JSON.parse(text);
            errorMsg = errJson.error || errorMsg;
          } catch {
            if (text.trim().length > 0) {
              if (text.length < 100) errorMsg = text;
            } else {
              errorMsg = `Server returned status code ${response.status} (${response.statusText || 'Bad Request'}) with an empty response body.`;
            }
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        
        // --- SECURE SEQUENTIAL VALUE EXTRACTION ENGINE ---
        if (data && data.body && activeTab.extractors && activeTab.extractors.length > 0) {
          try {
            const parsedBody = JSON.parse(data.body);
            const nextVariables = { ...variables };
            let extractedCount = 0;
            const logLines: string[] = [];

            activeTab.extractors.forEach(ext => {
              if (!ext.jsonPath || !ext.variableName) return;
              const parts = ext.jsonPath.split('.');
              let val: any = parsedBody;
              for (const part of parts) {
                if (val && typeof val === 'object' && part in val) {
                  val = val[part];
                } else {
                  val = undefined;
                  break;
                }
              }

              if (val !== undefined) {
                const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
                nextVariables[ext.variableName] = valStr;
                extractedCount++;
                logLines.push(`{{${ext.variableName}}} = ${valStr.substring(0, 40)}${valStr.length > 40 ? '...' : ''}`);
              }
            });

            if (extractedCount > 0) {
              setVariables(nextVariables);
              showCustomAlert(
                "⚡ SEQUENTIAL EXTRACTION", 
                `Successfully mapped ${extractedCount} response values into global runtime variables:\n\n` + 
                logLines.map(line => `• ${line}`).join('\n')
              );
            }
          } catch(e) {
            console.warn('Programmatic variable extract matching bypassed or response body lacks valid JSON:', e);
          }
        }

        const dataWithConfig = { ...data, config: resolvedConfig };
        const evaluated = evaluateAssertions(dataWithConfig, activeTab.assertions || []);
        dataWithConfig.assertions = evaluated;
        const currentResults = Array.isArray(activeTab.results) ? activeTab.results : [];
        updateActiveTab({ 
          result: dataWithConfig,
          results: [...currentResults, dataWithConfig]
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          const errorResult = {
            id: uuidv4(),
            status: 0,
            headers: {},
            body: '',
            responseTime: 0,
            rawOutput: err.message,
            error: err.message,
            curlCommand: 'N/A',
            config: resolvedConfig
          };
          const evaluated = evaluateAssertions(errorResult, activeTab.assertions || []);
          (errorResult as any).assertions = evaluated;
          const currentResults = Array.isArray(activeTab.results) ? activeTab.results : [];
          updateActiveTab({ 
            result: errorResult,
            results: [...currentResults, errorResult]
          });
        }
      } finally {
        updateActiveTab({ loading: false });
      }
    }
  };

  const createTab = (savedReq?: SavedRequest) => {
    const newId = uuidv4();
    const newTab: Tab = {
      id: newId,
      name: savedReq?.name || 'NEW_REQUEST',
      config: savedReq ? { method: savedReq.method, url: savedReq.url, headers: savedReq.headers, body: savedReq.body } : { method: 'GET', url: '', headers: {}, body: '' },
      graphqlQuery: savedReq?.graphqlQuery || '',
      graphqlVariables: savedReq?.graphqlVariables || '',
      headersList: savedReq?.headersList || [{ id: '1', key: 'Content-Type', value: 'application/json' }],
      result: null,
      results: [],
      batchResults: [],
      batchMode: false,
      batchIterations: 10,
      batchConcurrency: 5,
      showCurl: false,
      loading: false,
      progress: null,
      assertions: savedReq?.assertions || [{ id: 'def-status', type: 'status', value: '200' }],
      extractors: savedReq?.extractors || [],
      authConfig: savedReq?.authConfig || { type: 'none' }
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
  };

  const addCollection = () => {
    showCustomPrompt('CREATE COLLECTION', 'Enter a name for the new collection:', 'NEW_COLLECTION', (name) => {
      setCollections(prev => [...prev, { id: uuidv4(), name: name.toUpperCase(), requests: [] }]);
    });
  };

  const deleteRequest = (colId: string, reqId: string) => {
    setCollections(prev => prev.map(c => 
      c.id === colId ? { ...c, requests: c.requests.filter(r => r.id !== reqId) } : c
    ));
  };

  const deleteCollection = (id: string) => {
    if (id === 'default') {
      showCustomAlert('ACTION DENIED', 'The Root Collection is system-reserved and cannot be deleted.');
      return;
    }
    showCustomConfirm(
      'DELETE COLLECTION',
      'Warning: This action will permanently delete this collection and all of its compiled requests. Are you sure you want to proceed?',
      () => {
        setCollections(prev => prev.filter(c => c.id !== id));
      }
    );
  };

  const saveToCollection = () => {
    if (!activeTab) return;
    showSaveRequestDialog(activeTab.name, (name, colId) => {
      const targetCol = collections.find(c => c.id === colId) || collections[0];
      if (!targetCol) return;

      const savedReq: SavedRequest = {
        id: uuidv4(),
        name,
        ...activeTab.config,
        graphqlQuery: activeTab.graphqlQuery,
        graphqlVariables: activeTab.graphqlVariables,
        headersList: [...activeTab.headersList]
      };

      setCollections(prev => prev.map(c => c.id === targetCol.id ? { ...c, requests: [...c.requests, savedReq] } : c));
      updateActiveTab({ name });
    });
  };

  const handleStartLabTest = (moduleId: string, settings: any) => {
    if (!ws || !activeTab) return;
    if (moduleId === 'autocannon' || moduleId === 'load') {
      const resolved = getResolvedConfig(activeTab);
      handleStartAutocannon({
        url: resolved.url,
        method: resolved.method,
        headers: resolved.headers,
        body: resolved.body,
        connections: settings.connections || settings.concurrency || 50,
        duration: settings.duration || (settings.iterations ? Math.min(60, Math.max(5, settings.iterations)) : 10),
        pipelining: settings.pipelining || 1,
        rate: settings.rate,
        timeout: settings.timeout || 10,
        title: `TestLab Autocannon Load Benchmark`
      });
      return;
    }
    const nextLabResults = {
      ...(activeTab.labResults || {}),
      [moduleId]: []
    };
    updateActiveTab({ 
      loading: true,
      batchResults: [],
      labResults: nextLabResults
    });
    ws.send(JSON.stringify({
      type: 'run-batch',
      tabId: activeTabId,
      payload: {
        request: getResolvedConfig(activeTab),
        testModule: settings.backendModuleId || moduleId,
        uiModule: moduleId,
        iterations: settings.iterations,
        concurrency: settings.concurrency,
        retries: settings.retries,
        jitter: moduleId === 'chaos',
        fuzzing: moduleId === 'fuzzer',
        regions: settings.regions,
        rotateIps: settings.rotateIps
      }
    }));
  };

  const handleStartAutocannon = (config: any) => {
    if (!ws || !activeTab) return;
    updateActiveTab({
      loading: true,
      autocannonProgress: {
        elapsedSeconds: 0,
        durationSeconds: config.duration || 10,
        percent: 0,
        currentRps: 0,
        currentLatency: 0,
        currentBytesPerSec: 0,
        totalRequests: 0,
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
        errors: 0,
        timeouts: 0
      }
    });
    ws.send(JSON.stringify({
      type: 'run-autocannon',
      tabId: activeTabId,
      payload: config
    }));
  };

  const handleAbortAutocannon = () => {
    if (!ws || !activeTab) return;
    ws.send(JSON.stringify({
      type: 'abort-autocannon',
      tabId: activeTabId
    }));
    updateActiveTab({
      loading: false,
      autocannonProgress: null
    });
  };

  const addAssertion = (rule: AssertionRule) => {
    updateActiveTab({
      assertions: [...(activeTab.assertions || []), rule]
    });
  };

  const removeAssertion = (id: string) => {
    updateActiveTab({
      assertions: (activeTab.assertions || []).filter(r => r.id !== id)
    });
  };

  const updateAssertion = (id: string, updates: Partial<AssertionRule>) => {
    updateActiveTab({
      assertions: (activeTab.assertions || []).map(r => r.id === id ? { ...r, ...updates } : r)
    });
  };

  return {
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
      isDraggingSplit,
      graphqlQueryHeight,
      graphqlVariablesHeight,
      payloadJsonHeight,
      variables,
      activeTab
    },
    actions: {
      setTabs,
      setActiveTabId,
      setCollections,
      setIsSidebarCollapsed,
      setIsWorkerPoolOpen,
      setTheme,
      setDialog,
      showCustomAlert,
      showCustomConfirm,
      showCustomPrompt,
      setView,
      setSplitPercent,
      setIsDraggingSplit,
      startResizeQuery,
      startResizeVariables,
      startResizePayloadJson,
      setVariables,
      getResolvedConfig,
      updateActiveTab,
      updateActiveConfig,
      runCollection,
      duplicateCollection,
      handleAbort,
      handleRun,
      createTab,
      closeTab,
      addCollection,
      deleteRequest,
      deleteCollection,
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
  };
}
