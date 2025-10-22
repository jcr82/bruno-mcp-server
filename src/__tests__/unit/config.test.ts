import { describe, test, expect } from 'vitest';
import { ConfigLoader, ConfigSchema, DEFAULT_CONFIG } from '../../config.js';

describe('ConfigLoader', () => {
  describe('constructor()', () => {
    test('should initialize with default config', () => {
      const loader = new ConfigLoader();
      expect(loader.getConfig()).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('getTimeout()', () => {
    test('should return default timeout configuration', () => {
      const loader = new ConfigLoader();
      const timeout = loader.getTimeout();

      expect(timeout.request).toBe(30000);
      expect(timeout.collection).toBe(120000);
    });
  });

  describe('getRetry()', () => {
    test('should return default retry configuration', () => {
      const loader = new ConfigLoader();
      const retry = loader.getRetry();

      expect(retry.enabled).toBe(false);
      expect(retry.maxAttempts).toBe(3);
      expect(retry.backoff).toBe('exponential');
      expect(retry.retryableStatuses).toEqual([408, 429, 500, 502, 503, 504]);
    });
  });

  describe('getSecurity()', () => {
    test('should return default security configuration', () => {
      const loader = new ConfigLoader();
      const security = loader.getSecurity();

      expect(security.maskSecrets).toBe(true);
      expect(security.secretPatterns).toContain('password');
      expect(security.secretPatterns).toContain('token');
      expect(security.secretPatterns).toContain('secret');
    });
  });

  describe('getLogging()', () => {
    test('should return default logging configuration', () => {
      const loader = new ConfigLoader();
      const logging = loader.getLogging();

      expect(logging.level).toBe('info');
      expect(logging.format).toBe('text');
      expect(logging.maxLogSize).toBe(10485760);
      expect(logging.maxLogFiles).toBe(5);
    });
  });

  describe('getPerformance()', () => {
    test('should return default performance configuration', () => {
      const loader = new ConfigLoader();
      const performance = loader.getPerformance();

      expect(performance.cacheEnabled).toBe(true);
      expect(performance.cacheTTL).toBe(300000);
      expect(performance.maxConcurrency).toBe(10);
    });
  });

  describe('updateConfig()', () => {
    test('should update configuration at runtime', () => {
      const loader = new ConfigLoader();

      loader.updateConfig({
        retry: {
          enabled: true,
          maxAttempts: 5,
          backoff: 'linear',
          retryableStatuses: [500, 502]
        }
      });

      const retry = loader.getRetry();
      expect(retry.enabled).toBe(true);
      expect(retry.maxAttempts).toBe(5);
      expect(retry.backoff).toBe('linear');
    });

    test('should merge partial updates with existing config', () => {
      const loader = new ConfigLoader();

      loader.updateConfig({
        logging: {
          level: 'debug',
          format: 'json'
        }
      });

      const logging = loader.getLogging();
      expect(logging.level).toBe('debug');
      expect(logging.format).toBe('json');
      // Other fields should remain default
      expect(logging.maxLogSize).toBe(10485760);
    });
  });

  describe('maskSecrets()', () => {
    test('should mask secrets in text', () => {
      const loader = new ConfigLoader();

      const text = 'password=secret123 token: abc123 api_key=xyz789';
      const masked = loader.maskSecrets(text);

      expect(masked).not.toContain('secret123');
      expect(masked).not.toContain('abc123');
      expect(masked).not.toContain('xyz789');
      expect(masked).toContain('***MASKED***');
    });

    test('should not mask secrets when maskSecrets is false', () => {
      const loader = new ConfigLoader();
      loader.updateConfig({
        security: {
          maskSecrets: false,
          secretPatterns: ['password', 'token']
        }
      });

      const text = 'password=secret123 token: abc123';
      const masked = loader.maskSecrets(text);

      expect(masked).toBe(text);
      expect(masked).toContain('secret123');
    });

    test('should handle text without secrets', () => {
      const loader = new ConfigLoader();

      const text = 'This is a normal text without any secrets';
      const masked = loader.maskSecrets(text);

      expect(masked).toBe(text);
    });
  });

  describe('ConfigSchema', () => {
    test('should validate valid configuration', () => {
      const validConfig = {
        retry: {
          enabled: true,
          maxAttempts: 5,
          backoff: 'linear' as const
        },
        logging: {
          level: 'debug' as const,
          format: 'json' as const
        }
      };

      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    test('should reject invalid retry.maxAttempts', () => {
      const invalidConfig = {
        retry: {
          maxAttempts: 100 // Too high (max is 10)
        }
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    test('should reject invalid logging.level', () => {
      const invalidConfig = {
        logging: {
          level: 'invalid-level'
        }
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    test('should apply default values', () => {
      const emptyConfig = {};

      const result = ConfigSchema.parse(emptyConfig);
      expect(result.retry?.enabled).toBe(false);
      expect(result.retry?.maxAttempts).toBe(3);
      expect(result.logging?.level).toBe('info');
      expect(result.performance?.cacheEnabled).toBe(true);
    });
  });
});
