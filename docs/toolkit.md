# mcpGraphToolkit Overview

## Overview

mcpGraphToolkit is an MCP server that provides tools for building, testing, and running mcpGraph tools. It is implemented as an alternate executable alongside the main `mcpgraph` executable, called `mcpgraphtoolkit`.

## Architecture

### Entry Point
- **File**: `src/toolkit-main.ts`
- **Binary**: `mcpgraphtoolkit` (in `package.json` bin)
- **CLI Arguments**: Same as mcpGraph (`-g/--graph`, `-m/--mcp`)

### Core Components

1. **Core Graph API Extensions** (`src/api.ts` - extends McpGraphApi)
   - Methods for graph manipulation:
     - `addTool(tool: ToolDefinition)` - add tool to graph
     - `updateTool(toolName: string, tool: ToolDefinition)` - update existing tool
     - `deleteTool(toolName: string)` - remove tool from graph
     - `save(filePath?: string)` - serialize and write graph to file
   - These methods manipulate the in-memory config and can save to file

2. **YAML Serializer** (`src/config/serializer.ts`)
   - Deserializes: `parseYamlConfig()` - reads file and parses YAML to `McpGraphConfig`
   - Serializes: `serializeYamlConfig()` - converts `McpGraphConfig` to YAML string
   - Uses `js-yaml`'s `load()` and `dump()` functions
   - Handles proper YAML formatting (indentation, block scalars, etc.)
   - Keeps bidirectional YAML operations together

3. **ToolkitApi** (`src/toolkit/api.ts`)
   - Thin wrapper that exposes McpGraphApi methods as MCP tools
   - Handles MCP tool request/response formatting
   - No core graph logic - just exposes existing functionality
   - Includes `close()` method to clean up MCP discovery resources

4. **MCP Server Discovery** (`src/toolkit/mcp-discovery.ts`)
   - Loads and manages MCP servers from mcp.json
   - Provides methods to list servers and tools
   - Handles MCP client connections for tool introspection
   - Uses `loadMcpServers()` from `config/mcp-loader.ts` to load servers

5. **Expression Testers** (`src/toolkit/expression-testers.ts`)
   - JSONata expression testing with context
   - JSON Logic expression testing with context
   - Error handling and validation
   - Returns `ExpressionTestResult` with `result` and optional `error` object

## Tools

mcpGraphToolkit provides 12 tools organized into the following categories:

> **📖 For Agents:** If you're an AI agent using mcpGraphToolkit to build graph tools, see [mcpGraphToolkit SKILL.md](../skills/mcpgraphtoolkit/SKILL.md) for comprehensive guidance on using these tools effectively.

### Graph Discovery Tools

#### `getGraphServer`
Returns full server metadata (name, version, title, instructions).
- **Input**: None
- **Output**: Server metadata object

#### `listGraphTools`
Returns list of tools in graph (name, description).
- **Input**: None
- **Output**: Array of tool summaries

#### `getGraphTool`
Returns complete tool definition with nodes.
- **Input**: `toolName` (string)
- **Output**: Complete tool definition with nodes

### MCP Server Discovery Tools

#### `listMcpServers`
Returns list of available MCP servers.
- **Input**: None
- **Output**: Array of server summaries (name, title, instructions, version)
- **Note**: Returns error if MCP file not provided (requires `-m` flag)

#### `listMcpServerTools`
Returns list of tools from MCP servers.
- **Input**: `serverName` (optional string) - filter by server
- **Output**: Array of tool summaries (name, description, server)
- **Note**: Returns error if MCP file not provided (requires `-m` flag)

#### `getMcpServerTool`
Returns full MCP tool definition.
- **Input**: `serverName` (string), `toolName` (string)
- **Output**: Complete tool definition (name, description, inputSchema, outputSchema)
- **Note**: Returns error if MCP file not provided (requires `-m` flag)

### Graph Tool Management (CRUD)

#### `addGraphTool`
Adds a new tool to the graph.
- **Input**: `tool` (object) - complete tool definition
- **Output**: `{ success: true, message: "Tool 'name' added successfully" }`
- Automatically saves the graph file after addition

