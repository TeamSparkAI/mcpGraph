# Test Setup Guide

This document describes how to set up the testing environment for mcpGraph, including the filesystem MCP server used for testing.

## Filesystem MCP Server

For testing, we use the official filesystem MCP server from the [Model Context Protocol servers repository](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem).

### Installation

The filesystem MCP server is installable via npm and can be run with `npx`.

### Configuration

To use the filesystem MCP server, add it to your MCP client configuration. The configuration format depends on your MCP client, but typically looks like this:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Desktop",
        "/path/to/other/allowed/dir"
      ]
    }
  }
}
```

### Configuration Parameters

- `command`: `"npx"` - Uses npx to run the package
- `args`: Array of arguments:
  - `"-y"` - Automatically installs the package if not present
  - `"@modelcontextprotocol/server-filesystem"` - The package name
  - Additional arguments are directory paths that the server is allowed to access

### Test Directory

The project includes a `test/` directory with various test files that can be used for testing file operations. When configuring the filesystem MCP server, include the path to the project's test directory:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/absolute/path/to/mcpGraph/test"
      ]
    }
  }
}
```

### Available Tools

The filesystem MCP server provides tools for:
- `list_directory` - List contents of a directory
- `read_file` - Read file contents
- `write_file` - Write to a file
- `create_directory` - Create a directory
- And other filesystem operations

See the [filesystem MCP server documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) for the complete list of available tools.

### Usage in Tests

When testing mcpGraph, the filesystem MCP server can be used to:
1. Test MCP tool calling from graph nodes
2. Test the `count_files` example workflow
3. Test file operations and transformations
4. Validate graph execution with real MCP server interactions

