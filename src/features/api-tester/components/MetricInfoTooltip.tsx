import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, HelpCircle, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Gauge, Activity, Clock, Zap, ShieldCheck, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MetricType = 
  | 'p99'
  | 'p90'
  | 'p50'
  | 'p99_9'
  | 'avg_latency'
  | 'throughput'
  | 'total_requests'
  | 'data_transferred'
  | 'success_rate'
  | 'sla_audit'
  | 'status_codes'
  | 'errors_timeouts'
  | 'connections'
  | 'pipelining';

export interface MetricDefinition {
  title: string;
  category: 'Latency Percentile' | 'Throughput' | 'Reliability' | 'Network' | 'Concurrency';
  shortDesc: string;
  detailedDesc: string;
  realWorldExample: string;
  industryBenchmark: string;
  formula?: string;
  icon?: any;
  accentColor: string;
}

export const METRIC_DEFINITIONS: Record<MetricType, MetricDefinition> = {
  p99: {
    title: '99th Percentile Latency (P99)',
    category: 'Latency Percentile',
    shortDesc: 'The maximum response time experienced by 99% of your requests.',
    detailedDesc: 'P99 isolates the slowest 1% "tail" of requests. Averages hide severe lag spikes, whereas P99 reveals worst-case experiences caused by database locks, garbage collection pauses, or cold starts.',
    realWorldExample: 'If 1,000 customers hit your checkout endpoint, 990 of them finish in under 280ms, but 10 customers wait 5.4 seconds. Those 10 customers might abandon their purchase.',
    industryBenchmark: '< 200ms is excellent for web APIs; < 500ms is standard for complex backend transactions; > 1,000ms breaches common enterprise SLAs.',
    formula: 'Sort all request latencies ascending: P99 = latency at index (N × 0.99)',
    icon: Gauge,
    accentColor: 'rose',
  },
  p90: {
    title: '90th Percentile Latency (P90)',
    category: 'Latency Percentile',
    shortDesc: 'Response time threshold where 90% of requests are faster, and 10% are slower.',
    detailedDesc: 'P90 represents the latency seen by the vast majority of active users, filtering out rare one-off network anomalies.',
    realWorldExample: 'In a search API, a P90 of 150ms means 9 out of 10 user queries return in 150ms or less. Only 1 in 10 encounters slower performance.',
    industryBenchmark: '< 100ms for caching/microservices; < 250ms for relational database APIs.',
    formula: 'Sort all request latencies ascending: P90 = latency at index (N × 0.90)',
    icon: Gauge,
    accentColor: 'amber',
  },
  p50: {
    title: '50th Percentile / Median Latency (P50)',
    category: 'Latency Percentile',
    shortDesc: 'The middle response time — exactly 50% of requests were faster, and 50% were slower.',
    detailedDesc: 'P50 is the true median experience for an ordinary user, far more accurate than an average because it is immune to extreme outlier skew.',
    realWorldExample: 'If your P50 is 45ms and your average is 300ms, the typical user gets blazing-fast 45ms responses, but a few heavy queries are dragging the average up.',
    industryBenchmark: '< 50ms for internal APIs; < 100ms for public web APIs.',
    formula: 'Median value when all latencies are ordered sequentially.',
    icon: Clock,
    accentColor: 'cyan',
  },
  p99_9: {
    title: '99.9th Percentile Latency (P99.9)',
    category: 'Latency Percentile',
    shortDesc: 'Extreme outlier latency — the experience of 1 in every 1,000 requests (the "three nines").',
    detailedDesc: 'Critical for high-volume distributed systems (e.g. AWS, Stripe, Google) where handling millions of daily requests means thousands of users hit P99.9 daily.',
    realWorldExample: 'At 10,000 requests/sec, 10 requests every single second will experience the P99.9 latency. If P99.9 is 7.4s, 10 users per second experience severe freeze.',
    industryBenchmark: '< 500ms for financial/real-time systems; < 1,500ms for web applications.',
    formula: 'Sort all request latencies ascending: P99.9 = latency at index (N × 0.999)',
    icon: Gauge,
    accentColor: 'rose',
  },
  avg_latency: {
    title: 'Average Latency (Mean RTT)',
    category: 'Latency Percentile',
    shortDesc: 'The mathematical mean round-trip time for all completed requests.',
    detailedDesc: 'Calculated as the total elapsed response time divided by total requests. Helpful for general trend tracking, but always pair with P95/P99 to detect outlier spikes.',
    realWorldExample: 'If 9 requests take 10ms and 1 request takes 1,000ms, the average is 109ms. 90% of users had an instant experience, but the average suggests moderate slowness.',
    industryBenchmark: '< 100ms is high-performance; 100–300ms is standard; > 500ms indicates slow queries or network bottlenecks.',
    formula: 'Total sum of all latency times ÷ Total number of requests',
    icon: Clock,
    accentColor: 'emerald',
  },
  throughput: {
    title: 'Throughput (Requests Per Second - RPS)',
    category: 'Throughput',
    shortDesc: 'The rate of successful HTTP requests processed and returned every second.',
    detailedDesc: 'Measures the processing capacity of your server, application runtime, and database. Higher RPS with stable latency indicates healthy scalability.',
    realWorldExample: 'A ticketing website handling 150 RPS can serve ~9,000 page views every minute during a major concert on-sale event.',
    industryBenchmark: 'Node.js/Express JSON APIs typically handle 500–5,000 RPS on a single modern CPU core depending on database queries.',
    formula: 'Total Completed Requests ÷ Test Duration (seconds)',
    icon: Zap,
    accentColor: 'amber',
  },
  total_requests: {
    title: 'Total Requests Dispatched',
    category: 'Throughput',
    shortDesc: 'The cumulative count of HTTP requests generated across all concurrent connections.',
    detailedDesc: 'Represents the total workload load generated against the target endpoint during the benchmark session.',
    realWorldExample: 'Sending 1,350 requests over 10 seconds with 50 concurrent connections simulates 50 users simultaneously and repeatedly calling your API.',
    industryBenchmark: 'Run small smoke tests (1,000 reqs) in CI/CD pipelines and stress tests (50,000+ reqs) before production deployments.',
    formula: 'Sum of all completed, failed, and timed-out requests',
    icon: Activity,
    accentColor: 'cyan',
  },
  data_transferred: {
    title: 'Data Transferred / Bandwidth',
    category: 'Network',
    shortDesc: 'Total payload bytes (headers + response body) received over the wire.',
    detailedDesc: 'Monitors network egress consumption and compression efficiency (e.g. gzip, brotli). Uncompressed large payloads bottleneck throughput regardless of server CPU.',
    realWorldExample: 'Downloading 0.57 MB across 1,350 requests means each response is ~440 bytes. If this jumped to 500 KB per response, bandwidth would become the primary bottleneck.',
    industryBenchmark: 'Keep JSON API responses < 10 KB where possible; enable gzip compression on responses > 1 KB.',
    formula: 'Total HTTP payload bytes ÷ (1024 × 1024) for MB',
    icon: HardDrive,
    accentColor: 'purple',
  },
  success_rate: {
    title: 'HTTP Success Rate & Availability',
    category: 'Reliability',
    shortDesc: 'The percentage of requests that returned valid 2xx HTTP Success status codes.',
    detailedDesc: 'Separates healthy responses (200 OK, 201 Created) from errors (4xx client/auth errors, 5xx server crashes, or socket drops).',
    realWorldExample: 'A 4.4% success rate with 1,290 4xx errors means almost every request failed due to missing authorization headers or 404 Not Found paths.',
    industryBenchmark: 'Production APIs should maintain ≥ 99.9% success rate during standard traffic and ≥ 95% under maximum stress.',
    formula: '(2xx Responses ÷ Total Requests) × 100%',
    icon: ShieldCheck,
    accentColor: 'emerald',
  },
  sla_audit: {
    title: 'SLA Contract & Quality Gate Audit',
    category: 'Reliability',
    shortDesc: 'Automated pass/fail evaluation of performance requirements against contract thresholds.',
    detailedDesc: 'Evaluates whether your API meets strict Service Level Agreements (SLAs) such as Max P99 Latency, Max Error Rate, and Minimum RPS. Used in CI/CD deployment gates.',
    realWorldExample: 'If your contract demands P99 < 500ms and measured P99 is 5,462ms, the SLA audit fails and automatically prevents bad code from deploying to production.',
    industryBenchmark: 'Enterprise SLAs typically mandate 99.9% uptime, P99 < 500ms, and < 0.1% server error rates.',
    formula: 'Passed Contract Rules ÷ Total Defined Rules',
    icon: ShieldCheck,
    accentColor: 'amber',
  },
  status_codes: {
    title: 'HTTP Status Code Distribution',
    category: 'Reliability',
    shortDesc: 'Breakdown of HTTP response codes received during the benchmark.',
    detailedDesc: 'Categorized into 2xx (Success), 3xx (Redirects), 4xx (Client Errors like 401 Unauthorized or 404), 5xx (Server Crashes like 500 or 502), and Socket Errors (Connection reset / ECONNREFUSED).',
    realWorldExample: 'High 429 status codes indicate your rate limiter is triggering; high 504 status codes indicate upstream database or proxy timeouts.',
    industryBenchmark: 'Aim for 100% 2xx codes under normal load; 0% 5xx server errors.',
    formula: 'Count and percentage of responses grouped by HTTP status family.',
    icon: Activity,
    accentColor: 'cyan',
  },
  errors_timeouts: {
    title: 'Socket Errors & Timeouts',
    category: 'Reliability',
    shortDesc: 'Network level drops, connection timeouts, and reset sockets.',
    detailedDesc: 'Occurs when the server event loop is blocked, connection queues overflow (backlog limit reached), or the server fails to reply within the timeout deadline.',
    realWorldExample: '10 socket errors during a 50-connection burst means the Node.js server dropped 10 TCP connections because its backlog queue was saturated.',
    industryBenchmark: 'Zero socket timeouts allowed under rated capacity.',
    formula: 'Count of ETIMEDOUT, ECONNRESET, and ECONNREFUSED socket events.',
    icon: AlertTriangle,
    accentColor: 'rose',
  },
  connections: {
    title: 'Concurrent Connections',
    category: 'Concurrency',
    shortDesc: 'The number of parallel TCP socket connections maintained simultaneously.',
    detailedDesc: 'Simulates multiple users or microservices hitting the endpoint at the exact same moment. Tests thread/event-loop concurrency handling.',
    realWorldExample: 'Setting 50 connections simulates 50 active browser tabs or clients actively firing requests concurrently.',
    industryBenchmark: 'Standard microservices test between 20–200 concurrent connections.',
    formula: 'Active open TCP sockets in Autocannon pool.',
    icon: Zap,
    accentColor: 'amber',
  },
  pipelining: {
    title: 'HTTP Pipelining Factor',
    category: 'Concurrency',
    shortDesc: 'The number of requests sent over a single TCP socket before waiting for responses.',
    detailedDesc: 'Pipelining increases throughput on a single connection by packing multiple HTTP requests back-to-back without waiting for each individual response.',
    realWorldExample: 'A pipelining factor of 10 allows sending 10 requests in a burst down one connection, testing server buffer queuing.',
    industryBenchmark: 'Default is 1 (standard HTTP/1.1 request-response lifecycle).',
    formula: 'Number of in-flight requests per socket.',
    icon: Activity,
    accentColor: 'purple',
  },
};

