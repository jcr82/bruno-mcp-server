import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeInput,
  validatePath,
  validateRequestName,
  validateFolderPath,
  validateEnvVarName,
  validateEnvVarValue,
  sanitizeEnvVariables,
  maskSecretsInError,
  validateToolParameters,
  logSecurityEvent
} from '../../security.js';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
const mockedFs = fs as any;

// Create a variable to hold the mocked config that can be changed per test
let mockedAllowedPaths: string[] = [];

// Mock the config loader
vi.mock('../../config.js', () => ({
  getConfigLoader: () => ({
    getSecurity: () => ({
      allowedPaths: mockedAllowedPaths,
      maskSecrets: true,
      secretPatterns: ['password', 'token', 'secret', 'key']
    }),
    maskSecrets: (text: string) => text.replace(/password=\w+/g, 'password=***')
  })
}));

// Mock the logger
const mockLogSecurityEvent = vi.fn();
vi.mock('../../logger.js', () => ({
  getLogger: () => ({
    logSecurityEvent: mockLogSecurityEvent
  })
}));

describe('Security', () => {
  describe('sanitizeInput()', () => {
    test('should remove dangerous characters', () => {
      const input = 'test; rm -rf files';
      const sanitized = sanitizeInput(input);

      expect(sanitized).not.toContain(';');
      expect(sanitized).toBe('test rm -rf files');
    });

    test('should remove command injection characters', () => {
      const inputs = [
        { input: 'test|command', expected: 'testcommand' },
        { input: 'test`whoami`', expected: 'testwhoami' },
        { input: 'test$(id)', expected: 'testid' },
        { input: 'test&command', expected: 'testcommand' }
      ];

      inputs.forEach(({ input, expected }) => {
        expect(sanitizeInput(input)).toBe(expected);
      });
    });

    test('should allow normal characters', () => {
      const input = 'My-Collection_Name123.bru';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe(input);
    });

    test('should allow spaces and slashes', () => {
      const input = 'path/to/my collection';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBe(input);
    });
  });

  describe('validateRequestName()', () => {
    test('should accept valid request names', () => {
      const validNames = [
        'Get Users',
        'Create User',
        'Update-User',
        'DELETE_user_123'
      ];

      validNames.forEach(name => {
        const result = validateRequestName(name);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test('should reject names with path traversal', () => {
      const invalidNames = [
        '../secret',
        'test/../file',
        'folder\\file'
      ];

      invalidNames.forEach(name => {
        const result = validateRequestName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('path traversal');
      });
    });

    test('should reject names with null bytes', () => {
      const name = 'test\x00file';
      const result = validateRequestName(name);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });

    test('should reject names starting with slash', () => {
      const name = '/absolute/path';
      const result = validateRequestName(name);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('path traversal');
    });
  });

  describe('validateFolderPath()', () => {
    test('should accept valid relative folder paths', () => {
      const validPaths = [
        'users',
        'api/v1',
        'tests/integration',
        'my-folder'
      ];

      validPaths.forEach(path => {
        const result = validateFolderPath(path);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test('should reject paths with directory traversal', () => {
      const invalidPaths = [
        '../secret',
        'folder/../data',
        'test/../../file'
      ];

      invalidPaths.forEach(path => {
        const result = validateFolderPath(path);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('path traversal');
      });
    });

    test('should reject absolute paths', () => {
      const absolutePaths = [
        '/absolute/path',
        '/usr/local/collections'
      ];

      absolutePaths.forEach(path => {
        const result = validateFolderPath(path);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('relative');
      });
    });
  });

  describe('validateEnvVarName()', () => {
    test('should accept valid environment variable names', () => {
      const validNames = [
        'API_KEY',
        'BASE_URL',
        '_PRIVATE',
        'my_var_123',
        'MixedCase_123'
      ];

      validNames.forEach(name => {
        expect(validateEnvVarName(name)).toBe(true);
      });
    });

    test('should reject invalid environment variable names', () => {
      const invalidNames = [
        '123_STARTS_WITH_NUMBER',
        'has-dash',
        'has space',
        'has@symbol',
        ''
      ];

      invalidNames.forEach(name => {
        expect(validateEnvVarName(name)).toBe(false);
      });
    });
  });

  describe('validateEnvVarValue()', () => {
    test('should accept safe environment variable values', () => {
      const validValues = [
        'https://api.example.com',
        'simple-value-123',
        'value with spaces',
        '/path/to/file'
      ];

      validValues.forEach(value => {
        expect(validateEnvVarValue(value)).toBe(true);
      });
    });

    test('should reject values with command injection patterns', () => {
      const dangerousValues = [
        '$(whoami)',
        '${USER}',
        '`ls -la`',
        'value; rm -rf /',
        'test|command'
      ];

      dangerousValues.forEach(value => {
        expect(validateEnvVarValue(value)).toBe(false);
      });
    });
  });

  describe('sanitizeEnvVariables()', () => {
    test('should return valid environment variables', () => {
      const envVars = {
        API_KEY: 'abc123',
        BASE_URL: 'https://api.example.com',
        TIMEOUT: '30000'
      };

      const result = sanitizeEnvVariables(envVars);

      expect(result.sanitized).toEqual(envVars);
      expect(result.warnings).toHaveLength(0);
    });

    test('should filter out invalid variable names', () => {
      const envVars = {
        'VALID_VAR': 'value1',
        'invalid-var': 'value2',
        'has space': 'value3'
      };

      const result = sanitizeEnvVariables(envVars);

      expect(result.sanitized).toEqual({ VALID_VAR: 'value1' });
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('invalid-var');
      expect(result.warnings[1]).toContain('has space');
    });

    test('should filter out unsafe variable values', () => {
      const envVars = {
        SAFE_VAR: 'safe-value',
        UNSAFE_VAR: '$(whoami)',
        ANOTHER_UNSAFE: '`command`'
      };

      const result = sanitizeEnvVariables(envVars);

      expect(result.sanitized).toEqual({ SAFE_VAR: 'safe-value' });
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('UNSAFE_VAR');
      expect(result.warnings[1]).toContain('ANOTHER_UNSAFE');
    });

    test('should return empty object for all invalid variables', () => {
      const envVars = {
        'invalid-name': '$(command)',
        '123invalid': '`test`'
      };

      const result = sanitizeEnvVariables(envVars);

      expect(result.sanitized).toEqual({});
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('maskSecretsInError()', () => {
    test('should mask secrets in error message', () => {
      const error = new Error('Failed to authenticate with password=secret123');
      const masked = maskSecretsInError(error);

      expect(masked.message).not.toContain('secret123');
      expect(masked.message).toContain('***');
      expect(masked.name).toBe(error.name);
    });

    test('should preserve error name', () => {
      const error = new Error('Test error');
      error.name = 'CustomError';

      const masked = maskSecretsInError(error);

      expect(masked.name).toBe('CustomError');
    });

    test('should mask secrets in stack trace', () => {
      const error = new Error('Test error password=secret');
      error.stack = 'Error: Test error password=secret123\n  at test.js:10:5';

      const masked = maskSecretsInError(error);

      expect(masked.stack).not.toContain('secret123');
      expect(masked.stack).toContain('***');
    });

    test('should handle errors without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;

      const masked = maskSecretsInError(error);

      expect(masked.message).toBe(error.message);
      expect(masked.stack).toBeUndefined();
    });
  });

  describe('validatePath()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockedAllowedPaths = []; // Reset to empty (allow all)
    });

    test('should allow any path when allowedPaths is empty', async () => {
      mockedAllowedPaths = [];

      const result = await validatePath('/any/path');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject non-existent path when allowedPaths is configured', async () => {
      mockedAllowedPaths = ['/home/user/collections'];
      mockedFs.access.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await validatePath('/home/user/collections/test');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    test('should accept path within allowed directory', async () => {
      mockedAllowedPaths = ['/home/user/collections'];
      mockedFs.access.mockResolvedValueOnce(undefined);

      const result = await validatePath('/home/user/collections/api-tests');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject path outside allowed directories', async () => {
      mockedAllowedPaths = ['/home/user/collections'];
      mockedFs.access.mockResolvedValueOnce(undefined);

      const result = await validatePath('/var/lib/other');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not within allowed directories');
    });

    test('should handle validation errors gracefully', async () => {
      mockedAllowedPaths = ['/home/user/collections'];
      mockedFs.access.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await validatePath('/home/user/collections/test');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('validateToolParameters()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockedAllowedPaths = []; // Reset to empty
      mockedFs.access.mockResolvedValue(undefined); // Mock path exists by default
    });

    test('should validate all parameters successfully', async () => {
      const params = {
        collectionPath: '/valid/path',
        requestName: 'Get Users',
        folderPath: 'api/v1',
        envVariables: {
          API_KEY: 'test-key',
          BASE_URL: 'https://api.example.com'
        }
      };

      const result = await validateToolParameters(params);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should detect invalid collection path', async () => {
      mockedAllowedPaths = ['/allowed/path'];
      mockedFs.access.mockRejectedValueOnce(new Error('ENOENT'));

      const params = {
        collectionPath: '/invalid/path'
      };

      const result = await validateToolParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].toLowerCase()).toContain('path');
    });

    test('should detect invalid request name', async () => {
      const params = {
        requestName: '../../../secret'
      };

      const result = await validateToolParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].toLowerCase()).toContain('request');
    });

    test('should detect invalid folder path', async () => {
      const params = {
        folderPath: '/absolute/path'
      };

      const result = await validateToolParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].toLowerCase()).toContain('folder');
    });

    test('should collect warnings for invalid env variables', async () => {
      const params = {
        envVariables: {
          'VALID_VAR': 'value',
          'invalid-var': 'value',
          'UNSAFE': '$(whoami)'
        }
      };

      const result = await validateToolParameters(params);

      expect(result.valid).toBe(true); // Still valid, just warnings
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should handle multiple errors', async () => {
      const params = {
        requestName: '../secret',
        folderPath: '/absolute/path'
      };

      const result = await validateToolParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });

    test('should handle empty parameters', async () => {
      const result = await validateToolParameters({});

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('logSecurityEvent()', () => {
    beforeEach(() => {
      mockLogSecurityEvent.mockClear();
    });

    test('should log path validation event', () => {
      logSecurityEvent({
        type: 'path_validation',
        details: 'Path validated successfully',
        severity: 'info'
      });

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'path_validation',
        'Path validated successfully',
        'info'
      );
    });

    test('should log input sanitization event', () => {
      logSecurityEvent({
        type: 'input_sanitization',
        details: 'Removed dangerous characters',
        severity: 'warning'
      });

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'input_sanitization',
        'Removed dangerous characters',
        'warning'
      );
    });

    test('should log env var validation event', () => {
      logSecurityEvent({
        type: 'env_var_validation',
        details: 'Invalid environment variable rejected',
        severity: 'warning'
      });

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'env_var_validation',
        'Invalid environment variable rejected',
        'warning'
      );
    });

    test('should log access denied event', () => {
      logSecurityEvent({
        type: 'access_denied',
        details: 'Path outside allowed directories',
        severity: 'error'
      });

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'access_denied',
        'Path outside allowed directories',
        'error'
      );
    });
  });
});
