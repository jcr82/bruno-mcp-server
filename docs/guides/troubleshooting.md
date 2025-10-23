# Troubleshooting Guide

Common issues and their solutions.

## Installation Issues

### Bruno CLI Not Found

**Symptoms:** Error "Bruno CLI not available" or "bru: command not found"

**Solutions:**
1. Run `npm install` to ensure dependencies are installed
2. Check Bruno CLI: `npx bru --version`
3. Manually install if needed: `npm install -g @usebruno/cli`

### Build Failures

**Symptoms:** TypeScript compilation errors

**Solutions:**
1. Clean and rebuild:
   ```bash
   rm -rf dist node_modules
   npm install
   npm run build
   ```
2. Check Node.js version: `node --version` (must be 18+)

## Runtime Issues

### Collection Not Found

**Symptoms:** "Collection not found" or "Not a valid Bruno collection"

**Solutions:**
- Use absolute paths, not relative paths
- Verify `bruno.json` exists in the collection directory
- Check path doesn't have spaces (or escape them)

### Environment Not Found

**Symptoms:** "Environment file not found"

**Solutions:**
- Check `environments/` folder exists
- Verify `.bru` file exists: `ls /path/to/collection/environments/`
- Use correct environment name (without .bru extension)

### Request Execution Fails

**Symptoms:** Exit code 1, error messages in stderr

**Solutions:**
1. Test in Bruno desktop app first
2. Check environment variables are correct
3. Verify API endpoint is accessible
4. Review error message for specific details

## Performance Issues

### Slow Request Execution

**Solutions:**
- Increase timeout: Set `timeout.request` in config
- Check network connectivity
- Verify API endpoint response time

### Cache Not Working

**Solutions:**
- Verify `cacheEnabled: true` in config
- Check cache TTL settings
- Clear cache and restart server

## Connection Issues

### MCP Server Not Connecting

**Solutions:**
1. Verify path in `claude_desktop_config.json` is absolute
2. Ensure project is built: `npm run build`
3. Restart Claude Desktop
4. Check Developer Tools console for errors

### Tools Not Appearing

**Solutions:**
1. Verify server is running: Check Claude Desktop's "bruno" server status
2. Restart Claude Desktop
3. Check configuration syntax is valid JSON

## Error Messages

### "ENOENT: no such file or directory"

**Solution:** Check all file paths are correct and absolute

### "Permission denied"

**Solution:** Ensure read/write permissions for:
- Collection directories
- Report output directories
- Log file directories

### "Timeout exceeded"

**Solution:** Increase timeout in configuration:
```json
{
  "timeout": {
    "request": 60000,
    "collection": 300000
  }
}
```

## Debugging

### Enable Debug Logging

```json
{
  "logging": {
    "level": "debug",
    "logFile": "./debug.log"
  }
}
```

### Check Health

Use `bruno_health_check` tool with metrics:
```typescript
bruno_health_check({
  includeMetrics: true,
  includeCacheStats: true
})
```

### Test with Mock CLI

Switch to mock mode to isolate issues:
```json
{
  "useMockCLI": true
}
```

## Getting Help

If issues persist:
1. Check [GitHub Issues](https://github.com/jcr82/bruno-mcp-server/issues)
2. Review [API Documentation](../api/tools.md)
3. Enable debug logging and share logs
4. Open a new issue with details

---

**Last Updated:** 2025-10-22
