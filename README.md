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
    entryNode: "entry_count_files"
    exitNode: "exit_count_files"

nodes:
  - id: "entry_count_files"
    type: "entry"
    next: "list_directory_node"
  
  - id: "list_directory_node"
    type: "mcp_tool"
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
```

This graph:
1. Receives a directory path as input
2. Calls the filesystem MCP server's `list_directory` tool
3. Transforms the result to count files using JSONata
4. Returns the count

## Node Types

- **`entry`**: Entry point for a tool's graph execution. Receives tool arguments.
- **`mcp_tool`**: Calls an MCP tool on an internal or external MCP server.
- **`transform`**: Applies [JSONata](https://jsonata.org/) expressions to transform data between nodes.
- **`switch`**: Uses [JSON Logic](https://jsonlogic.com/) to conditionally route to different nodes.
- **`exit`**: Exit point that returns the final result to the MCP tool caller.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run the project:
```bash
npm start
```

Or run in development mode (with hot reload):
```bash
npm run dev
```

## Running Tests

```bash
npm test
```

See [docs/test-setup.md](docs/test-setup.md) for information on setting up the testing environment, including the filesystem MCP server configuration.

## Development

- Source code is in `src/`
- Build output goes to `dist/`
- TypeScript configuration is in `tsconfig.json`
- Example configurations are in `examples/`
- Tests are in `tests/`

## Documentation

- [Design Document](docs/design.md) - Complete design and architecture
- [Implementation Plan](docs/implementation-plan.md) - Implementation details and phases
- [Test Setup](docs/test-setup.md) - Testing environment setup
