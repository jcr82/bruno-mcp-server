# Mock Bruno CLI Mode

## Overview

The Bruno MCP Server includes a **Mock Bruno CLI** mode that allows you to run the server without requiring the actual Bruno CLI to be installed. This is particularly useful for:

- **CI/CD Environments** - Run tests without Bruno CLI dependencies
- **Development** - Fast, predictable responses for development
- **Unit Testing** - Consistent test data
- **Offline Development** - Work without network access

## Features

The Mock Bruno CLI provides:

✅ **Predictable Responses** - Consistent, deterministic outputs
✅ **Fast Execution** - Configurable delays (default 100ms)
✅ **All Report Formats** - JSON, JUnit, HTML generation
✅ **Error Simulation** - Test failure scenarios
✅ **Complete API Coverage** - All Bruno CLI operations supported

## Configuration

### Enable Mock Mode

Add to your `bruno-mcp.config.json`:

```json
{
  "useMockCLI": true,
  "mockCLIDelay": 100
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useMockCLI` | boolean | `false` | Enable mock mode instead of real Bruno CLI |
| `mockCLIDelay` | number | `100` | Simulated execution delay in milliseconds |

### Environment Variable

You can also enable mock mode via environment variable:

```bash
export BRUNO_MOCK_CLI=true
export BRUNO_MOCK_CLI_DELAY=50
```

## Usage Examples

### Basic Mock Execution

```typescript
// The configuration will automatically use mock CLI
const brunoCLI = new BrunoCLI();

// All operations work the same way
const result = await brunoCLI.runRequest(
  '/path/to/collection',
  'Get Users',
  { environment: 'dev' }
);
```

### Programmatic Mock CLI

You can also use the mock CLI directly:

```typescript
import { createMockBrunoCLI } from './mock-bruno-cli.js';

const mockCLI = createMockBrunoCLI({ delay: 50 });

// Execute mock request
const result = await mockCLI.runRequest(['run', 'My Request']);
console.log(result.stdout); // Mock output

// Simulate failures
mockCLI.setShouldFail(true, 'Custom error message');
const failResult = await mockCLI.runRequest(['run', 'Test']);
```

### Mock Report Generation

```typescript
const mockCLI = createMockBrunoCLI();

const mockData = {
  summary: {
    totalRequests: 3,
    passedRequests: 3,
    failedRequests: 0,
    totalDuration: 300
  },
  results: [
    { name: 'Test 1', passed: true, duration: 100, status: 200 },
    { name: 'Test 2', passed: true, duration: 100, status: 200 },
    { name: 'Test 3', passed: true, duration: 100, status: 201 }
  ]
};

// Generate JSON report
await mockCLI.writeReport('json', './report.json', mockData);

// Generate JUnit XML
await mockCLI.writeReport('junit', './report.xml', mockData);

// Generate HTML
await mockCLI.writeReport('html', './report.html', mockData);
```

## Mock Response Format

### Request Execution

```typescript
{
  exitCode: 0,
  stdout: `Running Tests...

✓ Get Users (100ms)

Test Summary:
  Total: 1
  Passed: 1
  Failed: 0
  Duration: 100ms`,
  stderr: ''
}
```

### Collection Execution

```typescript
{
  exitCode: 0,
  stdout: `Running Tests...

✓ Get Users (100ms)
✓ Get User By ID (100ms)
✓ Create User (100ms)

Test Summary:
  Total: 3
  Passed: 3
  Failed: 0
  Duration: 300ms`,
  stderr: ''
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Test with Mock CLI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests with mock CLI
        env:
          BRUNO_MOCK_CLI: true
        run: npm test
```

### GitLab CI

```yaml
test:
  stage: test
  image: node:18
  variables:
    BRUNO_MOCK_CLI: "true"
  script:
    - npm install
    - npm test
```

### CircleCI

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:18.0
    environment:
      BRUNO_MOCK_CLI: true
    steps:
      - checkout
      - run: npm install
      - run: npm test
