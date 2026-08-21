import React from 'react';

export type TestModuleId = 'basic_query' | 'blast' | 'race' | 'replay' | 'load' | 'chaos' | 'fuzzer' | 'security_audit' | 'distributed' | 'autocannon';

export interface TestModule {
  id: TestModuleId;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  strategy: string;
  settingsTitle: string;
  primaryMetric: string;
  theory: string;
  category: 'perf' | 'resilience' | 'security';
}

export const TEST_MODULES: Omit<TestModule, 'icon'>[] = [
  {
    id: 'basic_query',
    name: 'CONTRACT & SCHEMA VERIFICATION',
    description: 'One-shot connection to inspect returns, header keys, response times, and validate JSON schemas.',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/40',
    strategy: 'SINGLE_PROBE',
    settingsTitle: 'PROBE_SETUP',
    primaryMetric: 'RESPONSE_TIME',
    theory: 'Single-probe validation is the baseline of API contract checking. It runs a clean request to inspect response status codes, header details, and validate complex JSON payload structures.',
    category: 'resilience'
  },
  {
    id: 'blast',
    name: 'BURST CONCURRENCY STRESS',
    description: 'Floods target endpoints with concurrent bursts to identify sudden thread pool and socket saturation thresholds.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/40',
    strategy: 'PARALLEL_STORM',
    settingsTitle: 'CONCURRENCY_LEVEL',
    primaryMetric: 'THROUGHPUT_RPS',
    theory: 'Blast testing fires tight dense request waves simultaneously. This tracks concurrency-to-latency scaling graphs to pinpoint exactly where thread switching triggers CPU Thrashing.',
    category: 'perf'
  },
  {
    id: 'race',
    name: 'RACE CONDITION & ATOMICITY',
    description: 'Sub-millisecond writes engine targeting specific records to verify atomic locking or isolate dirty writes.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/40',
    strategy: 'OVERLAPPING_COLLISION',
    settingsTitle: 'COLLISION_WINDOW',
    primaryMetric: 'STATE_OVERLAPS',
    theory: 'Race detectors verify concurrency blocks. Bombarding an edit endpoint at the identical millisecond reveals whether row-level isolation safeguards database consistency.',
    category: 'perf'
  },
  {
    id: 'replay',
    name: 'IDEMPOTENCY & REPLAY AUDIT',
    description: 'Iterates transactions with locked authorization tokens to verify double-capture safeguards and idempotency.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    strategy: 'DEDUPLICATION_MATCH',
    settingsTitle: 'TRANS_LOCKS',
    primaryMetric: 'DEDUPLIC_PCT',
    theory: 'Replay audits verify request deduplication. By submitting identical signature pairs sequentially, we audit whether duplicate charges fail or get gracefully logged with Cached headers.',
    category: 'resilience'
  },
  {
    id: 'load',
    name: 'LOAD BENCHMARK (AUTOCANNON)',
    description: 'High-speed HTTP benchmarking engine with connection pipelining (-p), concurrent sockets (-c), and latency percentiles.',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    borderColor: 'border-rose-500/40',
    strategy: 'AUTOCANNON_PIPELINING_ENGINE',
    settingsTitle: 'AUTOCANNON_SETTINGS',
    primaryMetric: 'RPS_&_LATENCY_P99',
    theory: 'Autocannon delivers high-throughput socket pipelining benchmark testing. It stresses TCP socket multiplexing to evaluate max RPS throughput, connection saturation, and P99 latency percentiles.',
    category: 'perf'
  },
  {
    id: 'chaos',
    name: 'CHAOS & FAULT RESILIENCE',
    description: 'Randomly drops request headers and introduces network jitters to verify circuit breaker graceful fallbacks.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/40',
    strategy: 'ENTROPY_INJECTION',
    settingsTitle: 'JITTER_AMPLITUDE',
    primaryMetric: 'FALLBACK_RATIO',
    theory: 'Chaos engines test upstream fault tolerance patterns. Discharging sudden packet delays or dropping headers validates whether circuit breakers safely degrade or trigger full-system crash cascades.',
    category: 'resilience'
  },
  {
    id: 'fuzzer',
    name: 'SCHEMA & PAYLOAD FUZZER',
    description: 'Mutates variable structures, strips schema fields, and cascades large string buffers to test parser bounds.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/40',
    strategy: 'SCHEMA_MUTATION',
    settingsTitle: 'MUTATION_FREQ',
    primaryMetric: 'PARSING_ERRORS',
    theory: 'Fuzzing audits verify payload validation boundaries. Injecting null cast variables, removing required keys, and expanding giant binary shapes ensures express body parsers fail with clean HTTP 400 errors instead of VM crash loops.',
    category: 'security'
  },
  {
    id: 'security_audit',
    name: 'VULNERABILITY & OWASP AUDIT',
    description: 'Automated vulnerability sweep probing parameters against SQLi, tag XSS, and local traversal vectors.',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    borderColor: 'border-rose-500/40',
    strategy: 'VULNERABILITY_PROBE',
    settingsTitle: 'EXPLOIT_DEPTH',
    primaryMetric: 'VULN_ALERTS',
    theory: 'Vulnerability scanners evaluate input parameters against standard injection strings. This flags reflected script execution boundaries or system file exposures, while auditing CORS and sanitizations.',
    category: 'security'
  },
  {
    id: 'distributed',
    name: 'GEO-DISTRIBUTED SIMULATION',
    description: 'Simulates multi-continent client routes by spoofing CDN origin headers, IP arrays, and regional ISP latencies.',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/40',
    strategy: 'WORLDWIDE_SIMULATION',
    settingsTitle: 'SIMULATED_NODES',
    primaryMetric: 'GEO_RTT_MS',
    theory: 'Geographically distributed audits verify CDN integration rules. Spoofing real IP locations and tracking regional speed trends ensures security firewall and IP limits perform cleanly near global origin endpoints.',
    category: 'perf'
  }
];

