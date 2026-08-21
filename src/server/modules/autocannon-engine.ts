import autocannon, { Options, Result } from 'autocannon';
import { SystemMetrics, RequestSystemMetrics, SystemHardwareSpecs } from './system-metrics';

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

    const startTime = Date.now();
    const startCpu = process.cpuUsage();
    const startMem = process.memoryUsage();
    const durationSeconds = Math.max(1, Math.min(120, config.duration || 10));
    const connections = Math.max(1, Math.min(1000, config.connections || 10));
    const pipelining = Math.max(1, Math.min(32, config.pipelining || 1));
    const method = (config.method || 'GET').toUpperCase() as any;

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
