import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

/**
 * Configuration schema for Bruno MCP Server
 */
export const ConfigSchema = z.object({
  // Bruno CLI configuration
  brunoCliPath: z.string().optional().describe('Custom path to Bruno CLI executable'),
  brunoHome: z.string().optional().describe('Bruno collections home directory'),
  useMockCLI: z.boolean().optional().default(false)
    .describe('Use mock Bruno CLI instead of real CLI (useful for testing and CI/CD)'),
  mockCLIDelay: z.number().optional().default(100)
    .describe('Simulated delay for mock CLI operations in milliseconds'),

  // Timeout configuration
  timeout: z.object({
    request: z.number().min(1000).max(300000).optional().default(30000)
      .describe('Timeout for individual requests in milliseconds (default: 30000)'),
    collection: z.number().min(1000).max(600000).optional().default(120000)
      .describe('Timeout for collection runs in milliseconds (default: 120000)')
  }).optional().default({}),

  // Retry configuration
  retry: z.object({
    enabled: z.boolean().optional().default(false)
      .describe('Enable automatic retry for failed requests'),
    maxAttempts: z.number().min(1).max(10).optional().default(3)
      .describe('Maximum number of retry attempts'),
    backoff: z.enum(['linear', 'exponential']).optional().default('exponential')
      .describe('Backoff strategy for retries'),
    retryableStatuses: z.array(z.number()).optional().default([408, 429, 500, 502, 503, 504])
      .describe('HTTP status codes that should trigger a retry')
  }).optional().default({}),

  // Security configuration
  security: z.object({
    allowedPaths: z.array(z.string()).optional()
      .describe('List of allowed directories for collections (empty = all allowed)'),
    maskSecrets: z.boolean().optional().default(true)
      .describe('Mask sensitive data in logs and error messages'),
    secretPatterns: z.array(z.string()).optional().default([
      'password', 'secret', 'token', 'key', 'auth', 'api[_-]?key'
    ]).describe('Patterns to identify secrets for masking')
  }).optional().default({}),

  // Logging configuration
  logging: z.object({
    level: z.enum(['debug', 'info', 'warning', 'error']).optional().default('info')
      .describe('Logging level'),
    format: z.enum(['json', 'text']).optional().default('text')
      .describe('Log format (json or text)'),
    logFile: z.string().optional()
      .describe('Path to log file (optional, logs to stderr by default)'),
    maxLogSize: z.number().optional().default(10485760)
      .describe('Maximum log file size in bytes before rotation (default: 10MB)'),
    maxLogFiles: z.number().optional().default(5)
      .describe('Maximum number of rotated log files to keep')
  }).optional().default({}),

  // Performance configuration
  performance: z.object({
    cacheEnabled: z.boolean().optional().default(true)
      .describe('Enable caching of collection metadata'),
    cacheTTL: z.number().optional().default(300000)
      .describe('Cache time-to-live in milliseconds (default: 5 minutes)'),
    maxConcurrency: z.number().min(1).max(100).optional().default(10)
      .describe('Maximum number of concurrent requests (for future parallel execution)')
  }).optional().default({})
});