export const THEORETICAL_FRAMEWORKS: Record<TestModuleId, {
  problem: string;
  solution: string;
  realLifeExample: string;
  staffEngineeringDepth: string;
}> = {
  basic_query: {
    problem: "API modules are frequently deployed with silent contract discrepancies. When backend query serializers modify database return formats or key casing (e.g., camelCase to snake_case, or altering nested list object schemas), downstream clients crash immediately upon property reference. Lacking automated, strict schema contract testing, these formatting errors routinely leak into customer-facing staging and production environments.",
    solution: "SINGLE_REQUEST execution maps precise JSON schemas, isolates specific value schemas, validates strict HTTP response statuses, and checks mandatory response headers. This guarantees complete schema cohesion and allows frontend developers to trust contract updates.",
    realLifeExample: "A microservice update alters a customer info query's ID property key from 'userId' to 'uid' to align with an optimized index. Without automated API contract specifications, the mobile application fails immediately on launch with a 'TypeError: Cannot read properties of undefined' crash for all active visitors.",
    staffEngineeringDepth: "Enforce API contract stability using Zod, AJV, or JSON-Schema validation frameworks on client/server boundaries. Isolate changes using clear API versioning patterns (/api/v1 vs /api/v2), and pair with automated build-time OpenAPI docs generation to expose type changes instantly."
  },
  blast: {
    problem: "When system traffic surges suddenly (e.g., ticket openings or viral marketing events), thousands of concurrent TCP sockets connect. If database connection sizes or event-loop threads are under-configured, CPU context switching thrashing sets in. Servers consume all physical execution power swapping threads rather than completing actual IO queries, leading to severe latency and rapid gateway timeout collapse (HTTP 504).",
    solution: "CONCURRENT_BLAST floods target routes with highly parallel requests to check thread pool limits and database connection bottlenecks. Measuring throughput (RPS) against concurrent users isolates the performance saturation boundary of the API cluster.",
    realLifeExample: "A reservation gateway faces 10,000 requests in a 400ms window during a product release. With a database connection limit of only 15 client slots, Postgres blocks incoming threads. The application server runs out of open database connections, queues overflow, and the entire API cluster crashes.",
    staffEngineeringDepth: "Mitigate thread pool bottlenecks by scaling DB access with dedicated transaction pools (e.g., PgBouncer), decoupling writes using persistent messaging registers (e.g., RabbitMQ, Kafka), and integrating proactive active load shedding (serving fast HTTP 503 errors when queue waits exceed 150ms)."
  },
  race: {
    problem: "Non-atomic state manipulation (Read-Modify-Write) allows concurrent commands of multiple threads to read raw values before changes write back. If separate actions (e.g. transfers, ticket bookings, stock decrements) target the exact same asset at the identical millisecond, they modify stale state, causing major double-allocation exploits or balance leaks.",
    solution: "RACE_DETECTOR submits high-frequency, overlapping write commands targeting a single record. This forces millisecond-level collision windows, revealing whether database records utilize robust row-level transaction isolation rules.",
    realLifeExample: "An online buyer with $50 balance clicks 'Withdraw $45' twice in the same millisecond. Multiple threads check the balance individually, find $50 is sufficient, and execute two withdrawals, causing a negative bank account balance while distributing $90 in cash.",
    staffEngineeringDepth: "Guard states against dirty writes by using pessimistic locking (SELECT FOR UPDATE) to lock rows during evaluation, optimistic locking strategies (WHERE version = current_version), or coordinated distributed locks (such as Redlock) via fast RAM storage nodes."
  },
  replay: {
    problem: "Unstable mobile networks encounter packet gaps, forcing client retry systems or proxy routes to resubmit identical API payloads. Without strict uniqueness constraints, the API executes these retried requests as brand new commands, resulting in duplicate user registrations, multiple database records, or double credit card transactions.",
    solution: "REPLAY_GUARD submits identical transaction structures, headers, and payload signatures sequentially. This validates whether backends properly identify identical transactions, block duplicate executions, and serve safe cached results without processing mutations again.",
    realLifeExample: "A client on a patchy mobile connection clicks 'Authorize Payment'. The request succeeds on the server but the connection drops before the client gets the 200 OK. The device retries three times, and the server charges the customer $300 instead of $100.",
    staffEngineeringDepth: "Enforce strict Idempotency-Key validation headers at the API gateway level. Store unique transaction tokens in shared Redis memory caches with an expiration of 24 hours. If a token is in 'Processing' state, block; if 'Completed', return the original cached response directly."
  },
  load: {
    problem: "System issues are routinely masked during rapid spikes but aggregate over hours of sustained traffic. Gradual resource decay (performance rot) from subtle runtime heap leaks, missing database indexes, unclosed OS file descriptors, or socket leaks slowly degrades API latency until the server exhausts space and crashes.",
    solution: "LOAD_CANNON maintains a continuous, long-running request queue at consistent pressure to evaluate runtime garbage collection, monitor heap allocation graphs, check socket exhaustion, and isolate backend index degradation.",
    realLifeExample: "An IoT endpoint registers sensor telemetry but fails to free its internal diagnostic scope reference. The microservice operates perfectly for 8 hours under load, but gradually eats 16GB of system memory, starts swapping swap space, and crashes with an out-of-memory exception.",
    staffEngineeringDepth: "Analyze server processes under sustained load using memory allocation profilers. Implement strict connection socket timeout boundaries to prevent idle devices from starving operating system files, and schedule automated rolling container restarts at 85% memory limits."
  },
  chaos: {
    problem: "In distributed microservice graphs, adjacent networks, databases, or third-party APIs will eventually fail or run slow. If parent services block synchronously while waiting for downstream dependencies, a failure in an optional secondary service (such as review banners) starves event-loops worldwide.",
    solution: "CHAOS_MODE injects random packet jitters, forced connection terminations, and network delays into dependent streams. This checks whether circuit breakers, timeout limits, and secondary fallback models seamlessly protect major system flows.",
    realLifeExample: "A web platform's checkout page tries to load payment methods, purchase reviews, and promo slides. The slide service fails due to an outage. Because the checkout page queries the slides synchronously without a timeout, the entire checkout page times out and errors out for all users.",
    staffEngineeringDepth: "Wrap all third-party API dependencies in robust Circuit Breaker patterns (such as Cockatiel or Hystrix). Mandate aggressive connection timeouts (500ms max), and establish safe degrader returns: if a network request fails, return static cached configurations immediately."
  },
  fuzzer: {
    problem: "Input validation layers often make assumptions about type patterns and object styles. If unescaped strings, deep nested objects, arbitrary integers, or unexpected data structures bypass sanity filters, they can trigger internal database queries, crashes of the V8 parser, or raw code injection.",
    solution: "PAYLOAD_FUZZER alters payload configurations by dropping keys, swapping data types, adding nested objects, and injecting giant buffer strings, confirming that controller inputs handle invalid payloads gracefully with clean HTTP 400 errors.",
    realLifeExample: "An endpoint receives data filters: { 'username':sujan }. A malicious user injects database-specific nested variables: { 'username': { '$ne': '' } }. The direct query returns all customer user records, exposing entire user credentials to an unauthorized attacker.",
    staffEngineeringDepth: "Govern all payload entrances strictly using isolated schema models (Zod, TypeBox, AJV) via a 'Parse, Don't Validate' architectural paradigm. This ensures all incoming objects are compiled and strongly typed before they migrate down into database handlers."
  },
  security_audit: {
    problem: "Open client inputs are major targets for SQL Injections (SQLi), Cross-Site Scripting (XSS), Local Directory Traversals, and malicious shell executions. Additionally, missing CORS locks or improperly configured server safety headers leave browser cookies vulnerable to active hijacking.",
    solution: "SECURITY_AUDITOR executes Automated Vulnerability Sweeps by injecting injection codes, scripting queries, and directory traversal targets into user arguments, ensuring the API restricts access and prevents leakage of raw backends.",
    realLifeExample: "An API displays customer profile photos via /api/profile?file=user.jpg. A malicious user inputs /api/profile?file=../../../../etc/passwd, bypassing authorization boundaries and extracting Unix user files from the operating system.",
    staffEngineeringDepth: "Build a solid defense-in-depth layout: implement Prepared / Parameterized Queries across all databases to completely eliminate SQL Injection, disinfect rich text parameters using DOMPurify, lock uploads, and serve strict security headers (CSP, HSTS)."
  },
  distributed: {
    problem: "Why do standard single-source load tests trigger false results? Traditional rate-limiting systems (Token Bucket / Sliding Window in Redis) count requests *per individual client IP address*, not the collective endpoint load. When you run stress tests from a single local computer or isolated test runner container, all traffic shares your single container IP. The server identifies this as a single-source threat and restricts it immediately (HTTP 429 Too Many Requests), even if total global server resources are completely idle. In a real-world production incident, however, thousands of separate legitimate visitors hit your systems with unique IP addresses simultaneously. Your local test runner cannot verify if your global rate limit settings are correctly distributed or if they suffer from regional gateway issues.",
    solution: "DISTRIBUTED_LOAD simulates true worldwide traffic by rotating realistic geolocated client IP headers (such as `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `True-Client-IP`, `Client-IP`) and user agents across workers. By distributing the load across multiple virtual geo-nodes (US, EU, APAC, LATAM), it checks whether your rate limit structures correctly separate multi-user traffic, bypassing artificial single-IP bottlenecks while ensuring regional firewalls, CDNs, and proxies run flawlessly.",
    realLifeExample: "A global service launches a mobile update. The backend applies a strict single-IP rate limit policy. However, because the API runs behind a multi-tier proxy cluster that is NOT configured with 'trust proxy', the application cluster identifies all inbound traffic as coming from the internal load balancer's single IP. The rate limiter fires instantly, blockading 99% of all global users with 429 Too Many Requests errors and causing a massive site-wide outage.",
    staffEngineeringDepth: "Configure strict 'trust proxy' configurations inside Express, Koa, or NestJS gateway routers to accurately process client headers while preventing header-spoofing attacks (arbitrary IP manipulation) from untrusted external sources. Always deploy multi-tiered rate limiting: rapid client-level rate limits (e.g., 5 requests/sec per IP) paired with broader, globally coordinated API gateway limits across all nodes. Also use CDN-level regional Edge rules (e.g. Cloudflare WAF Rate Limiting) to isolate heavy load prior to reaching origin servers."
  },
  autocannon: {
    problem: "Traditional HTTP debugging utilities like curl or standard single-threaded request dispatchers cannot generate high socket concurrency. They create one connection at a time or are bottlenecked by local JavaScript event loops, making it impossible to uncover high-load socket saturation, kernel TCP backlog limits, memory leaks under peak traffic, or latency degradation curves.",
    solution: "AUTOCANNON executes ultra-high-throughput concurrent HTTP/1.1 load benchmarking using C-optimized socket reuse, HTTP pipelining, and HDR-grade histogram tracking. It tests continuous saturation (up to tens of thousands of requests per second) directly in the UI without requiring terminal CLI commands.",
    realLifeExample: "A backend service works flawlessly under standard 50 RPS curl checks, but when traffic surges to 5,000 RPS during an event, Node.js event-loop lag increases to 800ms and socket connection queues exhaust the server file descriptors. Autocannon exposes this exact breakdown point in a 10-second benchmark.",
    staffEngineeringDepth: "Use HTTP/1.1 keep-alive connection pooling, socket pipelining, non-blocking I/O, and backpressure handling. Monitor p99 latency percentiles alongside raw throughput to detect GC pauses and event loop starvation under sustained concurrency."
  }
};
