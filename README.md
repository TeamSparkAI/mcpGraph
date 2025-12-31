# mcpGraph

MCP server that executes directed graphs of MCP server calls.

> **📖 Learn More:** Read [**mcpGraph: A No-Code Alternative to "Code Mode"**](docs/no-code-code-mode.md) to understand how mcpGraph provides the context efficiency and accuracy of Code Mode while maintaining the security and observability of a no-code solution.

> **🎥 Watch the Demo:** Check out the [**mcpGraph Overview and mcpGraphUX Demo**](https://youtu.be/eyC7OzuB6c4) video to see mcpGraph in action and explore the visual debugging capabilities of mcpGraphUX.

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
  title: "File utilities"
  instructions: "This server provides file utility tools for counting files and calculating total file sizes in directories."

# Optional: Execution limits to prevent infinite loops
executionLimits:
  maxNodeExecutions: 1000      # Maximum total node executions (default: 1000)
  maxExecutionTimeMs: 300000   # Maximum execution time in milliseconds (default: 300000 = 5 minutes)

# MCP Servers used by the graph
mcpServers:
  filesystem:
    command: "npx"
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "./tests/counting"

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
    nodes:
      # Entry node: Receives tool arguments
      - id: "entry"
        type: "entry"
        next: "list_directory_node"
      
      # List directory contents
      - id: "list_directory_node"
        type: "mcp"
        server: "filesystem"
        tool: "list_directory"
        args:
          path: "$.entry.directory"
        next: "count_files_node"
      
      # Transform and count files
      - id: "count_files_node"
        type: "transform"
        transform:
          expr: '{ "count": $count($split($.list_directory_node.content, "\n")) }'
        next: "exit"
      
      # Exit node: Returns the count
      - id: "exit"
        type: "exit"
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
  - **Expression Format**: The `expr` field is a string containing a JSONata expression. Use single-quoted strings for simple expressions: `expr: '{ "result": "value" }'`. Use block scalars (`|`) for complex multi-line expressions to improve readability.
- **`switch`**: Uses [JSON Logic](https://jsonlogic.com/) to conditionally route to different nodes. Note: `var` operations in JSON Logic rules are evaluated using JSONata, allowing full JSONata expression support.
  - **Output**: The node ID of the target node that was routed to (string)
- **`exit`**: Exit point that returns the final result to the MCP tool caller.
  - **Output**: The output from the previous node in the execution history

## Execution History & Debugging

mcpGraph maintains a complete execution history for each tool execution, enabling powerful debugging and introspection capabilities:

- **Execution History**: Every node execution is recorded with timing, outputs, and a unique `executionIndex` (sequential: 0, 1, 2, ...)
- **Context Structure**: Context for expressions is built from history - a flat structure where each node ID maps to its latest output
  - Simple notation: `$.node_id` accesses the latest output of a node
  - When nodes execute multiple times (loops), context shows the most recent execution
  - History functions provide access to all executions, not just the latest
- **Time-Travel Debugging**: Get the context that was available to any specific execution using `getContextForExecution(executionIndex)`
- **History Functions**: Use JSONata functions to access execution history:
  - `$previousNode()` - Get the previous node's output
  - `$previousNode(index)` - Get the node that executed N steps before current
  - `$executionCount(nodeName)` - Count how many times a node executed
  - `$nodeExecution(nodeName, index)` - Get a specific execution of a node (0 = first, -1 = last)
  - `$nodeExecutions(nodeName)` - Get all executions of a node as an array
- **Loop Support**: Nodes can execute multiple times in loops, with each execution tracked separately in history

See [docs/introspection-debugging.md](docs/introspection-debugging.md) for detailed documentation on debugging features.

**Context Access:**
- All node outputs are accessible by node ID (e.g., `$.entry.directory`, `$.list_directory_node`)
- Latest execution wins: `$.increment_node` returns the most recent output when a node executes multiple times
- History functions are available in all JSONata expressions (including those used in JSON Logic `var` operations)

### JSONata Expression Format

The `expr` field in transform nodes is a string containing a JSONata expression. In YAML, you can use either:

- **Single-quoted strings** (`'...'`) for simple, single-line expressions:
  ```yaml
  transform:
    expr: '{ "count": $count($split($.list_directory_node.content, "\n")) }'
  ```
  This keeps the expression on one line and is ideal for simple transformations.

- **Block scalars** (`|`) for complex, multi-line expressions:
  ```yaml
  transform:
    expr: |
      $executionCount("increment_node") = 0
        ? { "counter": 1, "sum": 1, "target": $.entry_sum.n }
        : { "counter": $nodeExecution("increment_node", -1).counter + 1, ... }
  ```
  This improves readability for expressions with conditional logic, nested objects, or multiple operations.

Both forms work identically - the expression is evaluated as a string by JSONata. Use single quotes for simple expressions and block scalars for complex ones to improve readability.

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

### Execution Limits

mcpGraph supports cyclical graphs, which requires guardrails to prevent infinite loops. Execution limits can be configured at the graph level:

```yaml
version: "1.0"

server:
  name: "myServer"          # Required: unique identifier
  version: "1.0.0"          # Required: server version
  title: "My MCP server"    # Optional: display name (defaults to name if not provided)
  instructions: "Instructions for using this server"  # Optional: server usage instructions

# Optional: Execution limits to prevent infinite loops
executionLimits:
  maxNodeExecutions: 1000      # Maximum total node executions (default: 1000)
  maxExecutionTimeMs: 300000   # Maximum execution time in milliseconds (default: 300000 = 5 minutes)

tools:
  # ... tool definitions ...
```

**Execution Limits:**
- **`maxNodeExecutions`** (optional): Maximum number of node executions across the entire graph. Default: `1000`. If execution reaches this limit, an error is thrown.
- **`maxExecutionTimeMs`** (optional): Maximum wall-clock time for graph execution in milliseconds. Default: `300000` (5 minutes). If execution exceeds this time, an error is thrown.

Both limits are checked before each node execution. If either limit is exceeded, execution stops immediately with a clear error message indicating which limit was hit.

**Note:** These limits are optional. If not specified, the defaults apply. They can be set to higher values for long-running batch jobs or lower values for quick operations.

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
        "-g",
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
        "-g",
        "/path/to/your/config.yaml"
      ]
    }
  }
}
```

**Note:** Replace `/path/to/your/config.yaml` with the actual path to your YAML configuration file. The `-g` (or `--graph`) flag specifies the graph configuration file to use.

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
  directory: './tests/counting',
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
