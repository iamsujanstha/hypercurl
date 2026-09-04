import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import multer from "multer";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { CurlEngine, RequestConfig, CurlResult } from "./src/server/modules/curl-engine";
import { RequestRunner, BatchConfig, getRandomRegionIp } from "./src/server/modules/runner";
import { Store } from "./src/server/modules/store";
import { AutocannonEngine, AutocannonConfig } from "./src/server/modules/autocannon-engine";
import { SystemMetrics } from "./src/server/modules/system-metrics";
import { SecurityGuard } from "./src/server/modules/security";

async function startServer() {
  await Store.init();
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // Intercept and return clean JSON error for body parser syntax errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "status" in err && err.status === 400) {
      res.status(400).json({ 
        error: "Malformed JSON payload or empty request body with JSON Content-Type", 
        message: err.message || "Failed to parse JSON request body" 
      });
      return;
    }
    next(err);
  });

  // Mock Race Condition Demo State
  let globalBalance = 1000;
  let transactionLogs: any[] = [];

  const upload = multer({ dest: '/tmp/hypercurl-uploads/' });

  app.post("/api/upload-file", upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    res.json({
      success: true,
      fileId: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });
  });

  // API Routes
  app.get("/api/history", async (req, res) => {
    try {
      const history = await Store.getHistory();
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/history", async (req, res) => {
    try {
      await Store.clearHistory();
      res.json({ success: true, message: "History cleared." });
    } catch (error: any) {
      console.error("Error clearing history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await Store.getCollections();
      res.json(collections);
    } catch (error: any) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collections", async (req, res) => {
    try {
      await Store.saveCollection(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving collection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/collections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await Store.deleteCollection(id);
      res.json({ success: true, message: `Collection ${id} removed.` });
    } catch (error: any) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Environments REST API
  app.get("/api/environments", async (req, res) => {
    try {
      const envs = await Store.getEnvironments();
      res.json(envs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/environments", async (req, res) => {
    try {
      await Store.saveEnvironment(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/environments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await Store.deleteEnvironment(id);
      res.json({ success: true, message: `Environment ${id} removed.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Benchmarks Snapshots REST API
  app.get("/api/benchmarks", async (req, res) => {
    try {
      const benchmarks = await Store.getBenchmarks();
      res.json(benchmarks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/benchmarks", async (req, res) => {
    try {
      await Store.saveBenchmark(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/benchmarks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await Store.deleteBenchmark(id);
      res.json({ success: true, message: `Benchmark ${id} removed.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Headless CI/CD Test Suite Runner Route
  app.post("/api/test-runner/run", async (req, res) => {
    try {
      const { suite, variables = {} } = req.body;
      if (!suite || !Array.isArray(suite.steps)) {
        res.status(400).json({ error: "Missing or invalid 'suite' definition with steps." });
        return;
      }

      const runtimeVars = { ...variables };
      const stepResults: any[] = [];
      const startTime = Date.now();

      for (let i = 0; i < suite.steps.length; i++) {
        const step = suite.steps[i];
        
        // Resolve URL & Headers
        let resolvedUrl = step.url || "";
        Object.entries(runtimeVars).forEach(([k, v]) => {
          resolvedUrl = resolvedUrl.replace(new RegExp(`{{${k}}}`, "g"), String(v));
        });

        const headers: Record<string, string> = {};
        if (Array.isArray(step.headersList)) {
          step.headersList.forEach((h: any) => {
            if (h.enabled !== false && h.key?.trim()) {
              let val = h.value || "";
              Object.entries(runtimeVars).forEach(([k, v]) => {
                val = val.replace(new RegExp(`{{${k}}}`, "g"), String(v));
              });
              headers[h.key.trim()] = val;
            }
          });
        }

        let resolvedBody = step.body;
        if (resolvedBody) {
          Object.entries(runtimeVars).forEach(([k, v]) => {
            resolvedBody = resolvedBody.replace(new RegExp(`{{${k}}}`, "g"), String(v));
          });
        }

        const stepStart = Date.now();
        let curlRes: CurlResult | undefined;
        let stepStatus: "passed" | "failed" = "passed";
        let stepError: string | undefined;

        try {
          curlRes = await CurlEngine.execute({
            url: resolvedUrl,
            method: step.method || "GET",
            headers,
            body: resolvedBody,
            timeout: step.timeoutMs ? Math.round(step.timeoutMs / 1000) : 10
          });
        } catch (err: any) {
          stepStatus = "failed";
          stepError = err.message || "Request execution failed";
        }

        const stepDuration = Date.now() - stepStart;
        const assertions: any[] = [];

        if (curlRes && Array.isArray(step.assertions)) {
          step.assertions.forEach((a: any) => {
            let pass = false;
            let act = "";
            if (a.type === "status") {
              act = String(curlRes!.status);
              pass = act === String(a.value);
            } else if (a.type === "latency") {
              act = `${curlRes!.responseTime}ms`;
              pass = curlRes!.responseTime <= parseInt(a.value, 10);
            } else if (a.type === "body_contains") {
              act = (curlRes!.body || "").substring(0, 50);
              pass = (curlRes!.body || "").includes(a.value);
            }
            if (!pass) stepStatus = "failed";
            assertions.push({ ruleId: a.id, type: a.type, passed: pass, expected: a.value, actual: act });
          });
        }

        // Variable extraction
        const extracted: Record<string, string> = {};
        if (curlRes && Array.isArray(step.extractors)) {
          step.extractors.forEach((ext: any) => {
            if (ext.jsonPath && ext.variableName && curlRes!.body) {
              try {
                const parsed = JSON.parse(curlRes!.body);
                const pathParts = ext.jsonPath.replace(/^\$\.?/, "").split(".");
                let val: any = parsed;
                for (const p of pathParts) {
                  if (val && typeof val === "object") val = val[p];
                  else { val = undefined; break; }
                }
                if (val !== undefined) {
                  const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
                  extracted[ext.variableName] = strVal;
                  runtimeVars[ext.variableName] = strVal;
                }
              } catch {}
            }
          });
        }

        stepResults.push({
          stepId: step.id,
          stepName: step.name,
          method: step.method,
          url: resolvedUrl,
          durationMs: stepDuration,
          status: stepStatus,
          error: stepError,
          assertions,
          extractedVariables: extracted
        });

        if (stepStatus === "failed" && suite.stopOnFailure) {
          break;
        }
      }

      const passedCount = stepResults.filter(s => s.status === "passed").length;
      const failedCount = stepResults.filter(s => s.status === "failed").length;

      const summary = {
        suiteId: suite.id || "ad-hoc",
        suiteName: suite.name || "Test Suite",
        totalSteps: suite.steps.length,
        executedSteps: stepResults.length,
        passedSteps: passedCount,
        failedSteps: failedCount,
        totalDurationMs: Date.now() - startTime,
        status: failedCount === 0 ? "PASSED" : "FAILED",
        exitCode: failedCount === 0 ? 0 : 1,
        stepResults
      };

      res.status(failedCount === 0 ? 200 : 400).json(summary);
    } catch (error: any) {
      console.error("Headless runner error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Autocannon Benchmark REST API Routes
  app.post("/api/autocannon/run", async (req, res) => {
    try {
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "127.0.0.1";
      if (!SecurityGuard.checkRateLimit(clientIp)) {
        res.status(429).json({ 
          error: "Rate Limit Exceeded", 
          message: "Too many benchmark requests. Please wait a moment before starting another load test." 
        });
        return;
      }

      const config: AutocannonConfig = req.body;
      if (!config || !config.url) {
        res.status(400).json({ error: "Missing required 'url' property in request body." });
        return;
      }
      const runKey = `rest-ac-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const result = await AutocannonEngine.run(runKey, config);
      await Store.addToHistory({
        request: {
          url: config.url,
          method: config.method || 'GET',
          headers: config.headers || {},
          body: config.body
        },
        batch: {
          iterations: result.totalRequests,
          concurrency: config.connections,
          successCount: result.statusCodes['2xx'],
          avgResponseTime: result.latency.average
        }
      });
      res.json(result);
    } catch (error: any) {
      console.error("Autocannon execution error:", error);
      res.status(500).json({ error: error.message || "Autocannon benchmark failed" });
    }
  });

  app.post("/api/autocannon/stop", (req, res) => {
    const { key } = req.body || {};
    if (key) {
      AutocannonEngine.stop(key);
    }
    res.json({ success: true, message: "Autocannon benchmark stop signal dispatched." });
  });

  // Moved Race Demo Routes under /api
  app.post("/api/race-demo/reset", (req, res) => {
    globalBalance = 1000;
    transactionLogs = [];
    res.json({ 
      status: "system_reset", 
      balance: globalBalance,
      message: "Race demo state has been restored to defaults." 
    });
  });

  app.get("/api/race-demo/balance", (req, res) => {
    res.json({ balance: globalBalance });
  });

  app.all(["/api/orders/broken/place", "/api/orders/fixed/place"], (req, res, next) => {
    if (req.method !== "POST") {
      res.status(405).json({
        error: "Method Not Allowed",
        message: `This endpoint only supports POST requests. You sent a ${req.method} request.`
      });
      return;
    }
    next();
  });

  app.post("/api/orders/broken/place", async (req, res) => {
    // Intentional Race Condition: Read -> Wait -> Write
    const currentBalance = globalBalance;
    const amount = (req.body && req.body.amount) || 10;
    
    // Simulate some async processing time to widen the race window
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
    if (currentBalance >= amount) {
      globalBalance = currentBalance - amount;
      const tx = { id: Date.now(), amount, remaining: globalBalance, type: 'broken' };
      transactionLogs.push(tx);
      res.json({ success: true, ...tx });
    } else {
      res.status(400).json({ error: "Insufficient funds", currentBalance });
    }
  });

  app.post("/api/orders/fixed/place", async (req, res) => {
    // Atomic-like update
    const amount = (req.body && req.body.amount) || 10;
    
    if (globalBalance >= amount) {
      globalBalance -= amount;
      const tx = { id: Date.now(), amount, remaining: globalBalance, type: 'fixed' };
      transactionLogs.push(tx);
      res.json({ success: true, ...tx });
    } else {
      res.status(400).json({ error: "Insufficient funds", currentBalance: globalBalance });
    }
  });

  app.post("/api/execute", async (req, res) => {
    const config: RequestConfig = req.body;
    console.log(`Executing request to: ${config.url}`);
    console.log("EXECUTE CONFIG METHOD:", config.method);
    console.log("EXECUTE CONFIG HEADERS:", JSON.stringify(config.headers, null, 2));
    console.log("EXECUTE CONFIG BODY:", config.body ? (config.body.length > 500 ? config.body.substring(0, 500) + '...' : config.body) : 'EMPTY');
    
    try {
      const result = await CurlEngine.execute(config);
      await Store.addToHistory({ request: config, result });
      res.json(result);
    } catch (error: any) {
      console.error("Execution error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // IP-based Rate Limiter Demo for distributed testing
  const rateLimitStore = new Map<string, number[]>();

  app.get("/api/demo/rate-limited", (req, res) => {
    const rawIp = req.headers["x-forwarded-for"] || 
                  req.headers["x-real-ip"] || 
                  req.headers["client-ip"] || 
                  req.ip || 
                  "127.0.0.1";
    const clientIp = Array.isArray(rawIp) 
      ? rawIp[0].trim() 
      : typeof rawIp === "string" 
        ? rawIp.split(",")[0].trim() 
        : "127.0.0.1";
    
    const now = Date.now();
    let timestamps = rateLimitStore.get(clientIp) || [];
    
    // Filter timestamps to the last 1 second (1000ms)
    timestamps = timestamps.filter(t => now - t < 1000);
    
    if (timestamps.length >= 3) {
      timestamps.push(now);
      rateLimitStore.set(clientIp, timestamps);
      res.status(429).json({
        error: "Too Many Requests",
        message: `Throttle triggered! IP ${clientIp} exceeded limit of 3 requests per second.`,
        clientIp,
        rateLimit: "3 req/sec",
        trustedProxyHeaders: true,
        help: "Running this under the 'DISTRIBUTED_LOAD' test will rotate simulated IPs and automatically bypass this rate limit!"
      });
      return;
    }
    
    timestamps.push(now);
    rateLimitStore.set(clientIp, timestamps);
    
    res.json({
      success: true,
      message: "Request allowed.",
      clientIp,
      requestsInLastSecond: timestamps.length,
      limitLeft: Math.max(0, 3 - timestamps.length),
      trustedProxyHeaders: true
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/system/specs", (req, res) => {
    try {
      const specs = SystemMetrics.getSpecs();
      res.json(specs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // WebSocket for real-time batch execution
  const activeBatches = new Map<WebSocket, AbortController>();
  const activeAutocannonRuns = new Map<WebSocket, string>();

  // Real-time server telemetry engine (broadcast every 2000ms)
  const broadcastTelemetry = () => {
    const clientCount = wss.clients.size;
    const telemetryPayload = {
      type: "telemetry",
      payload: {
        status: "ONLINE",
        engine: "cURL + Autocannon",
        clientCount,
        latency: "0.2ms",
        systemSpecs: SystemMetrics.getSpecs()
      }
    };
    
    const rawMessage = JSON.stringify(telemetryPayload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(rawMessage);
      }
    });
  };

  const telemetryInterval = setInterval(broadcastTelemetry, 2000);

  wss.on("connection", (ws) => {
    // Dispatch initial real-time telemetry frame immediately on connect
    const initialPayload = {
      type: "telemetry",
      payload: {
        status: "ONLINE",
        engine: "cURL + Autocannon",
        clientCount: wss.clients.size,
        latency: "0.2ms",
        systemSpecs: SystemMetrics.getSpecs()
      }
    };
    ws.send(JSON.stringify(initialPayload));

    ws.on("close", () => {
      const controller = activeBatches.get(ws);
      if (controller) {
        controller.abort();
        activeBatches.delete(ws);
      }
      const acKey = activeAutocannonRuns.get(ws);
      if (acKey) {
        AutocannonEngine.stop(acKey);
        activeAutocannonRuns.delete(ws);
      }
    });

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "run-batch") {
          const config: BatchConfig = data.payload;
          const tabId = data.tabId;
          const controller = new AbortController();
          activeBatches.set(ws, controller);

          // Execute with the full RequestRunner engine ensuring accurate mutations, injections, and percentiles
          RequestRunner.runBatch(config, (progress) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ 
                type: "progress", 
                tabId, 
                testModule: config.testModule, 
                uiModule: config.uiModule, 
                ...progress 
              }));
            }
          }, controller.signal).then(async (results) => {
            activeBatches.delete(ws);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ 
                type: "complete", 
                tabId, 
                testModule: config.testModule, 
                uiModule: config.uiModule, 
                results 
              }));
            }

            if (results.length > 0) {
              await Store.addToHistory({ 
                request: config.request, 
                batch: { 
                  iterations: config.iterations, 
                  concurrency: config.concurrency,
                  successCount: results.filter(r => r.status >= 200 && r.status < 300).length,
                  avgResponseTime: results.reduce((acc, r) => acc + r.responseTime, 0) / results.length
                } 
              });
            }
          }).catch(err => {
            console.error("Batch runner execution error:", err);
            activeBatches.delete(ws);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "error",
                tabId,
                testModule: config.testModule,
                uiModule: config.uiModule,
                error: err?.message || "Batch runner execution failed."
              }));
            }
          });
        } else if (data.type === "abort-batch") {
          const controller = activeBatches.get(ws);
          if (controller) {
            controller.abort();
            activeBatches.delete(ws);
          }
        } else if (data.type === "run-autocannon") {
          const config: AutocannonConfig = data.payload;
          const tabId = data.tabId;
          const runKey = `ws-ac-${tabId}-${Date.now()}`;
          activeAutocannonRuns.set(ws, runKey);

          try {
            const result = await AutocannonEngine.run(runKey, config, (progress) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "autocannon-progress",
                  tabId,
                  progress
                }));
              }
            });

            activeAutocannonRuns.delete(ws);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "autocannon-complete",
                tabId,
                result
              }));
            }

            // Save benchmark in history store
            await Store.addToHistory({
              request: {
                url: config.url,
                method: config.method || 'GET',
                headers: config.headers || {},
                body: config.body
              },
              batch: {
                iterations: result.totalRequests,
                concurrency: config.connections,
                successCount: result.statusCodes['2xx'],
                avgResponseTime: result.latency.average
              }
            });
          } catch (err: any) {
            activeAutocannonRuns.delete(ws);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "autocannon-error",
                tabId,
                error: err?.message || "Autocannon benchmark failed to run"
              }));
            }
          }
        } else if (data.type === "abort-autocannon") {
          const tabId = data.tabId;
          const acKey = activeAutocannonRuns.get(ws);
          if (acKey) {
            AutocannonEngine.stop(acKey);
            activeAutocannonRuns.delete(ws);
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "autocannon-aborted",
              tabId
            }));
          }
        }
      } catch (error) {
        console.error("WS error:", error);
      }
    });
  });

  // Master API 404 handler - placed BEFORE dev/production SPA routing
  app.all("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "Not Found", 
      message: `API endpoint ${req.method} ${req.path} not found.` 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Serve SPA for non-API routes
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HyperCurl server running on http://localhost:${PORT}`);
  });
}

startServer();
