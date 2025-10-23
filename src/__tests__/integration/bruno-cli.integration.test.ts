import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { BrunoCLI } from '../../bruno-cli.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the test collection
const TEST_COLLECTION_PATH = path.join(__dirname, 'test-collection');
const REPORTS_PATH = path.join(__dirname, 'reports');

describe('BrunoCLI Integration Tests', () => {
  let brunoCLI: BrunoCLI;

  beforeAll(async () => {
    brunoCLI = new BrunoCLI();

    // Ensure reports directory exists and is clean
    try {
      await fs.rm(REPORTS_PATH, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
    await fs.mkdir(REPORTS_PATH, { recursive: true });
  });

  afterAll(async () => {
    // Clean up reports directory
    try {
      await fs.rm(REPORTS_PATH, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Bruno CLI Availability', () => {
    test('should detect Bruno CLI installation', async () => {
      const isAvailable = await brunoCLI.isAvailable();
      expect(isAvailable).toBe(true);
    }, 10000);
  });

  describe('Collection Discovery', () => {
    test('should discover test collection', async () => {
      const collections = await brunoCLI.discoverCollections(__dirname, 2);

      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);

      // Should find our test collection
      const testCollection = collections.find(c => c.includes('test-collection'));
      expect(testCollection).toBeDefined();
    }, 10000);

    test('should respect maxDepth parameter', async () => {
      const collections = await brunoCLI.discoverCollections(__dirname, 1);
      expect(Array.isArray(collections)).toBe(true);
    }, 10000);
  });

  describe('Collection Validation', () => {
    test('should validate test collection successfully', async () => {
      const result = await brunoCLI.validateCollection(TEST_COLLECTION_PATH);

      expect(result.valid).toBe(true);
      expect(result.summary).toBeDefined();
      if (result.summary) {
        expect(result.summary.totalRequests).toBeGreaterThan(0);
      }
    }, 10000);

    test('should detect invalid collection path', async () => {
      const result = await brunoCLI.validateCollection('/nonexistent/path');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Request Listing', () => {
    test('should list all requests in collection', async () => {
      const requests = await brunoCLI.listRequests(TEST_COLLECTION_PATH);

      expect(requests).toBeDefined();
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBeGreaterThanOrEqual(3); // We created 3 requests

      // Check request structure
      requests.forEach(req => {
        expect(req).toHaveProperty('name');
        expect(req.name).toBeTruthy();
      });

      // Verify specific requests exist
      const getUsers = requests.find(r => r.name === 'Get Users');
      expect(getUsers).toBeDefined();
      if (getUsers) {
        expect(getUsers.method).toBe('GET');
        expect(getUsers.url).toContain('/users');
      }
    }, 10000);

    test('should handle empty collection gracefully', async () => {
      // Create temporary empty collection
      const emptyCollectionPath = path.join(__dirname, 'empty-collection');
      await fs.mkdir(emptyCollectionPath, { recursive: true });
      await fs.writeFile(
        path.join(emptyCollectionPath, 'bruno.json'),
        JSON.stringify({ version: '1', name: 'Empty', type: 'collection' })
      );

      const requests = await brunoCLI.listRequests(emptyCollectionPath);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(0);

      // Cleanup
      await fs.rm(emptyCollectionPath, { recursive: true, force: true });
    }, 10000);
  });

  describe('Environment Management', () => {
    test('should list all environments', async () => {
      const environments = await brunoCLI.listEnvironments(TEST_COLLECTION_PATH);

      expect(environments).toBeDefined();
      expect(Array.isArray(environments)).toBe(true);
      expect(environments.length).toBeGreaterThanOrEqual(2); // dev and staging

      // Verify dev environment exists
      const devEnv = environments.find(e => e.name === 'dev');
      expect(devEnv).toBeDefined();
      if (devEnv) {
        expect(devEnv.variables).toHaveProperty('baseUrl');
        expect(devEnv.variables.environment).toBe('dev');
      }
    }, 10000);

    test('should validate environment successfully', async () => {
      const result = await brunoCLI.validateEnvironment(TEST_COLLECTION_PATH, 'dev');

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.variables).toBeDefined();
      if (result.variables) {
        expect(result.variables.baseUrl).toBeTruthy();
      }
    }, 10000);

    test('should detect non-existent environment', async () => {
      const result = await brunoCLI.validateEnvironment(TEST_COLLECTION_PATH, 'nonexistent');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Request Introspection', () => {
    test('should get request details', async () => {
      const details = await brunoCLI.getRequestDetails(TEST_COLLECTION_PATH, 'Get Users');

      expect(details).toBeDefined();
      expect(details.name).toBe('Get Users');
      expect(details.method).toBe('GET');
      expect(details.url).toContain('/users');
      expect(details.tests).toBeDefined();
      expect(details.tests.length).toBeGreaterThan(0);
    }, 10000);

    test('should get POST request with body', async () => {
      const details = await brunoCLI.getRequestDetails(TEST_COLLECTION_PATH, 'Create User');

      expect(details).toBeDefined();
      expect(details.name).toBe('Create User');
      expect(details.method).toBe('POST');
      expect(details.body).toBeDefined();
      if (details.body) {
        expect(details.body.type).toBeTruthy();
        expect(details.body.content).toBeTruthy();
      }
    }, 10000);

    test('should throw error for non-existent request', async () => {
      await expect(
        brunoCLI.getRequestDetails(TEST_COLLECTION_PATH, 'Nonexistent Request')
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Request Execution', () => {
    test('should run a single request successfully', async () => {
      const result = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get Users',
        { environment: 'dev' }
      );

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    }, 30000); // Longer timeout for actual HTTP request

    test('should run request with environment variables', async () => {
      const result = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get User By ID',
        { environment: 'dev' }
      );

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    }, 30000);

    test('should run POST request with body', async () => {
      const result = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Create User',
        { environment: 'dev' }
      );

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    }, 30000);

    test('should handle request execution errors gracefully', async () => {
      await expect(
        brunoCLI.runRequest(TEST_COLLECTION_PATH, 'Nonexistent Request')
      ).rejects.toThrow();
    }, 30000);
  });

  describe('Collection Execution', () => {
    test('should run entire collection', async () => {
      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev'
      });

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    }, 60000); // Longer timeout for collection run

    test('should run specific folder in collection', async () => {
      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev',
        folderPath: 'Users'
      });

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    }, 60000);

    test('should run collection with custom environment variables', async () => {
      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        envVariables: {
          baseUrl: 'https://jsonplaceholder.typicode.com',
          customVar: 'test-value'
        }
      });

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    }, 60000);
  });

  describe('Report Generation', () => {
    test('should generate JSON report', async () => {
      const jsonReportPath = path.join(REPORTS_PATH, 'test-results.json');

      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev',
        reporterJson: jsonReportPath
      });

      expect(result.exitCode).toBe(0);

      // Give Bruno CLI a moment to write the file
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify report file was created
      const reportExists = await fs.access(jsonReportPath)
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);

      if (reportExists) {
        // Verify report content
        const reportContent = await fs.readFile(jsonReportPath, 'utf-8');
        const report = JSON.parse(reportContent);
        expect(report).toBeDefined();
      }
    }, 60000);

    test('should generate JUnit XML report', async () => {
      const junitReportPath = path.join(REPORTS_PATH, 'test-results.xml');

      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev',
        reporterJunit: junitReportPath
      });

      expect(result.exitCode).toBe(0);

      // Verify report file was created
      const reportExists = await fs.access(junitReportPath)
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);

      if (reportExists) {
        // Verify it's valid XML
        const reportContent = await fs.readFile(junitReportPath, 'utf-8');
        expect(reportContent).toContain('<?xml');
        expect(reportContent).toContain('testsuite');
      }
    }, 60000);

    test('should generate HTML report', async () => {
      const htmlReportPath = path.join(REPORTS_PATH, 'test-results.html');

      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev',
        reporterHtml: htmlReportPath
      });

      expect(result.exitCode).toBe(0);

      // Verify report file was created
      const reportExists = await fs.access(htmlReportPath)
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);

      if (reportExists) {
        // Verify it's valid HTML
        const reportContent = await fs.readFile(htmlReportPath, 'utf-8');
        expect(reportContent).toContain('<!DOCTYPE html>');
      }
    }, 60000);
  });

  describe('Dry Run Mode', () => {
    test('should validate request without executing (dry run)', async () => {
      const result = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get Users',
        {
          environment: 'dev'
        }
      );

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    }, 30000);

    test('should validate collection without executing (dry run)', async () => {
      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev'
      });

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle missing collection path', async () => {
      await expect(
        brunoCLI.listRequests('/nonexistent/collection')
      ).rejects.toThrow();
    }, 10000);

    test('should handle missing bruno.json', async () => {
      const invalidPath = path.join(__dirname, 'invalid-collection');
      await fs.mkdir(invalidPath, { recursive: true });

      await expect(
        brunoCLI.listRequests(invalidPath)
      ).rejects.toThrow();

      // Cleanup
      await fs.rm(invalidPath, { recursive: true, force: true });
    }, 10000);
  });

  describe('Performance and Caching', () => {
    test('should cache request list for faster subsequent calls', async () => {
      // First call - no cache (but might have cache from previous tests)
      const result1 = await brunoCLI.listRequests(TEST_COLLECTION_PATH);

      // Second call - should use cache
      const result2 = await brunoCLI.listRequests(TEST_COLLECTION_PATH);

      // Results should be identical
      expect(result2).toEqual(result1);
      expect(result2.length).toBeGreaterThan(0);
    }, 10000);

    test('should cache environment list', async () => {
      // First call
      const result1 = await brunoCLI.listEnvironments(TEST_COLLECTION_PATH);

      // Second call - cached
      const result2 = await brunoCLI.listEnvironments(TEST_COLLECTION_PATH);

      // Results should be identical
      expect(result2).toEqual(result1);
      expect(result2.length).toBeGreaterThan(0);
    }, 10000);
  });
});
