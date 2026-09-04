import { v4 as uuidv4 } from 'uuid';
import { HttpMethod, BodyType, KeyValuePair, AuthConfig } from '../types';

export interface ParsedCurlOutput {
  url: string;
  method: HttpMethod;
  headersList: KeyValuePair[];
  bodyType: BodyType;
  body?: string;
  authConfig?: AuthConfig;
  queryParams: KeyValuePair[];
}

/**
 * Robust cURL command parser
 * Handles single quotes, double quotes, line continuations (\), flags:
 * -X / --request
 * -H / --header
 * -d / --data / --data-raw / --data-binary / --data-urlencode
 * -u / --user (Basic Auth)
 * -A / --user-agent
 * Bearer token detection
 */
export function parseCurlCommand(rawCurl: string): ParsedCurlOutput {
  if (!rawCurl || typeof rawCurl !== 'string') {
    return {
      url: '',
      method: 'GET',
      headersList: [],
      bodyType: 'none',
      queryParams: []
    };
  }

  // Normalize multi-line continuations
  const cleaned = rawCurl
    .replace(/\\\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Tokenize preserving quotes
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (isEscaped) {
      current += ch;
      isEscaped = false;
      continue;
    }

    if (ch === '\\' && !inSingleQuote) {
      isEscaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (ch === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  let method: HttpMethod = 'GET';
  let url = '';
  const headersList: KeyValuePair[] = [];
  let body = '';
  let bodyType: BodyType = 'none';
  let authConfig: AuthConfig | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1] || '';

    if (token === 'curl') continue;

    // Method flag: -X or --request
    if (token === '-X' || token === '--request') {
      const m = nextToken.toUpperCase();
      if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(m)) {
        method = m as HttpMethod;
      }
      i++;
      continue;
    }

    // Headers flag: -H or --header
    if (token === '-H' || token === '--header') {
      const separatorIdx = nextToken.indexOf(':');
      if (separatorIdx > 0) {
        const headerKey = nextToken.substring(0, separatorIdx).trim();
        const headerVal = nextToken.substring(separatorIdx + 1).trim();

        // Check for Bearer Token
        if (headerKey.toLowerCase() === 'authorization' && headerVal.toLowerCase().startsWith('bearer ')) {
          authConfig = {
            type: 'bearer',
            bearerToken: headerVal.substring(7).trim()
          };
        } else if (headerKey.toLowerCase() === 'authorization' && headerVal.toLowerCase().startsWith('basic ')) {
          try {
            const decoded = atob(headerVal.substring(6).trim());
            const [u, p] = decoded.split(':');
            authConfig = {
              type: 'basic',
              basicAuth: { username: u || '', password: p || '' }
            };
          } catch {
            headersList.push({ id: uuidv4(), key: headerKey, value: headerVal, enabled: true });
          }
        } else {
          headersList.push({ id: uuidv4(), key: headerKey, value: headerVal, enabled: true });
        }
      }
      i++;
      continue;
    }

    // User-Agent flag: -A or --user-agent
    if (token === '-A' || token === '--user-agent') {
      headersList.push({ id: uuidv4(), key: 'User-Agent', value: nextToken, enabled: true });
      i++;
      continue;
    }

    // Basic Auth flag: -u or --user
    if (token === '-u' || token === '--user') {
      const parts = nextToken.split(':');
      authConfig = {
        type: 'basic',
        basicAuth: {
          username: parts[0] || '',
          password: parts[1] || ''
        }
      };
      i++;
      continue;
    }

    // Data / Body flags
    if (['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode', '--data-ascii'].includes(token)) {
      body = nextToken;
      if (method === 'GET') {
        method = 'POST';
      }
      i++;
      continue;
    }

    // URL token (starts with http:// or https:// or has no leading flag)
    if (!token.startsWith('-') && (token.startsWith('http://') || token.startsWith('https://') || token.includes('/'))) {
      if (!url) {
        url = token;
      }
    }
  }

  // Parse Query Parameters from URL
  const queryParams: KeyValuePair[] = [];
  let baseUrlOnly = url;
  try {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.forEach((val, key) => {
        queryParams.push({ id: uuidv4(), key, value: val, enabled: true });
      });
      // Retain the query params in the list
    }
  } catch (err) {}

  // Determine body type
  if (body) {
    const isJsonHeader = headersList.some(h => h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().includes('json'));
    let isJsonSyntax = false;
    try {
      JSON.parse(body);
      isJsonSyntax = true;
    } catch {}

    if (isJsonHeader || isJsonSyntax) {
      bodyType = 'json';
    } else if (body.includes('&') && body.includes('=')) {
      bodyType = 'form';
    } else if (body.startsWith('<') && body.endsWith('>')) {
      bodyType = 'xml';
    } else {
      bodyType = 'raw';
    }
  }

  return {
    url,
    method,
    headersList,
    bodyType,
    body,
    authConfig,
    queryParams
  };
}
