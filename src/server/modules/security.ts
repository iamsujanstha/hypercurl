import { Request, Response, NextFunction } from 'express';

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
}

export class SecurityGuard {
  // Disallowed internal IP patterns and cloud metadata services
  private static BLOCKED_HOSTNAMES = [
    '169.254.169.254',             // AWS / GCP / Azure Instance Metadata Service (IMDSv1/v2)
    'metadata.google.internal',     // GCP Metadata hostname
    'instance-data',                // OpenStack / AWS alternate hostname
    '169.254.170.2',                // AWS ECS task metadata
    'fd00:ec2::254',                // AWS IPv6 IMDS
  ];

  private static BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'gopher:', 'php:', 'data:', 'javascript:', 'dict:', 'ldap:', 'jar:'];

  /**
   * Validates target URL against SSRF threats and protocol abuse
   */
  static validateTargetUrl(rawUrl: string): SecurityCheckResult {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { allowed: false, reason: 'URL is required and must be a valid string.' };
    }

    const trimmed = rawUrl.trim();

    try {
      const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `http://${trimmed}`);
      
      const protocol = parsed.protocol.toLowerCase();
      if (!['http:', 'https:'].includes(protocol)) {
        return { allowed: false, reason: `Protocol '${protocol}' is forbidden. Only HTTP and HTTPS are permitted.` };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Check blocked metadata hosts
      if (this.BLOCKED_HOSTNAMES.includes(hostname)) {
        return { allowed: false, reason: `Access to cloud infrastructure metadata host (${hostname}) is strictly blocked for security (SSRF prevention).` };
      }

      // Check link-local IP range (169.254.0.0/16)
      if (/^169\.254\.\d+\.\d+$/.test(hostname)) {
        return { allowed: false, reason: `Link-local IP range (${hostname}) is blocked (SSRF prevention).` };
      }

      // Check IPv6 link-local (fe80::/10)
      if (hostname.startsWith('fe80:') || hostname.startsWith('[fe80:')) {
        return { allowed: false, reason: 'IPv6 link-local addresses are blocked.' };
      }

      return { allowed: true };
    } catch (e: any) {
      return { allowed: false, reason: `Invalid URL format: ${e.message}` };
    }
  }

  /**
   * Enforces hard limits on autocannon load testing parameters to prevent DoS abuse
   */
  static sanitizeAutocannonConfig(config: any): { sanitized: any; warnings: string[] } {
    const warnings: string[] = [];
    const sanitized = { ...config };

    // Max duration: 120 seconds
    const MAX_DURATION = 120;
    if (sanitized.duration && sanitized.duration > MAX_DURATION) {
      warnings.push(`Duration reduced from ${sanitized.duration}s to maximum allowed limit (${MAX_DURATION}s).`);
      sanitized.duration = MAX_DURATION;
    }

    // Max connections: 1,000 sockets
    const MAX_CONNECTIONS = 1000;
    if (sanitized.connections && sanitized.connections > MAX_CONNECTIONS) {
      warnings.push(`Connections reduced from ${sanitized.connections} to maximum allowed limit (${MAX_CONNECTIONS}).`);
      sanitized.connections = MAX_CONNECTIONS;
    }

    // Max pipelining: 32
    const MAX_PIPELINING = 32;
    if (sanitized.pipelining && sanitized.pipelining > MAX_PIPELINING) {
      warnings.push(`Pipelining factor reduced from ${sanitized.pipelining} to maximum limit (${MAX_PIPELINING}).`);
      sanitized.pipelining = MAX_PIPELINING;
    }

    return { sanitized, warnings };
  }

  /**
   * Rate limiting tracker for load testing triggers (max 10 starts per minute per IP)
   */
  private static ipLoadTestTimestamps = new Map<string, number[]>();

  static checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    const timestamps = (this.ipLoadTestTimestamps.get(ip) || []).filter(t => t > oneMinuteAgo);
    
    // Max 15 runs per minute per IP
    if (timestamps.length >= 15) {
      return false;
    }

    timestamps.push(now);
    this.ipLoadTestTimestamps.set(ip, timestamps);
    return true;
  }
}
