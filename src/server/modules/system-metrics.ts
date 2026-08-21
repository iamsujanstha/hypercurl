import os from 'node:os';

export interface SystemHardwareSpecs {
  cpuCores: number;
  cpuModel: string;
  cpuSpeedMhz: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  usedMemoryBytes: number;
  memoryUsagePercent: number;
  loadAverage: number[];
  platform: string;
  arch: string;
  nodeVersion: string;
  uptimeSeconds: number;
  processUptimeSeconds: number;
  processMemory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
  };
}

export interface RequestSystemMetrics {
  cpuCores: number;
  cpuModel: string;
  cpuUserMs: number;
  cpuSystemMs: number;
  cpuTotalMs: number;
  cpuPercentEstimated: number;
  memoryHeapUsedBytes: number;
  memoryHeapTotalBytes: number;
  memoryRssBytes: number;
  memoryDeltaBytes: number;
  systemTotalMemoryBytes: number;
  systemFreeMemoryBytes: number;
  systemMemoryUsagePercent: number;
  timestamp: string;
}

export class SystemMetrics {
  static getSpecs(): SystemHardwareSpecs {
    const cpus = os.cpus() || [];
    const totalMem = os.totalmem() || 1;
    const freeMem = os.freemem() || 0;
    const usedMem = Math.max(0, totalMem - freeMem);
    const procMem = process.memoryUsage();

    return {
      cpuCores: cpus.length || 1,
      cpuModel: cpus[0]?.model || 'Host System CPU Core',
      cpuSpeedMhz: cpus[0]?.speed || 0,
      totalMemoryBytes: totalMem,
      freeMemoryBytes: freeMem,
      usedMemoryBytes: usedMem,
      memoryUsagePercent: Number(((usedMem / totalMem) * 100).toFixed(1)),
      loadAverage: os.loadavg() || [0, 0, 0],
      platform: `${os.type()} ${os.arch()}`,
      arch: os.arch(),
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(os.uptime()),
      processUptimeSeconds: Math.floor(process.uptime()),
      processMemory: {
        rssBytes: procMem.rss,
        heapTotalBytes: procMem.heapTotal,
        heapUsedBytes: procMem.heapUsed,
        externalBytes: procMem.external
      }
    };
  }

  static createRequestSnapshot(
    startCpu: NodeJS.CpuUsage,
    startMem: NodeJS.MemoryUsage,
    responseTimeMs: number
  ): RequestSystemMetrics {
    const cpuDelta = process.cpuUsage(startCpu);
    const endMem = process.memoryUsage();
    const cpus = os.cpus() || [];
    const totalMem = os.totalmem() || 1;
    const freeMem = os.freemem() || 0;
    const usedMem = Math.max(0, totalMem - freeMem);

    const cpuUserMs = Number((cpuDelta.user / 1000).toFixed(2));
    const cpuSystemMs = Number((cpuDelta.system / 1000).toFixed(2));
    const cpuTotalMs = Number((cpuUserMs + cpuSystemMs).toFixed(2));

    const coreCount = cpus.length || 1;
    // Estimated computation load % relative to request wall-clock response time
    const rawCpuPct = responseTimeMs > 0 ? ((cpuTotalMs / responseTimeMs) * 100) / coreCount : 0;
    const cpuPercentEstimated = Number(Math.min(100, Math.max(0.1, rawCpuPct)).toFixed(1));

    return {
      cpuCores: coreCount,
      cpuModel: cpus[0]?.model || 'System CPU',
      cpuUserMs,
      cpuSystemMs,
      cpuTotalMs,
      cpuPercentEstimated,
      memoryHeapUsedBytes: endMem.heapUsed,
      memoryHeapTotalBytes: endMem.heapTotal,
      memoryRssBytes: endMem.rss,
      memoryDeltaBytes: endMem.heapUsed - startMem.heapUsed,
      systemTotalMemoryBytes: totalMem,
      systemFreeMemoryBytes: freeMem,
      systemMemoryUsagePercent: Number(((usedMem / totalMem) * 100).toFixed(1)),
      timestamp: new Date().toISOString()
    };
  }
}