```

## Testing with Mock Mode

### Unit Tests

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { MockBrunoCLI } from '../mock-bruno-cli.js';

describe('My Tests', () => {
  let mockCLI: MockBrunoCLI;

  beforeEach(() => {
    mockCLI = new MockBrunoCLI({ delay: 10 }); // Fast execution
  });

  test('should handle successful request', async () => {
    const result = await mockCLI.runRequest(['run', 'My Request']);
    expect(result.exitCode).toBe(0);
  });

  test('should handle failures', async () => {
    mockCLI.setShouldFail(true, 'Test failure');
    const result = await mockCLI.runRequest(['run', 'Failing Request']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Test failure');
  });
});
```

## Differences from Real Bruno CLI

While the mock CLI aims to closely mimic the real Bruno CLI, there are some differences:

### Mock CLI Behavior

✅ **Always succeeds** by default (unless configured to fail)
✅ **Fixed response data** - Uses predefined mock responses
✅ **No actual HTTP requests** - All responses are simulated
✅ **Fast execution** - Configurable delays instead of real network time
✅ **No collection file parsing** - Uses mock data structures

### When to Use Each

| Scenario | Use Real CLI | Use Mock CLI |
|----------|-------------|--------------|
| Development | ✅ | ✅ Faster |
| Local testing | ✅ Accurate | ✅ Faster |
| CI/CD | ❌ Slow | ✅ Fast |
| Integration tests | ✅ Required | ❌ |
| Unit tests | ❌ Slow | ✅ Preferred |
| E2E tests | ✅ Required | ❌ |
| Offline work | ❌ | ✅ |

## Troubleshooting

### Mock mode not working

Check your configuration:
```bash
# Verify config
cat bruno-mcp.config.json | grep useMockCLI

# Check environment
echo $BRUNO_MOCK_CLI
```

### Want to temporarily disable mock mode

Set configuration to `false` or unset environment variable:
```bash
unset BRUNO_MOCK_CLI
```

### Custom mock responses

Currently, the mock CLI provides fixed responses. For custom responses, you can:

1. Extend the `MockBrunoCLI` class
2. Override the response methods
3. Implement your own mock logic

Example:
```typescript
class CustomMockCLI extends MockBrunoCLI {
  async runRequest(args: string[]) {
    // Your custom logic here
    return {
      exitCode: 0,
      stdout: 'Custom response',
      stderr: ''
    };
  }
}
```

## Performance Comparison

Typical execution times:

| Operation | Real Bruno CLI | Mock CLI (100ms delay) | Mock CLI (0ms delay) |
|-----------|----------------|------------------------|----------------------|
| Single request | ~500ms | ~100ms | <5ms |
| Collection (10 requests) | ~5s | ~1s | <50ms |
| Report generation | ~500ms | ~100ms | <5ms |

## Best Practices

1. **Use mock mode in CI/CD** for fast, reliable tests
2. **Use real CLI for integration tests** to catch real issues
3. **Configure appropriate delays** to simulate realistic timing
4. **Test both modes** to ensure compatibility
5. **Document which mode** your tests require

## API Reference

### MockBrunoCLI Class

```typescript
class MockBrunoCLI {
  constructor(options?: { delay?: number })

  setShouldFail(fail: boolean, message?: string): void
  version(): Promise<MockBrunoResponse>
  runRequest(args: string[]): Promise<MockBrunoResponse>
  runCollection(args: string[]): Promise<MockBrunoResponse>
  execute(command: string, args: string[]): Promise<MockBrunoResponse>
  writeReport(format: 'json' | 'junit' | 'html', outputPath: string, data: any): Promise<void>
}
```

### Factory Function

```typescript
function createMockBrunoCLI(options?: { delay?: number }): MockBrunoCLI
```

## Examples

See the following test files for complete examples:

- [Unit tests](src/__tests__/unit/mock-bruno-cli.test.ts) - Mock CLI unit tests
- [E2E tests](src/__tests__/e2e/workflows.e2e.test.ts) - Real CLI E2E tests
- [Integration tests](src/__tests__/integration/bruno-cli.integration.test.ts) - Real CLI integration tests

## Contributing

To add new mock responses or improve the mock CLI:

1. Update `src/mock-bruno-cli.ts`
2. Add tests in `src/__tests__/unit/mock-bruno-cli.test.ts`
3. Ensure backward compatibility
4. Update this documentation

---

**Created:** 2025-10-22
**Last Updated:** 2025-10-22
**Version:** 1.0.0
