import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLogger, resetLogger, LogLevel, LogFormat } from '../../logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
vi.mock('fs/promises');
const mockedFs = fs as any;

// Mock config
let mockConfig: any = {
  logging: {
    level: 'info',
    format: 'text',
    logFile: undefined,
    maxLogSize: 10 * 1024 * 1024,
    maxLogFiles: 5
  }
};

vi.mock('../../config.js', () => ({
  getConfigLoader: () => ({
    getConfig: () => mockConfig
  })
}));

// Spy on console.error
let consoleErrorSpy: any;

describe('Logger', () => {
  beforeEach(() => {
    // Reset logger singleton before each test
    resetLogger();

    // Reset mock config
    mockConfig = {
      logging: {
        level: 'info',
        format: 'text',
        logFile: undefined,
        maxLogSize: 10 * 1024 * 1024,
        maxLogFiles: 5
      }
    };

    // Reset fs mocks
    vi.clearAllMocks();
    mockedFs.mkdir = vi.fn().mockResolvedValue(undefined);
    mockedFs.stat = vi.fn().mockRejectedValue(new Error('ENOENT'));
    mockedFs.appendFile = vi.fn().mockResolvedValue(undefined);
    mockedFs.rename = vi.fn().mockResolvedValue(undefined);
    mockedFs.unlink = vi.fn().mockResolvedValue(undefined);

    // Spy on console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getLogger()', () => {
    test('should return singleton instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    test('should create new instance after reset', () => {
      const logger1 = getLogger();
      resetLogger();
      const logger2 = getLogger();
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('initialization', () => {
    test('should initialize with default config', () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    test('should initialize with custom log file path', () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    test('should initialize with custom max log size', () => {
      mockConfig.logging.maxLogSize = 5 * 1024 * 1024;
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    test('should initialize with custom max log files', () => {
      mockConfig.logging.maxLogFiles = 10;
      const logger = getLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('log levels', () => {
    test('should log debug messages when level is debug', async () => {
      mockConfig.logging.level = 'debug';
      const logger = getLogger();

      await logger.debug('Debug message', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('DEBUG');
      expect(logOutput).toContain('Debug message');
    });

    test('should log info messages when level is info', async () => {
      mockConfig.logging.level = 'info';
      const logger = getLogger();

      await logger.info('Info message', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('Info message');
    });

    test('should log warning messages when level is warning', async () => {
      mockConfig.logging.level = 'warning';
      const logger = getLogger();

      await logger.warning('Warning message', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('WARNING');
      expect(logOutput).toContain('Warning message');
    });

    test('should log error messages', async () => {
      mockConfig.logging.level = 'error';
      const logger = getLogger();
      const error = new Error('Test error');

      await logger.error('Error message', error, { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('Error message');
      expect(logOutput).toContain('Test error');
    });

    test('should not log debug when level is info', async () => {
      mockConfig.logging.level = 'info';
      const logger = getLogger();

      await logger.debug('Debug message');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should not log info when level is warning', async () => {
      mockConfig.logging.level = 'warning';
      const logger = getLogger();

      await logger.info('Info message');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should not log warning when level is error', async () => {
      mockConfig.logging.level = 'error';
      const logger = getLogger();

      await logger.warning('Warning message');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('log formats', () => {
    test('should format logs as JSON when format is json', async () => {
      mockConfig.logging.format = 'json';
      const logger = getLogger();

      await logger.info('Test message', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];

      // Parse JSON to verify it's valid
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.context).toEqual({ key: 'value' });
      expect(parsed.timestamp).toBeDefined();
    });

    test('should format logs as text when format is text', async () => {
      mockConfig.logging.format = 'text';
      const logger = getLogger();

      await logger.info('Test message', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toMatch(/\[.*\] INFO: Test message/);
      expect(logOutput).toContain('Context:');
      expect(logOutput).toContain('"key":"value"');
    });

    test('should format error with stack trace in text format', async () => {
      mockConfig.logging.format = 'text';
      const logger = getLogger();
      const error = new Error('Test error');

      await logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('Error occurred');
      expect(logOutput).toContain('Error: Test error');
      expect(logOutput).toContain('Stack:');
    });

    test('should format error in JSON format', async () => {
      mockConfig.logging.format = 'json';
      const logger = getLogger();
      const error = new Error('Test error');

      await logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Error occurred');
      expect(parsed.error.message).toBe('Test error');
      expect(parsed.error.stack).toBeDefined();
    });
  });

  describe('file logging', () => {
    test('should create log directory on first write', async () => {
      mockConfig.logging.logFile = '/tmp/logs/test.log';
      const logger = getLogger();

      await logger.info('Test message');

      expect(mockedFs.mkdir).toHaveBeenCalledWith('/tmp/logs', { recursive: true });
    });

    test('should write to log file when configured', async () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      const logger = getLogger();

      await logger.info('Test message');

      expect(mockedFs.appendFile).toHaveBeenCalled();
      const [filePath, content] = mockedFs.appendFile.mock.calls[0];
      expect(filePath).toBe('/tmp/test.log');
      expect(content).toContain('Test message');
    });

    test('should not write to file when logFile is not configured', async () => {
      mockConfig.logging.logFile = undefined;
      const logger = getLogger();

      await logger.info('Test message');

      expect(mockedFs.appendFile).not.toHaveBeenCalled();
    });

    test('should handle file write errors gracefully', async () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      mockedFs.appendFile = vi.fn().mockRejectedValue(new Error('Write failed'));

      const logger = getLogger();

      // Should not throw
      await expect(logger.info('Test message')).resolves.toBeUndefined();
    });

    test('should handle directory creation errors gracefully', async () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      mockedFs.mkdir = vi.fn().mockRejectedValue(new Error('mkdir failed'));

      const logger = getLogger();

      // Should not throw
      await expect(logger.info('Test message')).resolves.toBeUndefined();
    });
  });

  describe('log rotation', () => {
    test('should rotate logs when size exceeds maxLogSize', async () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      mockConfig.logging.maxLogSize = 100; // Small size to trigger rotation

      // Mock stat to return size near limit
      mockedFs.stat = vi.fn().mockResolvedValue({ size: 50 });

      const logger = getLogger();

      // Write a message that will exceed the limit
      const longMessage = 'x'.repeat(100);
      await logger.info(longMessage);

      // Should have called rename to rotate files
      expect(mockedFs.rename).toHaveBeenCalled();
    });

    test('should rotate existing log files', async () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      mockConfig.logging.maxLogSize = 10;
      mockConfig.logging.maxLogFiles = 3;

      const logger = getLogger();

      // Trigger rotation
      const longMessage = 'x'.repeat(100);
      await logger.info(longMessage);

      // Should rename files in sequence
      expect(mockedFs.rename).toHaveBeenCalled();
    });

    test('should delete oldest log file when exceeding maxLogFiles', async () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      mockConfig.logging.maxLogSize = 10;
      mockConfig.logging.maxLogFiles = 2;

      const logger = getLogger();

      // Trigger rotation
      const longMessage = 'x'.repeat(100);
      await logger.info(longMessage);

      // Should attempt to delete oldest file
      expect(mockedFs.unlink).toHaveBeenCalled();
    });

    test('should handle rotation errors gracefully', async () => {
      mockConfig.logging.logFile = '/tmp/test.log';
      mockConfig.logging.maxLogSize = 10;
      mockedFs.rename = vi.fn().mockRejectedValue(new Error('Rename failed'));

      const logger = getLogger();

      // Should not throw
      const longMessage = 'x'.repeat(100);
      await expect(logger.info(longMessage)).resolves.toBeUndefined();
    });
  });

  describe('logToolExecution()', () => {
    test('should log successful tool execution as info', async () => {
      const logger = getLogger();

      await logger.logToolExecution('bruno_run_request', { collectionPath: '/test' }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('Tool execution: bruno_run_request');
      expect(logOutput).toContain('duration');
      expect(logOutput).toContain('100');
    });

    test('should log failed tool execution as error', async () => {
      const logger = getLogger();

      await logger.logToolExecution('bruno_run_request', { collectionPath: '/test' }, 50, false);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('Tool execution: bruno_run_request');
    });

    test('should sanitize sensitive parameters', async () => {
      const logger = getLogger();

      await logger.logToolExecution('bruno_run_request', {
        password: 'secret123',
        apiKey: 'mykey123',
        token: 'token123'
      }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('secret123');
      expect(logOutput).not.toContain('mykey123');
      expect(logOutput).not.toContain('token123');
      expect(logOutput).toContain('***');
    });
  });

  describe('logSecurityEvent()', () => {
    test('should log info security events', async () => {
      const logger = getLogger();

      await logger.logSecurityEvent('Path validated', '/test/path', 'info');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('Security: Path validated');
      expect(logOutput).toContain('/test/path');
    });

    test('should log warning security events', async () => {
      const logger = getLogger();

      await logger.logSecurityEvent('Suspicious input detected', 'Contains special chars', 'warning');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('WARNING');
      expect(logOutput).toContain('Security: Suspicious input detected');
    });

    test('should log error security events', async () => {
      const logger = getLogger();

      await logger.logSecurityEvent('Access denied', 'Path outside allowed directories', 'error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('Security: Access denied');
    });
  });

  describe('parameter sanitization', () => {
    test('should mask password in parameters', async () => {
      const logger = getLogger();

      await logger.logToolExecution('test_tool', { password: 'secret' }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('secret');
      expect(logOutput).toContain('***');
    });

    test('should mask token in parameters', async () => {
      const logger = getLogger();

      await logger.logToolExecution('test_tool', { authToken: 'bearer123' }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('bearer123');
    });

    test('should mask apiKey in parameters', async () => {
      const logger = getLogger();

      await logger.logToolExecution('test_tool', { apiKey: 'myapikey123' }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('myapikey123');
      expect(logOutput).toContain('***');
    });

    test('should mask secret in parameters', async () => {
      const logger = getLogger();

      await logger.logToolExecution('test_tool', { clientSecret: 'secret456' }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('secret456');
    });

    test('should mask authorization in parameters', async () => {
      const logger = getLogger();

      await logger.logToolExecution('test_tool', { authorization: 'Bearer xyz' }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('Bearer xyz');
    });

    test('should not mask non-sensitive parameters', async () => {
      const logger = getLogger();

      await logger.logToolExecution('test_tool', { collectionPath: '/test/path', requestName: 'Get Users' }, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('/test/path');
      expect(logOutput).toContain('Get Users');
    });

    test('should handle null parameters', async () => {
      const logger = getLogger();

      // logToolExecution doesn't return a promise, so just call it
      await logger.logToolExecution('test_tool', null, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should handle undefined parameters', async () => {
      const logger = getLogger();

      // logToolExecution doesn't return a promise, so just call it
      await logger.logToolExecution('test_tool', undefined, 100, true);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    test('should handle logging without context', async () => {
      const logger = getLogger();

      await logger.info('Message without context');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Message without context');
    });

    test('should handle logging with empty context', async () => {
      const logger = getLogger();

      await logger.info('Message with empty context', {});

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Message with empty context');
    });

    test('should handle error without stack trace', async () => {
      const logger = getLogger();
      const error = new Error('Test error');
      delete error.stack;

      await logger.error('Error without stack', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test error');
    });

    test('should handle very long messages', async () => {
      const logger = getLogger();
      const longMessage = 'x'.repeat(10000);

      await expect(logger.info(longMessage)).resolves.toBeUndefined();
    });

    test('should handle special characters in messages', async () => {
      const logger = getLogger();

      await logger.info('Message with special chars: ñ, é, 中文, 🚀');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('ñ, é, 中文, 🚀');
    });

    test('should handle circular references in context', async () => {
      const logger = getLogger();
      const circular: any = { a: 1 };
      circular.self = circular;

      // JSON.stringify will throw on circular references
      await expect(logger.info('Test', circular)).rejects.toThrow(/circular|Converting circular/i);
    });
  });
});
