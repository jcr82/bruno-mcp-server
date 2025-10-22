import { getConfigLoader } from './config.js';
import type { BrunoRequest } from './bruno-cli.js';

/**
 * Performance utilities for Bruno MCP Server
 * Includes caching and metrics tracking
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

interface ExecutionMetric {
  tool: string;
  duration: number;
  success: boolean;
  timestamp: number;
  collectionPath?: string;
  requestName?: string;
}

/**
 * Simple in-memory cache with TTL support
 */
class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttl: number;

  constructor(ttl: number = 300000) { // 5 minutes default
    this.ttl = ttl;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      hits: 0
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Increment hit counter
    entry.hits++;
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Remove expired entries
    this.cleanup();
    return this.cache.size;
  }

  getStats(): { size: number; totalHits: number; keys: string[] } {
    this.cleanup();
    let totalHits = 0;
    const keys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      totalHits += entry.hits;
      keys.push(key);
    }

    return { size: this.cache.size, totalHits, keys };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Performance manager singleton
 */
class PerformanceManager {
  private requestListCache: Cache<BrunoRequest[]>;
  private collectionDiscoveryCache: Cache<string[]>;
  private environmentListCache: Cache<Array<{ name: string; path: string; variables?: Record<string, string> }>>;
  private fileContentCache: Cache<string>;
  private metrics: ExecutionMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  constructor() {
    const configLoader = getConfigLoader();
    const perfConfig = configLoader.getPerformance();
    this.requestListCache = new Cache(perfConfig.cacheTTL);
    this.collectionDiscoveryCache = new Cache(perfConfig.cacheTTL * 2); // Cache discovery longer
    this.environmentListCache = new Cache(perfConfig.cacheTTL);
    this.fileContentCache = new Cache(perfConfig.cacheTTL / 2); // Cache files shorter
  }

  /**
   * Cache collection request list
   */
  cacheRequestList(collectionPath: string, requests: BrunoRequest[]): void {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return;
    }
    this.requestListCache.set(collectionPath, requests);
  }

  /**
   * Get cached request list
   */
  getCachedRequestList(collectionPath: string): BrunoRequest[] | null {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return null;
    }
    return this.requestListCache.get(collectionPath);
  }

  /**
   * Cache collection discovery results
   */
  cacheCollectionDiscovery(searchPath: string, collections: string[]): void {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return;
    }
    this.collectionDiscoveryCache.set(searchPath, collections);
  }

  /**
   * Get cached collection discovery results
   */
  getCachedCollectionDiscovery(searchPath: string): string[] | null {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return null;
    }
    return this.collectionDiscoveryCache.get(searchPath);
  }

  /**
   * Cache environment list
   */
  cacheEnvironmentList(collectionPath: string, environments: Array<{ name: string; path: string; variables?: Record<string, string> }>): void {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return;
    }
    this.environmentListCache.set(collectionPath, environments);
  }

  /**
   * Get cached environment list
   */
  getCachedEnvironmentList(collectionPath: string): Array<{ name: string; path: string; variables?: Record<string, string> }> | null {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return null;
    }
    return this.environmentListCache.get(collectionPath);
  }

  /**
   * Cache file content
   */
  cacheFileContent(filePath: string, content: string): void {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return;
    }
    this.fileContentCache.set(filePath, content);
  }

  /**
   * Get cached file content
   */
  getCachedFileContent(filePath: string): string | null {
    const configLoader = getConfigLoader();
    if (!configLoader.getPerformance().cacheEnabled) {
      return null;
    }
    return this.fileContentCache.get(filePath);
  }

  /**
   * Invalidate cache for a collection
   */
  invalidateCache(collectionPath: string): void {
    this.requestListCache.delete(collectionPath);
    this.environmentListCache.delete(collectionPath);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.requestListCache.clear();
    this.collectionDiscoveryCache.clear();
    this.environmentListCache.clear();
    this.fileContentCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      requestList: this.requestListCache.getStats(),
      collectionDiscovery: this.collectionDiscoveryCache.getStats(),
      environmentList: this.environmentListCache.getStats(),
      fileContent: this.fileContentCache.getStats()
    };
  }

  /**
   * Record execution metric
   */
  recordMetric(metric: ExecutionMetric): void {
    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get metrics for a specific tool
   */
  getMetricsForTool(tool: string): ExecutionMetric[] {
    return this.metrics.filter(m => m.tool === tool);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ExecutionMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    if (this.metrics.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        byTool: {}
      };
    }

    const byTool: Record<string, {
      count: number;
      success: number;
      totalDuration: number;
      avgDuration: number;
      successRate: number;
    }> = {};

    let totalSuccess = 0;
    let totalDuration = 0;

    for (const metric of this.metrics) {
      if (!byTool[metric.tool]) {
        byTool[metric.tool] = {
          count: 0,
          success: 0,
          totalDuration: 0,
          avgDuration: 0,
          successRate: 0
        };
      }

      byTool[metric.tool].count++;
      byTool[metric.tool].totalDuration += metric.duration;

      if (metric.success) {
        byTool[metric.tool].success++;
        totalSuccess++;
      }

      totalDuration += metric.duration;
    }

    // Calculate averages
    for (const tool in byTool) {
      const stats = byTool[tool];
      stats.avgDuration = stats.totalDuration / stats.count;
      stats.successRate = (stats.success / stats.count) * 100;
    }

    return {
      totalExecutions: this.metrics.length,
      successRate: (totalSuccess / this.metrics.length) * 100,
      averageDuration: totalDuration / this.metrics.length,
      byTool
    };
  }

  /**
   * Clear old metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }
}

// Global performance manager instance
let globalPerformanceManager: PerformanceManager | null = null;

/**
 * Get or create global performance manager
 */
