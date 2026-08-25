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
    id: 'suite-autocannon-integration',
    name: 'Autocannon Benchmark REST Engine',
    description: 'Validates automated programmatic invocation of the Autocannon engine and audit logging verification.',
    category: 'regression',
    stopOnFailure: true,
    steps: [
      {
        id: 'step-run-benchmark',
        name: '1. Execute Programmatic Benchmark',
        method: 'POST',
        url: 'http://localhost:3000/api/autocannon/run',
        headersList: [
          { id: 'h6', key: 'Content-Type', value: 'application/json', enabled: true }
        ],
        bodyType: 'json',
        body: JSON.stringify({
          url: 'http://localhost:3000/api/health',
          connections: 10,
          duration: 2,
          pipelining: 1
        }, null, 2),
        assertions: [
          { id: 'a15', type: 'status', value: '200' },
          { id: 'a16', type: 'json_path', extra: 'duration', value: '*' }
        ],
        extractors: [
          { id: 'e2', jsonPath: 'totalRequests', variableName: 'benchmarkTotalRequests' }
        ]
      },
      {
        id: 'step-verify-audit',
        name: '2. Verify Audit History Logged',
        method: 'GET',
        url: 'http://localhost:3000/api/history',
        headersList: [
          { id: 'h7', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a17', type: 'status', value: '200' },
          { id: 'a18', type: 'header_matches', extra: 'content-type', value: 'application/json' }
        ],
        extractors: []
      }
    ]
  },
  {
    id: 'suite-public-api-chaining',
    name: 'End-to-End Dynamic Variable Chaining',
    description: 'Demonstrates real-world sequential API testing by fetching an initial record and chaining extracted identifiers.',
    category: 'e2e',
    stopOnFailure: true,
    steps: [
      {
        id: 'step-fetch-todo',
        name: '1. Fetch Primary Todo Record',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos/1',
        headersList: [
          { id: 'h9', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a22', type: 'status', value: '200' },
          { id: 'a23', type: 'json_path', extra: 'id', value: '1' }
        ],
        extractors: [
          { id: 'e4', jsonPath: 'userId', variableName: 'linkedUserId' }
        ]
      },
      {
        id: 'step-fetch-user',
        name: '2. Fetch Chained User Profile ({{linkedUserId}})',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/{{linkedUserId}}',
        headersList: [
          { id: 'h10', key: 'Accept', value: 'application/json', enabled: true }
        ],
        bodyType: 'none',
        assertions: [
          { id: 'a25', type: 'status', value: '200' },
          { id: 'a26', type: 'latency', value: '1500' }
        ],
        extractors: []
      }
    ]
  }
];
