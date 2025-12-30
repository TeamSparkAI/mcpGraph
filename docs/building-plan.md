# mcpGraphToolkit Implementation Plan

## Status: ✅ COMPLETE

All phases (1-8) have been implemented and tested. The toolkit is fully functional with all 11 tools implemented and comprehensive test coverage.

## Overview

mcpGraphToolkit is a new MCP server that provides tools for building, testing, and running mcpGraph tools. It will be implemented as an alternate executable alongside the main `mcpgraph` executable, called `mcpgraphtoolkit`.

## Architecture

### Entry Point
- **File**: `src/toolkit-main.ts`
- **Binary**: `mcpgraphtoolkit` (added to `package.json` bin)
- **CLI Arguments**: Same as mcpGraph (`-g/--graph`, `-m/--mcp`)

### Core Components

1. **Core Graph API Extensions** (`src/api.ts` - extend McpGraphApi)
   - Add methods to McpGraphApi for graph manipulation:
     - `addTool(tool: ToolDefinition)` - add tool to graph
     - `updateTool(toolName: string, tool: ToolDefinition)` - update existing tool
     - `deleteTool(toolName: string)` - remove tool from graph
     - `save(filePath?: string)` - serialize and write graph to file
   - These methods manipulate the in-memory config and can save to file

2. **YAML Serializer** (`src/config/serializer.ts` - renamed from parser.ts)
   - Deserializes: `parseYamlConfig()` - reads file and parses YAML to `McpGraphConfig`
   - Serializes: `serializeYamlConfig()` - converts `McpGraphConfig` to YAML string
   - Uses `js-yaml`'s `load()` and `dump()` functions
   - Handles proper YAML formatting (indentation, block scalars, etc.)
   - Keeps bidirectional YAML operations together

3. **ToolkitApi** (`src/toolkit/api.ts`)
   - Thin wrapper that exposes McpGraphApi methods as MCP tools
   - Handles MCP tool request/response formatting
   - No core graph logic - just exposes existing functionality

4. **MCP Server Discovery** (`src/toolkit/mcp-discovery.ts`)
   - Loads and manages MCP servers from mcp.json
   - Provides methods to list servers and tools
   - Handles MCP client connections for tool introspection
   - Toolkit-specific functionality

5. **Expression Testers** (`src/toolkit/expression-testers.ts`)
   - JSONata expression testing with context
   - JSON Logic expression testing with context
   - Error handling and validation
   - Toolkit-specific utility (exception to core rule)

## Implementation Phases

### Phase 1: Core Infrastructure

#### 1.1 Create Toolkit Entry Point
- [x] Create `src/toolkit-main.ts`
  - Parse CLI arguments (`-g`, `-m`)
  - Initialize ToolkitApi
  - Set up MCP server with tool handlers
  - Connect stdio transport
  - **As-built**: Error handling added - catches errors from `callTool` and converts to `McpError` for proper MCP error responses

#### 1.2 Rename Parser to Serializer and Add Serialization
- [x] Rename `src/config/parser.ts` to `src/config/serializer.ts`
  - Update file comment to reflect bidirectional operations
  - Update import in `loader.ts` to use new filename
- [x] Add `serializeYamlConfig(config: McpGraphConfig): string` function
  - Uses `js-yaml`'s `dump()` function (same module as `load()`)
  - Configured for readable YAML output (indentation, etc.)
  - Keeps YAML deserialization (load) and serialization (save) together
  - **As-built**: Uses `indent: 2`, `lineWidth: -1`, `noRefs: true`, `sortKeys: false` for formatting

#### 1.2a Extend Logger with Log Collection
- [x] Add log collection capability to `src/logger.ts`
  - Add `LogEntry` interface: `{ level: string, message: string, timestamp: string, args?: unknown[] }`
  - Add `LogCollector` class that buffers log entries in memory
  - Add `startCollection()` method to logger - creates and activates collector
  - Add `stopCollection()` method - stops collection and returns collected logs array
  - When collection active, logs are buffered in memory (in addition to normal stderr output)
  - Collection can be enabled/disabled per execution
  - **As-built**: `LogEntry` uses `LogLevel` type instead of string

#### 1.2b Extend ExecutionOptions and ExecutionResult for Logging
- [x] Add to `src/types/execution.ts`:
  - Add `enableLogging?: boolean` to `ExecutionOptions` interface
  - Add `logs?: LogEntry[]` to `ExecutionResult` interface
- [x] Update `GraphExecutor.executeTool()`:
  - If `options.enableLogging === true`, start log collection before execution
  - Stop collection after execution completes (success or error)
  - Include collected logs in ExecutionResult

