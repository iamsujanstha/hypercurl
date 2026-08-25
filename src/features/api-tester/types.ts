import { RequestConfig, CurlResult } from '@/server/modules/curl-engine';
import { ProgressUpdate } from '@/server/modules/runner';
import { AutocannonBenchmarkResult, AutocannonTickProgress } from '@/server/modules/autocannon-engine';
import { SystemHardwareSpecs, RequestSystemMetrics } from '@/server/modules/system-metrics';

export type { AutocannonBenchmarkResult, AutocannonTickProgress, SystemHardwareSpecs, RequestSystemMetrics };

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'GRAPHQL'] as const;

export type HttpMethod = typeof METHODS[number];

export type AppView = 'studio' | 'suites' | 'variables' | 'history' | 'debugger' | 'lab' | 'autocannon';

export type TestExecutionMode = 
  | 'functional'
  | 'load'
  | 'race'
  | 'security'
  | 'chaos'
  | 'fuzz'
  | 'distributed';

export interface AssertionRule {
  id: string;
  type: 'status' | 'latency' | 'body_contains' | 'json_path' | 'header_matches' | 'graphql_no_errors';
  value: string;
  extra?: string;
}

export interface AssertionResult {
  ruleId: string;
  type: string;
  passed: boolean;
  actual: string;
  expected: string;
  error?: string;
}

export interface ResponseExtractorRule {
  id: string;
  jsonPath: string;
  variableName: string;
}

export interface AuthConfig {
  type: 'none' | 'oauth2_client' | 'oauth2_pkce' | 'mtls' | 'aws_v4';
  oauth2Client?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scope?: string;
  };
  oauth2Pkce?: {
    clientId: string;
    authUrl: string;
    codeVerifier: string;
    codeChallenge: string;
    challengeMethod: 'S256' | 'plain';
  };
  mtls?: {
    clientCert: string;
    privateKey: string;
  };
  awsV4?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    service: string;
  };
}

export interface SavedRequest extends RequestConfig {
  id: string;
  name: string;
  graphqlQuery?: string;
  graphqlVariables?: string;
  headersList: { id: string, key: string, value: string }[];
  assertions?: AssertionRule[];
  extractors?: ResponseExtractorRule[];
  authConfig?: AuthConfig;
}

export interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
}

export interface Tab {
  id: string;
  name: string;
  config: RequestConfig;
  graphqlQuery?: string;
  graphqlVariables?: string;
  headersList: { id: string, key: string, value: string }[];
  result: CurlResult | null;
  results: CurlResult[];
  batchResults: CurlResult[];
  batchMode: boolean;
  batchIterations?: number;
  batchConcurrency?: number;
  showCurl: boolean;
  loading: boolean;
  progress: null | ProgressUpdate;
  assertions?: AssertionRule[];
  extractors?: ResponseExtractorRule[];
  authConfig?: AuthConfig;
  labResults?: Record<string, CurlResult[]>;
  autocannonResult?: AutocannonBenchmarkResult | null;
  autocannonProgress?: AutocannonTickProgress['progress'] | null;
  testMode?: TestExecutionMode;
  testConfig?: {
    connections?: number;
    duration?: number;
    pipelining?: number;
    rateLimit?: number;
    iterations?: number;
    concurrency?: number;
    retries?: number;
    jitter?: boolean;
    chaosAmplitude?: number;
    fuzzChecks?: { keyDeletions: boolean; typeMutations: boolean; bufferOverflow: boolean };
    securityChecks?: { sqli: boolean; xss: boolean; pathTraversal: boolean; headersAuditor: boolean };
    regions?: string[];
    rotateIps?: boolean;
  };
}

export interface Telemetry {
  status: 'ONLINE' | 'STANDBY';
  engine: string;
  clientCount: number;
  latency: string;
  systemSpecs?: SystemHardwareSpecs;
}

export interface DialogState {
  isOpen: boolean;
  type: 'ALERT' | 'CONFIRM' | 'PROMPT_TEXT' | 'SAVE_REQUEST';
  title: string;
  message: string;
  defaultValue?: string;
  inputVal?: string;
  selectedColId?: string;
  onConfirm: (val1?: string, val2?: string) => void;
}

// Real-World Automated Test Suite Types
export interface TestSuiteStep {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headersList: { id: string; key: string; value: string; enabled?: boolean }[];
  bodyType?: 'none' | 'json' | 'raw';
  body?: string;
  assertions: AssertionRule[];
  extractors: ResponseExtractorRule[];
  timeoutMs?: number;
  delayBeforeMs?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: 'smoke' | 'auth' | 'crud' | 'regression' | 'sla' | 'e2e' | 'custom';
  steps: TestSuiteStep[];
  stopOnFailure?: boolean;
}

export interface TestStepResult {
  stepId: string;
  stepName: string;
  method: string;
  url: string;
  resolvedHeaders: Record<string, string>;
  resolvedBody?: string;
  response?: CurlResult;
  status: 'passed' | 'failed' | 'running' | 'pending' | 'skipped' | 'error';
  durationMs: number;
  assertions: AssertionResult[];
  extractedVariables?: Record<string, string>;
  error?: string;
}

export interface TestSuiteRunResult {
  suiteId: string;
  suiteName: string;
  startTime: number;
  endTime?: number;
  totalDurationMs: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  stepResults: TestStepResult[];
  status: 'idle' | 'running' | 'completed' | 'aborted' | 'failed';
}


