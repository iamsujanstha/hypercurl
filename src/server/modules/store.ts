import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const COLLECTIONS_FILE = path.join(DATA_DIR, 'collections.json');
const ENVIRONMENTS_FILE = path.join(DATA_DIR, 'environments.json');
const SUITES_FILE = path.join(DATA_DIR, 'suites.json');
const BENCHMARKS_FILE = path.join(DATA_DIR, 'benchmarks.json');

const DEFAULT_ENVIRONMENTS = [
  {
    id: 'env-local',
    name: 'Local',
    type: 'local',
    isProduction: false,
    baseUrl: 'http://localhost:3000',
    variables: [
      { id: 'v1', key: 'BASE_URL', value: 'http://localhost:3000', enabled: true },
      { id: 'v2', key: 'API_KEY', value: 'local_dev_secret_key_84920', isSecret: true, enabled: true },
      { id: 'v3', key: 'TIMEOUT_MS', value: '5000', enabled: true }
    ]
  },
  {
    id: 'env-dev',
    name: 'Development',
    type: 'dev',
    isProduction: false,
    baseUrl: 'https://dev-api.example.com',
    variables: [
      { id: 'v4', key: 'BASE_URL', value: 'https://dev-api.example.com', enabled: true },
      { id: 'v5', key: 'AUTH_TOKEN', value: 'bearer_dev_jwt_99182', isSecret: true, enabled: true }
    ]
  },
  {
    id: 'env-staging',
    name: 'Staging',
    type: 'staging',
    isProduction: false,
    baseUrl: 'https://staging-api.example.com',
    variables: [
      { id: 'v6', key: 'BASE_URL', value: 'https://staging-api.example.com', enabled: true },
      { id: 'v7', key: 'API_KEY', value: 'staging_sec_key_443', isSecret: true, enabled: true }
    ]
  },
  {
    id: 'env-production',
    name: 'Production',
    type: 'production',
    isProduction: true,
    baseUrl: 'https://api.example.com',
    variables: [
      { id: 'v8', key: 'BASE_URL', value: 'https://api.example.com', enabled: true },
      { id: 'v9', key: 'API_KEY', value: 'prod_live_sec_token_9901', isSecret: true, enabled: true }
    ]
  }
];

export class Store {
  static async init() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      for (const [file, defaultData] of [
        [HISTORY_FILE, []],
        [COLLECTIONS_FILE, []],
        [ENVIRONMENTS_FILE, DEFAULT_ENVIRONMENTS],
        [SUITES_FILE, []],
        [BENCHMARKS_FILE, []]
      ] as const) {
        try {
          await fs.access(file);
        } catch {
          await fs.writeFile(file, JSON.stringify(defaultData, null, 2));
        }
      }
    } catch (error) {
      console.error('Failed to initialize store:', error);
    }
  }

  // --- History ---
  static async getHistory() {
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static async addToHistory(item: any) {
    const history = await this.getHistory();
    history.unshift({ ...item, timestamp: Date.now() });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history.slice(0, 100)));
  }

  static async clearHistory() {
    await fs.writeFile(HISTORY_FILE, JSON.stringify([]));
  }

  // --- Collections ---
  static async getCollections() {
    try {
      const data = await fs.readFile(COLLECTIONS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static async saveCollection(collection: any) {
    const collections = await this.getCollections();
    const index = collections.findIndex((c: any) => (c.id && collection.id && c.id === collection.id) || c.name === collection.name);
    if (index >= 0) {
      collections[index] = collection;
    } else {
      collections.push(collection);
    }
    await fs.writeFile(COLLECTIONS_FILE, JSON.stringify(collections, null, 2));
  }

  static async deleteCollection(idOrName: string) {
    const collections = await this.getCollections();
    const filtered = collections.filter((c: any) => c.id !== idOrName && c.name !== idOrName);
    await fs.writeFile(COLLECTIONS_FILE, JSON.stringify(filtered, null, 2));
  }

  // --- Environments ---
  static async getEnvironments() {
    try {
      const data = await fs.readFile(ENVIRONMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return DEFAULT_ENVIRONMENTS;
    } catch {
      return DEFAULT_ENVIRONMENTS;
    }
  }

  static async saveEnvironment(env: any) {
    const envs = await this.getEnvironments();
    const index = envs.findIndex((e: any) => (e.id && env.id && e.id === env.id) || e.name === env.name);
    if (index >= 0) {
      envs[index] = env;
    } else {
      envs.push(env);
    }
    await fs.writeFile(ENVIRONMENTS_FILE, JSON.stringify(envs, null, 2));
  }

  static async deleteEnvironment(id: string) {
    const envs = await this.getEnvironments();
    const filtered = envs.filter((e: any) => e.id !== id && e.name !== id);
    await fs.writeFile(ENVIRONMENTS_FILE, JSON.stringify(filtered, null, 2));
  }

  // --- Benchmarks Snapshots ---
  static async getBenchmarks() {
    try {
      const data = await fs.readFile(BENCHMARKS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static async saveBenchmark(snapshot: any) {
    const benchmarks = await this.getBenchmarks();
    benchmarks.unshift(snapshot);
    await fs.writeFile(BENCHMARKS_FILE, JSON.stringify(benchmarks.slice(0, 50), null, 2));
  }

  static async deleteBenchmark(id: string) {
    const benchmarks = await this.getBenchmarks();
    const filtered = benchmarks.filter((b: any) => b.id !== id);
    await fs.writeFile(BENCHMARKS_FILE, JSON.stringify(filtered, null, 2));
  }
}
