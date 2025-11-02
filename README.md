# Bruno MCP Server

[![Tests](https://img.shields.io/badge/tests-212%20passing-success)](.)
[![Coverage](https://img.shields.io/badge/coverage-84.69%25-success)](.)
[![Function Coverage](https://img.shields.io/badge/function%20coverage-85%25-success)](.)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](.)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An MCP (Model Context Protocol) server that provides integration with Bruno CLI for API testing and collection management.

## 🚀 Quick Start

### Install via NPM (Recommended)

```bash
# Install globally
npm install -g bruno-mcp-server

# Or install locally in your project
npm install bruno-mcp-server
```

### Install from Source

```bash
# Clone the repository
git clone https://github.com/jcr82/bruno-mcp-server.git
cd bruno-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Features

### Core Features
- ✅ Run individual API requests from Bruno collections
- ✅ Run entire collections or specific folders
- ✅ List all requests in a collection
- ✅ Environment variable support and validation
- ✅ Report generation (JSON, JUnit, HTML)
- ✅ Collection discovery and validation
- ✅ Request introspection and dry run mode
- ✅ Health monitoring and performance metrics
- ✅ Security features (path validation, secret masking)
- ✅ Caching for optimal performance
- ✅ Mock CLI mode for testing and CI/CD

## Installation

### Prerequisites
- **Node.js**: Version 20 or higher
- **Bruno Collections**: Your existing Bruno API test collections

### Option 1: NPM Global Installation

```bash
npm install -g bruno-mcp-server
```

This installs the server globally and makes it available as a command.

### Option 2: NPM Local Installation

```bash
npm install bruno-mcp-server
```

Add to your MCP client config using `node_modules/.bin/bruno-mcp-server`.

### Option 3: From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/jcr82/bruno-mcp-server.git
   cd bruno-mcp-server
   npm install
   npm run build
   ```

2. The built server will be in `dist/index.js`.

## Configuration

### For Claude Desktop

Add the following to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### If installed globally via npm:

```json
{
  "mcpServers": {
    "bruno": {
      "command": "bruno-mcp-server"
    }
  }
}
```

#### If installed from source:

```json
{
  "mcpServers": {
    "bruno": {
      "command": "node",
      "args": ["/path/to/bruno-mcp-server/dist/index.js"]
    }
  }
}
```

#### If installed locally in a project:

```json
{
  "mcpServers": {
    "bruno": {
      "command": "node",
      "args": ["/path/to/project/node_modules/.bin/bruno-mcp-server"]
    }
  }
}
```

## Usage

Once configured, you can use the following tools through your MCP client:

### 1. Run a Specific Request

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Get User",
  environment: "dev",               // optional - environment name or path
  envVariables: {                   // optional
    "API_KEY": "your-key"
  },
  // Report generation options (optional)
  reporterJson: "./reports/results.json",    // JSON report
  reporterJunit: "./reports/results.xml",    // JUnit XML for CI/CD
  reporterHtml: "./reports/results.html",    // HTML report
  dryRun: false                     // optional - validate without executing HTTP call
})
```

**Dry Run Mode:**
Set `dryRun: true` to validate request configuration without executing the HTTP call:
```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Create User",
  dryRun: true  // Validates configuration only - no HTTP call made
})
```

Output:
```
=== DRY RUN: Request Validation ===

✅ Request validated successfully (HTTP call not executed)

Request: Create User
Method: POST
URL: {{baseUrl}}/api/users

Configuration Summary:
  Headers: 2
  Body: json
  Auth: bearer
  Tests: 3

ℹ️  This was a dry run - no HTTP request was sent.
```

### 2. Run a Collection

```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  environment: "dev",                // optional - environment name or path
  folderPath: "auth",                // optional - run specific folder
  envVariables: {                    // optional
    "BASE_URL": "https://api.example.com"
  },
  // Report generation options (optional)
  reporterJson: "./reports/collection.json",
  reporterJunit: "./reports/collection.xml",
  reporterHtml: "./reports/collection.html",
  dryRun: false                      // optional - validate without executing HTTP calls
})
```

**Dry Run Mode for Collections:**
```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  folderPath: "Users",
  dryRun: true  // Validates all requests without making HTTP calls
})
```

Output:
```
=== DRY RUN: Collection Validation ===

