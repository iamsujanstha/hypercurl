import { AssertionRule, AssertionResult } from './types';
import { validateJsonSchema } from './utils/schemaValidator';

export function evaluateAssertions(result: any, rules: AssertionRule[] = []): AssertionResult[] {
  if (!result || !rules || rules.length === 0) return [];
  
  return rules.map(rule => {
    let passed = false;
    let actual = '';
    let expected = rule.value || '';
    let error = '';
    let path = rule.extra || '';

    try {
      switch (rule.type) {
        case 'status':
        case 'status_range': {
          actual = String(result.status);
          if (expected.toLowerCase().endsWith('xx')) {
            const prefix = expected.substring(0, 1);
            passed = String(result.status).startsWith(prefix);
          } else {
            passed = String(result.status) === expected;
          }
          break;
        }

        case 'latency': {
          actual = `${result.responseTime}ms`;
          const expectedMs = parseInt(expected.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(expectedMs)) {
            passed = result.responseTime <= expectedMs;
          } else {
            passed = true;
          }
          break;
        }

        case 'response_size': {
          const bodyBytes = result.body ? new TextEncoder().encode(result.body).length : 0;
          actual = `${bodyBytes} B`;
          const expectedBytes = parseInt(expected.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(expectedBytes)) {
            passed = bodyBytes <= expectedBytes;
          } else {
            passed = true;
          }
          break;
        }

        case 'body_contains': {
          const bodyText = result.body || '';
          actual = bodyText.length > 60 ? bodyText.substring(0, 60) + '...' : bodyText;
          passed = bodyText.includes(expected);
          break;
        }

        case 'body_not_contains': {
          const bodyText = result.body || '';
          actual = bodyText.length > 60 ? bodyText.substring(0, 60) + '...' : bodyText;
          passed = !bodyText.includes(expected);
          break;
        }

        case 'regex_matches': {
          const bodyText = result.body || '';
          try {
            const regex = new RegExp(expected);
            passed = regex.test(bodyText);
            actual = passed ? 'Matches regex pattern' : 'Does not match pattern';
          } catch (e: any) {
            passed = false;
            error = `Invalid regex syntax: ${e.message}`;
          }
          break;
        }

        case 'header_matches': {
          const headerName = (rule.extra || '').toLowerCase();
          const headers = result.headers || {};
          actual = headers[headerName] || '';
          passed = actual.toLowerCase().includes(expected.toLowerCase());
          break;
        }

        case 'type_check': {
          const jsonPath = (rule.extra || '$').trim();
          const bodyText = result.body || '';
          try {
            const parsed = JSON.parse(bodyText);
            const val = resolveJsonPathValue(parsed, jsonPath);
            const actualType = getValType(val);
            actual = actualType;
            passed = actualType.toLowerCase() === expected.toLowerCase();
          } catch (e: any) {
            passed = false;
            error = `Failed to parse JSON for type check: ${e.message}`;
          }
          break;
        }

        case 'json_path': {
          const jsonPath = (rule.extra || '').trim();
          const bodyText = result.body || '';
          actual = 'N/A';
          try {
            const parsed = JSON.parse(bodyText);
            const val = resolveJsonPathValue(parsed, jsonPath);

            if (val === undefined) {
              passed = false;
              actual = 'undefined';
              error = `Path '${jsonPath}' not found in response JSON`;
            } else {
              actual = typeof val === 'object' ? JSON.stringify(val) : String(val);

              // 1. Existence check
              if (expected === '*' || expected === '' || expected.toLowerCase() === 'exists') {
                passed = true;
              }
              // 2. Length check (e.g. length > 0)
              else if (expected.startsWith('length')) {
                const len = Array.isArray(val) ? val.length : (typeof val === 'string' ? val.length : Object.keys(val || {}).length);
                actual = `length: ${len}`;
                if (expected.includes('>')) {
                  const target = parseInt(expected.split('>')[1].trim(), 10);
                  passed = len > target;
                } else if (expected.includes('==') || expected.includes('=')) {
                  const target = parseInt(expected.split('=')[1].trim(), 10);
                  passed = len === target;
                } else {
                  passed = len > 0;
                }
              }
              // 3. String contains (e.g. contains "@")
              else if (expected.startsWith('contains')) {
                const searchStr = expected.replace('contains', '').trim().replace(/^["']|["']$/g, '');
                passed = String(val).includes(searchStr);
              }
              // 4. Exact equality match
              else {
                // Strip quotes if user entered "active" or 'active'
                const cleanExpected = expected.replace(/^["']|["']$/g, '');
                passed = String(val) === cleanExpected || String(val) === expected;
              }
            }
          } catch (e: any) {
            passed = false;
            error = `Invalid JSON response: ${e.message}`;
          }
          break;
        }

        case 'json_schema': {
          const bodyText = result.body || '';
          const schemaStr = rule.extra || rule.value || '{}';
          try {
            const data = JSON.parse(bodyText);
            const schema = JSON.parse(schemaStr);
            const validation = validateJsonSchema(data, schema);
            passed = validation.valid;
            if (validation.valid) {
              actual = 'Valid Schema';
            } else {
              const firstErr = validation.errors[0];
              actual = `Invalid (${validation.errors.length} errors)`;
              error = validation.errors.map(e => `${e.path}: ${e.message}`).join('; ');
              path = firstErr?.path || '$';
            }
          } catch (e: any) {
            passed = false;
            error = `Schema parsing error: ${e.message}`;
          }
          break;
        }

        case 'graphql_no_errors': {
          const bodyText = result.body || '';
          actual = 'N/A';
          try {
            const parsed = JSON.parse(bodyText);
            if (parsed && typeof parsed === 'object') {
              const hasErrors = Array.isArray(parsed.errors) && parsed.errors.length > 0;
              passed = !hasErrors;
              actual = hasErrors ? `${parsed.errors.length} error(s)` : 'No errors';
              if (hasErrors) {
                error = JSON.stringify(parsed.errors);
              }
            } else {
              passed = false;
              error = 'Response is not a valid JSON object';
            }
          } catch (e: any) {
            passed = false;
            error = `Invalid GraphQL JSON body: ${e.message}`;
          }
          break;
        }

        default:
          passed = true;
          break;
      }
    } catch (e: any) {
      passed = false;
      error = e.message;
    }

    return {
      ruleId: rule.id,
      type: rule.type,
      passed,
      actual,
      expected,
      error,
      path
    };
  });
}

function resolveJsonPathValue(obj: any, path: string): any {
  if (!path || path === '$' || path === '.') return obj;
  const cleanPath = path.startsWith('$.') ? path.substring(2) : (path.startsWith('$') ? path.substring(1) : path);
  if (!cleanPath) return obj;

  // Split by dots and array indices like users[0].id
  const segments = cleanPath.replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean);
  let curr = obj;

  for (const seg of segments) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    curr = curr[seg];
  }

  return curr;
}

function getValType(val: any): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}
