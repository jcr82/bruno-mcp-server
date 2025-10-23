/**
 * Mock Bruno CLI for development and testing
 *
 * This mock implementation provides predictable responses for all Bruno CLI operations
 * without requiring the actual Bruno CLI to be installed. Useful for:
 * - CI/CD environments
 * - Development without Bruno CLI
 * - Fast unit testing
 * - Consistent test data
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface MockBrunoResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class MockBrunoCLI {
  private mockDelay: number = 100; // Simulate CLI execution time
  private shouldFail: boolean = false;
  private failureMessage: string = 'Mock execution failed';

  constructor(options?: { delay?: number }) {
    if (options?.delay !== undefined) {
      this.mockDelay = options.delay;
    }
  }

  /**
   * Set whether the mock should simulate failures
   */
  setShouldFail(fail: boolean, message?: string) {
    this.shouldFail = fail;
    if (message) {
      this.failureMessage = message;
    }
  }

  /**
   * Simulate execution delay
   */
  private async delay() {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
  }

  /**
   * Mock version check
   */
  async version(): Promise<MockBrunoResponse> {
    await this.delay();
    return {
      exitCode: 0,
      stdout: '@usebruno/cli/1.40.0 (mock)',
      stderr: ''
    };
  }

  /**
   * Mock running a single request
   */
  async runRequest(args: string[]): Promise<MockBrunoResponse> {
    await this.delay();

    if (this.shouldFail) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: this.failureMessage
      };
    }

    // Extract request name from args
    const requestNameIndex = args.indexOf('run') + 1;
    const requestName = args[requestNameIndex] || 'Unknown Request';

    const mockResult = {
      summary: {
        totalRequests: 1,
        passedRequests: 1,
        failedRequests: 0,
        totalDuration: this.mockDelay
      },
      results: [
        {
          name: requestName,
          passed: true,
          status: 200,
          duration: this.mockDelay,
          request: {
            method: 'GET',
            url: 'https://api.example.com/mock',
            headers: {
              'Accept': 'application/json'
            }
          },
          response: {
            status: 200,
            statusText: 'OK',
            headers: {
              'content-type': 'application/json'
            },
            body: {
              id: 1,
              message: 'Mock response',
              timestamp: new Date().toISOString()
            },
            responseTime: this.mockDelay
          },
          assertions: [
            {
              name: 'Status should be 200',
              passed: true
            }
          ]
        }
      ]
    };

    return {
      exitCode: 0,
      stdout: this.formatOutput(mockResult),
      stderr: ''
    };
  }

  /**
   * Mock running a collection
   */
  async runCollection(args: string[]): Promise<MockBrunoResponse> {
    await this.delay();

    if (this.shouldFail) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: this.failureMessage
      };
    }

    const mockResult = {
      summary: {
        totalRequests: 3,
        passedRequests: 3,
        failedRequests: 0,
        totalDuration: this.mockDelay * 3
      },
      results: [
        {
          name: 'Get Users',
          passed: true,
          status: 200,
          duration: this.mockDelay,
          request: {
            method: 'GET',
            url: 'https://api.example.com/users'
          },
          response: {
            status: 200,
            statusText: 'OK',
            body: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }]
          }
        },
        {
          name: 'Get User By ID',
          passed: true,
          status: 200,
          duration: this.mockDelay,
          request: {
            method: 'GET',
            url: 'https://api.example.com/users/1'
          },
          response: {
            status: 200,
            statusText: 'OK',
            body: { id: 1, name: 'User 1', email: 'user1@example.com' }
          }
        },
        {
          name: 'Create User',
          passed: true,
          status: 201,
          duration: this.mockDelay,
          request: {
            method: 'POST',
            url: 'https://api.example.com/users'
          },
          response: {
            status: 201,
            statusText: 'Created',
            body: { id: 3, name: 'New User', email: 'newuser@example.com' }
          }
        }
      ]
    };

    return {
      exitCode: 0,
      stdout: this.formatOutput(mockResult),
      stderr: ''
    };
  }

  /**
   * Execute a mock command
   */
  async execute(command: string, args: string[]): Promise<MockBrunoResponse> {
    // Check for version command
    if (args.includes('--version') || args.includes('-v')) {
      return this.version();
    }

    // Check for run command
    if (args.includes('run')) {
      // Determine if it's a request or collection run
      // A request run has a non-flag argument after 'run' that doesn't look like a path
      const runIndex = args.indexOf('run');
      let hasRequestName = false;

      for (let i = runIndex + 1; i < args.length; i++) {
        const arg = args[i];
        // Skip flags and their values
        if (arg.startsWith('-')) {
          i++; // Skip next argument (flag value)
          continue;
        }
        // If we find a non-flag argument, it's a request name
        if (!arg.includes('/')) {
          hasRequestName = true;
          break;
        }
      }

      if (hasRequestName) {
        return this.runRequest(args);
      } else {
        return this.runCollection(args);
      }
    }

    // Default response
    return {
      exitCode: 0,
      stdout: 'Mock Bruno CLI',
      stderr: ''
    };
  }

  /**
   * Format mock output to match Bruno CLI output
   */
  private formatOutput(result: any): string {
    const lines: string[] = [];

    lines.push('Running Tests...');
    lines.push('');

    result.results.forEach((r: any) => {
      const status = r.passed ? '✓' : '✗';
      lines.push(`${status} ${r.name} (${r.duration}ms)`);
    });

    lines.push('');
    lines.push('Test Summary:');
    lines.push(`  Total: ${result.summary.totalRequests}`);
    lines.push(`  Passed: ${result.summary.passedRequests}`);
    lines.push(`  Failed: ${result.summary.failedRequests}`);
    lines.push(`  Duration: ${result.summary.totalDuration}ms`);

    return lines.join('\n');
  }

  /**
   * Write mock report file
   */
  async writeReport(format: 'json' | 'junit' | 'html', outputPath: string, data: any) {
    await this.delay();

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    } else if (format === 'junit') {
      const xml = this.generateJUnitXML(data);
      await fs.writeFile(outputPath, xml);
    } else if (format === 'html') {
      const html = this.generateHTML(data);
      await fs.writeFile(outputPath, html);
    }
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnitXML(data: any): string {
    const { summary, results } = data;
    const timestamp = new Date().toISOString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites tests="${summary.totalRequests}" failures="${summary.failedRequests}" time="${summary.totalDuration / 1000}">\n`;
    xml += `  <testsuite name="Bruno Tests" tests="${summary.totalRequests}" failures="${summary.failedRequests}" timestamp="${timestamp}">\n`;

    results.forEach((result: any) => {
      xml += `    <testcase name="${result.name}" time="${result.duration / 1000}" classname="BrunoTest">\n`;
      if (!result.passed) {
        xml += `      <failure message="Test failed">Request failed with status ${result.status}</failure>\n`;
      }
      xml += `    </testcase>\n`;
    });

    xml += '  </testsuite>\n';
    xml += '</testsuites>';

    return xml;
  }

  /**
   * Generate HTML report
   */
  private generateHTML(data: any): string {
    const { summary, results } = data;

    return `<!DOCTYPE html>
<html>
<head>
  <title>Bruno Test Report (Mock)</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .passed { color: green; }
    .failed { color: red; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
  </style>
</head>
<body>
  <h1>Bruno Test Report (Mock)</h1>

  <div class="summary">
    <h2>Summary</h2>
    <p>Total Tests: ${summary.totalRequests}</p>
    <p class="passed">Passed: ${summary.passedRequests}</p>
    <p class="failed">Failed: ${summary.failedRequests}</p>
    <p>Duration: ${summary.totalDuration}ms</p>
  </div>

  <h2>Test Results</h2>
  <table>
    <tr>
      <th>Test Name</th>
      <th>Status</th>
      <th>Duration</th>
      <th>Response Status</th>
    </tr>
    ${results.map((r: any) => `
    <tr>
      <td>${r.name}</td>
      <td class="${r.passed ? 'passed' : 'failed'}">${r.passed ? '✓ Passed' : '✗ Failed'}</td>
      <td>${r.duration}ms</td>
      <td>${r.status}</td>
    </tr>
    `).join('')}
  </table>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
    <p>Generated by Mock Bruno CLI at ${new Date().toISOString()}</p>
  </footer>
</body>
</html>`;
  }
}

/**
 * Factory function to create a mock Bruno CLI instance
 */
export function createMockBrunoCLI(options?: { delay?: number }): MockBrunoCLI {
  return new MockBrunoCLI(options);
}