✅ Collection validated successfully (HTTP calls not executed)

Total Requests: 5

Requests that would be executed:
  ✓ Get All Users - GET {{baseUrl}}/users
  ✓ Get User By ID - GET {{baseUrl}}/users/1
  ✓ Create User - POST {{baseUrl}}/users
  ✓ Update User - PUT {{baseUrl}}/users/1
  ✓ Delete User - DELETE {{baseUrl}}/users/1

ℹ️  This was a dry run - no HTTP requests were sent.
```

### 3. List Requests

```typescript
bruno_list_requests({
  collectionPath: "/path/to/collection"
})
```

### 4. Discover Collections

Recursively search for Bruno collections in a directory:

```typescript
bruno_discover_collections({
  searchPath: "/path/to/workspace",
  maxDepth: 5  // optional - maximum directory depth (default: 5, max: 10)
})
```

Example output:
```
Found 3 Bruno collection(s):

1. /path/to/workspace/api-tests
2. /path/to/workspace/projects/integration-tests
3. /path/to/workspace/e2e-tests
```

### 5. List Environments

List all environments available in a collection:

```typescript
bruno_list_environments({
  collectionPath: "/path/to/collection"
})
```

Example output:
```
Found 3 environment(s):

• dev
  Path: /path/to/collection/environments/dev.bru
  Variables: 5
    - baseUrl: https://api.dev.example.com
    - apiKey: ***
    - timeout: 5000

• staging
  Path: /path/to/collection/environments/staging.bru
  Variables: 5
    - baseUrl: https://api.staging.example.com
    - apiKey: ***
    - timeout: 10000

• production
  Path: /path/to/collection/environments/production.bru
  Variables: 5
    - baseUrl: https://api.example.com
    - apiKey: ***
    - timeout: 15000
```

### 6. Validate Environment

Validate an environment file's structure and variables:

```typescript
bruno_validate_environment({
  collectionPath: "/path/to/collection",
  environmentName: "dev"
})
```

Example output:
```
=== Environment Validation: dev ===

✅ Status: Valid

Variables: 5

  baseUrl: https://api.dev.example.com
  apiKey: *** (masked)
  timeout: 5000
  region: us-east-1
  debug: true

Warnings:
  ⚠️  Variable "apiKey" may contain hardcoded sensitive data
```

### 7. Get Request Details

Inspect a request's configuration without executing it:

```typescript
bruno_get_request_details({
  collectionPath: "/path/to/collection",
  requestName: "Create User"
})
```

Example output:
```
=== Request Details: Create User ===

Method: POST
URL: {{baseUrl}}/api/users
Auth: bearer

Headers:
  Content-Type: application/json
  Authorization: Bearer {{token}}

Body Type: json
Body Content:
  {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }

Tests: 3
  1. Status should be 201
  2. Response should have an ID
  3. Email should match

Metadata:
  Type: http
  Sequence: 1
```

**Use Cases:**
- Inspect request configuration before execution
- Debug request setup issues
- Generate documentation from requests
- Understand test assertions
- Review request structure

### 8. Validate Collection

Validate a Bruno collection's structure, syntax, and integrity:

```typescript
bruno_validate_collection({
  collectionPath: "/path/to/collection"
})
```

Example output:
```
=== Collection Validation ===

✅ Collection is valid

Summary:
  bruno.json: ✓ Found
  Total Requests: 15
  Valid Requests: 15
  Invalid Requests: 0
  Environments: 3

Warnings:
  ⚠️  Environment "dev": Variable "apiKey" may contain hardcoded sensitive data

🎉 Collection is ready to use!
```

**Use Cases:**
- Pre-flight validation before deployment
- CI/CD pipeline checks
- Catch configuration errors early
- Verify collection integrity
- Validate after collection updates

### 9. Health Check

Check the server health, Bruno CLI availability, and optionally view performance metrics and cache statistics:

```typescript
bruno_health_check({
  includeMetrics: true,      // optional - include performance metrics
  includeCacheStats: true    // optional - include cache statistics
})
```

Example output:
```
=== Bruno MCP Server Health Check ===

Server Status: Running
Server Version: 0.1.0
Node.js Version: v24.8.0
Platform: darwin arm64
Uptime: 42 seconds

