# CI/CD Integration Guide

Integrate Bruno MCP Server into your CI/CD pipelines.

## GitHub Actions

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Bruno MCP Server
        run: |
          git clone https://github.com/jcr82/bruno-mcp-server.git
          cd bruno-mcp-server
          npm install
          npm run build

      - name: Run API Tests
        run: |
          cd bruno-mcp-server
          node dist/index.js --run-collection ./path/to/collection \
            --environment production \
            --reporter-junit ./reports/junit.xml

      - name: Publish Test Results
        uses: EnricoMi/publish-unit-test-result-action@v2
        if: always()
        with:
          files: bruno-mcp-server/reports/*.xml

      - name: Upload Reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: bruno-mcp-server/reports/
```

## GitLab CI

```yaml
api-tests:
  image: node:18
  script:
    - git clone https://github.com/jcr82/bruno-mcp-server.git
    - cd bruno-mcp-server
    - npm install
    - npm run build
    - node dist/index.js --run-collection ../collections/api-tests \
        --environment staging \
        --reporter-junit reports/junit.xml
  artifacts:
    reports:
      junit: bruno-mcp-server/reports/junit.xml
    paths:
      - bruno-mcp-server/reports/
    expire_in: 1 week
```

## CircleCI

```yaml
version: 2.1

jobs:
  api-test:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run:
          name: Install Bruno MCP Server
          command: |
            git clone https://github.com/jcr82/bruno-mcp-server.git
            cd bruno-mcp-server
            npm install
            npm run build
      - run:
          name: Run Tests
          command: |
            cd bruno-mcp-server
            node dist/index.js --run-collection ../api-tests \
              --reporter-junit reports/junit.xml
      - store_test_results:
          path: bruno-mcp-server/reports
      - store_artifacts:
          path: bruno-mcp-server/reports

workflows:
  test:
    jobs:
      - api-test
```

## Mock Mode for CI/CD

Use mock mode for fast, reliable tests:

```json
{
  "useMockCLI": true,
  "mockCLIDelay": 10
}
```

```bash
export BRUNO_MOCK_CLI=true
npm test
```

## Best Practices

1. **Use Mock Mode** for unit tests
2. **Use Real CLI** for integration tests
3. **Generate JUnit reports** for CI integration
4. **Cache dependencies** to speed up builds
5. **Fail fast** on critical API failures

---

**Last Updated:** 2025-10-22
