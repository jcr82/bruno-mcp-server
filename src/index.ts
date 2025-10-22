#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { BrunoCLI } from './bruno-cli.js';
import { z } from 'zod';
import { initializeConfig, getConfigLoader } from './config.js';
import { validateToolParameters, maskSecretsInError, logSecurityEvent } from './security.js';
import { getPerformanceManager, measureExecution, formatMetrics, formatCacheStats } from './performance.js';
import { getLogger } from './logger.js';

// Tool parameter schemas
const RunRequestSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  requestName: z.string().describe('Name of the request to run'),
  environment: z.string().optional().describe('Name or path of the environment to use'),
  enviroment: z.string().optional().describe('Alias for environment (to handle common typo)'),
  envVariables: z.record(z.string()).optional().describe('Environment variables as key-value pairs'),
  reporterJson: z.string().optional().describe('Path to write JSON report'),
  reporterJunit: z.string().optional().describe('Path to write JUnit XML report'),
  reporterHtml: z.string().optional().describe('Path to write HTML report'),
  dryRun: z.boolean().optional().describe('Validate request without executing HTTP call')
});

const RunCollectionSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  environment: z.string().optional().describe('Name or path of the environment to use'),
  enviroment: z.string().optional().describe('Alias for environment (to handle common typo)'),
  folderPath: z.string().optional().describe('Specific folder within collection to run'),
  envVariables: z.record(z.string()).optional().describe('Environment variables as key-value pairs'),
  reporterJson: z.string().optional().describe('Path to write JSON report'),
  reporterJunit: z.string().optional().describe('Path to write JUnit XML report'),
  reporterHtml: z.string().optional().describe('Path to write HTML report'),
  dryRun: z.boolean().optional().describe('Validate requests without executing HTTP calls')
});

const ListRequestsSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection')
});

const HealthCheckSchema = z.object({
  includeMetrics: z.boolean().optional().describe('Include performance metrics in output'),
  includeCacheStats: z.boolean().optional().describe('Include cache statistics in output')
});

const DiscoverCollectionsSchema = z.object({
  searchPath: z.string().describe('Directory path to search for Bruno collections'),
  maxDepth: z.number().optional().describe('Maximum directory depth to search (default: 5)')
});

const ListEnvironmentsSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection')
});

const ValidateEnvironmentSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  environmentName: z.string().describe('Name of the environment to validate')
});

const GetRequestDetailsSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection'),
  requestName: z.string().describe('Name of the request to inspect')
});

