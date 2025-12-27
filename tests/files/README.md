# Test Files Directory

This directory contains files that are **directly referenced and used** by tests:

- **`test-mcp-*.json`**: MCP JSON configuration files used by `tests/mcp-loader.test.ts` to test MCP file loading functionality
- **`test-graph-*.yaml`**: Graph YAML configuration files used by `tests/mcp-loader.test.ts` to test graph loading and mcpServers merging

These files are loaded and parsed by tests, not just counted or listed.

For files used only for counting tests (not directly referenced), see `tests/counting/`.