#### `updateGraphTool`
Updates an existing tool in the graph.
- **Input**: `toolName` (string), `tool` (object) - updated tool definition
- **Output**: `{ success: true, message: "Tool 'name' updated successfully" }`
- Automatically saves the graph file after update

#### `deleteGraphTool`
Removes a tool from the graph.
- **Input**: `toolName` (string)
- **Output**: `{ success: true, message: "Tool 'name' deleted successfully" }`
- Automatically saves the graph file after deletion

**Note:** All graph manipulation logic is in core McpGraphApi. Toolkit just exposes these methods as MCP tools. Since we're serializing a valid `McpGraphConfig` object (which was loaded and validated), the serialized YAML is valid by definition.

### Tool Execution

#### `runGraphTool`
Executes a graph tool, either from the graph or inline.
- **Input**:
  - `toolName` (string, optional) - name of existing tool
  - `toolDefinition` (object, optional) - tool definition to run inline
  - `arguments` (object) - tool input arguments
  - `logging` (boolean, optional) - include execution logging
- **Output**:
  - `result` (any) - tool execution result
  - `error` (object, optional) - error details if failed
  - `logging` (array, optional) - execution logs if requested
  - `executionHistory` (array, optional) - execution history for debugging
- **Behavior**:
  - If `toolName` provided: executes existing tool from graph
  - If `toolDefinition` provided: executes inline tool definition
  - Inline tool definitions run in graph context:
    - Access to graph's MCP servers (via shared clientManager)
    - Uses graph's execution limits
    - Tool doesn't need to be saved to graph first (for testing/development)
  - Logging collection:
    - When `logging: true`, collects all log entries during execution
    - Logs include: debug, info, warn, error messages from all execution phases
- **Note**: Returns error if both `toolName` and `toolDefinition` provided, or if neither provided

### Expression Testing

#### `testJSONata`
Tests a JSONata expression with context.
- **Input**:
  - `expression` (string) - JSONata expression
  - `context` (object) - context object for evaluation
- **Output**:
  - `result` (any) - evaluation result
  - `error` (object, optional) - error details if failed
- **Behavior**: Validates syntax first using `validateJsonataSyntax()`, then evaluates

#### `testJSONLogic`
Tests a JSON Logic expression with context.
- **Input**:
  - `expression` (object) - JSON Logic expression object
  - `context` (object) - context object for evaluation
- **Output**:
  - `result` (any) - evaluation result (boolean for conditions)
  - `error` (object, optional) - error details if failed

#### `testMcpTool`
Tests an MCP tool call directly to understand its output structure and behavior.
- **Input**:
  - `server` (string) - name of the MCP server
  - `tool` (string) - name of the tool to call
  - `args` (object) - tool arguments (objects with `{ "expr": "..." }` are evaluated as JSONata recursively; if context is provided, expressions in args are evaluated)
  - `context` (object, optional) - context object for JSONata expression evaluation in args
