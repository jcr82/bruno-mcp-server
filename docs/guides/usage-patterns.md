# Usage Patterns and Best Practices

Common workflows and patterns for using Bruno MCP Server effectively.

## Pattern 1: Complete Workflow

```typescript
// 1. Discover collections
const collections = bruno_discover_collections({
  searchPath: "/workspace"
});

// 2. Validate first collection
const validation = bruno_validate_collection({
  collectionPath: collections[0]
});

if (validation.valid) {
  // 3. List requests
  const requests = bruno_list_requests({
    collectionPath: collections[0]
  });

  // 4. Execute
  bruno_run_collection({
    collectionPath: collections[0],
    environment: "production",
    reporterJson: "./reports/results.json"
  });
}
```

## Pattern 2: Environment Validation

```typescript
// List environments
const envs = bruno_list_environments({
  collectionPath: "/path/to/collection"
});

// Validate each
for (const env of envs) {
  const result = bruno_validate_environment({
    collectionPath: "/path/to/collection",
    environmentName: env.name
  });

  if (!result.valid) {
    console.error(`${env.name}: ${result.errors.join(", ")}`);
  }
}
```

## Pattern 3: Regression Testing

```typescript
// Run full suite with reports
bruno_run_collection({
  collectionPath: "/tests/api-regression",
  environment: "staging",
  reporterJson: "./reports/regression.json",
  reporterJunit: "./reports/regression.xml",
  reporterHtml: "./reports/regression.html"
});
```

## Pattern 4: Safe Production Execution

```typescript
// 1. Inspect request
const details = bruno_get_request_details({
  collectionPath: "/path/to/collection",
  requestName: "Delete Production Data"
});

// 2. Validate environment
const envValidation = bruno_validate_environment({
  collectionPath: "/path/to/collection",
  environmentName: "production"
});

// 3. Dry run first
const dryRun = bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Delete Production Data",
  dryRun: true
});

// 4. Only execute if all checks pass
if (envValidation.valid && dryRun.exitCode === 0) {
  bruno_run_request({
    collectionPath: "/path/to/collection",
    requestName: "Delete Production Data",
    environment: "production"
  });
}
```

## Pattern 5: Multi-Environment Testing

```typescript
const environments = ["dev", "staging", "production"];

for (const env of environments) {
  console.log(`Testing ${env}...`);

  const result = bruno_run_collection({
    collectionPath: "/tests/smoke-tests",
    environment: env,
    reporterJson: `./reports/${env}-results.json`
  });

  if (result.exitCode !== 0) {
    console.error(`${env} tests failed!`);
    break;
  }
}
```

## Best Practices

### 1. Always Validate First

```typescript
// Good
const validation = bruno_validate_collection({ collectionPath });
if (validation.valid) {
  bruno_run_collection({ collectionPath });
}

// Avoid
bruno_run_collection({ collectionPath }); // No validation
```

### 2. Use Absolute Paths

```typescript
// Good
collectionPath: "/Users/john/projects/api-tests"

// Avoid
collectionPath: "../api-tests"  // Relative path
```

### 3. Handle Errors

```typescript
try {
  const result = bruno_run_request({...});
  if (result.exitCode !== 0) {
    console.error("Request failed:", result.stderr);
  }
} catch (error) {
  console.error("Execution error:", error);
}
```

### 4. Generate Reports

```typescript
// Always generate reports for test runs
bruno_run_collection({
  collectionPath,
  environment,
  reporterJson: "./reports/results.json",  // For processing
  reporterJunit: "./reports/results.xml",  // For CI/CD
  reporterHtml: "./reports/results.html"   // For humans
});
```

### 5. Use Caching Wisely

Cache is enabled by default for better performance. Configure TTL based on your needs:

```json
{
  "performance": {
    "cacheEnabled": true,
    "cacheTTL": 300000  // 5 minutes
  }
}
```

---

**Last Updated:** 2025-10-22
