import { describe, test, expect, beforeEach, vi } from 'vitest';
import { getPerformanceManager, trackExecution, measureExecution, formatMetrics, formatCacheStats } from '../../performance.js';

// Mock config
vi.mock('../../config.js', () => ({
  getConfigLoader: () => ({
    getPerformance: () => ({
      cacheEnabled: true,
      cacheTTL: 5000, // 5 seconds for testing
      maxConcurrency: 10
    })
  })
}));

describe('Performance', () => {
  describe('getPerformanceManager()', () => {
    test('should return singleton instance', () => {
      const manager1 = getPerformanceManager();
      const manager2 = getPerformanceManager();

      expect(manager1).toBe(manager2);
    });

    test('should track metrics', () => {
      const manager = getPerformanceManager();
      manager.clearMetrics(); // Clear previous metrics

      manager.recordMetric({ tool: 'test-tool', duration: 100, success: true, timestamp: Date.now() });
      manager.recordMetric({ tool: 'test-tool', duration: 200, success: true, timestamp: Date.now() });

      const summary = manager.getMetricsSummary();

      expect(summary.totalExecutions).toBeGreaterThan(0);
      expect(summary.byTool['test-tool']).toBeDefined();
      expect(summary.byTool['test-tool'].count).toBe(2);
    });

    test('should calculate average execution time', () => {
      const manager = getPerformanceManager();
      manager.clearMetrics();

      manager.recordMetric({ tool: 'avg-test', duration: 100, success: true, timestamp: Date.now() });
      manager.recordMetric({ tool: 'avg-test', duration: 200, success: true, timestamp: Date.now() });
      manager.recordMetric({ tool: 'avg-test', duration: 300, success: true, timestamp: Date.now() });

      const summary = manager.getMetricsSummary();

      expect(summary.byTool['avg-test'].avgDuration).toBe(200);
    });

    test('should calculate success rate', () => {
      const manager = getPerformanceManager();
      manager.clearMetrics();

      manager.recordMetric({ tool: 'success-test', duration: 100, success: true, timestamp: Date.now() });
      manager.recordMetric({ tool: 'success-test', duration: 200, success: false, timestamp: Date.now() });
      manager.recordMetric({ tool: 'success-test', duration: 300, success: true, timestamp: Date.now() });

      const summary = manager.getMetricsSummary();

      // 2 out of 3 successful = 66.67%
      expect(summary.byTool['success-test'].successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('Cache functionality', () => {
    test('should cache and retrieve request lists', () => {
      const manager = getPerformanceManager();
      manager.clearCache();

      const mockRequests = [
        { name: 'Get Users', method: 'GET', url: 'https://api.example.com/users' }
      ];

      manager.cacheRequestList('/test/path', mockRequests as any);
      const cached = manager.getCachedRequestList('/test/path');

      expect(cached).toEqual(mockRequests);
    });

    test('should return null for non-existent cache', () => {
      const manager = getPerformanceManager();
      manager.clearCache();

      const cached = manager.getCachedRequestList('/nonexistent/path');

      expect(cached).toBeNull();
    });

    test('should cache collection discovery results', () => {
      const manager = getPerformanceManager();
      manager.clearCache();

      const mockCollections = ['/path/to/collection1', '/path/to/collection2'];

      manager.cacheCollectionDiscovery('/search/path', mockCollections);
      const cached = manager.getCachedCollectionDiscovery('/search/path');

      expect(cached).toEqual(mockCollections);
    });

    test('should cache environment lists', () => {
      const manager = getPerformanceManager();
      manager.clearCache();

      const mockEnvironments = [
        { name: 'dev', path: '/path/to/dev.bru' },
        { name: 'staging', path: '/path/to/staging.bru' }
      ];

      manager.cacheEnvironmentList('/collection', mockEnvironments);
      const cached = manager.getCachedEnvironmentList('/collection');

      expect(cached).toEqual(mockEnvironments);
    });

    test('should cache file content', () => {
      const manager = getPerformanceManager();
      manager.clearCache();

      const fileContent = 'test file content';

      manager.cacheFileContent('/path/to/file.txt', fileContent);
      const cached = manager.getCachedFileContent('/path/to/file.txt');

      expect(cached).toBe(fileContent);
    });

    test('should clear all caches', () => {
      const manager = getPerformanceManager();

      manager.cacheRequestList('/test', []);
      manager.cacheCollectionDiscovery('/test', []);
      manager.cacheEnvironmentList('/test', []);
      manager.cacheFileContent('/test', 'content');

      manager.clearCache();

      expect(manager.getCachedRequestList('/test')).toBeNull();
      expect(manager.getCachedCollectionDiscovery('/test')).toBeNull();
      expect(manager.getCachedEnvironmentList('/test')).toBeNull();
      expect(manager.getCachedFileContent('/test')).toBeNull();
    });
  });

  describe('trackExecution()', () => {
    test('should be a decorator function', () => {
      const decorator = trackExecution('test-tool');

      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });
  });

  describe('measureExecution()', () => {
    test('should measure async function execution', async () => {
      const manager = getPerformanceManager();
      manager.clearMetrics();

      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const result = await measureExecution('measure-test', testFunction);

      expect(result).toBe('result');

      const summary = manager.getMetricsSummary();
      expect(summary.byTool['measure-test']).toBeDefined();
      expect(summary.byTool['measure-test'].count).toBe(1);
    });

    test('should propagate errors from measured function', async () => {
      const testFunction = async () => {
        throw new Error('Test error');
      };

      await expect(
        measureExecution('error-test', testFunction)
      ).rejects.toThrow('Test error');
    });

    test('should still record metrics even when function throws', async () => {
      const manager = getPerformanceManager();
      manager.clearMetrics();

      const testFunction = async () => {
        throw new Error('Test error');
      };

      try {
        await measureExecution('error-metric-test', testFunction);
      } catch {
        // Expected error
      }

      const summary = manager.getMetricsSummary();
      expect(summary.byTool['error-metric-test']).toBeDefined();
    });
  });

  describe('formatMetrics()', () => {
    test('should format metrics summary', () => {
      const manager = getPerformanceManager();
      manager.clearMetrics();

      manager.recordMetric({ tool: 'format-test', duration: 100, success: true, timestamp: Date.now() });
      manager.recordMetric({ tool: 'format-test', duration: 200, success: true, timestamp: Date.now() });

      const summary = manager.getMetricsSummary();
      const formatted = formatMetrics(summary);

      expect(formatted).toContain('Performance Metrics');
      expect(formatted).toContain('format-test');
      expect(formatted).toContain('2'); // count
    });

    test('should handle empty metrics', () => {
      const manager = getPerformanceManager();
      manager.clearMetrics();

      const summary = manager.getMetricsSummary();
      const formatted = formatMetrics(summary);

      expect(formatted).toContain('Performance Metrics');
      expect(formatted).toContain('0'); // total executions
    });
  });

  describe('formatCacheStats()', () => {
    test('should format cache statistics', () => {
      const manager = getPerformanceManager();
      manager.clearCache();

      // Add some cache entries
      manager.cacheRequestList('/test1', []);

      const stats = manager.getCacheStats();
      const formatted = formatCacheStats(stats);

      expect(formatted).toContain('Cache Statistics');
      expect(formatted).toContain('Request List Cache');
      expect(formatted).toContain('1 entries');
    });

    test('should show zero entries for empty caches', () => {
      const manager = getPerformanceManager();
      manager.clearCache();

      const stats = manager.getCacheStats();
      const formatted = formatCacheStats(stats);

      expect(formatted).toContain('0 entries');
    });
  });

  describe('clearMetrics()', () => {
    test('should clear all recorded metrics', () => {
      const manager = getPerformanceManager();

      manager.recordMetric({ tool: 'clear-test', duration: 100, success: true, timestamp: Date.now() });
      manager.recordMetric({ tool: 'clear-test', duration: 200, success: true, timestamp: Date.now() });

      let summary = manager.getMetricsSummary();
      expect(summary.totalExecutions).toBeGreaterThan(0);

      manager.clearMetrics();

      summary = manager.getMetricsSummary();
      expect(summary.totalExecutions).toBe(0);
      expect(Object.keys(summary.byTool).length).toBe(0);
    });
  });
});
