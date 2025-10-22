import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrunoCLI } from '../../bruno-cli.js';
import { mockBrunoResponses } from '../mocks/bruno-cli.mock.js';
import { getPerformanceManager } from '../../performance.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
const mockedFs = fs as any;

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

import { execa } from 'execa';
const mockedExeca = execa as any;

describe('BrunoCLI', () => {
  let brunoCLI: BrunoCLI;
  const testCollectionPath = '/test/collection';

  beforeEach(() => {
    brunoCLI = new BrunoCLI();
    vi.clearAllMocks();
    // Clear performance manager cache
    getPerformanceManager().clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAvailable()', () => {
    test('should return true when Bruno CLI is available', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '@usebruno/cli/1.40.0',
        stderr: '',
        exitCode: 0
      } as any);

      const result = await brunoCLI.isAvailable();
      expect(result).toBe(true);
    });

    test('should return false when Bruno CLI is not available', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('Command not found'));

      const result = await brunoCLI.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('listRequests()', () => {
    beforeEach(() => {
      // Mock directory structure
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true
      } as any);

      mockedFs.access.mockResolvedValue(undefined);
    });

    test('should list all requests in a collection', async () => {
      // Mock collection structure
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'bruno.json', isFile: () => true, isDirectory: () => false },
        { name: 'Users', isFile: () => false, isDirectory: () => true },
        { name: 'Posts', isFile: () => false, isDirectory: () => true }
      ] as any);

      // Mock Users folder
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Get Users.bru', isFile: () => true, isDirectory: () => false },
        { name: 'Get User by ID.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mock Posts folder
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Get Posts.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mock file reads for each .bru file
      mockedFs.readFile.mockImplementation((async (filePath: string) => {
        if (filePath.includes('Get Users')) {
          return `meta {
  name: Get Users
  type: http
  seq: 1
}

get {
  url: https://jsonplaceholder.typicode.com/users
}`;
        }
        if (filePath.includes('Get User by ID')) {
          return `meta {
  name: Get User by ID
  type: http
  seq: 2
}

get {
  url: https://jsonplaceholder.typicode.com/users/1
}`;
        }
        if (filePath.includes('Get Posts')) {
          return `meta {
  name: Get Posts
  type: http
  seq: 1
}

get {
  url: https://jsonplaceholder.typicode.com/posts
}`;
        }
        return '';
      }) as any);

      const requests = await brunoCLI.listRequests(testCollectionPath);

      expect(requests).toHaveLength(3);
      expect(requests[0]).toMatchObject({
        name: 'Get Users',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users'
      });
      expect(requests[1]).toMatchObject({
        name: 'Get User by ID',
        method: 'GET'
      });
      expect(requests[2]).toMatchObject({
        name: 'Get Posts',
        method: 'GET'
      });
    });

    test('should return empty array for empty collection', async () => {
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'bruno.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      const requests = await brunoCLI.listRequests(testCollectionPath);

      expect(requests).toHaveLength(0);
    });

    test('should throw error if collection path does not exist', async () => {
      mockedFs.stat.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      await expect(brunoCLI.listRequests('/invalid/path')).rejects.toThrow();
    });

    test('should throw error if bruno.json is missing', async () => {
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true
      } as any);

      mockedFs.access.mockRejectedValueOnce(new Error('bruno.json not found'));
      mockedFs.readdir.mockRejectedValueOnce(new Error('bruno.json not found'));

      await expect(brunoCLI.listRequests(testCollectionPath)).rejects.toThrow();
    });
  });

  describe('discoverCollections()', () => {
    test('should discover collections recursively', async () => {
      // Mock root directory
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'project1', isFile: () => false, isDirectory: () => true },
        { name: 'project2', isFile: () => false, isDirectory: () => true },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true }
      ] as any);

      // Mock project1 - has bruno.json
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'bruno.json', isFile: () => true, isDirectory: () => false },
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);

      // Mock project2 - has subdirectory with collection
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'api-tests', isFile: () => false, isDirectory: () => true }
      ] as any);

      // Mock api-tests - has bruno.json
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'bruno.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      const collections = await brunoCLI.discoverCollections('/test/projects');

      expect(collections).toHaveLength(2);
      expect(collections).toContain('/test/projects/project1');
      expect(collections).toContain('/test/projects/project2/api-tests');
    });

    test('should respect maxDepth parameter', async () => {
      mockedFs.readdir.mockResolvedValue([
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ] as any);

      const collections = await brunoCLI.discoverCollections('/test', 0);

      expect(collections).toHaveLength(0);
      expect(mockedFs.readdir).toHaveBeenCalledTimes(1);
    });

    test('should skip hidden directories and node_modules', async () => {
      mockedFs.readdir.mockResolvedValueOnce([
        { name: '.git', isFile: () => false, isDirectory: () => true },
        { name: '.vscode', isFile: () => false, isDirectory: () => true },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true },
        { name: 'valid-dir', isFile: () => false, isDirectory: () => true }
      ] as any);

      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'bruno.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      const collections = await brunoCLI.discoverCollections('/test');

      expect(collections).toHaveLength(1);
      expect(collections[0]).toBe('/test/valid-dir');
    });
  });

  describe('listEnvironments()', () => {
    test('should list all environments with variables', async () => {
      const envPath = path.join(testCollectionPath, 'environments');

      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'dev.bru', isFile: () => true, isDirectory: () => false },
        { name: 'staging.bru', isFile: () => true, isDirectory: () => false },
        { name: 'production.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockedFs.readFile.mockImplementation((async (filePath: string) => {
        if (filePath.includes('dev.bru')) {
          return `vars {
  baseUrl: https://dev.api.example.com
  apiKey: dev-key-123
}`;
        }
        if (filePath.includes('staging.bru')) {
          return `vars {
  baseUrl: https://staging.api.example.com
  apiKey: staging-key-456
}`;
        }
        if (filePath.includes('production.bru')) {
          return `vars {
  baseUrl: https://api.example.com
  apiKey: prod-key-789
}`;
        }
        return '';
      }) as any);

      const environments = await brunoCLI.listEnvironments(testCollectionPath);

      expect(environments).toHaveLength(3);
      expect(environments[0]).toMatchObject({
        name: 'dev',
        variables: {
          baseUrl: 'https://dev.api.example.com',
          apiKey: 'dev-key-123'
        }
      });
    });

    test('should return empty array if environments directory does not exist', async () => {
      mockedFs.readdir.mockRejectedValueOnce(new Error('ENOENT'));

      const environments = await brunoCLI.listEnvironments(testCollectionPath);

      expect(environments).toHaveLength(0);
    });
  });

  describe('validateEnvironment()', () => {
    test('should validate a valid environment', async () => {
      mockedFs.access.mockResolvedValueOnce(undefined);
      mockedFs.stat.mockResolvedValueOnce({ isFile: () => true } as any);
      mockedFs.readFile.mockResolvedValueOnce(`vars {
  baseUrl: https://dev.api.example.com
  apiKey: dev-key-123
}`);

      const result = await brunoCLI.validateEnvironment(testCollectionPath, 'dev');

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.variables).toMatchObject({
        baseUrl: 'https://dev.api.example.com',
        apiKey: 'dev-key-123'
      });
    });

    test('should detect non-existent environment', async () => {
      mockedFs.access.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await brunoCLI.validateEnvironment(testCollectionPath, 'nonexistent');

      expect(result.valid).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should detect hardcoded secrets', async () => {
      mockedFs.access.mockResolvedValueOnce(undefined);
      mockedFs.stat.mockResolvedValueOnce({ isFile: () => true } as any);
      mockedFs.readFile.mockResolvedValueOnce(`vars {
  baseUrl: https://dev.api.example.com
  password: hardcoded-password-123
  apiKey: secret-key-456
}`);

      const result = await brunoCLI.validateEnvironment(testCollectionPath, 'dev');

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('hardcoded'))).toBe(true);
    });
  });

  describe('getRequestDetails()', () => {
    test('should extract request details from .bru file', async () => {
      const bruContent = `meta {
  name: Get Users
  type: http-request
  seq: 1
}

get {
  url: https://jsonplaceholder.typicode.com/users
}

headers {
  Content-Type: application/json
  Accept: application/json
}

auth {
  mode: none
}

tests {
  test("Status should be 200", function() {
    expect(res.status).to.equal(200);
  });
}`;

      // Mock the directory structure for findRequestFile
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);

      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Get Users.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mock readFile to return the .bru content
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (String(filePath).includes('Get Users.bru')) {
          return bruContent;
        }
        return '';
      });

      const details = await brunoCLI.getRequestDetails(testCollectionPath, 'Get Users');

      expect(details.name).toBe('Get Users');
      expect(details.method).toBe('GET');
      expect(details.url).toBe('https://jsonplaceholder.typicode.com/users');
      expect(details.headers['Content-Type']).toBe('application/json');
      expect(details.auth).toBe('none');
      expect(details.tests).toBeDefined();
    });

    test('should handle POST requests with body', async () => {
      const bruContent = `meta {
  name: Create User
  type: http-request
  seq: 2
}

post {
  url: https://jsonplaceholder.typicode.com/users
}

body:json {
  {
    "name": "John Doe",
    "email": "john@example.com"
  }
}`;

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);

      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Create User.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mock readFile to return the .bru content
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (String(filePath).includes('Create User.bru')) {
          return bruContent;
        }
        return '';
      });

      const details = await brunoCLI.getRequestDetails(testCollectionPath, 'Create User');

      expect(details.name).toBe('Create User');
      expect(details.method).toBe('POST');
      expect(details.body).toBeDefined();
      expect(details.body?.type).toBe('json');
    });

    test('should throw error for non-existent request', async () => {
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);

      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Other.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      await expect(
        brunoCLI.getRequestDetails(testCollectionPath, 'NonExistent')
      ).rejects.toThrow();
    });
  });

  describe('validateCollection()', () => {
    test('should validate a valid collection', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      // Mock bruno.json and .bru file reads
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (String(filePath).includes('bruno.json')) {
          return JSON.stringify({
            version: '1',
            name: 'Test Collection',
            type: 'collection'
          });
        }
        if (String(filePath).includes('test.bru')) {
          return `meta {
  name: Test
  type: http-request
}

get {
  url: https://example.com
}`;
        }
        return '';
      });

      // Mock collection directory structure for listRequests
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'bruno.json', isFile: () => true, isDirectory: () => false },
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);

      // Mock requests folder for listRequests
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'test.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mock for getRequestDetails (findRequestFile)
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);

      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'test.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mock for listEnvironments
      mockedFs.readdir.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await brunoCLI.validateCollection(testCollectionPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.hasBrunoJson).toBe(true);
      expect(result.summary.totalRequests).toBeGreaterThan(0);
    });

    test('should detect missing bruno.json', async () => {
      mockedFs.access.mockResolvedValueOnce(undefined); // directory exists
      mockedFs.access.mockRejectedValueOnce(new Error('bruno.json not found'));
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      const result = await brunoCLI.validateCollection(testCollectionPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('bruno.json'))).toBe(true);
    });
  });

  describe('runRequest()', () => {
    test('should execute a request successfully', async () => {
      // Mock directory structure for findBrunoRequests
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Get Users.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Mock temp file for JSON output
      mockedFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        // Mock reading the temp JSON output file
        if (String(filePath).includes('.json')) {
          return JSON.stringify(mockBrunoResponses.successfulRequest);
        }
        return '';
      });
      mockedFs.unlink = vi.fn().mockResolvedValue(undefined);

      const result = await brunoCLI.runRequest(testCollectionPath, 'Get Users');

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(mockedExeca).toHaveBeenCalled();
    });

    test('should handle request execution errors', async () => {
      // Mock directory structure for findBrunoRequests
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Invalid Request.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockedExeca.mockRejectedValueOnce(new Error('Request failed'));

      await expect(
        brunoCLI.runRequest(testCollectionPath, 'Invalid Request')
      ).rejects.toThrow();
    });

    test('should support environment parameter', async () => {
      // Mock directory structure for findBrunoRequests
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'requests', isFile: () => false, isDirectory: () => true }
      ] as any);
      mockedFs.readdir.mockResolvedValueOnce([
        { name: 'Get Users.bru', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      mockedFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        // Mock reading the temp JSON output file
        if (String(filePath).includes('.json')) {
          return JSON.stringify(mockBrunoResponses.successfulRequest);
        }
        return '';
      });
      mockedFs.unlink = vi.fn().mockResolvedValue(undefined);

      await brunoCLI.runRequest(testCollectionPath, 'Get Users', {
        environment: 'dev'
      });

      expect(mockedExeca).toHaveBeenCalled();
      const execaArgs = mockedExeca.mock.calls[0];
      expect(execaArgs[1]).toContain('--env');
    });
  });

  describe('runCollection()', () => {
    test('should execute a collection successfully', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(mockBrunoResponses.successfulCollection),
        stderr: '',
        exitCode: 0
      });

      mockedFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValueOnce(
        JSON.stringify(mockBrunoResponses.successfulCollection)
      );
      mockedFs.unlink = vi.fn().mockResolvedValue(undefined);

      const result = await brunoCLI.runCollection(testCollectionPath);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalRequests).toBeGreaterThan(0);
      expect(mockedExeca).toHaveBeenCalled();
    });

    test('should support folder path parameter', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(mockBrunoResponses.successfulCollection),
        stderr: '',
        exitCode: 0
      });

      mockedFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValueOnce(
        JSON.stringify(mockBrunoResponses.successfulCollection)
      );
      mockedFs.unlink = vi.fn().mockResolvedValue(undefined);

      await brunoCLI.runCollection(testCollectionPath, {
        folderPath: 'users'
      });

      expect(mockedExeca).toHaveBeenCalled();
    });

    test('should support environment variables', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(mockBrunoResponses.successfulCollection),
        stderr: '',
        exitCode: 0
      });

      mockedFs.writeFile = vi.fn().mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValueOnce(
        JSON.stringify(mockBrunoResponses.successfulCollection)
      );
      mockedFs.unlink = vi.fn().mockResolvedValue(undefined);

      await brunoCLI.runCollection(testCollectionPath, {
        envVariables: {
          API_KEY: 'test-key-123'
        }
      });

      expect(mockedExeca).toHaveBeenCalled();
      const execaArgs = mockedExeca.mock.calls[0];
      expect(execaArgs[1]).toContain('--env-var');
    });

    test('should handle collection execution errors', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('Collection failed'));

      await expect(
        brunoCLI.runCollection(testCollectionPath)
      ).rejects.toThrow();
    });
  });
});