- **Output**:
  - `output` (any) - tool execution output (matches what would be available in a graph node's execution context)
  - `evaluatedArgs` (object, optional) - evaluated arguments (present if JSONata expressions were used)
  - `executionTime` (number) - execution time in milliseconds
  - `error` (object, optional) - error details if call failed
- **Behavior**: 
  - Calls the MCP tool directly without creating a graph
  - Evaluates JSONata expressions in args if context is provided (using recursive `{ "expr": "..." }` syntax)
  - Returns the same output structure that would be available in a graph node's execution context
  - Useful for understanding tool behavior and output structure before building graph tools

## File Structure

```
src/
  api.ts                   # McpGraphApi extended with graph manipulation methods
  toolkit-main.ts          # Entry point for mcpgraphtoolkit
  config/
    serializer.ts          # YAML deserialization (load/parse) and serialization (save/dump)
  toolkit/
    api.ts                 # ToolkitApi class (thin wrapper exposing McpGraphApi as MCP tools)
    mcp-discovery.ts       # MCP server discovery and tool introspection
    expression-testers.ts  # JSONata and JSON Logic testing
```

## Design Principles

### Core vs Toolkit Separation
- **Core (McpGraphApi)**: All graph manipulation logic (load, add/update/delete tools, save)
- **Toolkit**: Exposes core functionality as MCP tools, handles request/response formatting
- Toolkit does NOT implement core graph functionality - it leverages it

### Graph Object Model
Core API works with `McpGraphConfig` objects in memory:
- Load graph using existing `loadConfig()` function (in constructor)
- Manipulate the config object via methods (addTool, updateTool, deleteTool)
- Serialize config object to YAML using `serializeYamlConfig()` function
- Write YAML string to file via `save()` method
- Executor is recreated after each config manipulation to ensure consistency

### Inline Tool Execution
`executeToolDefinition()` method allows running tools that aren't in the graph yet:
- Creates temporary config with inline tool added (doesn't modify main config)
- Uses same `clientManager` instance (shares MCP server connections)
- Uses graph's execution limits from main config
- Tool runs in full graph context without needing to be saved first
- Enables testing/development workflow: test tool → add to graph if it works
- Validates temporary config before execution

### Error Handling
- Toolkit server catches errors from `callTool()` and converts to `McpError` for proper MCP error responses
- All tools return structured error responses
- File I/O errors are caught and returned as tool errors
- Validation errors are returned with detailed messages
- MCP connection errors are handled gracefully

## Dependencies

### Core Modules (Extended)
- `McpGraphApi` - extended with graph manipulation methods (addTool, updateTool, deleteTool, save)
- `McpClientManager` - for MCP server connections
- `loadConfig` - for config loading (returns `McpGraphConfig`)
- Expression evaluators from `expressions/` directory

### Extended Core Module
- `serializer.ts` - provides `serializeYamlConfig()` function
  - Uses `js-yaml`'s `dump()` for serialization (complements existing `load()` for deserialization)

### Toolkit Modules (Toolkit-Specific)
- MCP discovery functionality
- Expression testers (utility functions)

## Usage

### Installation

mcpGraphToolkit is installed as part of the mcpGraph package. If you've installed mcpGraph from npm, you already have mcpGraphToolkit available.

### Configuration

To use mcpGraphToolkit in your agent, add it to your MCP client's configuration file:

```json
{
  "mcpServers": {
    "mcpgraphtoolkit": {
      "command": "mcpgraphtoolkit",
      "args": ["-g", "/path/to/your/graph.yaml", "-m", "/path/to/mcp.json"]
    }
  }
}
```

When using mcpGraphToolkit, you pass:
- A path to your mcpGraph file (via `-g` flag)
- A path to an mcp.json file containing mcpServers (via `-m` flag)

The mcp.json file can be any name and can be the same file your agent uses if you want access to the full set of tools your agent has.

### Requirements

- Toolkit requires write access to graph file for CRUD operations
- MCP servers must be accessible for discovery tools (requires `-m` flag)
- Expression testers use the same evaluators as graph execution
- All file operations are atomic where possible

## Testing

The toolkit includes comprehensive test coverage:

### Unit/Integration Tests
- **File**: `tests/toolkit-api.test.ts`
- Tests graph manipulation methods (addTool, updateTool, deleteTool, save)
- Tests MCP server discovery functionality
- Tests expression testers (JSONata, JSON Logic)
- Tests file I/O operations
- Tests inline tool execution

### MCP Client Integration Tests
- **File**: `tests/toolkit-mcp-server.test.ts`
- Tests all 12 toolkit tools via MCP protocol
- Uses MCP SDK Client to connect to toolkit server via stdio
- Tests error handling and edge cases
- Tests logging collection functionality
- Uses test fixtures (graph files, MCP configs)
- Verifies end-to-end functionality through MCP protocol

## Future Enhancements

- Graph file creation from template if missing
- Validate-only mode for expression testers
- Detailed execution history in runGraphTool
- Runtime debugging capabilities (step through graph)
- Support for multiple graph files management
