import autocannon, { Options, Result } from 'autocannon';
import { SystemMetrics, RequestSystemMetrics, SystemHardwareSpecs } from './system-metrics';
import { SecurityGuard } from './security';

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

export interface AutocannonConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  connections: number;
  duration: number; // in seconds
  pipelining?: number;
  amount?: number;
  rate?: number; // requests per second cap
  timeout?: number; // in seconds
  warmupDuration?: number; // in seconds (stepped socket ramp-up)
  slaThresholds?: AutocannonSlaThresholds;
  title?: string;
}

export interface AutocannonTickProgress {
  type: 'autocannon-progress';
  tabId: string;
  progress: {
    elapsedSeconds: number;
    durationSeconds: number;
    percent: number;
    currentRps: number;
    currentLatency: number;
    currentBytesPerSec: number;
    totalRequests: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    errors: number;
    timeouts: number;
  };
}

export interface AutocannonBenchmarkResult {
  title?: string;
  url: string;
  method: string;
  connections: number;
  duration: number;
  pipelining: number;
  rate?: number;
  totalRequests: number;
  totalBytes: number;
  durationSeconds: number;
  systemMetrics?: RequestSystemMetrics;
  systemSpecs?: SystemHardwareSpecs;
  requests: {
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
    total: number;
    p50: number;
    p90: number;
    p99: number;
    p99_9: number;
  };
  latency: {
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p97_5: number;
    p99: number;
    p99_9: number;
    p99_99: number;
  };
  throughput: {
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
    total: number;
  };
  statusCodes: {
    '1xx': number;
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
    non2xx: number;
  };
  errors: number;
  timeouts: number;
  mismatches: number;
  resets: number;
  timeline: {
    second: number;
    rps: number;
    latency: number;
    bytes: number;
  }[];
  percentiles: {
    percentile: string;
    value: number;
  }[];
  slaReport?: AutocannonSlaReport;
  formattedCliOutput: string;
  cliCommand: string;
  startTime: number;
  finishTime: number;
}

export class AutocannonEngine {
  private static activeInstances = new Map<string, any>();

  static stop(key: string) {
    const instance = this.activeInstances.get(key);
    if (instance) {
      try {
        instance.stop();
      } catch (err) {
        console.error('Error stopping autocannon instance:', err);
      }
      this.activeInstances.delete(key);
    }
  }

