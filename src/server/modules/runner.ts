import { CurlEngine, RequestConfig, CurlResult } from './curl-engine';

export interface BatchConfig {
  request?: RequestConfig;
  requests?: RequestConfig[];
  concurrency: number;
  iterations: number;
  delayMs?: number;
  // Lab Options
  testModule?: string;
  uiModule?: string;
  jitter?: boolean;
  fuzzing?: boolean;
  retries?: number;
  regions?: string[];
  rotateIps?: boolean;
}

export function getRandomRegionIp(region: string) {
  const data: Record<string, { ip: string; country: string; flag: string; regionName: string }[]> = {
    us: [
      { ip: "54.210.23.111", country: "United States", flag: "🇺🇸", regionName: "us-east-1 (N. Virginia)" },
      { ip: "198.51.100.42", country: "United States", flag: "🇺🇸", regionName: "us-west-2 (Oregon)" },
      { ip: "172.56.21.99", country: "United States", flag: "🇺🇸", regionName: "T-Mobile USA" },
      { ip: "34.200.45.12", country: "United States", flag: "🇺🇸", regionName: "AWS US East" },
      { ip: "66.249.66.1", country: "United States", flag: "🇺🇸", regionName: "Googlebot IP" }
    ],
    eu: [
      { ip: "185.190.140.22", country: "Germany", flag: "🇩🇪", regionName: "eu-central-1 (Frankfurt)" },
      { ip: "46.101.99.182", country: "United Kingdom", flag: "🇬🇧", regionName: "eu-west-2 (London)" },
      { ip: "5.145.2.103", country: "France", flag: "🇫🇷", regionName: "Orange S.A." },
      { ip: "34.76.120.45", country: "Belgium", flag: "🇧🇪", regionName: "GCP Europe" },
      { ip: "109.110.220.55", country: "Italy", flag: "🇮🇹", regionName: "Telecom Italia" }
    ],
    apac: [
      { ip: "103.55.12.9", country: "Japan", flag: "🇯🇵", regionName: "ap-northeast-1 (Tokyo)" },
      { ip: "210.140.10.82", country: "Japan", flag: "🇯🇵", regionName: "Softbank Japan" },
      { ip: "122.11.168.42", country: "Singapore", flag: "🇸🇬", regionName: "ap-southeast-1 (Singapore)" },
      { ip: "13.250.45.19", country: "Singapore", flag: "🇸🇬", regionName: "AWS Asia Pac" },
      { ip: "1.186.20.100", country: "India", flag: "🇮🇳", regionName: "Reliance Jio" },
      { ip: "203.104.5.12", country: "Australia", flag: "🇦🇺", regionName: "ap-southeast-2 (Sydney)" }
    ],
    latam: [
      { ip: "201.24.150.31", country: "Brazil", flag: "🇧🇷", regionName: "sa-east-1 (São Paulo)" },
      { ip: "186.200.12.55", country: "Brazil", flag: "🇧🇷", regionName: "Claro Telecom" },
      { ip: "190.15.220.4", country: "Argentina", flag: "🇦🇷", regionName: "Telecom Argentina" },
      { ip: "187.141.50.12", country: "Mexico", flag: "🇲🇽", regionName: "Telmex Mexico" },
      { ip: "190.157.30.40", country: "Colombia", flag: "🇨🇴", regionName: "Movistar Colombia" }
    ]
  };

  const list = data[region] || data.us;
  const base = list[Math.floor(Math.random() * list.length)];
  const octets = base.ip.split('.');
  
  // High fidelity subnet / CIDR rotation: randomize both 3rd and 4th octet safely
  const baseVal2 = parseInt(octets[2], 10);
  const randomThird = Math.max(1, Math.min(254, baseVal2 + Math.floor(Math.random() * 23) - 11));
  octets[2] = randomThird.toString();
  octets[3] = Math.floor(Math.random() * 254 + 1).toString();
  const realisticIp = octets.join('.');
  return {
    ...base,
    ip: realisticIp
  };
}

export interface ProgressUpdate {
  type: 'progress';
  completed: number;
  total: number;
  lastResult?: CurlResult;
  startTime?: number;
}

export class RequestRunner {
  public static activeCount = 0;

