import { execa } from 'execa';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { createRequire } from 'module';
import { getConfigLoader } from './config.js';
import { getPerformanceManager } from './performance.js';

export interface BrunoRunOptions {
  environment?: string;
  envVariables?: Record<string, string>;
  folderPath?: string;
  format?: 'json' | 'junit' | 'html';
  output?: string;
  recursive?: boolean;
  testsOnly?: boolean;
  bail?: boolean;
  // Report generation options
  reporterJson?: string;    // Path to write JSON report
  reporterJunit?: string;   // Path to write JUnit XML report
  reporterHtml?: string;    // Path to write HTML report
}

export interface BrunoRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  summary?: {
    totalRequests: number;
    passedRequests: number;
    failedRequests: number;
    totalDuration: number;
  };
  results?: Array<{
    name: string;
    passed: boolean;
    status: number;
    duration: number;
    error?: string;
    request?: {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      body?: any;
    };
    response?: {
      status?: number;
      statusText?: string;
      headers?: Record<string, string>;
      body?: any;
      responseTime?: number;
    };
    assertions?: Array<{ 
      name: string;
      passed: boolean;
      error?: string;
    }>;
  }>;
}

export interface BrunoRequest {
  name: string;
  method?: string;
  url?: string;
  folder?: string;
  path?: string;
}

export class BrunoCLI {
  private brunoCommand: string = 'bru';

  constructor(brunoPath?: string) {
    if (brunoPath) {
      this.brunoCommand = brunoPath;
    } else {
      // Check configuration for custom Bruno CLI path
      const configLoader = getConfigLoader();
      const config = configLoader.getConfig();

      if (config.brunoCliPath) {
        this.brunoCommand = config.brunoCliPath;
      } else {
        // Try to find the local Bruno CLI installation
        this.brunoCommand = this.findBrunoCLI();
      }
    }
  }

