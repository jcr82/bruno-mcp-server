# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- NPM package configuration for global and local installation
- GitHub Actions CI/CD workflows for automated testing
- GitHub Actions workflow for automated NPM publishing
- NPM installation instructions in README
- Multi-version Node.js testing (18.x, 20.x, 22.x)

## [0.1.0] - 2025-10-22

### Added
- Initial release of Bruno MCP Server
- 9 MCP tools for Bruno CLI integration:
  - `bruno_run_request` - Execute individual API requests
  - `bruno_run_collection` - Run entire collections or folders
  - `bruno_list_requests` - List all requests in a collection
  - `bruno_discover_collections` - Find Bruno collections recursively
  - `bruno_list_environments` - List available environments
  - `bruno_validate_environment` - Validate environment files
  - `bruno_get_request_details` - Inspect request configuration
  - `bruno_validate_collection` - Validate collection structure
  - `bruno_health_check` - Server health and metrics
- Report generation in 3 formats (JSON, JUnit XML, HTML)
- Dry run mode for validation without execution
- Environment variable support and validation
- Configuration system with Zod schema validation
- Security features:
  - Path validation to prevent directory traversal
  - Input sanitization against command injection
  - Secret masking in logs and error messages
- Performance optimizations:
  - Request list caching with configurable TTL
  - Collection discovery caching
  - Environment list caching
  - Execution metrics tracking
- Logging system:
  - Structured logging (JSON and text formats)
  - Multiple log levels (debug, info, warning, error)
  - Optional file output with rotation
  - Automatic secret masking
- Mock Bruno CLI mode for testing and CI/CD
- Comprehensive test suite:
  - 212 tests passing
  - 84.69% code coverage
  - Unit tests for all modules
  - Integration tests with real Bruno CLI
  - E2E workflow tests
  - Mock CLI tests
- Complete documentation:
  - API reference for all tools
  - Getting started guide
  - Configuration guide
  - Usage patterns guide
  - Troubleshooting guide
  - CI/CD integration guide
  - Mock mode documentation

### Security
- Path validation prevents directory traversal attacks
- Input sanitization prevents command injection
- Secret masking protects sensitive data in logs
- Environment variable validation for safe characters

### Performance
- Request list caching reduces filesystem operations
- Multi-level cache system with independent TTLs
- Performance metrics tracking for monitoring
- Configurable cache TTL and concurrency limits

## [0.0.1] - Development

### Added
- Initial project setup
- Basic MCP server structure
- Bruno CLI wrapper implementation
- TypeScript configuration
- Vitest test infrastructure

[Unreleased]: https://github.com/jcr82/bruno-mcp-server/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jcr82/bruno-mcp-server/releases/tag/v0.1.0
[0.0.1]: https://github.com/jcr82/bruno-mcp-server/commits/initial-dev
