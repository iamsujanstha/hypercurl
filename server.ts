import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { CurlEngine, RequestConfig, CurlResult } from "./src/server/modules/curl-engine";
import { RequestRunner, BatchConfig, getRandomRegionIp } from "./src/server/modules/runner";
import { Store } from "./src/server/modules/store";
import { AutocannonEngine, AutocannonConfig } from "./src/server/modules/autocannon-engine";
import { SystemMetrics } from "./src/server/modules/system-metrics";

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

  // Autocannon Benchmark REST API Routes
  app.post("/api/autocannon/run", async (req, res) => {
    try {
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
