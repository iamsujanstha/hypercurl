import { TestSuite } from '../types';

export const DEFAULT_TEST_SUITES: TestSuite[] = [
  {
    id: 'suite-smoke-health',
    name: 'API Health & Smoke Suite',
    description: 'Verifies core server status, system specs telemetry, and historical audit endpoints with SLA boundaries.',
    category: 'smoke',
    stopOnFailure: false,
    steps: [
      {
        id: 'step-health-check',
        name: 'Server Health Check Probe',
        method: 'GET',
        url: 'http://localhost:3000/api/health',
        headersList: [
          { id: 'h1', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a1', type: 'status', value: '200' },
          { id: 'a2', type: 'latency', value: '250' },
          { id: 'a3', type: 'json_path', extra: 'status', value: 'ok' },
          { id: 'a4', type: 'header_matches', extra: 'content-type', value: 'application/json' }
        ],
        extractors: []
      },
      {
        id: 'step-system-specs',
        name: 'Hardware & OS Specs Telemetry',
        method: 'GET',
        url: 'http://localhost:3000/api/system/specs',
        headersList: [
          { id: 'h2', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a5', type: 'status', value: '200' },
          { id: 'a6', type: 'latency', value: '350' },
          { id: 'a7', type: 'json_path', extra: 'platform', value: '*' }
        ],
        extractors: [
          { id: 'e1', jsonPath: 'platform', variableName: 'serverPlatform' }
        ]
      },
      {
        id: 'step-history-audit',
        name: 'Audit Logs & History Store',
        method: 'GET',
        url: 'http://localhost:3000/api/history',
        headersList: [
          { id: 'h3', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a8', type: 'status', value: '200' },
          { id: 'a9', type: 'header_matches', extra: 'content-type', value: 'application/json' }
        ],
        extractors: []
      }
    ]
  },
  {
    id: 'suite-crud-collections',
    name: 'CRUD Collections & Storage Lifecycle',
    description: 'Tests automated entity creation, variable extraction, persistence retrieval, and collection integrity.',
    category: 'crud',
    stopOnFailure: true,
    steps: [
      {
        id: 'step-create-collection',
        name: '1. Create Test Collection',
        method: 'POST',
        url: 'http://localhost:3000/api/collections',
        headersList: [
          { id: 'h4', key: 'Content-Type', value: 'application/json', enabled: true }
        ],
        bodyType: 'json',
        body: JSON.stringify({
          id: 'col-automated-test',
          name: 'Automated Test Suite Collection',
          requests: [
            {
              id: 'req-1',
              name: 'Ping Request',
              url: 'http://localhost:3000/api/health',
              method: 'GET',
              headers: {},
              headersList: []
            }
          ]
        }, null, 2),
        assertions: [
          { id: 'a10', type: 'status', value: '200' },
          { id: 'a11', type: 'latency', value: '400' },
          { id: 'a12', type: 'json_path', extra: 'success', value: 'true' }
        ],
        extractors: []
      },
      {
        id: 'step-verify-collections',
        name: '2. Verify Collection In Store',
        method: 'GET',
        url: 'http://localhost:3000/api/collections',
        headersList: [
          { id: 'h5', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a13', type: 'status', value: '200' },
          { id: 'a14', type: 'body_contains', value: 'Automated Test Suite Collection' }
        ],
        extractors: []
      }
    ]
  },
  {
    id: 'suite-order-atomic',
    name: 'Transactional Balance & Order Flow',
    description: 'Tests ledger balance query, order placement execution, and remaining funds verification.',
    category: 'regression',
    stopOnFailure: true,
    steps: [
      {
        id: 'step-reset-demo',
        name: '1. Reset Balance State',
        method: 'POST',
        url: 'http://localhost:3000/api/race-demo/reset',
        headersList: [
          { id: 'h6', key: 'Content-Type', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a15', type: 'status', value: '200' },
          { id: 'a16', type: 'json_path', extra: 'status', value: 'system_reset' }
        ],
        extractors: [
          { id: 'e2', jsonPath: 'balance', variableName: 'initialBalance' }
        ]
      },
      {
        id: 'step-place-order',
        name: '2. Execute Order Transaction',
        method: 'POST',
        url: 'http://localhost:3000/api/orders/fixed/place',
        headersList: [
          { id: 'h7', key: 'Content-Type', value: 'application/json', enabled: true }
        ],
        bodyType: 'json',
        body: JSON.stringify({ amount: 50 }, null, 2),
        assertions: [
          { id: 'a17', type: 'status', value: '200' },
          { id: 'a18', type: 'json_path', extra: 'success', value: 'true' },
          { id: 'a19', type: 'json_path', extra: 'amount', value: '50' }
        ],
        extractors: [
          { id: 'e3', jsonPath: 'remaining', variableName: 'remainingBalance' }
        ]
      },
      {
        id: 'step-verify-balance',
        name: '3. Verify Updated Balance',
        method: 'GET',
        url: 'http://localhost:3000/api/race-demo/balance',
        headersList: [
          { id: 'h8', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a20', type: 'status', value: '200' },
          { id: 'a21', type: 'json_path', extra: 'balance', value: '950' }
        ],
        extractors: []
      }
    ]
  },
  {
    id: 'suite-rate-limiting-sla',
    name: 'Rate Limiting & SLA Thresholds',
    description: 'Validates rate limit responses, client IP proxy headers, and latency bounds under rapid invocation.',
    category: 'sla',
    stopOnFailure: false,
    steps: [
      {
        id: 'step-rate-limit-1',
        name: '1. Rate Limit Probe (Pass)',
        method: 'GET',
        url: 'http://localhost:3000/api/demo/rate-limited',
        headersList: [
          { id: 'h9', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a22', type: 'status', value: '200' },
          { id: 'a23', type: 'latency', value: '150' },
          { id: 'a24', type: 'json_path', extra: 'success', value: 'true' }
        ],
        extractors: []
      },
      {
        id: 'step-health-sla',
        name: '2. SLA Latency Strict Gate (< 100ms)',
        method: 'GET',
        url: 'http://localhost:3000/api/health',
        headersList: [
          { id: 'h10', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a25', type: 'status', value: '200' },
          { id: 'a26', type: 'latency', value: '100' }
        ],
        extractors: []
      }
    ]
  }
];