export type BrunoMCPConfig = z.infer<typeof ConfigSchema>;

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: BrunoMCPConfig = {
  useMockCLI: false,
  mockCLIDelay: 100,
  timeout: {
    request: 30000,
    collection: 120000
  },
  retry: {
    enabled: false,
    maxAttempts: 3,
    backoff: 'exponential',
    retryableStatuses: [408, 429, 500, 502, 503, 504]
  },
  security: {
    maskSecrets: true,
    secretPatterns: ['password', 'secret', 'token', 'key', 'auth', 'api[_-]?key']
  },
  logging: {
    level: 'info',
    format: 'text',
    maxLogSize: 10485760,
    maxLogFiles: 5
  },
  performance: {
    cacheEnabled: true,
    cacheTTL: 300000,
    maxConcurrency: 10
  }
};

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private config: BrunoMCPConfig;
  private configPath?: string;

  constructor() {
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(configPath: string): Promise<BrunoMCPConfig> {
    try {
      const absolutePath = path.resolve(configPath);
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      const jsonConfig = JSON.parse(fileContent);

      // Validate and parse configuration
      this.config = ConfigSchema.parse(jsonConfig);
      this.configPath = absolutePath;

      console.error(`Configuration loaded from: ${absolutePath}`);
      return this.config;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.error(`Configuration file not found: ${configPath}, using defaults`);
        return this.config;
      }

      if (error instanceof z.ZodError) {
        console.error('Configuration validation errors:');
        error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        throw new Error('Invalid configuration file');
      }

      throw error;
    }
  }

  /**
   * Load configuration with automatic detection
   * Looks for bruno-mcp.config.json in:
   * 1. Current working directory
   * 2. User's home directory
   * 3. Environment variable BRUNO_MCP_CONFIG
   */
  async loadConfig(): Promise<BrunoMCPConfig> {
    // Check environment variable first
    const envConfigPath = process.env.BRUNO_MCP_CONFIG;
    if (envConfigPath) {
      try {
        return await this.loadFromFile(envConfigPath);
      } catch (error) {
        console.error(`Failed to load config from BRUNO_MCP_CONFIG: ${envConfigPath}`);
      }
    }

    // Check current working directory
    const cwdConfigPath = path.join(process.cwd(), 'bruno-mcp.config.json');
    try {
      const stats = await fs.stat(cwdConfigPath);
      if (stats.isFile()) {
        return await this.loadFromFile(cwdConfigPath);
      }
    } catch {
      // File doesn't exist, continue
    }

    // Check home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      const homeConfigPath = path.join(homeDir, '.bruno-mcp.config.json');
      try {
        const stats = await fs.stat(homeConfigPath);
        if (stats.isFile()) {
          return await this.loadFromFile(homeConfigPath);
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    console.error('No configuration file found, using defaults');
    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): BrunoMCPConfig {
    return this.config;
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(partialConfig: Partial<BrunoMCPConfig>): BrunoMCPConfig {
    this.config = ConfigSchema.parse({
      ...this.config,
      ...partialConfig
    });
    return this.config;
  }

  /**
   * Get configuration for specific section
   */
  getTimeout() {
    return this.config.timeout || DEFAULT_CONFIG.timeout!;
  }

  getRetry() {
    return this.config.retry || DEFAULT_CONFIG.retry!;
  }

  getSecurity() {
    return this.config.security || DEFAULT_CONFIG.security!;
  }

  getLogging() {
    return this.config.logging || DEFAULT_CONFIG.logging!;
  }

  getPerformance() {
    return this.config.performance || DEFAULT_CONFIG.performance!;
  }

  /**
   * Mask secrets in a string based on configuration
   */
  maskSecrets(text: string): string {
    if (!this.getSecurity().maskSecrets) {
      return text;
    }

    let maskedText = text;
    const patterns = this.getSecurity().secretPatterns || [];

    patterns.forEach(pattern => {
      // Create case-insensitive regex to find key=value or key: value patterns
      const regex = new RegExp(`(${pattern})[\\s]*[:=][\\s]*([^\\s,}"'\\]]+)`, 'gi');
      maskedText = maskedText.replace(regex, '$1=***MASKED***');
    });

    return maskedText;
  }
}

// Global configuration instance
let globalConfigLoader: ConfigLoader | null = null;

/**
 * Get or create global configuration loader
 */
export function getConfigLoader(): ConfigLoader {
  if (!globalConfigLoader) {
    globalConfigLoader = new ConfigLoader();
  }
  return globalConfigLoader;
}

/**
 * Initialize configuration
 */
export async function initializeConfig(configPath?: string): Promise<BrunoMCPConfig> {
  const loader = getConfigLoader();

  if (configPath) {
    return await loader.loadFromFile(configPath);
  }

  return await loader.loadConfig();
}
