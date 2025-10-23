import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfigLoader } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export type LogFormat = 'json' | 'text';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private logFilePath?: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB default
  private maxLogFiles: number = 5; // Keep 5 rotated files
  private currentLogSize: number = 0;
  private directoryInitialized: boolean = false;

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger() {
    const config = getConfigLoader().getConfig();

    if (config.logging?.logFile) {
      this.logFilePath = config.logging.logFile;
    }

    if (config.logging?.maxLogSize) {
      this.maxLogSize = config.logging.maxLogSize;
    }

    if (config.logging?.maxLogFiles) {
      this.maxLogFiles = config.logging.maxLogFiles;
    }
  }

  // Ensure log directory exists (called before first write)
  private async ensureLogDirectory() {
    if (!this.logFilePath) return;

    const logDir = path.dirname(this.logFilePath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }

    // Get current log file size if file exists
    try {
      const stats = await fs.stat(this.logFilePath);
      this.currentLogSize = stats.size;
    } catch {
      this.currentLogSize = 0;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const config = getConfigLoader().getConfig();
    const configLevel = config.logging?.level || 'info';

    const levels: LogLevel[] = ['debug', 'info', 'warning', 'error'];
    const configLevelIndex = levels.indexOf(configLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= configLevelIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const config = getConfigLoader().getConfig();
    const format = config.logging?.format || 'text';

    if (format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    let message = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += ` | Context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`;
      }
    }

    return message;
  }

  private async writeToFile(message: string) {
    if (!this.logFilePath) return;

    try {
      // Ensure directory exists on first write
      if (!this.directoryInitialized) {
        await this.ensureLogDirectory();
        this.directoryInitialized = true;
      }

      // Check if rotation is needed
      if (this.currentLogSize + message.length > this.maxLogSize) {
        await this.rotateLogFiles();
        this.currentLogSize = 0;
      }

      await fs.appendFile(this.logFilePath, message + '\n');
      this.currentLogSize += message.length + 1;
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async rotateLogFiles() {
    if (!this.logFilePath) return;

    try {
      // Rotate existing log files
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = `${this.logFilePath}.${i}`;
        const newFile = `${this.logFilePath}.${i + 1}`;

        try {
          await fs.rename(oldFile, newFile);
        } catch {
          // File might not exist, ignore
        }
      }

      // Move current log to .1
      try {
        await fs.rename(this.logFilePath, `${this.logFilePath}.1`);
      } catch {
        // Current file might not exist
      }

      // Delete oldest log file if it exists
      if (this.maxLogFiles > 0) {
        try {
          await fs.unlink(`${this.logFilePath}.${this.maxLogFiles + 1}`);
        } catch {
          // File might not exist
        }
      }
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }

  private async log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : undefined
    };

    const formattedMessage = this.formatLogEntry(entry);

    // Always write to stderr for console output
    console.error(formattedMessage);

    // Write to file if configured
    if (this.logFilePath) {
      await this.writeToFile(formattedMessage);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    return this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    return this.log('info', message, context);
  }

  warning(message: string, context?: Record<string, any>) {
    return this.log('warning', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    return this.log('error', message, context, error);
  }

  // Log tool execution
  logToolExecution(toolName: string, params: any, duration: number, success: boolean) {
    const level: LogLevel = success ? 'info' : 'error';
    this.log(level, `Tool execution: ${toolName}`, {
      tool: toolName,
      duration,
      success,
      params: this.sanitizeParams(params)
    });
  }

  // Log security events
  logSecurityEvent(event: string, details: string, severity: 'info' | 'warning' | 'error') {
    const level: LogLevel = severity === 'info' ? 'info' : severity === 'warning' ? 'warning' : 'error';
    this.log(level, `Security: ${event}`, {
      event,
      details,
      severity
    });
  }

  // Sanitize sensitive parameters
  private sanitizeParams(params: any): any {
    if (!params) return params;

    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'apikey', 'secret', 'authorization'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '***';
      }
    }

    return sanitized;
  }
}

// Singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

export function resetLogger() {
  loggerInstance = null;
}