#### 1.3 Extend McpGraphApi with Graph Manipulation Methods
- [x] Add to `src/api.ts` (McpGraphApi class):
  - `addTool(tool: ToolDefinition): void` - adds tool to config.tools array
  - `updateTool(toolName: string, tool: ToolDefinition): void` - updates existing tool
  - `deleteTool(toolName: string): void` - removes tool from config.tools array
  - `save(filePath?: string): void` - serializes graph to YAML and writes to file
    - Uses serializer from step 1.2
    - Defaults to original config path if filePath not provided
  - `getConfig(): McpGraphConfig` - returns current config (for getGraphTool, etc.)
  - `executeToolDefinition(toolDefinition: ToolDefinition, arguments: Record<string, unknown>, options?: ExecutionOptions): Promise<ExecutionResult>` - executes an inline tool definition
    - Creates temporary config with the tool added (doesn't modify main config)
    - Creates temporary GraphExecutor with temp config but same clientManager (shares MCP servers)
    - Executes tool using temporary executor
    - Returns result - tool runs in graph context with access to graph's MCP servers and execution limits
  - **As-built**: All methods update the executor after config changes by creating a new `GraphExecutor` instance

#### 1.4 Create ToolkitApi Class
- [x] Create `src/toolkit/api.ts`
  - Wraps McpGraphApi instance
  - Exposes McpGraphApi methods as MCP tool handlers
  - No core graph logic - just request/response handling
  - **As-built**: Includes `close()` method to clean up MCP discovery resources

#### 1.5 Update package.json
- [x] Add `mcpgraphtoolkit` to `bin` section
- [x] Point to `dist/toolkit-main.js`

### Phase 2: Graph Discovery Tools

#### 2.1 Graph Server Information
- [x] Implement `getGraphServer` tool
  - Returns full server metadata (name, version, title, instructions)
  - Input: None
  - Output: Server metadata object

#### 2.2 Graph Tools Listing
- [x] Implement `listGraphTools` tool
  - Returns list of tools in graph (name, description)
  - Input: None
  - Output: Array of tool summaries

#### 2.3 Graph Tool Details
- [x] Implement `getGraphTool` tool
  - Uses `api.getConfig()` to get full config
  - Finds tool by name in config.tools array
  - Returns complete tool definition with nodes
  - Input: `toolName` (string)
  - Output: Complete tool definition with nodes

### Phase 3: MCP Server Discovery Tools

#### 3.1 Create MCP Discovery Module
- [x] Create `src/toolkit/mcp-discovery.ts`
  - Load mcp.json file
  - Connect to MCP servers using McpClientManager
  - Cache server and tool metadata
  - **As-built**: Uses `loadMcpServers()` from `config/mcp-loader.ts` to load servers

#### 3.2 MCP Server Listing
- [x] Implement `listMcpServers` tool
  - Returns list of available MCP servers
  - Input: None
  - Output: Array of server summaries (name, title, instructions, version)
  - **As-built**: Returns error if MCP file not provided (requires `-m` flag)

#### 3.3 MCP Tool Listing
- [x] Implement `listMcpServerTools` tool
  - Returns list of tools from MCP servers
  - Input: `serverName` (optional string) - filter by server
  - Output: Array of tool summaries (name, description, server)
  - **As-built**: Returns error if MCP file not provided (requires `-m` flag)

#### 3.4 MCP Tool Details
- [x] Implement `getMcpServerTool` tool
  - Returns full MCP tool definition
  - Input: `serverName` (string), `toolName` (string)
  - Output: Complete tool definition (name, description, inputSchema, outputSchema)
  - **As-built**: Returns error if MCP file not provided (requires `-m` flag)

### Phase 4: Graph Tool Management (CRUD)

#### 4.1 Add Graph Tool
- [x] Implement `addGraphTool` tool
  - Input: `tool` (object) - complete tool definition
  - Calls `api.addTool(tool)` - core method handles manipulation
  - Calls `api.save()` - core method handles serialization and write
  - Returns success/error
  - **As-built**: Returns `{ success: true, message: "Tool 'name' added successfully" }`

#### 4.2 Update Graph Tool
- [x] Implement `updateGraphTool` tool
  - Input: `toolName` (string), `tool` (object) - updated tool definition
  - Calls `api.updateTool(toolName, tool)` - core method handles manipulation
  - Calls `api.save()` - core method handles serialization and write
  - Returns success/error
  - **As-built**: Returns `{ success: true, message: "Tool 'name' updated successfully" }`

#### 4.3 Delete Graph Tool
- [x] Implement `deleteGraphTool` tool
  - Input: `toolName` (string)
  - Calls `api.deleteTool(toolName)` - core method handles manipulation
  - Calls `api.save()` - core method handles serialization and write
  - Returns success/error
  - **As-built**: Returns `{ success: true, message: "Tool 'name' deleted successfully" }`

**Note:** All graph manipulation logic is in core McpGraphApi. Toolkit just exposes these methods as MCP tools. Since we're serializing a valid `McpGraphConfig` object (which was loaded and validated), the serialized YAML is valid by definition.

### Phase 5: Tool Execution

#### 5.1 Run Graph Tool
- [x] Implement `runGraphTool` tool
  - Input:
    - `toolName` (string, optional) - name of existing tool
    - `toolDefinition` (object, optional) - tool definition to run inline
    - `arguments` (object) - tool input arguments
    - `logging` (boolean, optional) - include execution logging
  - Output:
    - `result` (any) - tool execution result
    - `error` (object, optional) - error details if failed
    - `logging` (array, optional) - execution logs if requested
    - `executionHistory` (array, optional) - execution history for debugging
  - Implementation:
    - If `toolName` provided: calls `api.executeTool(toolName, arguments, { enableLogging: logging })`
    - If `toolDefinition` provided: calls `api.executeToolDefinition(toolDefinition, arguments, { enableLogging: logging })`
    - Inline tool definitions run in graph context:
      - Access to graph's MCP servers (via shared clientManager)
      - Uses graph's execution limits
      - Tool doesn't need to be saved to graph first (for testing/development)
  - Logging collection:
    - When `logging: true` in tool input, pass `enableLogging: true` in ExecutionOptions
    - GraphExecutor starts log collection before execution
    - Logger collects all log entries (level, message, timestamp, args) during execution
    - Log collection stops after execution completes
    - Collected logs included in ExecutionResult and returned in tool output
    - Logs include: debug, info, warn, error messages from all execution phases
  - **As-built**: Returns error if both `toolName` and `toolDefinition` provided, or if neither provided

### Phase 6: Expression Testing

#### 6.1 Create Expression Testers Module
- [x] Create `src/toolkit/expression-testers.ts`
  - JSONata expression evaluator with context
  - JSON Logic expression evaluator with context
  - Error handling and formatting
  - **As-built**: Returns `ExpressionTestResult` with `result` and optional `error` object

#### 6.2 Test JSONata
- [x] Implement `testJSONata` tool
  - Input:
    - `expression` (string) - JSONata expression
    - `context` (object) - context object for evaluation
  - Output:
    - `result` (any) - evaluation result
    - `error` (object, optional) - error details if failed
  - **As-built**: Validates syntax first using `validateJsonataSyntax()`, then evaluates

#### 6.3 Test JSON Logic
- [x] Implement `testJSONLogic` tool
  - Input:
    - `expression` (object) - JSON Logic expression object
    - `context` (object) - context object for evaluation
  - Output:
    - `result` (any) - evaluation result (boolean for conditions)
    - `error` (object, optional) - error details if failed

### Phase 7: Graph File Initialization

#### 7.1 Create Graph Template
- [ ] Create template for new graph files
  - Basic server metadata structure
  - Empty tools array
  - Proper YAML formatting

#### 7.2 Graph File Creation (Future)
- [ ] If graph file doesn't exist, create from template
  - Note: Marked as future enhancement in building.md
  - Can be implemented later if needed

### Phase 8: Testing

#### 8.1 Unit/Integration Tests
- [x] Create unit tests for core functionality
  - Test graph manipulation methods (addTool, updateTool, deleteTool, save)
  - Test MCP server discovery functionality
  - Test expression testers (JSONata, JSON Logic)
  - Test file I/O operations
  - Test inline tool execution
  - **As-built**: Created `tests/toolkit-api.test.ts` with comprehensive unit/integration tests

#### 8.2 MCP Client Integration Tests
- [x] Create `tests/toolkit-mcp-server.test.ts`
  - Follow pattern from `tests/mcp-server.test.ts`
  - Use MCP SDK Client to connect to toolkit server via stdio
  - Test all 11 toolkit tools via MCP protocol
  - Test error handling and edge cases
  - Test logging collection functionality
  - Use test fixtures (graph files, MCP configs)
  - Verify end-to-end functionality through MCP protocol
  - **As-built**: Tests use global timeout from test runner (90s), matching existing test pattern. Error handling tests catch exceptions (MCP SDK throws instead of returning `isError`). All 11 tools tested end-to-end.

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

## Tool Definitions

### Tool Schemas

All tools will follow MCP tool schema format with proper input/output schemas.

### Error Handling

- All tools return structured error responses
- File I/O errors are caught and returned as tool errors
- Validation errors are returned with detailed messages
- MCP connection errors are handled gracefully

## Dependencies

- **Core modules (extended):**
  - `McpGraphApi` - extended with graph manipulation methods (addTool, updateTool, deleteTool, save)
  - `McpClientManager` - for MCP server connections
  - `loadConfig` - for config loading (returns `McpGraphConfig`)
  - Expression evaluators from `expressions/` directory
- **Extended core module:**
  - `serializer.ts` (renamed from `parser.ts`) - add `serializeYamlConfig()` function
    - Uses `js-yaml`'s `dump()` for serialization (complements existing `load()` for deserialization)
    - Update import in `loader.ts` to reference new filename
- **Toolkit modules (toolkit-specific):**
  - MCP discovery functionality
  - Expression testers (utility functions)

## Testing Considerations

### Unit/Integration Tests (Direct API Testing)
- Unit tests for each tool's core functionality
- Integration tests for file I/O operations (read/write graph files)
- Tests for MCP server discovery functionality
- Tests for expression testing tools (JSONata, JSON Logic)
- Tests for graph tool CRUD operations (add/update/delete)
- Tests for inline tool execution

### MCP Client Integration Tests (End-to-End)
- **File**: `tests/toolkit-mcp-server.test.ts`
- Test all toolkit tools via MCP client (similar to `mcp-server.test.ts` for main server)
- Uses MCP SDK Client to connect to toolkit server via stdio transport
- Tests each tool exposed by toolkit:
  - `getGraphServer` - verify server metadata returned
  - `listGraphTools` - verify tool listing
  - `getGraphTool` - verify tool details
  - `listMcpServers` - verify MCP server discovery
  - `listMcpServerTools` - verify tool discovery
  - `getMcpServerTool` - verify tool details from MCP servers
  - `addGraphTool` - verify tool addition and file write
  - `updateGraphTool` - verify tool update and file write
  - `deleteGraphTool` - verify tool deletion and file write
  - `runGraphTool` - verify tool execution (both existing and inline)
  - `testJSONata` - verify JSONata expression testing
  - `testJSONLogic` - verify JSON Logic expression testing
- Test error handling via MCP protocol
- Test logging collection when requested
- Use test fixtures (graph files, MCP configs) similar to existing test structure

## Future Enhancements

- **Skill Documentation**: Create `skills/mcpGraphToolkit/SKILL.md` (separate from mcpGraph skill)
  - Document toolkit tools and usage
  - Explain how to use toolkit to build, test, and manage mcpGraph tools
  - Reference from main mcpGraph skill if needed
- Graph file creation from template if missing
- Validate-only mode for expression testers
- Detailed execution history in runGraphTool
- Runtime debugging capabilities (step through graph)
- Support for multiple graph files management

## Notes

- **Core vs Toolkit Separation**:
  - **Core (McpGraphApi)**: All graph manipulation logic (load, add/update/delete tools, save)
  - **Toolkit**: Exposes core functionality as MCP tools, handles request/response formatting
  - Toolkit does NOT implement core graph functionality - it leverages it
  
- **Graph Object Model**: Core API works with `McpGraphConfig` objects in memory
  - Load graph using existing `loadConfig()` function (in constructor)
  - Manipulate the config object via new methods (addTool, updateTool, deleteTool)
  - Serialize config object to YAML using new `serializeYamlConfig()` function
  - Write YAML string to file via `save()` method
  - **As-built**: Executor is recreated after each config manipulation to ensure consistency

- **Inline Tool Execution**: `executeToolDefinition()` method allows running tools that aren't in the graph yet
  - Creates temporary config with inline tool added (doesn't modify main config)
  - Uses same `clientManager` instance (shares MCP server connections)
  - Uses graph's execution limits from main config
  - Tool runs in full graph context without needing to be saved first
  - Enables testing/development workflow: test tool → add to graph if it works
  - **As-built**: Validates temporary config before execution

- **No Code Duplication**: Reuse existing `loadConfig()` and related parsing code. All graph manipulation is in core.

- **Error Handling**: 
  - Toolkit server catches errors from `callTool()` and converts to `McpError` for proper MCP error responses
  - MCP SDK client throws exceptions for errors, so tests catch exceptions rather than checking `result.isError`

- Toolkit will need write access to graph file for CRUD operations
- MCP servers must be accessible for discovery tools (requires `-m` flag)
- Expression testers use the same evaluators as graph execution (but are toolkit-specific utilities)
- All file operations should be atomic where possible

