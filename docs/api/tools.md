# Bruno MCP Server - Tool Reference

Complete reference for all 9 MCP tools provided by the Bruno MCP Server.

## Table of Contents

1. [bruno_run_request](#bruno_run_request)
2. [bruno_run_collection](#bruno_run_collection)
3. [bruno_list_requests](#bruno_list_requests)
4. [bruno_discover_collections](#bruno_discover_collections)
5. [bruno_list_environments](#bruno_list_environments)
6. [bruno_validate_environment](#bruno_validate_environment)
7. [bruno_get_request_details](#bruno_get_request_details)
8. [bruno_validate_collection](#bruno_validate_collection)
9. [bruno_health_check](#bruno_health_check)

---

## bruno_run_request

Execute a single API request from a Bruno collection.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionPath` | string | ✅ | Absolute path to the Bruno collection directory |
| `requestName` | string | ✅ | Name of the request to execute (as shown in Bruno) |
| `environment` | string | ❌ | Environment name or path to .bru environment file |
| `envVariables` | object | ❌ | Key-value pairs to override environment variables |
| `reporterJson` | string | ❌ | Path to write JSON report |
| `reporterJunit` | string | ❌ | Path to write JUnit XML report |
| `reporterHtml` | string | ❌ | Path to write HTML report |
| `dryRun` | boolean | ❌ | Validate without executing HTTP call |

### Returns

```typescript
{
  stdout: string;      // Command output
  stderr: string;      // Error output
  exitCode: number;    // 0 for success, non-zero for failure
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
    request?: {...};
    response?: {...};
    assertions?: Array<{...}>;
  }>;
}
```

### Examples

#### Basic Request Execution

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Get Users"
})
```

#### With Environment

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Get User By ID",
  environment: "dev"
})
```

#### With Custom Variables

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Create User",
  envVariables: {
    "API_KEY": "test-key-123",
    "BASE_URL": "https://api.test.com"
  }
})
```

#### With Report Generation

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Get Users",
  environment: "production",
  reporterJson: "./reports/get-users.json",
  reporterJunit: "./reports/get-users.xml",
  reporterHtml: "./reports/get-users.html"
})
```

#### Dry Run Mode

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Delete User",
  dryRun: true  // Validates without making HTTP call
})
```

### Error Handling

The tool throws errors for:
- Collection path not found
- Request name not found in collection
- Invalid .bru file syntax
- Bruno CLI execution failures

---

## bruno_run_collection

Execute an entire Bruno collection or a specific folder within it.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionPath` | string | ✅ | Absolute path to the Bruno collection directory |
| `environment` | string | ❌ | Environment name or path to .bru environment file |
| `folderPath` | string | ❌ | Relative path to folder within collection (runs only that folder) |
| `envVariables` | object | ❌ | Key-value pairs to override environment variables |
| `reporterJson` | string | ❌ | Path to write JSON report |
| `reporterJunit` | string | ❌ | Path to write JUnit XML report |
| `reporterHtml` | string | ❌ | Path to write HTML report |
| `dryRun` | boolean | ❌ | Validate all requests without executing HTTP calls |

### Returns

Same structure as `bruno_run_request`, but with results for all executed requests.

### Examples

#### Run Entire Collection

```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  environment: "dev"
})
```

#### Run Specific Folder

```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  environment: "staging",
  folderPath: "Users/Authentication"
})
```

#### With All Reports

```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  environment: "production",
  reporterJson: "./reports/api-tests.json",
  reporterJunit: "./reports/api-tests.xml",
  reporterHtml: "./reports/api-tests.html"
})
```

#### Dry Run for Entire Collection

```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  folderPath: "CriticalOperations",
  dryRun: true  // Validates all without HTTP calls
})
```

---

## bruno_list_requests

List all requests in a Bruno collection with their metadata.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionPath` | string | ✅ | Absolute path to the Bruno collection directory |

### Returns

```typescript
Array<{
  name: string;     // Request name
  method?: string;  // HTTP method (GET, POST, etc.)
  url?: string;     // Request URL
  folder?: string;  // Folder path within collection
  path?: string;    // Full file path to .bru file
}>
```

### Examples

```typescript
const requests = bruno_list_requests({
  collectionPath: "/path/to/collection"
});

// Output:
// [
//   { name: "Get Users", method: "GET", url: "{{baseUrl}}/users", folder: "Users", path: "..." },
//   { name: "Create User", method: "POST", url: "{{baseUrl}}/users", folder: "Users", path: "..." },
//   ...
// ]
```