const ValidateCollectionSchema = z.object({
  collectionPath: z.string().describe('Path to the Bruno collection to validate')
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'bruno_run_request',
    description: 'Run a specific request from a Bruno collection',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        requestName: {
          type: 'string',
          description: 'Name of the request to run'
        },
        environment: {
          type: 'string',
          description: 'Name or path of the environment to use (optional)'
        },
        envVariables: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Environment variables as key-value pairs (optional)'
        },
        reporterJson: {
          type: 'string',
          description: 'Path to write JSON report (optional)'
        },
        reporterJunit: {
          type: 'string',
          description: 'Path to write JUnit XML report for CI/CD integration (optional)'
        },
        reporterHtml: {
          type: 'string',
          description: 'Path to write HTML report (optional)'
        },
        dryRun: {
          type: 'boolean',
          description: 'Validate request configuration without executing HTTP call (optional)'
        }
      },
      required: ['collectionPath', 'requestName']
    }
  },
  {
    name: 'bruno_run_collection',
    description: 'Run an entire Bruno collection or a specific folder within it',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        environment: {
          type: 'string',
          description: 'Name or path of the environment to use (optional)'
        },
        folderPath: {
          type: 'string',
          description: 'Specific folder within collection to run (optional)'
        },
        envVariables: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Environment variables as key-value pairs (optional)'
        },
        reporterJson: {
          type: 'string',
          description: 'Path to write JSON report (optional)'
        },
        reporterJunit: {
          type: 'string',
          description: 'Path to write JUnit XML report for CI/CD integration (optional)'
        },
        reporterHtml: {
          type: 'string',
          description: 'Path to write HTML report (optional)'
        },
        dryRun: {
          type: 'boolean',
          description: 'Validate all requests without executing HTTP calls (optional)'
        }
      },
      required: ['collectionPath']
    }
  },
  {
    name: 'bruno_list_requests',
    description: 'List all requests in a Bruno collection',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        }
      },
      required: ['collectionPath']
    }
  },
  {
    name: 'bruno_health_check',
    description: 'Check the health and status of the Bruno MCP Server, including Bruno CLI availability, performance metrics, and cache statistics',
    inputSchema: {
      type: 'object',
      properties: {
        includeMetrics: {
          type: 'boolean',
          description: 'Include performance metrics in output (optional)'
        },
        includeCacheStats: {
          type: 'boolean',
          description: 'Include cache statistics in output (optional)'
        }
      },
      required: []
    }
  },
  {
    name: 'bruno_discover_collections',
    description: 'Discover Bruno collections by recursively searching for bruno.json files in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        searchPath: {
          type: 'string',
          description: 'Directory path to search for Bruno collections'
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum directory depth to search (default: 5, max: 10)'
        }
      },
      required: ['searchPath']
    }
  },
  {
    name: 'bruno_list_environments',
    description: 'List all available environments in a Bruno collection',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        }
      },
      required: ['collectionPath']
    }
  },
  {
    name: 'bruno_validate_environment',
    description: 'Validate an environment file structure and variables',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        environmentName: {
          type: 'string',
          description: 'Name of the environment to validate (e.g., "dev", "staging", "production")'
        }
      },
      required: ['collectionPath', 'environmentName']
    }
  },
  {
    name: 'bruno_get_request_details',
    description: 'Get detailed information about a specific request without executing it (method, URL, headers, body, tests)',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection'
        },
        requestName: {
          type: 'string',
          description: 'Name of the request to inspect'
        }
      },
      required: ['collectionPath', 'requestName']
    }
  },
  {
    name: 'bruno_validate_collection',
    description: 'Validate a Bruno collection structure, syntax, and request files',
    inputSchema: {
      type: 'object',
      properties: {
        collectionPath: {
          type: 'string',
          description: 'Path to the Bruno collection to validate'
        }
      },
      required: ['collectionPath']
    }
  }
];

class BrunoMCPServer {
  private server: Server;
  private brunoCLI: BrunoCLI;

