import { RequestConfig, CurlResult } from '@/server/modules/curl-engine';
import { ProgressUpdate } from '@/server/modules/runner';
import { AutocannonBenchmarkResult, AutocannonTickProgress } from '@/server/modules/autocannon-engine';
import { SystemHardwareSpecs, RequestSystemMetrics } from '@/server/modules/system-metrics';

export type { AutocannonBenchmarkResult, AutocannonTickProgress, SystemHardwareSpecs, RequestSystemMetrics };

// ==========================================
// 1. SLA & BENCHMARK TYPES
// ==========================================
export interface AutocannonSlaThresholds {
  maxErrorRatePercent?: number; // e.g. 1.0 (%)
  maxP99LatencyMs?: number; // e.g. 500 (ms)
  maxP95LatencyMs?: number; // e.g. 300 (ms)
  minThroughputRps?: number; // e.g. 100 (req/s)
  maxNon2xxRatePercent?: number; // e.g. 0.0 (%)
}

export interface AutocannonSlaCheck {
  id: string;
  name: string;
  target: string;
  actual: string;
  passed: boolean;
}

export interface AutocannonSlaReport {
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  checks: AutocannonSlaCheck[];
}

export type LoadTestMode = 
  | 'baseline'
  | 'load'
  | 'stress'
  | 'spike'
  | 'soak'
  | 'capacity';

export interface BenchmarkSnapshot {
  id: string;
  name: string;
  timestamp: number;
  url: string;
  method: string;
  connections: number;
  duration: number;
  pipelining: number;
  result: AutocannonBenchmarkResult;
  environmentName?: string;
}

export interface BenchmarkComparisonDelta {
  metric: string;
  runAValue: string | number;
  runBValue: string | number;
  diff: string;
  percentChange: number;
  isRegression: boolean;
  status: 'improved' | 'regressed' | 'neutral';
}

// ==========================================
// 2. HTTP & REQUEST DOMAIN TYPES
// ==========================================
export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'GRAPHQL'] as const;
export type HttpMethod = typeof METHODS[number];

export type AppView = 'studio' | 'suites' | 'variables' | 'history' | 'debugger' | 'lab' | 'autocannon' | 'reports';

export type TestExecutionMode = 
  | 'functional'
  | 'load'
  | 'race'
  | 'security'
  | 'chaos'
  | 'fuzz'
  | 'distributed';

export type BodyType = 'none' | 'json' | 'form' | 'xml' | 'raw' | 'graphql' | 'binary';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled?: boolean;
  description?: string;
  isSecret?: boolean;
}

// ==========================================
// 3. AUTHENTICATION TYPES
// ==========================================
export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'apikey' | 'custom' | 'oauth2_client' | 'oauth2_pkce' | 'mtls' | 'aws_v4';
  bearerToken?: string;
  basicAuth?: {
    username: string;
    password: string;
  };
  apiKey?: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
  };
  customHeaders?: KeyValuePair[];
  oauth2Client?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scope?: string;
  };
  oauth2Pkce?: {
    clientId: string;
    authUrl: string;
    codeVerifier?: string;
    codeChallenge?: string;
    challengeMethod?: 'S256' | 'plain';
  };
  mtls?: {
    clientCert: string;
    privateKey: string;
    caCert?: string;
  };
  awsV4?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    service: string;
  };
}

// ==========================================
// 4. ASSERTION & SCHEMA VALIDATION TYPES
// ==========================================
export type AssertionType = 
  | 'status'
  | 'status_range'
  | 'latency'
  | 'response_size'
  | 'header_matches'
  | 'body_contains'
  | 'body_not_contains'
  | 'json_path'
  | 'json_schema'
  | 'type_check'
  | 'regex_matches'
  | 'graphql_no_errors';

export interface AssertionRule {
  id: string;
  type: AssertionType;
  value: string;
  extra?: string; // Header name, JSONPath, or Schema JSON string
  description?: string;
}

export interface AssertionResult {
  ruleId: string;
  type: string;
  passed: boolean;
  actual: string;
  expected: string;
  error?: string;
  path?: string;
}

export interface SchemaValidationDiagnostic {
  path: string;
  message: string;
  expected: string;
  actual: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationDiagnostic[];
}

