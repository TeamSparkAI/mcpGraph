# mcpGraph

MCP server that executes directed graphs of MCP server calls.

## Overview

mcpGraph is an MCP (Model Context Protocol) server that exposes tools defined by declarative YAML configurations. Each tool executes a directed graph of nodes that can call other MCP tools, transform data, and make routing decisions, all without embedding a full programming language.

**Key Features:**
- **Declarative Configuration**: Define tools and their execution graphs in YAML
- **Data Transformation**: Use [JSONata](https://jsonata.org/) expressions to transform data between nodes
- **Conditional Routing**: Use [JSON Logic](https://jsonlogic.com/) for conditional branching
- **Observable**: Every transformation and decision is traceable
- **No Embedded Code**: All logic expressed using standard expression languages ([JSONata](https://jsonata.org/), [JSON Logic](https://jsonlogic.com/))

## Example

Here's a simple example that counts files in a directory:

```yaml
version: "1.0"

server:
  name: "mcpGraph"
  version: "1.0.0"
  description: "MCP server that executes directed graphs of MCP tool calls"

tools:
  - name: "count_files"
    description: "Counts the number of files in a directory"
    inputSchema:
      type: "object"
      properties:
        directory:
          type: "string"
          description: "The directory path to count files in"
      required:
        - directory
    outputSchema:
      type: "object"
      properties:
        count:
          type: "number"
          description: "The number of files in the directory"

nodes:
  - id: "entry_count_files"
    type: "entry"
    tool: "count_files"
    next: "list_directory_node"
  
  - id: "list_directory_node"
    type: "mcp"
    server: "filesystem"
    tool: "list_directory"
    args:
      path: "$.input.directory"
    next: "count_files_node"
  
  - id: "count_files_node"
    type: "transform"
    transform:
      expr: |
        { "count": $count($split(list_directory_node, "\n")) }
    next: "exit_count_files"
  
  - id: "exit_count_files"
    type: "exit"
    tool: "count_files"
```

This graph:
1. Receives a directory path as input
2. Calls the filesystem MCP server's `list_directory` tool
3. Transforms the result to count files using JSONata
4. Returns the count

## Node Types

- **`entry`**: Entry point for a tool's graph execution. Receives tool arguments.
- **`mcp`**: Calls an MCP tool on an internal or external MCP server.
- **`transform`**: Applies [JSONata](https://jsonata.org/) expressions to transform data between nodes.
- **`switch`**: Uses [JSON Logic](https://jsonlogic.com/) to conditionally route to different nodes.
- **`exit`**: Exit point that returns the final result to the MCP tool caller.

## For Developers

If you're interested in contributing to mcpGraph or working with the source code, see [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, development guidelines, and project structure.

## Installation

Install mcpGraph from npm:

```bash
npm install -g mcpgraph
```

Or install locally in your project:

```bash
npm install mcpgraph
```

## Configuration

### As an MCP Server

To use `mcpgraph` as an MCP server in an MCP client (such as Claude Desktop), add it to your MCP client's configuration file.

#### Claude Desktop Configuration

Add `mcpgraph` to your Claude Desktop MCP configuration (typically located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "mcpgraph": {
      "command": "mcpgraph",
      "args": [
        "-c",
        "/path/to/your/config.yaml"
      ]
    }
  }
}
```

Or if not installed (run from npm):

```json
{
  "mcpServers": {
    "mcpgraph": {
      "command": "npx",
      "args": [
        "-y",
        "mcpgraph",
        "-c",
        "/path/to/your/config.yaml"
      ]
    }
  }
}
```

**Note:** Replace `/path/to/your/config.yaml` with the actual path to your YAML configuration file. The `-c` flag specifies the configuration file to use.

### Programmatic API

The `mcpgraph` package exports a programmatic API that can be used in your own applications (e.g., for building a UX server or other interfaces):

```typescript
import { McpGraphApi } from 'mcpgraph';

// Create an API instance (loads and validates config)
const api = new McpGraphApi('path/to/config.yaml');

// List all available tools
const tools = api.listTools();

// Execute a tool
const result = await api.executeTool('count_files', {
  directory: './tests/files',
});

// Clean up resources
await api.close();
```

See [`examples/api-usage.ts`](examples/api-usage.ts) for a complete example.

## Documentation

- [Contributing Guide](CONTRIBUTING.md) - Setup, development, and contribution guidelines
- [Design Document](docs/design.md) - Complete design and architecture
- [Implementation](docs/implementation.md) - Implementation details and architecture
