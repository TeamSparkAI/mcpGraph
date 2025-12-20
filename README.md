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

# MCP Server Metadata
server:
  name: "fileUtils"
  version: "1.0.0"
  description: "File utilities"

# Tool Definitions
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

# MCP Servers used by the graph
servers:
  filesystem:
    command: "npx"
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "./tests/files"

# Graph Nodes
nodes:
  # Entry node: Receives tool arguments
  - id: "entry_count_files"
    type: "entry"
    tool: "count_files"
    next: "list_directory_node"
  
  # List directory contents
  - id: "list_directory_node"
    type: "mcp"
    server: "filesystem"
    tool: "list_directory"
    args:
      path: "$.entry_count_files.directory"
    next: "count_files_node"
  
  # Transform and count files
  - id: "count_files_node"
    type: "transform"
    transform:
      expr: |
        { "count": $count($split($.list_directory_node, "\n")) }
    next: "exit_count_files"
  
  # Exit node: Returns the count
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
  - **Output**: The tool input arguments (passed through as-is)
- **`mcp`**: Calls an MCP tool on an internal or external MCP server.
  - **Output**: The MCP tool's response (parsed from the tool's content)
- **`transform`**: Applies [JSONata](https://jsonata.org/) expressions to transform data between nodes.
  - **Output**: The result of evaluating the JSONata expression
- **`switch`**: Uses [JSON Logic](https://jsonlogic.com/) to conditionally route to different nodes. Note: `var` operations in JSON Logic rules are evaluated using JSONata, allowing full JSONata expression support.
  - **Output**: The node ID of the target node that was routed to (string)
- **`exit`**: Exit point that returns the final result to the MCP tool caller.
  - **Output**: The output from the previous node in the execution history

## Execution History & Debugging

mcpGraph maintains a complete execution history for each tool execution, enabling powerful debugging and introspection capabilities:

- **Execution History**: Every node execution is recorded with timing, inputs, outputs, and a unique `executionIndex`
- **Time-Travel Debugging**: Get the context that was available to any specific execution using `getContextForExecution(executionIndex)`
- **History Functions**: Use JSONata functions to access execution history:
  - `$previousNode()` - Get the previous node's output
  - `$executionCount(nodeName)` - Count how many times a node executed
  - `$nodeExecution(nodeName, index)` - Get a specific execution of a node
  - `$nodeExecutions(nodeName)` - Get all executions of a node as an array
- **Loop Support**: Nodes can execute multiple times in loops, with each execution tracked separately

See [docs/introspection-debugging.md](docs/introspection-debugging.md) for detailed documentation on debugging features.

**Context Access:**
- All node outputs are accessible by node ID (e.g., `$.entry_count_files.directory`, `$.list_directory_node`)
- History functions are available in all JSONata expressions:
  - `$previousNode()` - Get the previous node's output
  - `$previousNode(index)` - Get the node that executed N steps before current
  - `$executionCount(nodeName)` - Count executions of a node
  - `$nodeExecution(nodeName, index)` - Get a specific execution of a node
  - `$nodeExecutions(nodeName)` - Get all executions of a node as an array

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
- [Introspection & Debugging](docs/introspection-debugging.md) - Guide for building visualizer applications and debuggers