=== Bruno CLI ===
Status: Available
Version: Available (use --version for details)

=== Configuration ===
Logging Level: info
Retry Enabled: Yes
Security Enabled: No restrictions
Secret Masking: Enabled
Cache Enabled: Yes
Cache TTL: 300000ms

=== Performance Metrics ===
Total Executions: 15
Success Rate: 100.00%
Average Duration: 234.56ms

By Tool:
  bruno_run_request:
    Executions: 10
    Success Rate: 100.00%
    Avg Duration: 189.23ms

=== Cache Statistics ===
Request List Cache:
  Size: 3 entries
  Total Hits: 25
  Cached Collections:
    - /path/to/collection1
    - /path/to/collection2
    - /path/to/collection3

=== Status ===
All systems operational
```

## Report Generation

The Bruno MCP Server supports generating test reports in three formats:

### JSON Report
Contains detailed test results in JSON format, ideal for programmatic processing.

### JUnit XML Report
Compatible with CI/CD systems like Jenkins, GitHub Actions, and GitLab CI. Perfect for integration into automated pipelines.

### HTML Report
Beautiful, interactive HTML report with Vue.js interface for easy viewing in browsers.

### Example: Generate All Reports

```typescript
bruno_run_collection({
  collectionPath: "./my-api-tests",
  environment: "production",
  reporterJson: "./reports/api-tests.json",
  reporterJunit: "./reports/api-tests.xml",
  reporterHtml: "./reports/api-tests.html"
})
```

The server will confirm when reports are generated:

```
=== Generated Reports ===
  Wrote json results to ./reports/api-tests.json
  Wrote junit results to ./reports/api-tests.xml
  Wrote html results to ./reports/api-tests.html
```

## Example Collection

A ready-to-use example collection is available in [collection-examples/getting-started](collection-examples/getting-started/). This collection demonstrates:

- Basic HTTP methods (GET, POST, PUT)
- Environment variables usage
- Request headers and bodies
- Response tests and assertions
- Report generation

The example uses the free [JSONPlaceholder API](https://jsonplaceholder.typicode.com), so you can run it immediately without any setup.

**Quick Start:**
```typescript
bruno_run_collection({
  collectionPath: "./collection-examples/getting-started",
  environment: "dev"
})
```

See the [example collection README](collection-examples/getting-started/README.md) for more details and usage examples.

## Development

### Run in Development Mode
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Build
```bash
npm run build
```

## Configuration

The Bruno MCP Server supports configuration via a `bruno-mcp.config.json` file. The server looks for this file in the following locations (in order):

1. Environment variable: `BRUNO_MCP_CONFIG`
2. Current working directory: `./bruno-mcp.config.json`
3. Home directory: `~/.bruno-mcp.config.json`

### Configuration Options

```json
{
  "brunoCliPath": "/custom/path/to/bru",
  "brunoHome": "/path/to/bruno/home",
  "timeout": {
    "request": 30000,
    "collection": 120000
  },
  "retry": {
    "enabled": true,
    "maxAttempts": 3,
    "backoff": "exponential"
  },
  "security": {
    "allowedPaths": [
      "/path/to/collections",
      "/another/path"
    ],
    "maskSecrets": true,
    "secretPatterns": [
      "password",
      "api[_-]?key",
      "token",
      "secret",
      "authorization"
    ]
  },
  "logging": {
    "level": "info",
    "format": "json"
  },
  "performance": {
    "cacheEnabled": true,
    "cacheTTL": 300000
  }
}
```

### Configuration Details

- **brunoCliPath**: Custom path to Bruno CLI executable (default: auto-detect)
- **brunoHome**: Bruno home directory for environments and settings
- **timeout.request**: Timeout for individual requests in milliseconds (default: 30000)
- **timeout.collection**: Timeout for collection runs in milliseconds (default: 120000)
- **retry.enabled**: Enable automatic retry on failures (default: false)
- **retry.maxAttempts**: Maximum retry attempts (1-10, default: 3)
- **retry.backoff**: Retry backoff strategy: 'linear' or 'exponential'
- **security.allowedPaths**: Restrict file system access to specific paths
- **security.maskSecrets**: Enable secret masking in logs and errors (default: true)
- **security.secretPatterns**: Additional regex patterns for secret detection
- **logging.level**: Log level: 'debug', 'info', 'warning', 'error' (default: 'info')
- **logging.format**: Log format: 'json' or 'text' (default: 'text')
- **performance.cacheEnabled**: Enable request list caching (default: true)
- **performance.cacheTTL**: Cache time-to-live in milliseconds (default: 300000)

See [bruno-mcp.config.example.json](bruno-mcp.config.example.json) for a complete example.

## Security Features

### Path Validation
The server validates all file paths to prevent directory traversal attacks. Configure `security.allowedPaths` to restrict access to specific directories.

### Input Sanitization
All user inputs are sanitized to prevent command injection and other security vulnerabilities.

### Secret Masking
Sensitive data (API keys, passwords, tokens) are automatically masked in logs and error messages. Customize detection patterns via `security.secretPatterns`.

### Environment Variable Validation
Environment variables are validated for safe characters and patterns before being passed to Bruno CLI.

## Performance Features

### Request List Caching
Collection request lists are cached in memory with configurable TTL to reduce file system operations. Cache hits are logged for monitoring.

### Execution Metrics
The server tracks performance metrics including:
- Execution duration per tool
- Success/failure rates
- Average response times
- Total executions

Access these metrics via the `bruno_health_check` tool with `includeMetrics: true`.

## Project Structure

```
bruno-mcp-server/
├── src/
│   ├── index.ts        # Main MCP server implementation
│   ├── bruno-cli.ts    # Bruno CLI wrapper
│   ├── config.ts       # Configuration management
│   ├── security.ts     # Security validation utilities
│   └── performance.ts  # Caching and metrics tracking
├── dist/               # Compiled JavaScript (after build)
├── bruno-mcp.config.json         # Active configuration
├── bruno-mcp.config.example.json # Example configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