export function getPerformanceManager(): PerformanceManager {
  if (!globalPerformanceManager) {
    globalPerformanceManager = new PerformanceManager();
  }
  return globalPerformanceManager;
}

/**
 * Decorator to track execution metrics
 */
export function trackExecution(tool: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const perfManager = getPerformanceManager();
      let success = true;

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        perfManager.recordMetric({
          tool,
          duration,
          success,
          timestamp: Date.now()
        });
      }
    };

    return descriptor;
  };
}

/**
 * Measure execution time
 */
export async function measureExecution<T>(
  tool: string,
  fn: () => Promise<T>,
  metadata?: { collectionPath?: string; requestName?: string }
): Promise<T> {
  const startTime = Date.now();
  const perfManager = getPerformanceManager();
  let success = true;

  try {
    const result = await fn();
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    perfManager.recordMetric({
      tool,
      duration,
      success,
      timestamp: Date.now(),
      ...metadata
    });
  }
}

/**
 * Format metrics for display
 */
export function formatMetrics(summary: ReturnType<typeof PerformanceManager.prototype.getMetricsSummary>): string {
  const lines: string[] = [];

  lines.push('=== Performance Metrics ===');
  lines.push(`Total Executions: ${summary.totalExecutions}`);
  lines.push(`Success Rate: ${summary.successRate.toFixed(2)}%`);
  lines.push(`Average Duration: ${summary.averageDuration.toFixed(2)}ms`);
  lines.push('');
  lines.push('By Tool:');

  for (const [tool, stats] of Object.entries(summary.byTool)) {
    lines.push(`  ${tool}:`);
    lines.push(`    Executions: ${stats.count}`);
    lines.push(`    Success Rate: ${stats.successRate.toFixed(2)}%`);
    lines.push(`    Avg Duration: ${stats.avgDuration.toFixed(2)}ms`);
  }

  return lines.join('\n');
}

/**
 * Format cache stats for display
 */
export function formatCacheStats(stats: ReturnType<typeof PerformanceManager.prototype.getCacheStats>): string {
  const lines: string[] = [];

  lines.push('=== Cache Statistics ===');
  lines.push(`Request List Cache:`);
  lines.push(`  Size: ${stats.requestList.size} entries`);
  lines.push(`  Total Hits: ${stats.requestList.totalHits}`);

  if (stats.requestList.keys.length > 0) {
    lines.push(`  Cached Collections:`);
    stats.requestList.keys.forEach(key => {
      lines.push(`    - ${key}`);
    });
  }

  return lines.join('\n');
}