// ==========================================
// 5. SECURITY AUDIT TYPES
// ==========================================
export interface SecurityAuditCheck {
  id: string;
  title: string;
  category: 'headers' | 'transport' | 'leak' | 'disclosure';
  severity: 'high' | 'medium' | 'low' | 'info';
  passed: boolean;
  actual: string;
  recommendation: string;
}

export interface SecurityAuditReport {
  score: number; // 0 - 100
  passedChecks: number;
  totalChecks: number;
  checks: SecurityAuditCheck[];
}

// ==========================================
// 6. VARIABLE EXTRACTION & CHAINING
// ==========================================
export interface ResponseExtractorRule {
  id: string;
  jsonPath?: string; // e.g. 'token' or '$.data.user.id'
  variableName: string; // e.g. 'AUTH_TOKEN'
  source?: 'json_path' | 'header' | 'status_code' | 'regex';
  expression?: string; // e.g. '$.data.token'
  defaultValue?: string;
}

// ==========================================
// 7. ENVIRONMENT MANAGEMENT
// ==========================================
export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isSecret?: boolean;
  enabled?: boolean;
  description?: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  baseUrl?: string;
}

// ==========================================
// 8. REQUEST & COLLECTION STORE
// ==========================================
export interface SavedRequest extends RequestConfig {
  id: string;
  name: string;
  description?: string;
  bodyType?: BodyType;
  queryParams?: KeyValuePair[];
  formData?: KeyValuePair[];
  graphqlQuery?: string;
  graphqlVariables?: string;
  headersList: KeyValuePair[];
  assertions?: AssertionRule[];
  assertionResults?: AssertionResult[];
  extractors?: ResponseExtractorRule[];
  authConfig?: AuthConfig;
  tags?: string[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  requests: SavedRequest[];
}

// ==========================================
// 9. CLIENT WORKSPACE TAB
// ==========================================
export interface Tab {
  id: string;
  name: string;
  config: RequestConfig;
  bodyType?: BodyType;
  queryParams?: KeyValuePair[];
  formData?: KeyValuePair[];
  graphqlQuery?: string;
  graphqlVariables?: string;
  headersList: KeyValuePair[];
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
  assertionResults?: AssertionResult[];
  extractors?: ResponseExtractorRule[];
  authConfig?: AuthConfig;
  securityReport?: SecurityAuditReport | null;
  labResults?: Record<string, CurlResult[]>;
  autocannonResult?: AutocannonBenchmarkResult | null;
  autocannonProgress?: AutocannonTickProgress['progress'] | null;
  slaThresholds?: AutocannonSlaThresholds;
  warmupDuration?: number;
  testMode?: TestExecutionMode;
  testConfig?: {
    connections?: number;
    duration?: number;
    pipelining?: number;
    rateLimit?: number;
    isRateLimited?: boolean;
    timeout?: number;
    warmupDuration?: number;
    enableSla?: boolean;
    slaThresholds?: AutocannonSlaThresholds;
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

// ==========================================
// 10. AUTOMATED TEST SUITE & WORKFLOW RUNNER
// ==========================================
export type SuiteTag = 'smoke' | 'regression' | 'critical' | 'auth' | 'crud' | 'sla' | 'negative' | 'e2e';

export interface TestSuiteStep {
  id: string;
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  queryParams?: KeyValuePair[];
  headersList: KeyValuePair[];
  bodyType?: BodyType;
  body?: string;
  formData?: KeyValuePair[];
  authConfig?: AuthConfig;
  assertions: AssertionRule[];
  extractors: ResponseExtractorRule[];
  timeoutMs?: number;
  delayBeforeMs?: number;
  tags?: string[];
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: 'smoke' | 'auth' | 'crud' | 'regression' | 'sla' | 'e2e' | 'negative' | 'custom';
  tags?: string[];
  steps: TestSuiteStep[];
  stopOnFailure?: boolean;
  dataDrivenFile?: string; // Optional CSV/JSON dataset for parameterized tests
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
  securityReport?: SecurityAuditReport;
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
  environmentName?: string;
  dataIterationIndex?: number;
}

// ==========================================
// 11. DRY RUN / VALIDATION TYPES
// ==========================================
export interface PreFlightCheckIssue {
  field: string;
  type: 'error' | 'warning';
  message: string;
}

export interface PreFlightCheckResult {
  valid: boolean;
  issues: PreFlightCheckIssue[];
  resolvedUrl: string;
  resolvedHeaders: Record<string, string>;
  resolvedBody?: string;
  generatedCurl: string;
}
