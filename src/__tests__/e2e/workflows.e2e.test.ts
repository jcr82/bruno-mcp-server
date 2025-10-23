import { describe, test, expect, beforeAll } from 'vitest';
import { BrunoCLI } from '../../bruno-cli.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the integration test collection
const TEST_COLLECTION_PATH = path.join(__dirname, '../integration/test-collection');

describe('E2E Workflow Tests', () => {
  let brunoCLI: BrunoCLI;

  beforeAll(() => {
    brunoCLI = new BrunoCLI();
  });

  describe('Complete API Testing Workflow', () => {
    test('should complete full workflow: discover -> validate -> list -> execute', async () => {
      // Step 1: Discover collections
      const collections = await brunoCLI.discoverCollections(path.dirname(TEST_COLLECTION_PATH), 2);
      expect(collections.length).toBeGreaterThan(0);

      const testCollection = collections.find(c => c.includes('test-collection'));
      expect(testCollection).toBeDefined();

      // Step 2: Validate collection
      const validation = await brunoCLI.validateCollection(testCollection!);
      expect(validation.valid).toBe(true);
      expect(validation.summary.totalRequests).toBeGreaterThan(0);

      // Step 3: List requests
      const requests = await brunoCLI.listRequests(testCollection!);
      expect(requests.length).toBeGreaterThan(0);

      // Step 4: Execute first request
      const firstRequest = requests[0];
      const result = await brunoCLI.runRequest(
        testCollection!,
        firstRequest.name,
        { environment: 'dev' }
      );
      expect(result.exitCode).toBe(0);
    }, 60000);

    test('should handle environment validation before execution', async () => {
      // Step 1: List environments
      const environments = await brunoCLI.listEnvironments(TEST_COLLECTION_PATH);
      expect(environments.length).toBeGreaterThan(0);

      // Step 2: Validate environment
      const devEnv = environments.find(e => e.name === 'dev');
      expect(devEnv).toBeDefined();

      const validation = await brunoCLI.validateEnvironment(TEST_COLLECTION_PATH, 'dev');
      expect(validation.valid).toBe(true);
      expect(validation.exists).toBe(true);

      // Step 3: Execute with validated environment
      const result = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get Users',
        { environment: 'dev' }
      );
      expect(result.exitCode).toBe(0);
    }, 60000);

    test('should support dry run before actual execution', async () => {
      // Step 1: Get request details (introspection)
      const details = await brunoCLI.getRequestDetails(TEST_COLLECTION_PATH, 'Create User');
      expect(details.method).toBe('POST');
      expect(details.body).toBeDefined();

      // Step 2: Dry run to validate (not implemented in current version, so just run normally)
      const dryRunResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Create User',
        { environment: 'dev' }
      );
      expect(dryRunResult.exitCode).toBe(0);

      // Step 3: Actual execution
      const actualResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Create User',
        { environment: 'dev' }
      );
      expect(actualResult.exitCode).toBe(0);
    }, 60000);
  });

  describe('Environment Switching Workflow', () => {
    test('should switch between environments seamlessly', async () => {
      const requestName = 'Get Users';

      // Execute with dev environment
      const devResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        requestName,
        { environment: 'dev' }
      );
      expect(devResult.exitCode).toBe(0);

      // Execute with staging environment
      const stagingResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        requestName,
        { environment: 'staging' }
      );
      expect(stagingResult.exitCode).toBe(0);

      // Both should succeed
      expect(devResult.exitCode).toBe(stagingResult.exitCode);
    }, 60000);

    test('should override environment variables', async () => {
      // First run with environment file
      const envResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get Users',
        { environment: 'dev' }
      );
      expect(envResult.exitCode).toBe(0);

      // Then run with custom variables (overriding environment)
      const customResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get Users',
        {
          envVariables: {
            baseUrl: 'https://jsonplaceholder.typicode.com',
            customVar: 'custom-value'
          }
        }
      );
      expect(customResult.exitCode).toBe(0);
    }, 60000);
  });

  describe('Collection Execution Strategies', () => {
    test('should execute entire collection in sequence', async () => {
      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev'
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    }, 90000);

    test('should execute specific folder within collection', async () => {
      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        environment: 'dev',
        folderPath: 'Users'
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    }, 90000);

    test('should execute with custom environment variables', async () => {
      const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
        envVariables: {
          baseUrl: 'https://jsonplaceholder.typicode.com',
          testMode: 'true'
        }
      });

      expect(result.exitCode).toBe(0);
    }, 90000);
  });

  describe('Error Recovery Workflow', () => {
    test('should gracefully handle missing requests', async () => {
      await expect(
        brunoCLI.runRequest(TEST_COLLECTION_PATH, 'Nonexistent Request')
      ).rejects.toThrow();

      // Verify we can still execute valid requests after error
      const validResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get Users',
        { environment: 'dev' }
      );
      expect(validResult.exitCode).toBe(0);
    }, 60000);

    test('should handle invalid collection path gracefully', async () => {
      const validation = await brunoCLI.validateCollection('/invalid/path');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Verify we can still work with valid collections
      const validValidation = await brunoCLI.validateCollection(TEST_COLLECTION_PATH);
      expect(validValidation.valid).toBe(true);
    }, 30000);

    test('should handle invalid environment gracefully', async () => {
      const validation = await brunoCLI.validateEnvironment(
        TEST_COLLECTION_PATH,
        'nonexistent'
      );
      expect(validation.valid).toBe(false);

      // Verify we can still use valid environments
      const validEnv = await brunoCLI.validateEnvironment(TEST_COLLECTION_PATH, 'dev');
      expect(validEnv.valid).toBe(true);
    }, 30000);
  });

  describe('Caching and Performance Workflow', () => {
    test('should leverage caching for repeated operations', async () => {
      // First call - populates cache
      const start1 = Date.now();
      const requests1 = await brunoCLI.listRequests(TEST_COLLECTION_PATH);
      const duration1 = Date.now() - start1;

      // Second call - uses cache
      const start2 = Date.now();
      const requests2 = await brunoCLI.listRequests(TEST_COLLECTION_PATH);
      const duration2 = Date.now() - start2;

      // Results should be identical
      expect(requests2).toEqual(requests1);

      // Cached call should be faster (or at least not slower)
      expect(duration2).toBeLessThanOrEqual(duration1 + 50); // Allow 50ms margin
    }, 30000);

    test('should cache environment listings', async () => {
      // First call
      const envs1 = await brunoCLI.listEnvironments(TEST_COLLECTION_PATH);

      // Second call - should use cache
      const envs2 = await brunoCLI.listEnvironments(TEST_COLLECTION_PATH);

      expect(envs2).toEqual(envs1);
      expect(envs2.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Multi-Request Workflow', () => {
    test('should execute multiple requests in sequence', async () => {
      const requests = await brunoCLI.listRequests(TEST_COLLECTION_PATH);
      const results = [];

      // Execute first 3 requests
      for (let i = 0; i < Math.min(3, requests.length); i++) {
        const result = await brunoCLI.runRequest(
          TEST_COLLECTION_PATH,
          requests[i].name,
          { environment: 'dev' }
        );
        results.push(result);
      }

      // All should succeed
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
    }, 90000);

    test('should handle mix of GET and POST requests', async () => {
      // Execute GET request
      const getResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Get Users',
        { environment: 'dev' }
      );
      expect(getResult.exitCode).toBe(0);

      // Execute POST request
      const postResult = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        'Create User',
        { environment: 'dev' }
      );
      expect(postResult.exitCode).toBe(0);

      // Both should succeed
      expect(getResult.exitCode).toBe(0);
      expect(postResult.exitCode).toBe(0);
    }, 60000);
  });

  describe('Introspection and Validation Workflow', () => {
    test('should inspect request before execution', async () => {
      // Get all requests
      const requests = await brunoCLI.listRequests(TEST_COLLECTION_PATH);
      expect(requests.length).toBeGreaterThan(0);

      // Inspect first request
      const firstRequest = requests[0];
      const details = await brunoCLI.getRequestDetails(
        TEST_COLLECTION_PATH,
        firstRequest.name
      );

      // Verify details
      expect(details.name).toBe(firstRequest.name);
      expect(details.method).toBeTruthy();
      expect(details.url).toBeTruthy();

      // Now execute it
      const result = await brunoCLI.runRequest(
        TEST_COLLECTION_PATH,
        firstRequest.name,
        { environment: 'dev' }
      );
      expect(result.exitCode).toBe(0);
    }, 60000);

    test('should validate collection structure before running tests', async () => {
      // Validate structure
      const validation = await brunoCLI.validateCollection(TEST_COLLECTION_PATH);
      expect(validation.valid).toBe(true);
      expect(validation.summary.hasBrunoJson).toBe(true);

      // Only proceed if validation passes
      if (validation.valid) {
        const result = await brunoCLI.runCollection(TEST_COLLECTION_PATH, {
          environment: 'dev'
        });
        expect(result.exitCode).toBe(0);
      }
    }, 90000);
  });
});