  static async runBatch(
    config: BatchConfig, 
    onProgress?: (update: ProgressUpdate) => void,
    signal?: AbortSignal
  ): Promise<CurlResult[]> {
    const { request, requests, concurrency, iterations, delayMs = 0, testModule, jitter, fuzzing, retries = 0, regions, rotateIps } = config;
    
    // If requests array is provided, iterations matches its length
    const total = requests ? requests.length : iterations;
    const results: CurlResult[] = [];
    let completed = 0;
    const startTime = Date.now();

    const queue = Array.from({ length: total }, (_, i) => i);
    
    const runId = Math.random().toString(36).substring(7);
    const worker = async () => {
      RequestRunner.activeCount++;
      try {
        while (queue.length > 0 && !signal?.aborted) {
          const index = queue.shift();
          if (index === undefined) break;

          let finalRequest = requests ? { ...requests[index] } : { ...request! };

          // --- Module-Specific Instrumentation ---

          // 6. Distributed Load Test Simulation: Spoof IP headers, User-Agent, and geographical routing latency
          let simulatedIp: string | undefined;
          let simulatedCountry: string | undefined;
          let simulatedFlag: string | undefined;
          let simulatedRegion: string | undefined;

          if (testModule === 'distributed' || rotateIps) {
            const chosenRegions = regions && regions.length > 0 ? regions : ['us', 'eu', 'apac', 'latam'];
            const region = chosenRegions[Math.floor(Math.random() * chosenRegions.length)];
            const info = getRandomRegionIp(region);
            simulatedIp = info.ip;
            simulatedCountry = info.country;
            simulatedFlag = info.flag;
            simulatedRegion = info.regionName;

            // Detect target protocol
            const isHttps = (finalRequest.url || '').toLowerCase().startsWith('https');
            const proto = isHttps ? 'https' : 'http';
            const port = isHttps ? '443' : '80';

            // Extract Host from context URL
            let hostHeader = '';
            try {
              if (finalRequest.url) {
                const urlParsed = new URL(finalRequest.url);
                hostHeader = urlParsed.host;
              }
            } catch (err) {}

            const headers: Record<string, string> = { 
              ...(finalRequest.headers || {}),
              // Standard Proxy IP routing headers (Title Case and lowercase variations)
              'X-Forwarded-For': simulatedIp,
              'x-forwarded-for': simulatedIp,
              'X-Real-IP': simulatedIp,
              'x-real-ip': simulatedIp,
              'CF-Connecting-IP': simulatedIp,
              'cf-connecting-ip': simulatedIp,
              'True-Client-IP': simulatedIp,
              'true-client-ip': simulatedIp,
              'Client-IP': simulatedIp,
              'client-ip': simulatedIp,
              'X-Client-IP': simulatedIp,
              'x-client-ip': simulatedIp,
              'X-Originating-IP': simulatedIp,
              'x-originating-ip': simulatedIp,
              'X-Cluster-Client-IP': simulatedIp,
              'x-cluster-client-ip': simulatedIp,

              // RFC 7239 Standard Forwarded header
              'Forwarded': `for=${simulatedIp};proto=${proto}`,
              'forwarded': `for=${simulatedIp};proto=${proto}`,

              // Additional proxy context metrics
              'X-Forwarded-Proto': proto,
              'x-forwarded-proto': proto,
              'X-Forwarded-Port': port,
              'x-forwarded-port': port
            };

            if (hostHeader) {
              headers['X-Forwarded-Host'] = hostHeader;
              headers['x-forwarded-host'] = hostHeader;
            }
            
            const userAgents = [
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
              "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
            ];
            headers['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)];
            finalRequest.headers = headers;
          }

        // 1. Payload Fuzzer: Mutation testing
        if (testModule === 'fuzzer' && finalRequest.body) {
          try {
            const body = JSON.parse(finalRequest.body);
            const keys = Object.keys(body);
            const strategy = Math.floor(Math.random() * 4);
            
            if (keys.length > 0) {
              const targetKey = keys[Math.floor(Math.random() * keys.length)];
              switch (strategy) {
                case 0: // Key Drop
                  delete body[targetKey];
                  break;
                case 1: // Type Swap
                  body[targetKey] = typeof body[targetKey] === 'number' ? "corrupt_string" : 999999999;
                  break;
                case 2: // Null Inject
                  body[targetKey] = null;
                  break;
                case 3: // Overflow
                  body[targetKey] = "A".repeat(1000);
                  break;
              }
            }
            finalRequest.body = JSON.stringify(body);
          } catch (e) {
            // If not JSON, append junk
            finalRequest.body += "_FUZZ_" + Math.random().toString(36);
          }
        }

        // 3. Replay Guard: Idempotency cloning
        if (testModule === 'replay' && finalRequest.body) {
          try {
            const body = JSON.parse(finalRequest.body);
            // Locate common transaction/id fields and keep them constant for specific groups
            const groupSize = 2; // Every 2 requests share the same ID
            const groupId = Math.floor(index / groupSize);
            const constantId = `REPLAY_TEST_ID_${runId}_${groupId}`;
            
            ['id', 'transaction_id', 'nonce', 'requestId', 'orderId'].forEach(field => {
              if (field in body || index % 5 === 0) body[field] = constantId;
            });
            finalRequest.body = JSON.stringify(body);
          } catch (e) {}
        }

        // 4. Chaos Mode: Network and header corruption
        if (testModule === 'chaos') {
          // Randomly drop headers
          const headers = { ...(finalRequest.headers || {}) };
          const headerKeys = Object.keys(headers);
          if (headerKeys.length > 0 && Math.random() > 0.5) {
            const target = headerKeys[Math.floor(Math.random() * headerKeys.length)];
            delete headers[target];
            finalRequest.headers = headers;
          }
          // Responsive Jitter
          await new Promise(r => setTimeout(r, Math.random() * 120));
        }

        // 5. Security Audit: Systematic Vulnerability Probes
        if (testModule === 'security_audit') {
          const probeType = index % 6;
          const headers = { ...finalRequest.headers };
          let bodyText = finalRequest.body || '';
          let urlText = finalRequest.url || '';

          // Add metadata helper headers so the engine and UI can audit the security testing
          headers['X-Security-Test-Type'] = ['SQLI', 'XSS', 'NO_AUTH', 'CORS', 'PATH_TRAVERSAL', 'CMD_INJECTION'][probeType];

          if (probeType === 0) { // SQL Injection (SQLi)
            const sqlPayload = "' OR '1'='1' --";
            urlText += (urlText.includes('?') ? '&' : '?') + `q=sqli_test${encodeURIComponent(sqlPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] += ` ${sqlPayload}`;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText += ` ${sqlPayload}`;
              }
            }
          } else if (probeType === 1) { // Cross-Site Scripting (XSS)
            const xssPayload = `"><script>alert("qaxss")</script>`;
            urlText += (urlText.includes('?') ? '&' : '?') + `input=${encodeURIComponent(xssPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] += ` ${xssPayload}`;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText += ` ${xssPayload}`;
              }
            }
          } else if (probeType === 2) { // No Authentication Bypass
            // Strip out credential headers to see if we get a 401/403 (Safe) or 200/500 (Vulnerable!)
            const authHeaders = ['authorization', 'cookie', 'x-api-key', 'token', 'auth', 'x-auth-token'];
            Object.keys(headers).forEach(k => {
              if (authHeaders.includes(k.toLowerCase())) {
                delete headers[k];
              }
            });
          } else if (probeType === 3) { // CORS Wildcard & Origin Reflection
            headers['Origin'] = 'https://evil-attacker.com';
            headers['Referer'] = 'https://evil-attacker.com/exploit-stage';
          } else if (probeType === 4) { // Path Traversal / Local File Inclusion (LFI)
            const traversalPayload = '../../../../etc/passwd';
            urlText += (urlText.includes('?') ? '&' : '?') + `file=${encodeURIComponent(traversalPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] = traversalPayload;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText = traversalPayload;
              }
            }
          } else if (probeType === 5) { // Shell Command Injection
            const cmdPayload = '; cat /etc/passwd || dir';
            urlText += (urlText.includes('?') ? '&' : '?') + `cmd=${encodeURIComponent(cmdPayload)}`;
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                Object.keys(bodyJson).forEach(k => {
                  if (typeof bodyJson[k] === 'string') {
                    bodyJson[k] += ` ${cmdPayload}`;
                  }
                });
                bodyText = JSON.stringify(bodyJson);
              } catch (e) {
                bodyText += ` ${cmdPayload}`;
              }
            }
          }

          finalRequest.headers = headers;
          finalRequest.body = bodyText;
          finalRequest.url = urlText;
        }

        // Standard Jitter (Fallback)
        if (jitter && testModule !== 'chaos' && testModule !== 'race') {
          const wait = Math.random() * 500;
          await new Promise(r => setTimeout(r, wait));
        }

        let result: CurlResult;
        let attempt = 0;
        
        const executeWithRetry = async (): Promise<CurlResult> => {
          try {
            const res = await CurlEngine.execute({
              ...finalRequest,
              id: `${finalRequest.id || 'req'}-${runId}-${index}`
            }, signal);
            
            if (res.status >= 400 && attempt < retries) {
              if (res.status >= 500 && res.status < 600) {
                // Exponential backoff for 5xx status codes
                const backoffBase = 200;
                const jitter = Math.random() * 50;
                const delay = Math.pow(2, attempt) * backoffBase + jitter;
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              attempt++;
              return executeWithRetry();
            }
            if (attempt > 0) {
              (res as any).retriesApplied = attempt;
            }
            return res;
          } catch (e: any) {
            if (attempt < retries) {
              // Try again with exponential backoff on fetch exceptions (treated as transient 5xx issues)
              const backoffBase = 200;
              const jitter = Math.random() * 50;
              const delay = Math.pow(2, attempt) * backoffBase + jitter;
              await new Promise(resolve => setTimeout(resolve, delay));
              
              attempt++;
              return executeWithRetry();
            }
            throw e;
          }
        };

        result = await executeWithRetry();
        result.iterationIndex = index;
        if (testModule === 'distributed' || rotateIps) {
          result.simulatedIp = simulatedIp;
          result.simulatedCountry = simulatedCountry;
          result.simulatedFlag = simulatedFlag;
          result.simulatedRegion = simulatedRegion;
        }

        results.push(result);
        completed++;

        if (onProgress) {
          onProgress({
            type: 'progress',
            completed,
            total,
            lastResult: result,
            startTime
          });
        }

        if (delayMs > 0 && queue.length > 0 && !signal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      } finally {
        RequestRunner.activeCount--;
      }
    };

    // Spawn workers based on concurrency
    const workers = Array.from(
      { length: Math.min(concurrency, iterations) }, 
      () => worker()
    );

    await Promise.all(workers);
    return results;
  }
}