### Use Cases

- Discover available requests
- Generate documentation
- Build custom UIs
- Validate collection structure

---

## bruno_discover_collections

Recursively search for Bruno collections in a directory.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchPath` | string | ✅ | Directory to search for collections |
| `maxDepth` | number | ❌ | Maximum directory depth (default: 5, max: 10) |

### Returns

```typescript
string[]  // Array of absolute paths to discovered collections
```

### Examples

#### Basic Discovery

```typescript
const collections = bruno_discover_collections({
  searchPath: "/Users/john/projects"
});

// Output:
// [
//   "/Users/john/projects/api-tests",
//   "/Users/john/projects/app/integration-tests",
//   "/Users/john/projects/services/e2e-tests"
// ]
```

#### With Depth Limit

```typescript
const collections = bruno_discover_collections({
  searchPath: "/workspace",
  maxDepth: 3  // Only search 3 levels deep
});
```

### How It Works

Searches for directories containing `bruno.json` or `collection.bru` files.
Automatically skips:
- Hidden directories (starting with `.`)
- `node_modules`
- Common build directories

---

## bruno_list_environments

List all environments available in a Bruno collection.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionPath` | string | ✅ | Absolute path to the Bruno collection directory |

### Returns

```typescript
Array<{
  name: string;                      // Environment name (filename without .bru)
  path: string;                      // Full path to .bru file
  variables: Record<string, string>; // Parsed environment variables
}>
```

### Examples

```typescript
const environments = bruno_list_environments({
  collectionPath: "/path/to/collection"
});

// Output:
// [
//   {
//     name: "dev",
//     path: "/path/to/collection/environments/dev.bru",
//     variables: {
//       baseUrl: "https://api.dev.example.com",
//       apiKey: "***",  // Masked for security
//       timeout: "5000"
//     }
//   },
//   {
//     name: "production",
//     path: "/path/to/collection/environments/production.bru",
//     variables: {
//       baseUrl: "https://api.example.com",
//       apiKey: "***",
//       timeout: "15000"
//     }
//   }
// ]
```

### Security

Sensitive values (containing "password", "secret", "token", "key") are automatically masked in the output.

---

## bruno_validate_environment

Validate an environment file's structure and variables.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionPath` | string | ✅ | Absolute path to the Bruno collection directory |
| `environmentName` | string | ✅ | Name of the environment to validate |

### Returns

```typescript
{
  valid: boolean;
  exists: boolean;
  errors: string[];
  warnings: string[];
  variables?: Record<string, string>;
}
```

### Examples

```typescript
const result = bruno_validate_environment({
  collectionPath: "/path/to/collection",
  environmentName: "dev"
});

// Output:
// {
//   valid: true,
//   exists: true,
//   errors: [],
//   warnings: [
//     "Variable 'apiKey' may contain hardcoded sensitive data"
//   ],
//   variables: {
//     baseUrl: "https://api.dev.example.com",
//     apiKey: "dev-key-123",
//     timeout: "5000"
//   }
// }
```

### Validation Checks

✅ File exists
✅ Valid .bru syntax
✅ Contains `vars {}` block
✅ Variables are defined
⚠️ Warns about hardcoded secrets

---

## bruno_get_request_details

Inspect a request's configuration without executing it.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionPath` | string | ✅ | Absolute path to the Bruno collection directory |
| `requestName` | string | ✅ | Name of the request to inspect |

### Returns

```typescript
{
  name: string;
  method: string;  // GET, POST, PUT, DELETE, etc.
  url: string;
  headers: Record<string, string>;
  body?: {
    type: string;      // json, xml, text, etc.
    content: string;
  };
  auth: string;        // none, bearer, basic, etc.
  tests: string[];     // Array of test descriptions
  metadata: {
    type: string;
    seq?: number;
  };
}
```

### Examples

```typescript
const details = bruno_get_request_details({
  collectionPath: "/path/to/collection",
  requestName: "Create User"
});

// Output:
// {
//   name: "Create User",
//   method: "POST",
//   url: "{{baseUrl}}/api/users",
//   headers: {
//     "Content-Type": "application/json",
//     "Authorization": "Bearer {{token}}"
//   },
//   body: {
//     type: "json",
//     content: "{\n  \"name\": \"John Doe\",\n  \"email\": \"john@example.com\"\n}"
//   },
//   auth: "bearer",
//   tests: [
//     "Status should be 201",
//     "Response should have an ID",
//     "Email should match"
//   ],
//   metadata: {
//     type: "http",
//     seq: 3
//   }
// }
```