  /**
   * Find the Bruno CLI executable
   */
  private findBrunoCLI(): string {
    const require = createRequire(import.meta.url);
    const fsSync = require('fs');

    // Get the directory where this module is located
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));

    // First, try to find it relative to the current module location
    // This works whether we're in src/ or dist/
    const localBruPath = path.join(moduleDir, '..', 'node_modules', '.bin', 'bru');

    // On Windows, the executable might have a .cmd extension
    const isWindows = process.platform === 'win32';
    const executablePath = isWindows ? `${localBruPath}.cmd` : localBruPath;

    // Check if local installation exists
    try {
      if (fsSync.existsSync(executablePath)) {
        return executablePath;
      }
    } catch {
      // Fall through to try process.cwd()
    }

    // Try from process.cwd() as a fallback (for backward compatibility)
    const cwdBruPath = path.join(process.cwd(), 'node_modules', '.bin', 'bru');
    const cwdExecutablePath = isWindows ? `${cwdBruPath}.cmd` : cwdBruPath;

    try {
      if (fsSync.existsSync(cwdExecutablePath)) {
        return cwdExecutablePath;
      }
    } catch {
      // Fall through to use global command
    }

    // Fall back to global command (in case it's installed globally)
    return 'bru';
  }

  /**
   * Check if Bruno CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await execa(this.brunoCommand, ['--version']);
      console.error(`Bruno CLI found at: ${this.brunoCommand}`);
      console.error(`Bruno CLI version: ${result.stdout}`);
      return true;
    } catch (error) {
      console.error(`Bruno CLI not found at: ${this.brunoCommand}`);
      return false;
    }
  }

  /**
   * Run a specific request from a collection
   * Bruno CLI must be run from within the collection directory
   */
  async runRequest(
    collectionPath: string,
    requestName: string,
    options: BrunoRunOptions = {}
  ): Promise<BrunoRunResult> {
    // Find the .bru file for this request
    const requestFile = await this.findRequestFile(collectionPath, requestName);
    if (!requestFile) {
      throw new Error(`Request "${requestName}" not found in collection`);
    }

    // Get relative path from collection root
    const relativePath = path.relative(collectionPath, requestFile);
    
    // Create temporary file for JSON output
    const tempFile = path.join(tmpdir(), `bruno-result-${randomUUID()}.json`);
    
        // Build command arguments - run specific file
        const args = ['run', relativePath];
        
        // Always use JSON format to capture response data
        args.push('--format', 'json');
        args.push('--output', tempFile);
        
        // Add optional parameters
        if (options.environment) {
          let envPath = options.environment;

          // Check if it's an absolute path
          if (path.isAbsolute(envPath)) {
            // If absolute path, get just the filename without extension
            // Bruno expects just the environment name, not the full path
            const basename = path.basename(envPath, '.bru');
            envPath = basename;
          } else if (envPath.includes('/') || envPath.includes('\\')) {
            // If it's a relative path with separators, get just the filename
            const basename = path.basename(envPath, '.bru');
            envPath = basename;
          } else if (envPath.endsWith('.bru')) {
            // If it ends with .bru, remove the extension
            envPath = envPath.replace(/\.bru$/, '');
          }
          // If just a name (no path separators, no extension), use as-is

          args.push('--env', envPath);
        }
    
        // Add environment variable overrides
        if (options.envVariables) {
          for (const [key, value] of Object.entries(options.envVariables)) {
            args.push('--env-var', `${key}=${value}`);
          }
        }
    
        if (options.testsOnly) {
          args.push('--tests-only');
        }

        if (options.bail) {
          args.push('--bail');
        }

        // Add reporter options for report generation
        if (options.reporterJson) {
          args.push('--reporter-json', options.reporterJson);
        }

        if (options.reporterJunit) {
          args.push('--reporter-junit', options.reporterJunit);
        }

        if (options.reporterHtml) {
          args.push('--reporter-html', options.reporterHtml);
        }

        try {
          // Get timeout configuration
          const configLoader = getConfigLoader();
          const timeout = configLoader.getTimeout();

          // Run Bruno CLI from within the collection directory
          const result = await execa(this.brunoCommand, args, {
            cwd: collectionPath,
            env: { ...process.env },
            reject: false,
            timeout: timeout.request
          });
    
          // If Bruno CLI failed, handle the error
          if (result.exitCode !== 0 || result.failed) {
            throw result;
          }

          // Read the JSON output file
          let jsonResult: any = null;
          try {
            const jsonContent = await fs.readFile(tempFile, 'utf-8');
            jsonResult = JSON.parse(jsonContent);
          } catch (error) {
            console.error('Failed to read Bruno output file:', error);
          }
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      return this.parseRunResult(result, jsonResult);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
      throw this.handleError(error);
    }
  }

  /**
   * Run an entire collection or folder
   * Bruno CLI must be run from within the collection directory
   */
  async runCollection(
    collectionPath: string,
    options: BrunoRunOptions = {}
  ): Promise<BrunoRunResult> {
    // Determine what to run (folder or entire collection)
    let targetPath = '.';
    
    if (options.folderPath) {
      // Run specific folder
      targetPath = options.folderPath;
    }
    
    // Create temporary file for JSON output
    const tempFile = path.join(tmpdir(), `bruno-result-${randomUUID()}.json`);
    
    // Build command arguments
    const args = ['run', targetPath];
    
    // Add recursive flag (usually needed for folders)
    if (options.recursive !== false) {
      args.push('-r');
    }
    
    // Always use JSON format to capture response data
    args.push('--format', 'json');
    args.push('--output', tempFile);
    
    // Add optional parameters
    if (options.environment) {
      let envPath = options.environment;

      // Check if it's an absolute path
      if (path.isAbsolute(envPath)) {
        // If absolute path, get just the filename without extension
        // Bruno expects just the environment name, not the full path
        const basename = path.basename(envPath, '.bru');
        envPath = basename;
      } else if (envPath.includes('/') || envPath.includes('\\')) {
        // If it's a relative path with separators, get just the filename
        const basename = path.basename(envPath, '.bru');
        envPath = basename;
      } else if (envPath.endsWith('.bru')) {
        // If it ends with .bru, remove the extension
        envPath = envPath.replace(/\.bru$/, '');
      }
      // If just a name (no path separators, no extension), use as-is

      args.push('--env', envPath);
    }

    // Add environment variable overrides
    if (options.envVariables) {
      for (const [key, value] of Object.entries(options.envVariables)) {
        args.push('--env-var', `${key}=${value}`);
      }
    }

    if (options.testsOnly) {
      args.push('--tests-only');
    }

    if (options.bail) {
      args.push('--bail');
    }

    // Add reporter options for report generation
    if (options.reporterJson) {
      args.push('--reporter-json', options.reporterJson);
    }

    if (options.reporterJunit) {
      args.push('--reporter-junit', options.reporterJunit);
    }

    if (options.reporterHtml) {
      args.push('--reporter-html', options.reporterHtml);
    }

    try {
      // Get timeout configuration
      const configLoader = getConfigLoader();
      const timeout = configLoader.getTimeout();

      // Run Bruno CLI from within the collection directory
      const result = await execa(this.brunoCommand, args, {
        cwd: collectionPath,
        env: { ...process.env },
        reject: false,
        timeout: timeout.collection
      });

      // Read the JSON output file
      let jsonResult: any = null;
      try {
        const jsonContent = await fs.readFile(tempFile, 'utf-8');
        jsonResult = JSON.parse(jsonContent);
      } catch (error) {
        console.error('Failed to read Bruno output file:', error);
      }

      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      return this.parseRunResult(result, jsonResult);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
      throw this.handleError(error);
    }
  }

  /**
   * List all requests in a collection
   */
  async listRequests(collectionPath: string): Promise<BrunoRequest[]> {
    try {
      // Check cache first
      const perfManager = getPerformanceManager();
      const cached = perfManager.getCachedRequestList(collectionPath);
      if (cached) {
        console.error(`Using cached request list for: ${collectionPath}`);
        return cached;
      }

      // Check if the collection path exists
      const stats = await fs.stat(collectionPath);
      if (!stats.isDirectory()) {
        throw new Error(`Collection path is not a directory: ${collectionPath}`);
      }

      // Check if it's a valid Bruno collection (should have bruno.json or collection.bru)
      const hasCollectionFile = await this.hasCollectionFile(collectionPath);
      if (!hasCollectionFile) {
        throw new Error(`Not a valid Bruno collection: ${collectionPath}`);
      }

      // Find all .bru files in the collection
      const requests = await this.findBrunoRequests(collectionPath);

      // Cache the results
      perfManager.cacheRequestList(collectionPath, requests);

      return requests;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Collection not found: ${collectionPath}`);
      }
      throw error;
    }
  }

  /**
   * Check if directory has a Bruno collection file
   */
  private async hasCollectionFile(dirPath: string): Promise<boolean> {
    try {
      // Check for bruno.json or collection.bru
      const brunoJsonPath = path.join(dirPath, 'bruno.json');
      const collectionBruPath = path.join(dirPath, 'collection.bru');
      
      try {
        await fs.access(brunoJsonPath);
        return true;
      } catch {
        // Try collection.bru
        try {
          await fs.access(collectionBruPath);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * Find a specific request file by name
   */
  private async findRequestFile(collectionPath: string, requestName: string): Promise<string | null> {
    const requests = await this.findBrunoRequests(collectionPath);
    
    // Try exact match first
    let request = requests.find(r => r.name === requestName);
    
    // Try case-insensitive match
    if (!request) {
      request = requests.find(r => r.name.toLowerCase() === requestName.toLowerCase());
    }
    
    // Try partial match
    if (!request) {
      request = requests.find(r => r.name.includes(requestName));
    }
    
    return request?.path || null;
  }

  /**
   * Recursively find all Bruno request files
   */
  private async findBrunoRequests(
    dirPath: string,
    basePath: string = dirPath,
    requests: BrunoRequest[] = []
  ): Promise<BrunoRequest[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Skip node_modules and other common non-request directories
        if (entry.name === 'node_modules' || entry.name === 'environments') {
          continue;
        }
        // Recursively search subdirectories
        await this.findBrunoRequests(fullPath, basePath, requests);
      } else if (entry.isFile() && entry.name.endsWith('.bru')) {
        // Skip collection.bru as it's not a request
        if (entry.name === 'collection.bru') {
          continue;
        }
        
        // Parse the .bru file for basic info
        const requestInfo = await this.parseBrunoFile(fullPath);
        const relativePath = path.relative(basePath, dirPath);
        
        requests.push({
          name: path.basename(entry.name, '.bru'),
          folder: relativePath || undefined,
          path: fullPath,
          ...requestInfo
        });
      }
    }

    return requests;
  }

  /**
   * Parse a Bruno request file for basic information
   */
  private async parseBrunoFile(filePath: string): Promise<Partial<BrunoRequest>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const info: Partial<BrunoRequest> = {};
      
      // Look for meta name first
      let inMeta = false;
      for (const line of lines) {
        if (line.trim() === 'meta {') {
          inMeta = true;
          continue;
        }
        if (inMeta && line.trim() === '}') {
          inMeta = false;
          continue;
        }
        if (inMeta) {
          const nameMatch = line.match(/^\s*name:\s*(.+)/);
          if (nameMatch) {
            info.name = nameMatch[1].trim();
          }
        }
        
        // Look for method and URL
        const methodMatch = line.match(/^(get|post|put|delete|patch|head|options)\s*\{/i);
        if (methodMatch) {
          info.method = methodMatch[1].toUpperCase();
          // Look for URL in the next few lines
          const urlIndex = lines.indexOf(line);
          for (let i = urlIndex + 1; i < Math.min(urlIndex + 5, lines.length); i++) {
            const urlMatch = lines[i].match(/^\s*url:\s*(.+)/);
            if (urlMatch) {
              info.url = urlMatch[1].trim();
              break;
            }
          }
        }
      }
      
      return info;
    } catch {
      // If we can't parse the file, just return empty info
      return {};
    }
  }

  /**
   * Parse the result from Bruno CLI execution
   */
  private parseRunResult(result: any, jsonOutput?: any): BrunoRunResult {
    const runResult: BrunoRunResult = {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode || 0
    };

    // Use the JSON output if available (from file)
    let jsonResult = jsonOutput || this.tryParseJson(result.stdout);

    // Bruno CLI returns an array with a single object containing summary and results
    // Unwrap it if needed
    if (Array.isArray(jsonResult) && jsonResult.length > 0) {
      jsonResult = jsonResult[0];
    }

    if (jsonResult) {
      // Extract summary information
      if (jsonResult.summary) {
        runResult.summary = {
          totalRequests: jsonResult.summary.totalRequests || jsonResult.summary.total || 0,
          passedRequests: jsonResult.summary.passedRequests || jsonResult.summary.passed || 0,
          failedRequests: jsonResult.summary.failedRequests || jsonResult.summary.failed || 0,
          totalDuration: jsonResult.summary.totalDuration || jsonResult.summary.duration || 0
        };
      }

      // Extract individual results with response data
      if (jsonResult.results && Array.isArray(jsonResult.results)) {
        runResult.results = jsonResult.results.map((r: any) => {
          const result: any = {
            name: r.suitename || r.name || r.test?.filename || 'Unknown',
            passed: r.error === null || r.error === undefined,
            status: r.response?.status || 0,
            duration: r.response?.responseTime || r.runtime || 0,
            error: r.error
          };

          // Add request details if available
          if (r.request) {
            result.request = {
              method: r.request.method,
              url: r.request.url,
              headers: r.request.headers,
              body: r.request.body || r.request.data
            };
          }

          // Add response details if available
          if (r.response) {
            result.response = {
              status: r.response.status,
              statusText: r.response.statusText,
              headers: r.response.headers,
              body: r.response.data || r.response.body,
              responseTime: r.response.responseTime
            };
          }

          // Add test/assertion results (Bruno uses testResults and assertionResults)
          const testResults = r.testResults || r.tests || r.assertions;
          const assertionResults = r.assertionResults || [];

          const allTests = [];

          if (Array.isArray(testResults)) {
            allTests.push(...testResults.map((t: any) => ({
              name: t.description || t.name || t.test,
              passed: t.status === 'pass' || t.passed === true,
              error: t.status === 'fail' ? t.error || t.message : undefined
            })));
          }

          if (Array.isArray(assertionResults)) {
            allTests.push(...assertionResults.map((a: any) => ({
              name: a.description || a.name,
              passed: a.status === 'pass' || a.passed === true,
              error: a.status === 'fail' ? a.error || a.message : undefined
            })));
          }

          if (allTests.length > 0) {
            result.assertions = allTests;
          }

          return result;
        });
      }

      // If results are in a different structure (check for 'items' or direct array)
      if (!runResult.results && jsonResult.items && Array.isArray(jsonResult.items)) {
        runResult.results = this.parseItems(jsonResult.items);
      }
    }

    return runResult;
  }

  /**
   * Try to parse JSON from string
   */
  private tryParseJson(str: string): any {
    if (!str || !str.trim()) return null;
    
    try {
      // Try to parse as-is
      if (str.trim().startsWith('{') || str.trim().startsWith('[')) {
        return JSON.parse(str);
      }
      
      // Look for JSON in the output (sometimes there's extra text)
      const jsonMatch = str.match(/(\{[\s\S]*\}|[[\][\s\S]*\])/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch {
      // Not JSON or parsing failed
    }
    
    return null;
  }

  /**
   * Parse items from alternative JSON structure
   */
  private parseItems(items: any[]): any[] {
    return items.map((item: any) => {
      const result: any = {
        name: item.name || 'Unknown',
        passed: item.status === 'passed' || item.passed !== false,
        status: item.response?.status || 0,
        duration: item.duration || 0
      };

      if (item.request) {
        result.request = {
          method: item.request.method,
          url: item.request.url,
          headers: item.request.headers,
          body: item.request.body
        };
      }

      if (item.response) {
        result.response = {
          status: item.response.status,
          statusText: item.response.statusText,
          headers: item.response.headers,
          body: item.response.body || item.response.data,
          responseTime: item.response.time || item.response.responseTime
        };
      }

      if (item.tests) {
        result.assertions = item.tests.map((t: any) => ({
          name: t.name || t.test,
          passed: t.passed || t.status === 'passed',
          error: t.error
        }));
      }

      return result;
    });
  }

  /**
   * Discover Bruno collections in a directory
   */
  async discoverCollections(searchPath: string, maxDepth: number = 5): Promise<string[]> {
    const perfManager = getPerformanceManager();

    // Check cache first
    const cached = perfManager.getCachedCollectionDiscovery(searchPath);
    if (cached) {
      return cached;
    }

    const collections: string[] = [];
    const maxSearchDepth = Math.min(maxDepth, 10); // Cap at 10 for safety

    async function searchDirectory(dirPath: string, currentDepth: number) {
      if (currentDepth > maxSearchDepth) {
        return;
      }

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        // Check if this directory contains bruno.json
        const hasBrunoJson = entries.some(entry =>
          entry.isFile() && entry.name === 'bruno.json'
        );

        if (hasBrunoJson) {
          collections.push(dirPath);
          // Don't search subdirectories of a collection
          return;
        }

        // Recursively search subdirectories
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subPath = path.join(dirPath, entry.name);
            await searchDirectory(subPath, currentDepth + 1);
          }
        }
      } catch (error) {
        // Silently skip directories we can't read
        console.error(`Cannot read directory: ${dirPath}`, error);
      }
    }

    await searchDirectory(searchPath, 0);

    // Cache the results
    perfManager.cacheCollectionDiscovery(searchPath, collections);

    return collections;
  }

  /**
   * List environments in a collection
   */
  async listEnvironments(collectionPath: string): Promise<Array<{
    name: string;
    path: string;
    variables?: Record<string, string>;
  }>> {
    const perfManager = getPerformanceManager();

    // Check cache first
    const cached = perfManager.getCachedEnvironmentList(collectionPath);
    if (cached) {
      return cached;
    }

    const environmentsPath = path.join(collectionPath, 'environments');
    const environments: Array<{ name: string; path: string; variables?: Record<string, string> }> = [];

    try {
      const entries = await fs.readdir(environmentsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.bru')) {
          const envName = path.basename(entry.name, '.bru');
          const envPath = path.join(environmentsPath, entry.name);

          try {
            const content = await fs.readFile(envPath, 'utf-8');
            const variables = this.parseEnvironmentVariables(content);

            environments.push({
              name: envName,
              path: envPath,
              variables
            });
          } catch (error) {
            // Include environment even if we can't parse it
            environments.push({
              name: envName,
              path: envPath
            });
          }
        }
      }
    } catch (error) {
      // Return empty array if environments directory doesn't exist
      return [];
    }

    // Cache the results
    perfManager.cacheEnvironmentList(collectionPath, environments);

    return environments;
  }

  /**
   * Validate an environment file
   */
  async validateEnvironment(collectionPath: string, environmentName: string): Promise<{
    valid: boolean;
    exists: boolean;
    errors: string[];
    warnings: string[];
    variables?: Record<string, string>;
  }> {
    const result = {
      valid: true,
      exists: false,
      errors: [] as string[],
      warnings: [] as string[],
      variables: undefined as Record<string, string> | undefined
    };

    const envPath = path.join(collectionPath, 'environments', `${environmentName}.bru`);

    try {
      await fs.access(envPath);
      result.exists = true;
    } catch {
      result.valid = false;
      result.errors.push(`Environment file not found: ${envPath}`);
      return result;
    }

    try {
      const content = await fs.readFile(envPath, 'utf-8');

      // Check basic structure
      if (!content.includes('vars {')) {
        result.warnings.push('Environment file does not contain a "vars {}" block');
      }

      // Parse variables
      result.variables = this.parseEnvironmentVariables(content);

      // Check for common issues
      if (Object.keys(result.variables).length === 0) {
        result.warnings.push('No variables defined in environment');
      }

      // Check for potentially sensitive data that might be hardcoded
      for (const [key, value] of Object.entries(result.variables)) {
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('token')) {
          if (value && !value.startsWith('{{') && !value.startsWith('$')) {
            result.warnings.push(`Variable "${key}" may contain hardcoded sensitive data`);
          }
        }
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Failed to read environment file: ${error}`);
    }

    return result;
  }

  /**
   * Parse environment variables from .bru file content
   */
  private parseEnvironmentVariables(content: string): Record<string, string> {
    const variables: Record<string, string> = {};

    // Match vars { ... } block
    const varsMatch = content.match(/vars\s*\{([^}]*)\}/s);
    if (!varsMatch) {
      return variables;
    }

    const varsContent = varsMatch[1];

    // Match variable assignments: name: value
    const varRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)\s*$/gm;
    let match;

    while ((match = varRegex.exec(varsContent)) !== null) {
      const [, key, value] = match;
      variables[key] = value;
    }

    return variables;
  }

  /**
   * Get detailed information about a request
   */
  async getRequestDetails(collectionPath: string, requestName: string): Promise<{
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: {
      type: string;
      content: string;
    };
    auth: string;
    tests?: string[];
    metadata: {
      type: string;
      seq?: number;
    };
  }> {
    // Find the request file
    const requestFile = await this.findRequestFile(collectionPath, requestName);
    if (!requestFile) {
      throw new Error(`Request "${requestName}" not found in collection`);
    }

    // Read and parse the .bru file
    const content = await fs.readFile(requestFile, 'utf-8');

    const details = {
      name: requestName,
      method: 'GET',
      url: '',
      headers: {} as Record<string, string>,
      body: undefined as { type: string; content: string } | undefined,
      auth: 'none',
      tests: [] as string[],
      metadata: {
        type: 'http',
        seq: undefined as number | undefined
      }
    };

    // Parse metadata block
    const metaMatch = content.match(/meta\s*\{([\s\S]*?)\n\}/s);
    if (metaMatch) {
      const metaContent = metaMatch[1];
      const nameMatch = metaContent.match(/name:\s*(.+)/);
      if (nameMatch) details.name = nameMatch[1].trim();

      const typeMatch = metaContent.match(/type:\s*(.+)/);
      if (typeMatch) details.metadata.type = typeMatch[1].trim();

      const seqMatch = metaContent.match(/seq:\s*(\d+)/);
      if (seqMatch) details.metadata.seq = parseInt(seqMatch[1]);
    }

    // Parse method block (get, post, put, patch, delete, etc.)
    const methodBlocks = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of methodBlocks) {
      const methodRegex = new RegExp(`${method}\\s*\\{([\\s\\S]*?)\\n\\}`, 's');
      const methodMatch = content.match(methodRegex);
      if (methodMatch) {
        details.method = method.toUpperCase();
        const methodContent = methodMatch[1];

        const urlMatch = methodContent.match(/url:\s*(.+)/);
        if (urlMatch) details.url = urlMatch[1].trim();

        const authMatch = methodContent.match(/auth:\s*(.+)/);
        if (authMatch) details.auth = authMatch[1].trim();

        break;
      }
    }

    // Parse headers block
    const headersMatch = content.match(/headers\s*\{([\s\S]*?)\n\}/s);
    if (headersMatch) {
      const headersContent = headersMatch[1];
      const headerLines = headersContent.split('\n').filter(line => line.trim());

      for (const line of headerLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          details.headers[key] = value;
        }
      }
    }

    // Parse body block
    const bodyTypeMatch = content.match(/body:(json|text|xml|formUrlEncoded|multipartForm|graphql|sparql|none)\s*\{/);
    if (bodyTypeMatch) {
      const bodyType = bodyTypeMatch[1];
      const bodyRegex = new RegExp(`body:${bodyType}\\s*\\{([\\s\\S]*?)\\n\\}`, 's');
      const bodyMatch = content.match(bodyRegex);

      if (bodyMatch) {
        details.body = {
          type: bodyType,
          content: bodyMatch[1].trim()
        };
      }
    }

    // Parse tests block
    const testsMatch = content.match(/tests\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
    if (testsMatch) {
      const testsContent = testsMatch[1];
      // Extract test function calls
      const testRegex = /test\s*\(\s*["']([^"']+)["']/g;
      let testMatch;

      while ((testMatch = testRegex.exec(testsContent)) !== null) {
        details.tests.push(testMatch[1]);
      }
    }

    return details;
  }

  /**
   * Validate a Bruno collection
   */
  async validateCollection(collectionPath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
      hasBrunoJson: boolean;
      totalRequests: number;
      validRequests: number;
      invalidRequests: number;
      environments: number;
    };
  }> {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      summary: {
        hasBrunoJson: false,
        totalRequests: 0,
        validRequests: 0,
        invalidRequests: 0,
        environments: 0
      }
    };

    // Check if collection directory exists
    try {
      await fs.access(collectionPath);
    } catch {
      result.valid = false;
      result.errors.push(`Collection directory not found: ${collectionPath}`);
      return result;
    }

    // Check for bruno.json
    const brunoJsonPath = path.join(collectionPath, 'bruno.json');
    try {
      await fs.access(brunoJsonPath);
      result.summary.hasBrunoJson = true;

      // Validate bruno.json structure
      const brunoJsonContent = await fs.readFile(brunoJsonPath, 'utf-8');
      try {
        const brunoJson = JSON.parse(brunoJsonContent);

        // Check required fields
        if (!brunoJson.version) {
          result.warnings.push('bruno.json missing "version" field');
        }
        if (!brunoJson.name) {
          result.warnings.push('bruno.json missing "name" field');
        }
        if (!brunoJson.type) {
          result.warnings.push('bruno.json missing "type" field');
        } else if (brunoJson.type !== 'collection') {
          result.errors.push(`Invalid type in bruno.json: expected "collection", got "${brunoJson.type}"`);
          result.valid = false;
        }
      } catch (error) {
        result.errors.push(`Invalid JSON in bruno.json: ${error}`);
        result.valid = false;
      }
    } catch {
      result.errors.push('bruno.json not found in collection root');
      result.valid = false;
      return result;
    }

    // Validate requests
    try {
      const requests = await this.listRequests(collectionPath);
      result.summary.totalRequests = requests.length;

      if (requests.length === 0) {
        result.warnings.push('Collection contains no requests');
      }

      // Validate each request file
      for (const req of requests) {
        try {
          await this.getRequestDetails(collectionPath, req.name);
          result.summary.validRequests++;
        } catch (error) {
          result.summary.invalidRequests++;
          result.errors.push(`Invalid request "${req.name}": ${error}`);
          result.valid = false;
        }
      }
    } catch (error) {
      result.errors.push(`Failed to list requests: ${error}`);
      result.valid = false;
    }

    // Check for environments
    try {
      const environments = await this.listEnvironments(collectionPath);
      result.summary.environments = environments.length;

      if (environments.length === 0) {
        result.warnings.push('No environments found in collection');
      }

      // Validate each environment
      for (const env of environments) {
        const validation = await this.validateEnvironment(collectionPath, env.name);
        if (!validation.valid) {
          result.warnings.push(`Environment "${env.name}" has issues: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
          validation.warnings.forEach(w => result.warnings.push(`Environment "${env.name}": ${w}`));
        }
      }
    } catch (error) {
      // Environments are optional, so this is just a warning
      result.warnings.push('Could not validate environments');
    }

    return result;
  }

  /**
   * Handle errors from Bruno CLI
   */
  private handleError(error: any): Error {
    // Check if it's an execa error by checking for specific properties
    if (error && typeof error === 'object' && 'stderr' in error) {
      if (error.stderr?.includes('command not found') || 
          error.stderr?.includes('not recognized') ||
          error.stderr?.includes('ENOENT')) {
        return new Error(
          `Bruno CLI not found at: ${this.brunoCommand}. ` +
          'Please ensure Bruno CLI is installed by running: npm install'
        );
      }
      
      if (error.stderr?.includes('You can run only at the root of a collection')) {
        return new Error(
          'Invalid collection directory. Bruno CLI must be run from the root of a Bruno collection. ' +
          'Ensure the directory contains a bruno.json or collection.bru file.'
        );
      }
      
      if (error.stderr) {
        return new Error(`Bruno CLI error: ${error.stderr}`);
      }
      
      return new Error(`Bruno CLI failed: ${error.message || 'Unknown error'}`);
    }
    
    return error instanceof Error ? error : new Error(String(error));
  }
}