  static async run(
    key: string,
    config: AutocannonConfig,
    onProgress?: (progress: AutocannonTickProgress['progress']) => void,
    signal?: AbortSignal
  ): Promise<AutocannonBenchmarkResult> {
    // Clean up any existing instance with this key
    this.stop(key);

    // SSRF & Target Security Validation
    const secCheck = SecurityGuard.validateTargetUrl(config.url);
    if (!secCheck.allowed) {
      throw new Error(`Security Blocked (SSRF Prevention): ${secCheck.reason}`);
    }

    const { sanitized } = SecurityGuard.sanitizeAutocannonConfig(config);

    const startTime = Date.now();
    const startCpu = process.cpuUsage();
    const startMem = process.memoryUsage();
    const durationSeconds = Math.max(1, Math.min(120, sanitized.duration || 10));
    const connections = Math.max(1, Math.min(1000, sanitized.connections || 10));
    const pipelining = Math.max(1, Math.min(32, sanitized.pipelining || 1));
    const method = (sanitized.method || 'GET').toUpperCase() as any;

    const opts: Options = {
      url: config.url,
      method: method === 'GRAPHQL' ? 'POST' : method,
      connections,
      duration: durationSeconds,
      pipelining,
      headers: config.headers || {},
      body: config.body || undefined,
      timeout: config.timeout || 10,
    };

    if (config.amount && config.amount > 0) {
      opts.amount = config.amount;
    }
    if (config.rate && config.rate > 0) {
      opts.overallRate = config.rate;
    }
    if (config.warmupDuration && config.warmupDuration > 0) {
      (opts as any).warmup = {
        duration: Math.min(30, config.warmupDuration)
      };
    }

    const timeline: { second: number; rps: number; latency: number; bytes: number }[] = [];
    let elapsedSeconds = 0;
    let status2xx = 0;
    let status3xx = 0;
    let status4xx = 0;
    let status5xx = 0;
    let totalReqs = 0;
    let errorCount = 0;
    let timeoutCount = 0;

    return new Promise((resolve, reject) => {
      let isDone = false;

      const instance = autocannon(opts, (err: any, result: Result) => {
        isDone = true;
        AutocannonEngine.activeInstances.delete(key);

        if (err) {
          return reject(err);
        }

        const finishTime = Date.now();
        const durationSec = result.duration || durationSeconds;

        // Construct latency percentiles array
        const latencyPercentiles = [
          { percentile: 'p50', value: result.latency.p50 || 0 },
          { percentile: 'p75', value: result.latency.p75 || 0 },
          { percentile: 'p90', value: result.latency.p90 || 0 },
          { percentile: 'p95', value: (result.latency as any).p95 || (result.latency.p90 + result.latency.p97_5) / 2 || 0 },
          { percentile: 'p97.5', value: result.latency.p97_5 || 0 },
          { percentile: 'p99', value: result.latency.p99 || 0 },
          { percentile: 'p99.9', value: result.latency.p99_9 || 0 },
          { percentile: 'p99.99', value: result.latency.p99_99 || 0 },
        ];

        // Format CLI equivalent string
        const headerFlags = Object.entries(config.headers || {})
          .map(([k, v]) => `-H "${k}: ${v}"`)
          .join(' ');
        const bodyFlag = config.body ? `-b '${config.body}'` : '';
        const cliCommand = `autocannon -c ${connections} -d ${durationSeconds} -p ${pipelining} -m ${method === 'GRAPHQL' ? 'POST' : method} ${headerFlags} ${bodyFlag} "${config.url}"`;

        // Format ASCII table output like autocannon CLI
        const formattedCliOutput = `
┌─────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Stat    │ 2.5%   │ 50%    │ 97.5%  │ 99%    │ Avg       │ Stdev    │ Max    │
├─────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Latency │ ${(result.latency.p2_5 || 0).toFixed(1)} ms │ ${(result.latency.p50 || 0).toFixed(1)} ms │ ${(result.latency.p97_5 || 0).toFixed(1)} ms │ ${(result.latency.p99 || 0).toFixed(1)} ms │ ${(result.latency.average || 0).toFixed(1)} ms │ ${(result.latency.stddev || 0).toFixed(1)} ms │ ${(result.latency.max || 0).toFixed(1)} ms │
└─────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘
┌───────────┬────────┬────────┬────────┬────────┬───────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%  │ Avg       │ Stdev    │ Min    │
├───────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Req/Sec   │ ${(result.requests.p1 || 0).toFixed(0)}    │ ${(result.requests.p2_5 || 0).toFixed(0)}    │ ${(result.requests.p50 || 0).toFixed(0)}    │ ${(result.requests.p97_5 || 0).toFixed(0)}    │ ${(result.requests.average || 0).toFixed(0)}     │ ${(result.requests.stddev || 0).toFixed(0)}     │ ${(result.requests.min || 0).toFixed(0)}    │
├───────────┼────────┼────────┼────────┼────────┼───────────┼──────────┼────────┤
│ Bytes/Sec │ ${((result.throughput.p1 || 0)/1024).toFixed(0)} kB │ ${((result.throughput.p2_5 || 0)/1024).toFixed(0)} kB │ ${((result.throughput.p50 || 0)/1024).toFixed(0)} kB │ ${((result.throughput.p97_5 || 0)/1024).toFixed(0)} kB │ ${((result.throughput.average || 0)/1024).toFixed(0)} kB  │ ${((result.throughput.stddev || 0)/1024).toFixed(0)} kB  │ ${((result.throughput.min || 0)/1024).toFixed(0)} kB │
└───────────┴────────┴────────┴────────┴────────┴───────────┴──────────┴────────┘

Req/Bytes counts: ${result.requests.total} requests, ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB read
2xx responses: ${result['2xx'] || 0}, non-2xx responses: ${result.non2xx || 0}
Errors: ${result.errors || 0}, Timeouts: ${result.timeouts || 0}, Resets: ${result.resets || 0}
Running ${durationSeconds}s test @ ${config.url}
${connections} connections with ${pipelining} pipelining factor
`.trim();

        const elapsedTotalMs = finishTime - startTime;
        const systemMetrics = SystemMetrics.createRequestSnapshot(startCpu, startMem, elapsedTotalMs);
        const systemSpecs = SystemMetrics.getSpecs();

        // Evaluate SLA Thresholds
        let slaReport: AutocannonSlaReport | undefined;
        if (config.slaThresholds) {
          const thresholds = config.slaThresholds;
          const totalRequests = result.requests.total || 0;
          const checks: AutocannonSlaCheck[] = [];

          if (thresholds.maxErrorRatePercent !== undefined) {
            const actualErrorRate = totalRequests > 0 ? ((result.errors || 0) / totalRequests) * 100 : 0;
            const passed = actualErrorRate <= thresholds.maxErrorRatePercent;
            checks.push({
              id: 'sla-error-rate',
              name: 'Max Error Rate',
              target: `≤ ${thresholds.maxErrorRatePercent.toFixed(1)}%`,
              actual: `${actualErrorRate.toFixed(2)}%`,
              passed
            });
          }

          if (thresholds.maxP99LatencyMs !== undefined) {
            const p99Val = result.latency.p99 || 0;
            const passed = p99Val <= thresholds.maxP99LatencyMs;
            checks.push({
              id: 'sla-p99-latency',
              name: 'Max p99 Latency SLA',
              target: `≤ ${thresholds.maxP99LatencyMs} ms`,
              actual: `${p99Val.toFixed(1)} ms`,
              passed
            });
          }

          if (thresholds.maxP95LatencyMs !== undefined) {
            const p95Val = (result.latency as any).p95 || (result.latency.p90 + result.latency.p97_5) / 2 || 0;
            const passed = p95Val <= thresholds.maxP95LatencyMs;
            checks.push({
              id: 'sla-p95-latency',
              name: 'Max p95 Latency SLA',
              target: `≤ ${thresholds.maxP95LatencyMs} ms`,
              actual: `${p95Val.toFixed(1)} ms`,
              passed
            });
          }

          if (thresholds.minThroughputRps !== undefined) {
            const actualRps = result.requests.average || 0;
            const passed = actualRps >= thresholds.minThroughputRps;
            checks.push({
              id: 'sla-min-throughput',
              name: 'Min Throughput RPS',
              target: `≥ ${thresholds.minThroughputRps} req/s`,
              actual: `${Math.round(actualRps).toLocaleString()} req/s`,
              passed
            });
          }

          if (thresholds.maxNon2xxRatePercent !== undefined) {
            const non2xx = result.non2xx || 0;
            const actualNon2xxRate = totalRequests > 0 ? (non2xx / totalRequests) * 100 : 0;
            const passed = actualNon2xxRate <= thresholds.maxNon2xxRatePercent;
            checks.push({
              id: 'sla-non-2xx-rate',
              name: 'Max Non-2xx Responses',
              target: `≤ ${thresholds.maxNon2xxRatePercent.toFixed(1)}%`,
              actual: `${actualNon2xxRate.toFixed(2)}%`,
              passed
            });
          }

          const passedCount = checks.filter(c => c.passed).length;
          slaReport = {
            passed: checks.length > 0 && passedCount === checks.length,
            totalChecks: checks.length,
            passedChecks: passedCount,
            checks
          };
        }

        const benchmarkResult: AutocannonBenchmarkResult = {
          title: config.title || 'Autocannon Load Test',
          url: config.url,
          method,
          connections,
          duration: durationSeconds,
          pipelining,
          rate: config.rate,
          totalRequests: result.requests.total || 0,
          totalBytes: result.throughput.total || 0,
          durationSeconds: durationSec,
          systemMetrics,
          systemSpecs,
          slaReport,
          requests: {
            average: result.requests.average || 0,
            mean: result.requests.mean || 0,
            stddev: result.requests.stddev || 0,
            min: result.requests.min || 0,
            max: result.requests.max || 0,
            total: result.requests.total || 0,
            p50: result.requests.p50 || 0,
            p90: result.requests.p90 || 0,
            p99: result.requests.p99 || 0,
            p99_9: result.requests.p99_9 || 0,
          },
          latency: {
            average: result.latency.average || 0,
            mean: result.latency.mean || 0,
            stddev: result.latency.stddev || 0,
            min: result.latency.min || 0,
            max: result.latency.max || 0,
            p50: result.latency.p50 || 0,
            p75: result.latency.p75 || 0,
            p90: result.latency.p90 || 0,
            p95: (result.latency as any).p95 || (result.latency.p90 + result.latency.p97_5) / 2 || 0,
            p97_5: result.latency.p97_5 || 0,
            p99: result.latency.p99 || 0,
            p99_9: result.latency.p99_9 || 0,
            p99_99: result.latency.p99_99 || 0,
          },
          throughput: {
            average: result.throughput.average || 0,
            mean: result.throughput.mean || 0,
            stddev: result.throughput.stddev || 0,
            min: result.throughput.min || 0,
            max: result.throughput.max || 0,
            total: result.throughput.total || 0,
          },
          statusCodes: {
            '1xx': result['1xx'] || 0,
            '2xx': result['2xx'] || 0,
            '3xx': result['3xx'] || 0,
            '4xx': result['4xx'] || 0,
            '5xx': result['5xx'] || 0,
            non2xx: result.non2xx || 0,
          },
          errors: result.errors || 0,
          timeouts: result.timeouts || 0,
          mismatches: result.mismatches || 0,
          resets: result.resets || 0,
          timeline,
          percentiles: latencyPercentiles,
          formattedCliOutput,
          cliCommand,
          startTime,
          finishTime,
        };

        resolve(benchmarkResult);
      });

      AutocannonEngine.activeInstances.set(key, instance);

      if (signal) {
        signal.addEventListener('abort', () => {
          if (!isDone) {
            try {
              instance.stop();
            } catch {}
          }
        });
      }

      instance.on('tick', () => {
        elapsedSeconds++;
        // autocannon exposes internal tick data
        const inst = instance as any;
        const currentRps = inst.requests?.average || 0;
        const currentLatency = inst.latency?.average || 0;
        const currentBytesPerSec = inst.throughput?.average || 0;
        totalReqs = inst.requests?.total || totalReqs;
        status2xx = inst['2xx'] || status2xx;
        errorCount = inst.errors || errorCount;
        timeoutCount = inst.timeouts || timeoutCount;

        timeline.push({
          second: elapsedSeconds,
          rps: currentRps,
          latency: currentLatency,
          bytes: currentBytesPerSec,
        });

        if (onProgress) {
          onProgress({
            elapsedSeconds,
            durationSeconds,
            percent: Math.min(100, Math.round((elapsedSeconds / durationSeconds) * 100)),
            currentRps,
            currentLatency,
            currentBytesPerSec,
            totalRequests: totalReqs,
            status2xx,
            status3xx,
            status4xx,
            status5xx,
            errors: errorCount,
            timeouts: timeoutCount,
          });
        }
      });

      (instance as any).on('response', (client: any, statusCode: number) => {
        totalReqs++;
        if (statusCode >= 200 && statusCode < 300) status2xx++;
        else if (statusCode >= 300 && statusCode < 400) status3xx++;
        else if (statusCode >= 400 && statusCode < 500) status4xx++;
        else if (statusCode >= 500) status5xx++;
      });

      (instance as any).on('reqError', () => {
        errorCount++;
      });

      (instance as any).on('timeout', () => {
        timeoutCount++;
      });
    });
  }
}
