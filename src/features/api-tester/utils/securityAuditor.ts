import { CurlResult } from '@/server/modules/curl-engine';
import { SecurityAuditCheck, SecurityAuditReport } from '../types';

/**
 * Lightweight & Non-Destructive API Security Auditor
 * Performs passive security hygiene checks on real HTTP responses.
 */
export function auditResponseSecurity(result: CurlResult): SecurityAuditReport {
  const checks: SecurityAuditCheck[] = [];
  const headers = result.headers || {};
  const lowerHeaders: Record<string, string> = {};
  Object.keys(headers).forEach(k => {
    lowerHeaders[k.toLowerCase()] = headers[k];
  });

  const url = result.config?.url || '';
  const isHttps = url.toLowerCase().startsWith('https://');
  const bodyText = result.body || '';

  // 1. Transport Security (HTTPS)
  checks.push({
    id: 'sec-transport-https',
    title: 'Transport Layer Encryption (HTTPS)',
    category: 'transport',
    severity: isHttps ? 'low' : 'high',
    passed: isHttps,
    actual: isHttps ? 'HTTPS in use' : 'Insecure HTTP plain-text detected',
    recommendation: isHttps ? 'Encrypted in transit.' : 'Migrate endpoint to TLS/HTTPS to protect headers and payload against interception.'
  });

  // 2. Strict-Transport-Security (HSTS)
  const hasHsts = Boolean(lowerHeaders['strict-transport-security']);
  checks.push({
    id: 'sec-header-hsts',
    title: 'Strict-Transport-Security (HSTS)',
    category: 'headers',
    severity: 'medium',
    passed: !isHttps ? true : hasHsts,
    actual: hasHsts ? lowerHeaders['strict-transport-security'] : 'Missing HSTS header',
    recommendation: hasHsts 
      ? 'HSTS header configured.' 
      : 'Send "Strict-Transport-Security: max-age=31536000; includeSubDomains" on HTTPS endpoints to prevent downgrade attacks.'
  });

  // 3. Content-Type Options (nosniff)
  const xcto = lowerHeaders['x-content-type-options'];
  const hasXcto = xcto && xcto.toLowerCase().includes('nosniff');
  checks.push({
    id: 'sec-header-xcto',
    title: 'X-Content-Type-Options: nosniff',
    category: 'headers',
    severity: 'low',
    passed: Boolean(hasXcto),
    actual: xcto || 'Missing',
    recommendation: hasXcto 
      ? 'MIME-sniffing protection active.' 
      : 'Include "X-Content-Type-Options: nosniff" to prevent browsers from interpreting non-executable response types as scripts.'
  });

  // 4. Frame Options / Anti-Clickjacking
  const xfo = lowerHeaders['x-frame-options'];
  const csp = lowerHeaders['content-security-policy'];
  const hasAntiClickjacking = Boolean(xfo || (csp && csp.includes('frame-ancestors')));
  checks.push({
    id: 'sec-header-clickjacking',
    title: 'Clickjacking Protection (X-Frame-Options / CSP)',
    category: 'headers',
    severity: 'medium',
    passed: hasAntiClickjacking,
    actual: xfo || (csp ? 'CSP frame-ancestors present' : 'Missing frame restrictions'),
    recommendation: hasAntiClickjacking 
      ? 'Frame restrictions defined.' 
      : 'Add "X-Frame-Options: DENY" or CSP "frame-ancestors \'none\'" if this API returns HTML content.'
  });

  // 5. Server Header Version Disclosure
  const serverHeader = lowerHeaders['server'];
  const xPoweredBy = lowerHeaders['x-powered-by'];
  const hasVerboseServer = (serverHeader && /\d+\.\d+/.test(serverHeader)) || Boolean(xPoweredBy);
  checks.push({
    id: 'sec-disclosure-server',
    title: 'Technology & Version Fingerprinting Disclosure',
    category: 'disclosure',
    severity: 'low',
    passed: !hasVerboseServer,
    actual: hasVerboseServer 
      ? `Disclosed: ${[serverHeader, xPoweredBy ? `X-Powered-By: ${xPoweredBy}` : ''].filter(Boolean).join('; ')}`
      : 'Clean (no exact version numbers exposed)',
    recommendation: !hasVerboseServer 
      ? 'No technology version leaks detected.' 
      : 'Suppress "Server" version numbers and remove "X-Powered-By" to prevent attackers from querying specific CVE vulnerability databases.'
  });

  // 6. Sensitive Secret Leak Patterns in Response Body
  const sensitivePatterns = [
    { name: 'Private Key', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i },
    { name: 'AWS Secret Key / Access Key', regex: /(AKIA[0-9A-Z]{16})|(aws_secret_access_key)/i },
    { name: 'Database Password URL', regex: /postgres:\/\/[^:]+:([^@]+)@|mongodb(\+srv)?:\/\/[^:]+:([^@]+)@/i },
    { name: 'GitHub Personal Token', regex: /ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82}/i },
    { name: 'Slack / Discord Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/|https:\/\/discord\.com\/api\/webhooks\//i }
  ];

  let detectedSecret: string | null = null;
  for (const pat of sensitivePatterns) {
    if (pat.regex.test(bodyText)) {
      detectedSecret = pat.name;
      break;
    }
  }

  checks.push({
    id: 'sec-leak-credentials',
    title: 'Sensitive Secret & Credential Leak Detection',
    category: 'leak',
    severity: 'high',
    passed: !detectedSecret,
    actual: detectedSecret ? `Potential ${detectedSecret} detected in body!` : 'No hardcoded private keys or access tokens detected in body.',
    recommendation: !detectedSecret 
      ? 'Clean payload.' 
      : 'Audit response body immediately to ensure private credentials and tokens are not accidentally returned to clients.'
  });

  // 7. Stack Trace / Verbose Error Leak Detection (e.g. at .../node_modules/...)
  const hasStackTrace = /(at [a-zA-Z0-9_$.]+\s+\([^)]+:\d+:\d+\))|(\bFile "[^"]+", line \d+, in \w+)|(Traceback \(most recent call last\):)/.test(bodyText);
  checks.push({
    id: 'sec-disclosure-stacktrace',
    title: 'Stack Trace & Debugging Exposure',
    category: 'disclosure',
    severity: 'medium',
    passed: !hasStackTrace,
    actual: hasStackTrace ? 'Stack trace fragments detected in response' : 'No raw stack traces detected',
    recommendation: !hasStackTrace 
      ? 'Clean error handling.' 
      : 'Ensure production error handlers return sanitized JSON messages instead of internal code paths, line numbers, or raw stack traces.'
  });

  const passedCount = checks.filter(c => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return {
    score,
    passedChecks: passedCount,
    totalChecks: checks.length,
    checks
  };
}
