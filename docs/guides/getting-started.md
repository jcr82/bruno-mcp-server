# Getting Started with Bruno MCP Server

A step-by-step guide to get up and running with the Bruno MCP Server in under 10 minutes.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [First Request](#first-request)
5. [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, ensure you have:

### Required

- **Node.js 18+** - [Download](https://nodejs.org/)
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```

- **Bruno Collections** - At least one Bruno collection with `.bru` files
  - If you don't have one, create a test collection in Bruno desktop app

### Optional

- **Claude Desktop** or another MCP-compatible client
- **Git** - For cloning the repository

---

## Installation

### Step 1: Clone or Download

```bash
# Clone the repository
git clone https://github.com/jcr82/bruno-mcp-server.git
cd bruno-mcp-server

# Or download and extract the ZIP file
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- Bruno CLI (automatically included)
- All required dependencies
- TypeScript and build tools

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 4: Verify Installation

```bash
# Check if Bruno CLI is available
npx bru --version

# Run tests to verify everything works
npm test
```

✅ If you see test output and Bruno CLI version, you're ready to go!

---

## Configuration

### For Claude Desktop

Add the Bruno MCP Server to your Claude Desktop configuration:

#### macOS

Edit: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bruno": {
      "command": "node",
      "args": ["/absolute/path/to/bruno-mcp-server/dist/index.js"]
    }
  }
}
```

#### Windows

Edit: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bruno": {
      "command": "node",
      "args": ["C:\\path\\to\\bruno-mcp-server\\dist\\index.js"]
    }
  }
}
```

#### Linux

Edit: `~/.config/Claude/claude_desktop_config.json`

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

**Important:** Use absolute paths, not relative paths!

### Restart Claude Desktop

After editing the configuration, restart Claude Desktop for changes to take effect.

### Verify Connection

In Claude Desktop, you should now see "bruno" in the available tools. Try asking:

> "Can you list the available Bruno MCP tools?"

---

## First Request

Let's execute your first API request using Bruno MCP Server!

### Step 1: Locate Your Collection

Find the absolute path to your Bruno collection:

```bash
# Example paths:
# macOS/Linux: /Users/john/Documents/bruno-collections/my-api
# Windows: C:\Users\john\Documents\bruno-collections\my-api
```

### Step 2: List Available Requests

In Claude Desktop, ask:

> "Can you list all requests in my Bruno collection at /path/to/your/collection?"

Claude will use the `bruno_list_requests` tool and show you all available requests.

### Step 3: Execute a Request

Now run one of the requests:

> "Please run the 'Get Users' request from my collection at /path/to/your/collection using the dev environment"

Claude will use the `bruno_run_request` tool and show you the results!

### Example Conversation

```
You: Can you run the "Get Users" request from /Users/john/api-tests using dev environment?

Claude: I'll execute that request for you.
[Uses bruno_run_request tool]

The request completed successfully:
✓ Get Users (234ms)

Response Status: 200 OK
Response Time: 234ms

Test Results:
✓ Status should be 200
✓ Response should be JSON
✓ Response should have users array

All 3 assertions passed!
```

---

## Quick Start Examples

### Example 1: Run a Single Request

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Get Users",
  environment: "dev"
})
```

### Example 2: Run Entire Collection

```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  environment: "staging",
  reporterJson: "./reports/test-results.json"
})
```

### Example 3: Discover Collections

```typescript
bruno_discover_collections({
  searchPath: "/Users/john/projects",
  maxDepth: 3
})
```

### Example 4: Validate Before Running

```typescript
// First validate
bruno_validate_collection({
  collectionPath: "/path/to/collection"
})

// If valid, run it
bruno_run_collection({
  collectionPath: "/path/to/collection",
  environment: "production"
})
```

---

## Common First-Time Issues

### Issue: "Bruno CLI not found"

**Solution:**
```bash
# Verify installation
npm install

# Check Bruno CLI
npx bru --version

# If still not found, install manually
npm install -g @usebruno/cli
```

### Issue: "Collection not found"

**Solution:**
- Verify you're using absolute paths, not relative
- Check the collection has a `bruno.json` file
- Ensure the path doesn't have spaces (or escape them properly)

### Issue: "MCP server not connecting"

**Solution:**
1. Verify the path in `claude_desktop_config.json` is absolute
2. Ensure the project is built (`npm run build`)
3. Restart Claude Desktop
4. Check logs in Claude Desktop's Developer Tools

### Issue: "Request failed"

**Solution:**
- Check your environment variables are correct
- Verify the API endpoint is accessible
- Look at the error message for specific details
- Try the request in Bruno desktop app first

---

## Configuration Options (Optional)

Create `bruno-mcp.config.json` in the project root for advanced configuration:

```json
{
  "timeout": {
    "request": 30000,
    "collection": 120000
  },
  "security": {
    "allowedPaths": [
      "/Users/john/bruno-collections"
    ],
    "maskSecrets": true
  },
  "performance": {
    "cacheEnabled": true,
    "cacheTTL": 300000
  },
  "logging": {
    "level": "info",
    "format": "text"
  }
}
```

See [Configuration Guide](configuration.md) for all options.

---

## Next Steps

Now that you're set up, explore these guides:

### 📖 Learn More
- [API Reference](../api/tools.md) - Complete tool documentation
- [Configuration Guide](configuration.md) - All configuration options
- [Usage Examples](usage-patterns.md) - Common patterns and workflows

### 🚀 Advanced Topics
- [Mock Mode](../../MOCK-MODE.md) - Testing without Bruno CLI
- [CI/CD Integration](ci-cd-integration.md) - Automated testing
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

### 💡 Try These Workflows

1. **API Regression Testing**
   - Run entire collection
   - Generate HTML report
   - Review test results

2. **Environment Validation**
   - List all environments
   - Validate each one
   - Switch between environments

3. **Collection Discovery**
   - Search workspace for collections
   - Validate each collection
   - Run tests across all

---

## Getting Help

### Documentation
- [README](../../README.md) - Project overview
- [API Reference](../api/tools.md) - Tool documentation
- [Guides](.) - Step-by-step guides

### Support
- GitHub Issues: [Report a bug](https://github.com/jcr82/bruno-mcp-server/issues)
- Discussions: [Ask questions](https://github.com/jcr82/bruno-mcp-server/discussions)

### Community
- Share your use cases
- Contribute examples
- Help others get started

---

## Quick Reference Card

```bash
# Installation
npm install
npm run build

# Testing
npm test
npm run test:coverage

# Development
npm run dev

# Verify Bruno CLI
npx bru --version
```

### Common Tool Usage

| Task | Tool |
|------|------|
| Run single request | `bruno_run_request` |
| Run collection | `bruno_run_collection` |
| List requests | `bruno_list_requests` |
| Find collections | `bruno_discover_collections` |
| List environments | `bruno_list_environments` |
| Validate env | `bruno_validate_environment` |
| Inspect request | `bruno_get_request_details` |
| Validate collection | `bruno_validate_collection` |
| Check health | `bruno_health_check` |

---

**Congratulations!** 🎉

You've successfully set up the Bruno MCP Server and executed your first request.

Continue with the [Usage Patterns Guide](usage-patterns.md) to learn advanced workflows.

---

**Last Updated:** 2025-10-22
**Version:** 1.0.0
