import { v4 as uuidv4 } from 'uuid';

/**
 * Enterprise-grade variable interpolation engine supporting:
 * 1. User-defined environment variables: {{BASE_URL}}, {{API_KEY}}
 * 2. Postman & JMeter standard dynamic mock variables:
 *    - {{$randomUUID}} or {{$guid}}: Generates a unique UUID v4
 *    - {{$timestamp}}: Current Unix timestamp in seconds
 *    - {{$isoTimestamp}}: Current ISO-8601 UTC timestamp string
 *    - {{$randomInt}}: Random integer between 1 and 1000
 *    - {{$randomEmail}}: Realistic randomized test email address
 *    - {{$randomUserName}} / {{$randomName}}: Random test username
 *    - {{$randomAlphaNumeric}}: Random 8-character alphanumeric string
 *    - {{$randomPrice}} / {{$randomFloat}}: Random float / price string
 *    - {{$randomBoolean}}: Random boolean ('true' or 'false')
 */

const FIRST_NAMES = ['alex', 'jordan', 'taylor', 'morgan', 'casey', 'sam', 'riley', 'cameron', 'dakota', 'devon'];
const LAST_NAMES = ['chen', 'smith', 'patel', 'kumar', 'miller', 'rossi', 'garcia', 'novak', 'tanaka', 'dubois'];
const DOMAINS = ['example.com', 'hypercurl.test', 'qa-benchmark.org', 'test-api.io'];

export function generateDynamicMockValue(key: string, context?: { iteration?: number }): string | null {
  const normalized = key.toLowerCase();
  
  if (normalized === '$iteration' && context?.iteration !== undefined) {
    return context.iteration.toString();
  }
  if (normalized === '$randomuuid' || normalized === '$guid') {
    return uuidv4();
  }
  if (normalized === '$timestamp') {
    return Math.floor(Date.now() / 1000).toString();
  }
  if (normalized === '$isotimestamp') {
    return new Date().toISOString();
  }
  if (normalized === '$randomint') {
    return Math.floor(Math.random() * 1000 + 1).toString();
  }
  if (normalized === '$randomemail') {
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const rand = Math.floor(Math.random() * 900 + 100);
    const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
    return `${fn}.${ln}${rand}@${domain}`;
  }
  if (normalized === '$randomusername' || normalized === '$randomname') {
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const rand = Math.floor(Math.random() * 900 + 100);
    return `${fn}_qa_${rand}`;
  }
  if (normalized === '$randomalphanumeric') {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  if (normalized === '$randomprice' || normalized === '$randomfloat') {
    return (Math.random() * 100 + 5).toFixed(2);
  }
  if (normalized === '$randomboolean') {
    return Math.random() > 0.5 ? 'true' : 'false';
  }

  return null;
}

export function interpolateVariables(
  template: string,
  variables: Record<string, string> = {},
  context?: { iteration?: number, preserveDynamic?: boolean }
): string {
  if (!template || typeof template !== 'string') return template || '';

  // Replace {{var}} patterns with support for user vars & dynamic mock generators
  return template.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();

    // 1. Check for dynamic mock generators (e.g. {{$randomUUID}})
    if (key.startsWith('$')) {
      if (context?.preserveDynamic) {
        return match; // Leave untouched for server to resolve later
      }
      const dynamicVal = generateDynamicMockValue(key, context);
      if (dynamicVal !== null) {
        return dynamicVal;
      }
    }

    // 2. Check user-defined variables
    if (key in variables && variables[key] !== undefined) {
      return variables[key];
    }

    // 3. Fallback: match without leading/trailing whitespace or case-insensitive check in user vars
    const foundKey = Object.keys(variables).find(k => k.toLowerCase() === key.toLowerCase());
    if (foundKey && variables[foundKey] !== undefined) {
      return variables[foundKey];
    }

    // Return original match if variable cannot be resolved
    return match;
  });
}