### Use Cases

- Debug request configuration
- Generate documentation
- Inspect before execution
- Understand test assertions

---

## bruno_validate_collection

Validate a Bruno collection's structure, syntax, and integrity.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionPath` | string | ✅ | Absolute path to the Bruno collection directory |

### Returns

```typescript
{
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
}
```

### Examples

```typescript
const result = bruno_validate_collection({
  collectionPath: "/path/to/collection"
});

// Output:
// {
//   valid: true,
//   errors: [],
//   warnings: [
//     "Environment 'dev': Variable 'apiKey' may contain hardcoded sensitive data"
//   ],
//   summary: {
//     hasBrunoJson: true,
//     totalRequests: 15,
//     validRequests: 15,
//     invalidRequests: 0,
//     environments: 3
//   }
// }
```

### Validation Checks

✅ `bruno.json` exists
✅ All `.bru` files have valid syntax
✅ Environments are valid
✅ Requests are properly formatted
⚠️ Warns about potential issues

### Use Cases

- Pre-deployment validation
- CI/CD pipeline checks
- Catch configuration errors early
- Verify collection integrity

---

## bruno_health_check

Check server health, Bruno CLI availability, and optionally view metrics.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeMetrics` | boolean | ❌ | Include performance metrics in output |
| `includeCacheStats` | boolean | ❌ | Include cache statistics in output |

### Returns

```typescript
{
  status: string;
  version: string;
  nodeVersion: string;
  platform: string;
  uptime: number;
  brunoCLI: {
    available: boolean;
    version?: string;
  };
  config: {
    loggingLevel: string;
    retryEnabled: boolean;
    securityEnabled: boolean;
    cacheEnabled: boolean;
  };
  metrics?: {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    byTool: Record<string, {...}>;
  };
  cacheStats?: {
    requestList: {...};
    collectionDiscovery: {...};
    environmentList: {...};
    fileContent: {...};
  };
}
```

### Examples

#### Basic Health Check

```typescript
bruno_health_check({})

// Output:
// {
//   status: "Running",
//   version: "0.1.0",
//   nodeVersion: "v18.17.0",
//   platform: "darwin",
//   uptime: 3600,
//   brunoCLI: {
//     available: true,
//     version: "1.40.0"
//   },
//   config: {
//     loggingLevel: "info",
//     retryEnabled: false,
//     securityEnabled: false,
//     cacheEnabled: true
//   }
// }
```

#### With Metrics

```typescript
bruno_health_check({
  includeMetrics: true,
  includeCacheStats: true
})
```

### Use Cases

- Verify server is running
- Check Bruno CLI installation
- Monitor performance
- Debug caching behavior

---

## Common Patterns

### Sequential Execution

```typescript
// 1. Discover collections
const collections = bruno_discover_collections({ searchPath: "/workspace" });

// 2. Validate first collection
const validation = bruno_validate_collection({ collectionPath: collections[0] });

if (validation.valid) {
  // 3. List requests
  const requests = bruno_list_requests({ collectionPath: collections[0] });

  // 4. Execute first request
  const result = bruno_run_request({
    collectionPath: collections[0],
    requestName: requests[0].name,
    environment: "dev"
  });
}
```

### Environment Workflow

```typescript
// 1. List available environments
const envs = bruno_list_environments({ collectionPath: "/path/to/collection" });

// 2. Validate chosen environment
const validation = bruno_validate_environment({
  collectionPath: "/path/to/collection",
  environmentName: "production"
});

if (validation.valid) {
  // 3. Run with validated environment
  bruno_run_collection({
    collectionPath: "/path/to/collection",
    environment: "production"
  });
}
```

### Inspection Before Execution

```typescript
// 1. Get request details
const details = bruno_get_request_details({
  collectionPath: "/path/to/collection",
  requestName: "Delete User"
});

console.log(`Method: ${details.method}`);
console.log(`URL: ${details.url}`);
console.log(`Tests: ${details.tests.length}`);

// 2. Dry run to validate
const dryRun = bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Delete User",
  dryRun: true
});

// 3. Execute if validation passes
if (dryRun.exitCode === 0) {
  bruno_run_request({
    collectionPath: "/path/to/collection",
    requestName: "Delete User",
    environment: "dev"
  });
}
```

---

## Error Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid parameters |
| 3 | Collection not found |
| 4 | Request not found |
| 5 | Bruno CLI not available |

---

**Last Updated:** 2025-10-22
**Version:** 1.0.0
