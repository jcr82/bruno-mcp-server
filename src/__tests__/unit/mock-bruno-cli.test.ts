import { describe, test, expect, beforeEach } from 'vitest';
import { MockBrunoCLI, createMockBrunoCLI } from '../../mock-bruno-cli.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('MockBrunoCLI', () => {
  let mockCLI: MockBrunoCLI;

  beforeEach(() => {
    mockCLI = createMockBrunoCLI({ delay: 10 }); // Fast execution for tests
  });

  describe('version()', () => {
    test('should return mock version', async () => {
      const result = await mockCLI.version();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1.40.0');
      expect(result.stdout).toContain('mock');
      expect(result.stderr).toBe('');
    });
  });

  describe('runRequest()', () => {
    test('should execute mock request successfully', async () => {
      const args = ['run', 'Get Users', '--env', 'dev'];
      const result = await mockCLI.runRequest(args);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Get Users');
      expect(result.stdout).toContain('✓');
      expect(result.stdout).toContain('Test Summary');
      expect(result.stderr).toBe('');
    });

    test('should simulate request execution delay', async () => {
      const slowMock = createMockBrunoCLI({ delay: 100 });
      const start = Date.now();

      await slowMock.runRequest(['run', 'Test Request']);

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(90); // Allow some margin
    });

    test('should handle failure mode', async () => {
      mockCLI.setShouldFail(true, 'Request failed intentionally');

      const result = await mockCLI.runRequest(['run', 'Failing Request']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('failed intentionally');
    });

    test('should reset failure mode', async () => {
      mockCLI.setShouldFail(true);
      mockCLI.setShouldFail(false);

      const result = await mockCLI.runRequest(['run', 'Test']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('runCollection()', () => {
    test('should execute mock collection successfully', async () => {
      const args = ['run', '--env', 'dev'];
      const result = await mockCLI.runCollection(args);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('✓');
      expect(result.stdout).toContain('Test Summary');
      // Check for the actual format used
      expect(result.stdout).toMatch(/Total:\s*3/);
      expect(result.stdout).toMatch(/Passed:\s*3/);
      expect(result.stdout).toMatch(/Failed:\s*0/);
    });

    test('should include multiple test results', async () => {
      const result = await mockCLI.runCollection(['run']);

      expect(result.stdout).toContain('Get Users');
      expect(result.stdout).toContain('Get User By ID');
      expect(result.stdout).toContain('Create User');
    });

    test('should handle collection failure mode', async () => {
      mockCLI.setShouldFail(true, 'Collection execution failed');

      const result = await mockCLI.runCollection(['run']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Collection execution failed');
    });
  });

  describe('execute()', () => {
    test('should detect version command', async () => {
      const result = await mockCLI.execute('bru', ['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1.40.0');
    });

    test('should detect version command with short flag', async () => {
      const result = await mockCLI.execute('bru', ['-v']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mock');
    });

    test('should route to runRequest for single request', async () => {
      const result = await mockCLI.execute('bru', ['run', 'My Request']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('My Request');
    });

    test('should route to runCollection for collection run', async () => {
      const result = await mockCLI.execute('bru', ['run', '--env', 'dev']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Total: 3');
    });

    test('should return default response for unknown commands', async () => {
      const result = await mockCLI.execute('bru', ['help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Mock Bruno CLI');
    });
  });

  describe('Report Generation', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = path.join(tmpdir(), `mock-cli-test-${randomUUID()}`);
    });

    test('should write JSON report', async () => {
      const reportPath = path.join(tempDir, 'report.json');
      const mockData = {
        summary: { totalRequests: 3, passedRequests: 3, failedRequests: 0, totalDuration: 300 },
        results: [
          { name: 'Test 1', passed: true, duration: 100 },
          { name: 'Test 2', passed: true, duration: 100 },
          { name: 'Test 3', passed: true, duration: 100 }
        ]
      };

      await mockCLI.writeReport('json', reportPath, mockData);

      const content = await fs.readFile(reportPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.summary.totalRequests).toBe(3);
      expect(parsed.results.length).toBe(3);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('should write JUnit XML report', async () => {
      const reportPath = path.join(tempDir, 'report.xml');
      const mockData = {
        summary: { totalRequests: 2, passedRequests: 1, failedRequests: 1, totalDuration: 200 },
        results: [
          { name: 'Passing Test', passed: true, duration: 100, status: 200 },
          { name: 'Failing Test', passed: false, duration: 100, status: 500 }
        ]
      };

      await mockCLI.writeReport('junit', reportPath, mockData);

      const content = await fs.readFile(reportPath, 'utf-8');

      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('<testsuites');
      expect(content).toContain('<testsuite');
      expect(content).toContain('Passing Test');
      expect(content).toContain('Failing Test');
      expect(content).toContain('<failure');

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('should write HTML report', async () => {
      const reportPath = path.join(tempDir, 'report.html');
      const mockData = {
        summary: { totalRequests: 2, passedRequests: 2, failedRequests: 0, totalDuration: 200 },
        results: [
          { name: 'Test 1', passed: true, duration: 100, status: 200 },
          { name: 'Test 2', passed: true, duration: 100, status: 201 }
        ]
      };

      await mockCLI.writeReport('html', reportPath, mockData);

      const content = await fs.readFile(reportPath, 'utf-8');

      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<title>Bruno Test Report (Mock)</title>');
      expect(content).toContain('Test 1');
      expect(content).toContain('Test 2');
      expect(content).toContain('✓ Passed');
      expect(content).toContain('Total Tests: 2');

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('Factory Function', () => {
    test('should create mock CLI with default delay', () => {
      const mock = createMockBrunoCLI();
      expect(mock).toBeInstanceOf(MockBrunoCLI);
    });

    test('should create mock CLI with custom delay', () => {
      const mock = createMockBrunoCLI({ delay: 500 });
      expect(mock).toBeInstanceOf(MockBrunoCLI);
    });

    test('should create mock CLI with zero delay', () => {
      const mock = createMockBrunoCLI({ delay: 0 });
      expect(mock).toBeInstanceOf(MockBrunoCLI);
    });
  });

  describe('Output Formatting', () => {
    test('should format successful execution output', async () => {
      const result = await mockCLI.runRequest(['run', 'Sample Request']);

      expect(result.stdout).toContain('Running Tests');
      expect(result.stdout).toContain('✓ Sample Request');
      expect(result.stdout).toContain('Test Summary:');
      expect(result.stdout).toContain('Total:');
      expect(result.stdout).toContain('Passed:');
      expect(result.stdout).toContain('Failed:');
      expect(result.stdout).toContain('Duration:');
    });

    test('should show execution time in output', async () => {
      const result = await mockCLI.runCollection(['run']);

      expect(result.stdout).toMatch(/\d+ms/); // Should contain milliseconds
    });
  });
});