  constructor() {
    this.server = new Server(
      {
        name: 'bruno-mcp-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.brunoCLI = new BrunoCLI();
    this.setupHandlers();
    
    // Check Bruno CLI availability on startup
    this.checkBrunoCLI();
  }

  private async checkBrunoCLI() {
    const logger = getLogger();
    const isAvailable = await this.brunoCLI.isAvailable();
    if (!isAvailable) {
      logger.warning('Bruno CLI is not available', { suggestion: 'Run npm install to install dependencies' });
      console.error('Warning: Bruno CLI is not available. Please run "npm install" to install dependencies.');
    } else {
      logger.info('Bruno CLI is available and ready');
    }
  }

  private setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const logger = getLogger();
      const startTime = Date.now();

      try {
        logger.info(`Executing tool: ${name}`, { tool: name });

        let result;
        switch (name) {
          case 'bruno_run_request':
            result = await this.handleRunRequest(args);
            break;

          case 'bruno_run_collection':
            result = await this.handleRunCollection(args);
            break;

          case 'bruno_list_requests':
            result = await this.handleListRequests(args);
            break;

          case 'bruno_health_check':
            result = await this.handleHealthCheck(args);
            break;

          case 'bruno_discover_collections':
            result = await this.handleDiscoverCollections(args);
            break;

          case 'bruno_list_environments':
            result = await this.handleListEnvironments(args);
            break;

          case 'bruno_validate_environment':
            result = await this.handleValidateEnvironment(args);
            break;

          case 'bruno_get_request_details':
            result = await this.handleGetRequestDetails(args);
            break;

          case 'bruno_validate_collection':
            result = await this.handleValidateCollection(args);
            break;

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool '${name}' is not supported by Bruno MCP server`
            );
        }

        // Log successful execution
        const duration = Date.now() - startTime;
        logger.logToolExecution(name, args, duration, true);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logToolExecution(name, args, duration, false);

        if (error instanceof McpError) {
          logger.error(`Tool execution failed: ${name}`, error, { tool: name });
          throw error;
        }

        // Mask secrets in error messages
        const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
        const errorMessage = maskedError instanceof Error ? maskedError.message : String(maskedError);

        logger.error(`Tool execution error: ${name}`, maskedError instanceof Error ? maskedError : new Error(errorMessage), { tool: name });

        // Convert other errors to MCP errors
        throw new McpError(
          ErrorCode.InternalError,
          `Bruno CLI error: ${errorMessage}`
        );
      }
    });
  }

  private async handleRunRequest(args: unknown) {
    const params = RunRequestSchema.parse(args);

    // Security validation
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      requestName: params.requestName,
      envVariables: params.envVariables
    });

    if (!validation.valid) {
      logSecurityEvent({
        type: 'access_denied',
        details: `Run request blocked: ${validation.errors.join(', ')}`,
        severity: 'error'
      });
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Security validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        logSecurityEvent({
          type: 'env_var_validation',
          details: warning,
          severity: 'warning'
        });
      });
    }

    // Handle dry run mode
    if (params.dryRun) {
      return await this.handleDryRunRequest(params);
    }

    const result = await this.brunoCLI.runRequest(
      params.collectionPath,
      params.requestName,
      {
        environment: params.environment || params.enviroment,
        envVariables: params.envVariables,
        reporterJson: params.reporterJson,
        reporterJunit: params.reporterJunit,
        reporterHtml: params.reporterHtml
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: this.formatRunResult(result)
        } as TextContent
      ]
    };
  }

  private async handleRunCollection(args: unknown) {
    const params = RunCollectionSchema.parse(args);

    // Security validation
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      folderPath: params.folderPath,
      envVariables: params.envVariables
    });

    if (!validation.valid) {
      logSecurityEvent({
        type: 'access_denied',
        details: `Run collection blocked: ${validation.errors.join(', ')}`,
        severity: 'error'
      });
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Security validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        logSecurityEvent({
          type: 'env_var_validation',
          details: warning,
          severity: 'warning'
        });
      });
    }

    // Handle dry run mode
    if (params.dryRun) {
      return await this.handleDryRunCollection(params);
    }

    const result = await this.brunoCLI.runCollection(
      params.collectionPath,
      {
        environment: params.environment || params.enviroment,
        folderPath: params.folderPath,
        envVariables: params.envVariables,
        reporterJson: params.reporterJson,
        reporterJunit: params.reporterJunit,
        reporterHtml: params.reporterHtml
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: this.formatRunResult(result)
        } as TextContent
      ]
    };
  }

  private async handleListRequests(args: unknown) {
    const params = ListRequestsSchema.parse(args);

    // Security validation
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath
    });

    if (!validation.valid) {
      logSecurityEvent({
        type: 'access_denied',
        details: `List requests blocked: ${validation.errors.join(', ')}`,
        severity: 'error'
      });
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Security validation failed: ${validation.errors.join(', ')}`
      );
    }

    const requests = await this.brunoCLI.listRequests(params.collectionPath);

    return {
      content: [
        {
          type: 'text',
          text: this.formatRequestList(requests)
        } as TextContent
      ]
    };
  }

  private async handleHealthCheck(args: unknown) {
    const params = HealthCheckSchema.parse(args);

    const perfManager = getPerformanceManager();
    const configLoader = getConfigLoader();
    const config = configLoader.getConfig();

    // Check Bruno CLI availability
    const brunoCLIAvailable = await this.brunoCLI.isAvailable();
    const brunoCLIVersion = brunoCLIAvailable ? await this.getBrunoCLIVersion() : 'Not available';

    const output: string[] = [];
    output.push('=== Bruno MCP Server Health Check ===');
    output.push('');
    output.push('Server Status: Running');
    output.push(`Server Version: 0.1.0`);
    output.push(`Node.js Version: ${process.version}`);
    output.push(`Platform: ${process.platform} ${process.arch}`);
    output.push(`Uptime: ${Math.floor(process.uptime())} seconds`);
    output.push('');

    output.push('=== Bruno CLI ===');
    output.push(`Status: ${brunoCLIAvailable ? 'Available' : 'Not Available'}`);
    output.push(`Version: ${brunoCLIVersion}`);
    output.push('');

    output.push('=== Configuration ===');
    output.push(`Logging Level: ${config.logging?.level || 'info'}`);
    output.push(`Retry Enabled: ${config.retry?.enabled ? 'Yes' : 'No'}`);
    output.push(`Security Enabled: ${config.security?.allowedPaths ? `Yes (${config.security.allowedPaths.length} allowed paths)` : 'No restrictions'}`);
    output.push(`Secret Masking: ${config.security?.maskSecrets !== false ? 'Enabled' : 'Disabled'}`);
    output.push(`Cache Enabled: ${config.performance?.cacheEnabled !== false ? 'Yes' : 'No'}`);
    output.push(`Cache TTL: ${config.performance?.cacheTTL || 300000}ms`);
    output.push('');

    // Include performance metrics if requested
    if (params.includeMetrics) {
      const summary = perfManager.getMetricsSummary();
      output.push(formatMetrics(summary));
      output.push('');
    }

    // Include cache statistics if requested
    if (params.includeCacheStats) {
      const cacheStats = perfManager.getCacheStats();
      output.push(formatCacheStats(cacheStats));
      output.push('');
    }

    output.push('=== Status ===');
    output.push(brunoCLIAvailable ? 'All systems operational' : 'Warning: Bruno CLI not available');

    return {
      content: [
        {
          type: 'text',
          text: output.join('\n')
        } as TextContent
      ]
    };
  }

  private async getBrunoCLIVersion(): Promise<string> {
    try {
      // Use execa directly to get version - BrunoCLI.isAvailable already logs version
      // This is a simpler approach since we just checked availability
      return 'Available (use --version for details)';
    } catch {
      return 'Unknown';
    }
  }

  private async handleDiscoverCollections(args: unknown) {
    const params = DiscoverCollectionsSchema.parse(args);

    // Validate search path
    const validation = await validateToolParameters({
      collectionPath: params.searchPath
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid search path: ${validation.errors.join(', ')}`
      );
    }

    try {
      const collections = await this.brunoCLI.discoverCollections(
        params.searchPath,
        params.maxDepth || 5
      );

      const output: string[] = [];

      if (collections.length === 0) {
        output.push(`No Bruno collections found in: ${params.searchPath}`);
        output.push('');
        output.push('A Bruno collection is a directory containing a bruno.json file.');
      } else {
        output.push(`Found ${collections.length} Bruno collection(s):\n`);

        collections.forEach((collectionPath, index) => {
          output.push(`${index + 1}. ${collectionPath}`);
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to discover collections: ${maskedError}`
      );
    }
  }

  private async handleListEnvironments(args: unknown) {
    const params = ListEnvironmentsSchema.parse(args);

    // Validate collection path
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid collection path: ${validation.errors.join(', ')}`
      );
    }

    try {
      const environments = await this.brunoCLI.listEnvironments(params.collectionPath);

      const output: string[] = [];

      if (environments.length === 0) {
        output.push('No environments found in this collection.');
        output.push('');
        output.push('Environments are stored in the "environments" directory with .bru extension.');
      } else {
        output.push(`Found ${environments.length} environment(s):\n`);

        environments.forEach((env) => {
          output.push(`• ${env.name}`);
          output.push(`  Path: ${env.path}`);

          if (env.variables && Object.keys(env.variables).length > 0) {
            output.push(`  Variables: ${Object.keys(env.variables).length}`);

            // Show first few variables as preview
            const varEntries = Object.entries(env.variables).slice(0, 3);
            varEntries.forEach(([key, value]) => {
              // Mask potential secrets in output
              const displayValue = key.toLowerCase().includes('password') ||
                                   key.toLowerCase().includes('secret') ||
                                   key.toLowerCase().includes('token') ||
                                   key.toLowerCase().includes('key')
                ? '***'
                : value.length > 50 ? value.substring(0, 47) + '...' : value;
              output.push(`    - ${key}: ${displayValue}`);
            });

            if (Object.keys(env.variables).length > 3) {
              output.push(`    ... and ${Object.keys(env.variables).length - 3} more`);
            }
          }

          output.push('');
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list environments: ${maskedError}`
      );
    }
  }

  private async handleValidateEnvironment(args: unknown) {
    const params = ValidateEnvironmentSchema.parse(args);

    // Validate collection path and environment name
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      requestName: params.environmentName // Reuse request validation for env name
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${validation.errors.join(', ')}`
      );
    }

    try {
      const result = await this.brunoCLI.validateEnvironment(
        params.collectionPath,
        params.environmentName
      );

      const output: string[] = [];
      output.push(`=== Environment Validation: ${params.environmentName} ===`);
      output.push('');

      if (!result.exists) {
        output.push(`❌ Status: Not Found`);
        output.push('');
        output.push('Errors:');
        result.errors.forEach(err => output.push(`  • ${err}`));
      } else if (!result.valid) {
        output.push(`❌ Status: Invalid`);
        output.push('');
        output.push('Errors:');
        result.errors.forEach(err => output.push(`  • ${err}`));
      } else {
        output.push(`✅ Status: Valid`);
        output.push('');

        if (result.variables && Object.keys(result.variables).length > 0) {
          output.push(`Variables: ${Object.keys(result.variables).length}`);
          output.push('');

          Object.entries(result.variables).forEach(([key, value]) => {
            // Mask sensitive values
            const displayValue = key.toLowerCase().includes('password') ||
                                 key.toLowerCase().includes('secret') ||
                                 key.toLowerCase().includes('token') ||
                                 key.toLowerCase().includes('key')
              ? '*** (masked)'
              : value;
            output.push(`  ${key}: ${displayValue}`);
          });
          output.push('');
        }
      }

      if (result.warnings.length > 0) {
        output.push('Warnings:');
        result.warnings.forEach(warn => output.push(`  ⚠️  ${warn}`));
      }

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to validate environment: ${maskedError}`
      );
    }
  }

  private async handleGetRequestDetails(args: unknown) {
    const params = GetRequestDetailsSchema.parse(args);

    // Validate parameters
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath,
      requestName: params.requestName
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${validation.errors.join(', ')}`
      );
    }

    try {
      const details = await this.brunoCLI.getRequestDetails(
        params.collectionPath,
        params.requestName
      );

      const output: string[] = [];
      output.push(`=== Request Details: ${details.name} ===`);
      output.push('');

      // Method and URL
      output.push(`Method: ${details.method}`);
      output.push(`URL: ${details.url}`);
      output.push(`Auth: ${details.auth}`);
      output.push('');

      // Headers
      if (Object.keys(details.headers).length > 0) {
        output.push('Headers:');
        Object.entries(details.headers).forEach(([key, value]) => {
          output.push(`  ${key}: ${value}`);
        });
        output.push('');
      }

      // Body
      if (details.body) {
        output.push(`Body Type: ${details.body.type}`);
        output.push('Body Content:');

        // Format body content with indentation
        const bodyLines = details.body.content.split('\n');
        bodyLines.forEach(line => {
          output.push(`  ${line}`);
        });
        output.push('');
      } else {
        output.push('Body: none');
        output.push('');
      }

      // Tests
      if (details.tests && details.tests.length > 0) {
        output.push(`Tests: ${details.tests.length}`);
        details.tests.forEach((test, index) => {
          output.push(`  ${index + 1}. ${test}`);
        });
        output.push('');
      } else {
        output.push('Tests: none');
        output.push('');
      }

      // Metadata
      output.push('Metadata:');
      output.push(`  Type: ${details.metadata.type}`);
      if (details.metadata.seq !== undefined) {
        output.push(`  Sequence: ${details.metadata.seq}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get request details: ${maskedError}`
      );
    }
  }

  private async handleDryRunRequest(params: any) {
    try {
      // Get request details to validate structure
      const details = await this.brunoCLI.getRequestDetails(
        params.collectionPath,
        params.requestName
      );

      const output: string[] = [];
      output.push('=== DRY RUN: Request Validation ===');
      output.push('');
      output.push(`✅ Request validated successfully (HTTP call not executed)`);
      output.push('');
      output.push(`Request: ${details.name}`);
      output.push(`Method: ${details.method}`);
      output.push(`URL: ${details.url}`);
      output.push('');

      // Show what would be executed
      output.push('Configuration Summary:');
      output.push(`  Headers: ${Object.keys(details.headers).length}`);
      output.push(`  Body: ${details.body ? details.body.type : 'none'}`);
      output.push(`  Auth: ${details.auth}`);
      output.push(`  Tests: ${details.tests?.length || 0}`);
      output.push('');

      if (params.environment) {
        output.push(`Environment: ${params.environment}`);
        output.push('');
      }

      if (params.envVariables && Object.keys(params.envVariables).length > 0) {
        output.push(`Environment Variables: ${Object.keys(params.envVariables).length} provided`);
        output.push('');
      }

      output.push('ℹ️  This was a dry run - no HTTP request was sent.');
      output.push('   Remove dryRun parameter to execute the actual request.');

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Dry run validation failed: ${maskedError}`
      );
    }
  }

  private async handleDryRunCollection(params: any) {
    try {
      // List all requests in the collection/folder
      const requests = await this.brunoCLI.listRequests(params.collectionPath);

      // Filter by folder if specified
      let requestsToValidate = requests;
      if (params.folderPath) {
        requestsToValidate = requests.filter(req =>
          req.folder && req.folder.includes(params.folderPath)
        );
      }

      const output: string[] = [];
      output.push('=== DRY RUN: Collection Validation ===');
      output.push('');
      output.push(`✅ Collection validated successfully (HTTP calls not executed)`);
      output.push('');
      output.push(`Total Requests: ${requestsToValidate.length}`);
      output.push('');

      // Validate each request
      output.push('Requests that would be executed:');
      for (const req of requestsToValidate) {
        try {
          const details = await this.brunoCLI.getRequestDetails(
            params.collectionPath,
            req.name
          );
          output.push(`  ✓ ${req.name} - ${details.method} ${details.url}`);
        } catch (error) {
          output.push(`  ✗ ${req.name} - Validation error: ${error}`);
        }
      }
      output.push('');

      if (params.folderPath) {
        output.push(`Folder Filter: ${params.folderPath}`);
        output.push('');
      }

      if (params.environment) {
        output.push(`Environment: ${params.environment}`);
        output.push('');
      }

      if (params.envVariables && Object.keys(params.envVariables).length > 0) {
        output.push(`Environment Variables: ${Object.keys(params.envVariables).length} provided`);
        output.push('');
      }

      output.push('ℹ️  This was a dry run - no HTTP requests were sent.');
      output.push('   Remove dryRun parameter to execute the actual collection.');

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Dry run validation failed: ${maskedError}`
      );
    }
  }

  private async handleValidateCollection(args: unknown) {
    const params = ValidateCollectionSchema.parse(args);

    // Validate collection path
    const validation = await validateToolParameters({
      collectionPath: params.collectionPath
    });

    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid collection path: ${validation.errors.join(', ')}`
      );
    }

    try {
      const result = await this.brunoCLI.validateCollection(params.collectionPath);

      const output: string[] = [];
      output.push('=== Collection Validation ===');
      output.push('');

      if (result.valid) {
        output.push('✅ Collection is valid');
      } else {
        output.push('❌ Collection has errors');
      }
      output.push('');

      // Summary
      output.push('Summary:');
      output.push(`  bruno.json: ${result.summary.hasBrunoJson ? '✓ Found' : '✗ Missing'}`);
      output.push(`  Total Requests: ${result.summary.totalRequests}`);
      output.push(`  Valid Requests: ${result.summary.validRequests}`);
      output.push(`  Invalid Requests: ${result.summary.invalidRequests}`);
      output.push(`  Environments: ${result.summary.environments}`);
      output.push('');

      // Errors
      if (result.errors.length > 0) {
        output.push('Errors:');
        result.errors.forEach(err => output.push(`  ✗ ${err}`));
        output.push('');
      }

      // Warnings
      if (result.warnings.length > 0) {
        output.push('Warnings:');
        result.warnings.forEach(warn => output.push(`  ⚠️  ${warn}`));
        output.push('');
      }

      if (result.valid && result.warnings.length === 0) {
        output.push('🎉 Collection is ready to use!');
      }

      return {
        content: [
          {
            type: 'text',
            text: output.join('\n')
          } as TextContent
        ]
      };
    } catch (error) {
      const maskedError = error instanceof Error ? maskSecretsInError(error) : error;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to validate collection: ${maskedError}`
      );
    }
  }

  private formatRunResult(result: any): string {
    const output = [];
    
    if (result.summary) {
      output.push('=== Execution Summary ===');
      output.push(`Total Requests: ${result.summary.totalRequests || 0}`);
      output.push(`Passed: ${result.summary.passedRequests || 0}`);
      output.push(`Failed: ${result.summary.failedRequests || 0}`);
      output.push(`Duration: ${result.summary.totalDuration || 0}ms`);
      output.push('');
    }

    if (result.results && result.results.length > 0) {
      output.push('=== Request Results ===');
      result.results.forEach((req: any) => {
        output.push(`
[${req.passed ? '✓' : '✗'}] ${req.name}`);
        
        // Request details
        if (req.request) {
          output.push(`  Request: ${req.request.method || 'GET'} ${req.request.url || ''}`);
        }
        
        // Response details
        if (req.response) {
          output.push(`  Status: ${req.response.status} ${req.response.statusText || ''}`);
          output.push(`  Duration: ${req.response.responseTime || req.duration}ms`);

          // Show response headers
          if (req.response.headers) {
            const headerKeys = Object.keys(req.response.headers);
            if (headerKeys.length > 0) {
              output.push('  Response Headers:');
              // Show most important headers first
              const importantHeaders = ['content-type', 'content-length', 'date', 'server'];
              const shownHeaders = new Set<string>();

              importantHeaders.forEach(key => {
                if (req.response.headers[key]) {
                  output.push(`    ${key}: ${req.response.headers[key]}`);
                  shownHeaders.add(key);
                }
              });

              // Show remaining headers (limit to first 5 additional)
              let count = 0;
              for (const [key, value] of Object.entries(req.response.headers)) {
                if (!shownHeaders.has(key) && count < 5) {
                  output.push(`    ${key}: ${value}`);
                  count++;
                }
              }

              if (headerKeys.length > shownHeaders.size + count) {
                output.push(`    ... and ${headerKeys.length - shownHeaders.size - count} more headers`);
              }
            }
          }

          // Show response body (limited to prevent huge outputs)
          if (req.response.body !== undefined && req.response.body !== null) {
            output.push('  Response Body:');
            const bodyStr = typeof req.response.body === 'string'
              ? req.response.body
              : JSON.stringify(req.response.body, null, 2);

            // Limit output size
            const maxLength = 2000;
            if (bodyStr.length > maxLength) {
              output.push(`    ${bodyStr.substring(0, maxLength)}...`);
              output.push(`    [Truncated - ${bodyStr.length} total characters]`);
            } else {
              bodyStr.split('\n').forEach((line: any) => {
                output.push(`    ${line}`);
              });
            }
          }
        } else if (req.status) {
          output.push(`  Status: ${req.status}`);
          output.push(`  Duration: ${req.duration}ms`);
        }
        
        if (req.error) {
          output.push(`  Error: ${req.error}`);
        }
        
        // Test assertions
        if (req.assertions && req.assertions.length > 0) {
          output.push('  Assertions:');
          req.assertions.forEach((assertion: any) => {
            output.push(`    ${assertion.passed ? '✓' : '✗'} ${assertion.name}`);
            if (!assertion.passed && assertion.error) {
              output.push(`      Error: ${assertion.error}`);
            }
          });
        }
      });
    }

    // Check for generated reports in stdout
    if (result.stdout) {
      const reportLines = result.stdout.split('\n').filter((line: string) =>
        line.includes('Wrote') && (line.includes('json') || line.includes('junit') || line.includes('html'))
      );

      if (reportLines.length > 0) {
        output.push('');
        output.push('=== Generated Reports ===');
        reportLines.forEach((line: string) => {
          output.push(`  ${line.trim()}`);
        });
      }
    }

    // Fallback to raw output if no structured data
    if (!result.summary && !result.results) {
      if (result.stdout) {
        output.push('\n=== Raw Output ===');
        output.push(result.stdout);
      }

      if (result.stderr) {
        output.push('\n=== Errors ===');
        output.push(result.stderr);
      }
    }

    return output.join('\n');
  }

  private formatRequestList(requests: any[]): string {
    if (requests.length === 0) {
      return 'No requests found in the collection.';
    }

    const output = [`Found ${requests.length} request(s):\n`];
    
    requests.forEach(req => {
      output.push(`• ${req.name}`);
      if (req.method && req.url) {
        output.push(`  ${req.method} ${req.url}`);
      }
      if (req.folder) {
        output.push(`  Folder: ${req.folder}`);
      }
    });

    return output.join('\n');
  }

  async run() {
    const logger = getLogger();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    const configLoader = getConfigLoader();
    const config = configLoader.getConfig();

    logger.info('Bruno MCP Server started successfully', {
      version: '0.1.0',
      loggingLevel: config.logging?.level || 'info',
      retryEnabled: config.retry?.enabled || false,
      cacheEnabled: config.performance?.cacheEnabled !== false
    });

    console.error('Bruno MCP Server started successfully');
    console.error(`Configuration: ${config.logging?.level || 'info'} logging, ${config.retry?.enabled ? 'retry enabled' : 'retry disabled'}`);
  }
}

// Initialize configuration and start the server
(async () => {
  try {
    // Initialize configuration
    await initializeConfig();

    // Start the server
    const server = new BrunoMCPServer();
    await server.run();
  } catch (error) {
    const logger = getLogger();
    logger.error('Failed to start Bruno MCP Server', error instanceof Error ? error : new Error(String(error)));
    console.error('Failed to start Bruno MCP Server:', error);
    process.exit(1);
  }
})();
