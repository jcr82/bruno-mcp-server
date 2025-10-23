# Configuration Guide

Complete guide to configuring the Bruno MCP Server.

## Configuration File

Create `bruno-mcp.config.json` in the project root or `~/.bruno-mcp.config.json` for global settings.

## All Configuration Options

```json
{
  "brunoCliPath": "/custom/path/to/bru",
  "brunoHome": "~/bruno-collections",
  "useMockCLI": false,
  "mockCLIDelay": 100,

  "timeout": {
    "request": 30000,
    "collection": 120000
  },

  "retry": {
    "enabled": false,
    "maxAttempts": 3,
    "backoff": "exponential",
    "retryableStatuses": [408, 429, 500, 502, 503, 504]
  },

  "security": {
    "allowedPaths": ["/path/to/collections"],
    "maskSecrets": true,
    "secretPatterns": ["password", "secret", "token", "key", "api[_-]?key"]
  },

  "logging": {
    "level": "info",
    "format": "text",
    "logFile": "./logs/bruno-mcp.log",
    "maxLogSize": 10485760,
    "maxLogFiles": 5
  },

  "performance": {
    "cacheEnabled": true,
    "cacheTTL": 300000,
    "maxConcurrency": 10
  }
}
```

## Option Reference

See [bruno-mcp.config.example.json](../../bruno-mcp.config.example.json) for complete examples.

## Environment Variables

```bash
export BRUNO_MCP_CONFIG="/path/to/config.json"
export BRUNO_MOCK_CLI=true
export BRUNO_MOCK_CLI_DELAY=50
```

---

**Last Updated:** 2025-10-22
