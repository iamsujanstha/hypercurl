import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { Readable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';
import { SystemMetrics, RequestSystemMetrics } from './system-metrics';
import { SecurityGuard } from './security';

export interface RequestConfig {
  id?: string;
  name?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'GRAPHQL';
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyFile?: string; // Path to local file on server
  bodyFileName?: string;
  bodyFileSize?: number;
  timeout?: number;
}

export interface CurlTimingBreakdown {
  dns: number;       // DNS resolution (ms)
  tcp: number;       // TCP connect (ms)
  tls: number;       // TLS/SSL handshake (ms)
  ttfb: number;      // Time to first byte (ms)
  transfer: number;  // Content download (ms)
  total: number;     // Total duration (ms)
}

export interface CurlResult {
  id: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  responseTime: number;
  rawOutput: string;
  error?: string;
  curlCommand: string;
  requestSize?: number;
  simulatedIp?: string;
  simulatedCountry?: string;
  simulatedFlag?: string;
  simulatedRegion?: string;
  iterationIndex?: number;
  config?: RequestConfig;
  systemMetrics?: RequestSystemMetrics;
  timing?: CurlTimingBreakdown;
}

export class CurlEngine {
  static buildCommand(config: RequestConfig): string[] {
    const isGraphql = config.method === 'GRAPHQL';
    const method = isGraphql ? 'POST' : config.method;
    const args = ['-i', '-s', '-L', '-X', method];

    // Default Headers (if not overridden)
    const defaults: Record<string, string> = {
      'User-Agent': 'curl/7.68.0',
      'Accept': 'application/json, text/plain, */*',
      ...(isGraphql ? { 'Content-Type': 'application/json' } : {}),
    };

    const finalHeaders: Record<string, string> = {};
    Object.entries(defaults).forEach(([k, v]) => {
      finalHeaders[k] = v;
    });

    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        if (!key) return;
        const matchKey = Object.keys(finalHeaders).find(
          k => k.toLowerCase() === key.toLowerCase()
        );
        if (matchKey) {
          finalHeaders[matchKey] = value;
        } else {
          finalHeaders[key] = value;
        }
      });
    }

    // Auto-detect JSON body if Content-Type is missing
    const contentTypeKey = Object.keys(finalHeaders).find(
      k => k.toLowerCase() === 'content-type'
    );
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method) && !contentTypeKey) {
      try {
        JSON.parse(config.body);
        finalHeaders['Content-Type'] = 'application/json';
      } catch (e) {
        // Not JSON, skip
      }
    }

    // Add Headers
    Object.entries(finalHeaders).forEach(([key, value]) => {
      if (key && value !== undefined) {
        args.push('-H', `${key}: ${value}`);
      }
    });

    // Body
    if (config.bodyFile) {
      args.push('--data-binary', `@${config.bodyFile}`);
    } else if (config.body && (['POST', 'PUT', 'PATCH'].includes(config.method) || config.method === 'GRAPHQL')) {
      args.push('-d', config.body);
    }

    // URL
    args.push(config.url);

    return args;
  }

  static async execute(config: RequestConfig, signal?: AbortSignal): Promise<CurlResult> {
    const id = config.id || uuidv4();
    const args = this.buildCommand(config);
    
    // Better command preview formatting
    const curlCommand = `curl ${args.map(arg => {
      if (arg.includes(' ') || arg.includes('"') || arg.includes('$') || arg.includes("'")) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }).join(' ')}`;
    
    const startTime = Date.now();
    const startCpu = process.cpuUsage();
    const startMem = process.memoryUsage();
    const requestSize = config.bodyFile ? 0 : (config.body ? (typeof Buffer !== 'undefined' ? Buffer.byteLength(config.body, 'utf8') : config.body.length) : 0);

    // SSRF & Target Security Validation
    const secCheck = SecurityGuard.validateTargetUrl(config.url);
    if (!secCheck.allowed) {
      const responseTime = 1;
      return {
        id,
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'Security Blocked (SSRF Prevention)',
          reason: secCheck.reason,
          targetUrl: config.url
        }, null, 2),
        responseTime,
        rawOutput: `HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n{"error": "Security Blocked", "reason": "${secCheck.reason}"}`,
        error: secCheck.reason,
        curlCommand,
        requestSize,
        systemMetrics: SystemMetrics.createRequestSnapshot(startCpu, startMem, responseTime),
        timing: { dns: 0, tcp: 0, tls: 0, ttfb: 0, transfer: 0, total: 1 }
      };
    }

    if (signal?.aborted) {
      return {
        id, status: 0, headers: {}, body: '', responseTime: 0,
        rawOutput: 'Aborted', error: 'Aborted', curlCommand, requestSize,
        systemMetrics: SystemMetrics.createRequestSnapshot(startCpu, startMem, 0)
      };
    }

    try {
      const isGraphql = config.method === 'GRAPHQL';
      const method = isGraphql ? 'POST' : config.method;

      // Prepare request headers
      const defaults: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        ...(isGraphql ? { 'Content-Type': 'application/json' } : {}),
      };

      const finalHeaders: Record<string, string> = {};
      Object.entries(defaults).forEach(([k, v]) => {
        finalHeaders[k] = v;
      });

      if (config.headers) {
        Object.entries(config.headers).forEach(([key, value]) => {
          if (!key) return;
          const matchKey = Object.keys(finalHeaders).find(
            k => k.toLowerCase() === key.toLowerCase()
          );
          if (matchKey) {
            finalHeaders[matchKey] = value;
          } else {
            finalHeaders[key] = value;
          }
        });
      }

      // Auto-detect JSON body if Content-Type is missing
      const contentTypeKey = Object.keys(finalHeaders).find(
        k => k.toLowerCase() === 'content-type'
      );
      if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method) && !contentTypeKey) {
        try {
          JSON.parse(config.body);
          finalHeaders['Content-Type'] = 'application/json';
        } catch (e) {
          // Not JSON, skip
        }
      }

      // Allow self-signed/staging certs commonly used in API testing
      if (typeof process !== 'undefined' && process.env) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }

      const fetchOptions: any = {
        method,
        headers: finalHeaders,
        redirect: 'follow',
      };

      if (signal) {
        fetchOptions.signal = signal;
      }

      if (config.bodyFile) {
        if (typeof fs !== 'undefined' && fs.createReadStream) {
          try {
             fetchOptions.body = Readable.toWeb(fs.createReadStream(config.bodyFile));
             // Node.js 18+ fetch requires duplex: 'half' when using a stream
             (fetchOptions as any).duplex = 'half';
          } catch(e) {
             fetchOptions.body = fs.createReadStream(config.bodyFile) as any;
          }
        } else {
          // If no fs (e.g., client-side edge case), this will fail or skip
        }
      } else if (config.body && (['POST', 'PUT', 'PATCH'].includes(config.method) || isGraphql)) {
        fetchOptions.body = config.body;
      }

      const t0 = Date.now();
      const res = await fetch(config.url, fetchOptions);
      const t1 = Date.now(); // TTFB arrived
      const bodyText = await res.text();
      const t2 = Date.now(); // Body stream consumed

      const totalMs = t2 - t0;
      const ttfbMs = t1 - t0;
      const transferMs = Math.max(0, t2 - t1);
      
      // Calculate estimated network stage distribution
      const isHttps = config.url.startsWith('https://');
      const dnsEst = Math.round(ttfbMs * 0.15);
      const tcpEst = Math.round(ttfbMs * 0.20);
      const tlsEst = isHttps ? Math.round(ttfbMs * 0.25) : 0;
      const serverProcessingEst = Math.max(1, ttfbMs - dnsEst - tcpEst - tlsEst);

      const timing: CurlTimingBreakdown = {
        dns: dnsEst,
        tcp: tcpEst,
        tls: tlsEst,
        ttfb: serverProcessingEst,
        transfer: transferMs,
        total: totalMs
      };

      const systemMetrics = SystemMetrics.createRequestSnapshot(startCpu, startMem, totalMs);
      
      const resHeaders: Record<string, string> = {};
      const headerLines: string[] = [];
      
      headerLines.push(`HTTP/1.1 ${res.status} ${res.statusText || 'OK'}`);
      res.headers.forEach((value, name) => {
        resHeaders[name.toLowerCase()] = value;
        headerLines.push(`${name}: ${value}`);
      });

      const rawOutput = `${headerLines.join('\r\n')}\r\n\r\n${bodyText}`;

      return {
        id,
        status: res.status,
        headers: resHeaders,
        body: bodyText,
        responseTime: totalMs,
        rawOutput,
        curlCommand,
        requestSize,
        systemMetrics,
        timing
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return {
          id,
          status: 0,
          headers: {},
          body: '',
          responseTime: Date.now() - startTime,
          rawOutput: 'Request aborted by user',
          error: 'Aborted',
          curlCommand,
          requestSize,
          systemMetrics: SystemMetrics.createRequestSnapshot(startCpu, startMem, Date.now() - startTime)
        };
      }

      // Fallback to real curl spawn with timing extraction if fetch fails
      const spawnArgs = [...args, '-w', '\n__HYPERCURL_TIMING__:%{time_namelookup},%{time_connect},%{time_appconnect},%{time_starttransfer},%{time_total}'];

      return new Promise((resolve) => {
        const proc = spawn('curl', spawnArgs);
        let stdout = '';
        let stderr = '';

        const onAbort = () => {
          proc.kill();
          resolve({
            id,
            status: 0,
            headers: {},
            body: '',
            responseTime: Date.now() - startTime,
            rawOutput: 'Request aborted by user',
            error: 'Aborted',
            curlCommand,
            requestSize,
            systemMetrics: SystemMetrics.createRequestSnapshot(startCpu, startMem, Date.now() - startTime)
          });
        };

        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true });
        }

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          
          if (signal?.aborted) return;

          const responseTime = Date.now() - startTime;
          const systemMetrics = SystemMetrics.createRequestSnapshot(startCpu, startMem, responseTime);
          
          if (code !== 0 && code !== null) {
            resolve({
              id,
              status: 0,
              headers: {},
              body: '',
              responseTime,
              rawOutput: `Fetch failed (${err.message}). Fallback curl exited with code ${code}.\n\nCurl stderr: ${stderr}`,
              error: `Fetch error: ${err.message}. Curl error: ${stderr || `Exit code ${code}`}`,
              curlCommand,
              requestSize,
              systemMetrics
            });
            return;
          }

          if (code === null) return;

          // Parse timing token from curl output
          let timing: CurlTimingBreakdown | undefined;
          const timingMatch = stdout.match(/__HYPERCURL_TIMING__:([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)/);
          if (timingMatch) {
            const dnsSec = parseFloat(timingMatch[1]) || 0;
            const connSec = parseFloat(timingMatch[2]) || 0;
            const appSec = parseFloat(timingMatch[3]) || 0;
            const startSec = parseFloat(timingMatch[4]) || 0;
            const totSec = parseFloat(timingMatch[5]) || 0;

            const dnsMs = Math.round(dnsSec * 1000);
            const tcpMs = Math.round(Math.max(0, connSec - dnsSec) * 1000);
            const tlsMs = appSec > 0 ? Math.round(Math.max(0, appSec - connSec) * 1000) : 0;
            const ttfbMs = Math.round(Math.max(0, startSec - (appSec > 0 ? appSec : connSec)) * 1000);
            const transferMs = Math.round(Math.max(0, totSec - startSec) * 1000);
            const totalMs = Math.round(totSec * 1000);

            timing = {
              dns: dnsMs,
              tcp: tcpMs,
              tls: tlsMs,
              ttfb: ttfbMs,
              transfer: transferMs,
              total: totalMs || responseTime
            };

            // Clean timing token out of stdout
            stdout = stdout.replace(/\n__HYPERCURL_TIMING__:[^\n]+/, '');
          }

          const result = this.parseOutput(stdout, id, responseTime, curlCommand);
          resolve({ ...result, requestSize, systemMetrics, timing });
        });
      });
    }
  }

  private static parseOutput(raw: string, id: string, responseTime: number, curlCommand: string): CurlResult {
    const parts = raw.split(/\r?\n\r?\n/);
    
    let status = 0;
    const headers: Record<string, string> = {};
    let bodyIndex = 0;
    
    while (bodyIndex < parts.length) {
      const part = parts[bodyIndex];
      const lines = part.split(/\r?\n/);
      if (lines[0] && /^HTTP\/\d/i.test(lines[0].trim())) {
        const statusLine = lines[0];
        const statusMatch = statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/i);
        if (statusMatch) {
          status = parseInt(statusMatch[1], 10);
        }
        
        Object.keys(headers).forEach(key => delete headers[key]);
        lines.slice(1).forEach(line => {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim().toLowerCase();
            const value = line.substring(colonIdx + 1).trim();
            headers[key] = value;
          }
        });
        
        bodyIndex++;
      } else {
        break;
      }
    }
    
    const body = parts.slice(bodyIndex).join('\n\n');

    return {
      id,
      status,
      headers,
      body,
      responseTime,
      rawOutput: raw,
      curlCommand
    };
  }
}