export interface MetricInfoTooltipProps {
  metric: MetricType;
  className?: string;
  size?: number;
  label?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  showLabel?: boolean;
}

export function MetricInfoTooltip({
  metric,
  className,
  size = 13,
  label,
  position = 'auto',
  showLabel = false,
}: MetricInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({ top: 0, left: 0, placement: 'bottom' });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const def = METRIC_DEFINITIONS[metric];

  if (!def) return null;

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 340;
    const popoverHeight = 310;
    const padding = 12;

    let placement: 'top' | 'bottom' = 'bottom';
    let top = rect.bottom + 8;
    
    // If not enough room below, place above
    if (window.innerHeight - rect.bottom < popoverHeight && rect.top > popoverHeight) {
      placement = 'top';
      top = rect.top - 8;
    }

    // Horizontal positioning with collision detection
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < padding) left = padding;
    if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - padding - popoverWidth;
    }

    setCoords({ top, left, placement });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    updatePosition();
    setIsOpen(prev => !prev);
  };

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const IconComp = def.icon || Info;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={`Learn about ${def.title}`}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-full text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer p-0.5 hover:bg-cyan-500/10 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 select-none",
          isOpen && "text-cyan-400 bg-cyan-500/15 ring-1 ring-cyan-500/30",
          className
        )}
      >
        <Info size={size} className="shrink-0 stroke-[2.2]" />
        {showLabel && label && (
          <span className="text-[10px] font-mono font-medium">{label}</span>
        )}
      </button>

      {/* Floating Popover Portal */}
      <AnimatePresence>
        {isOpen && (
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: coords.placement === 'top' ? undefined : `${coords.top}px`,
              bottom: coords.placement === 'top' ? `${window.innerHeight - coords.top}px` : undefined,
              left: `${coords.left}px`,
              zIndex: 99999,
              width: '340px',
              pointerEvents: 'auto',
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            className="select-text"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: coords.placement === 'top' ? 6 : -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: coords.placement === 'top' ? 6 : -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-2xl p-4 font-sans text-xs space-y-3 backdrop-blur-md ring-1 ring-slate-200/50 dark:bg-[#0B0F19] dark:text-slate-200 dark:border-cyan-500/30 dark:ring-white/10 text-left"
            >
              {/* Popover Header */}
              <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                    def.accentColor === 'rose' && "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400",
                    def.accentColor === 'amber' && "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400",
                    def.accentColor === 'emerald' && "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400",
                    def.accentColor === 'cyan' && "bg-cyan-50 border-cyan-200 text-cyan-600 dark:bg-cyan-500/15 dark:border-cyan-500/30 dark:text-cyan-400",
                    def.accentColor === 'purple' && "bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-400"
                  )}>
                    <IconComp size={15} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs font-mono tracking-tight leading-tight">
                      {def.title}
                    </h4>
                    <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {def.category}
                    </span>
                  </div>
                </div>

                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono font-bold uppercase dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-700/60">
                  Metric Guide
                </span>
              </div>

              {/* Short Definition */}
              <div className="text-slate-800 dark:text-slate-300 text-[11.5px] leading-relaxed font-semibold">
                {def.shortDesc}
              </div>

              {/* Deep Explanation */}
              <div className="text-slate-700 dark:text-slate-400 text-[11px] leading-relaxed bg-slate-50 dark:bg-[#070A12] p-2.5 rounded-xl border border-slate-200 dark:border-slate-850">
                <div className="text-[9.5px] uppercase font-mono font-bold text-cyan-700 dark:text-cyan-400 mb-1 flex items-center gap-1">
                  <Sparkles size={11} /> What it measures
                </div>
                {def.detailedDesc}
              </div>

              {/* Real-World Example */}
              <div className="text-amber-950 dark:text-slate-300 text-[11px] leading-relaxed bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200 dark:border-amber-500/25">
                <div className="text-[9.5px] uppercase font-mono font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <Activity size={11} /> Real-World Example
                </div>
                {def.realWorldExample}
              </div>

              {/* Industry Benchmark Target */}
              <div className="flex items-start gap-2 text-[10.5px] text-slate-800 dark:text-slate-300 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/25">
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase text-[9.5px] block">
                    Target Standard
                  </span>
                  <span>{def.industryBenchmark}</span>
                </div>
              </div>

              {/* Formula if available */}
              {def.formula && (
                <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-bold">Calculation: </span>
                  <span className="text-slate-800 dark:text-slate-300">{def.formula}</span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