The server properly handles and reports:
- Missing Bruno CLI installation
- Invalid collection paths
- Unsupported Bruno CLI operations
- Request execution failures
- Malformed input parameters

## Documentation

### 📚 Guides

- **[Getting Started](docs/guides/getting-started.md)** - Step-by-step guide to install and configure Bruno MCP Server
- **[Configuration](docs/guides/configuration.md)** - Complete configuration reference and options
- **[Usage Patterns](docs/guides/usage-patterns.md)** - Common workflows and best practices
- **[Troubleshooting](docs/guides/troubleshooting.md)** - Solutions to common issues
- **[CI/CD Integration](docs/guides/ci-cd-integration.md)** - Integrate with GitHub Actions, GitLab CI, CircleCI
- **[Mock Mode](MOCK-MODE.md)** - Testing without Bruno CLI dependencies

### 🔧 API Reference

- **[MCP Tools API](docs/api/tools.md)** - Complete reference for all 9 MCP tools with examples

## Troubleshooting

For detailed troubleshooting, see the [Troubleshooting Guide](docs/guides/troubleshooting.md).

### Quick Fixes

**Bruno CLI Not Found:**
1. Ensure dependencies are installed: `npm install`
2. Verify Bruno CLI was installed: `npx bru --version`
3. The server will automatically use the local installation in `node_modules/.bin/bru`

**Collection Not Found:**
- Use absolute paths (not relative paths)
- Verify the collection path is correct
- Ensure the directory contains a `bruno.json` file

**Permission Issues:**
- Ensure the MCP server has read access to your Bruno collections
- Check that the server can execute the Bruno CLI

## Next Steps

See [ROADMAP.md](ROADMAP.md) for the complete feature roadmap.

Completed features:
- ✅ Core MCP server with Bruno CLI integration
- ✅ Run requests and collections
- ✅ Environment support
- ✅ Report generation (JSON, JUnit, HTML formats)
- ✅ Collection discovery (recursive search)
- ✅ Environment management (list, validate)
- ✅ Request introspection (inspect without executing)
- ✅ Dry run mode (validate without HTTP execution)
- ✅ Collection validation (structure, syntax, integrity checks)
- ✅ Configuration system with multi-location support
- ✅ Security hardening (path validation, input sanitization, secret masking)
- ✅ Performance optimizations (request list caching, execution metrics)
- ✅ Health check tool

Planned enhancements:
- Logging system with structured output
- Parallel execution support
- Advanced filtering and search capabilities

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT