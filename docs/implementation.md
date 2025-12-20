# mcpGraph Implementation

This document describes the implementation of the mcpGraph MCP server with graph execution capabilities. The visual editor/UX is deferred to a later phase.

## Overview

The implementation creates a working MCP server that can:
1. Parse YAML configuration files
2. Expose MCP tools defined in the configuration
3. Execute directed graphs of nodes when tools are called
4. Handle data transformation and routing between nodes

## Phase 1: Foundation & Configuration Parsing

### 1.1 Project Setup & Dependencies

**Implemented:**
- TypeScript project initialized
- Logger (stderr only) implemented in `src/logger.ts`
- All dependencies added:
  - `@modelcontextprotocol/sdk` - MCP SDK
  - `jsonata` - Data transformation
  - `json-logic-js` - Conditional routing
  - `js-yaml` - YAML parsing
  - `zod` - Schema validation

**Note:** A custom execution loop was implemented to provide full control over execution flow and enable future introspection/debugging capabilities.

### 1.2 Type Definitions

**File: `src/types/config.ts`**

All TypeScript interfaces defined:
- `McpGraphConfig` - Root configuration structure
- `ServerMetadata` - MCP server metadata
- `ToolDefinition` - Tool definition with input/output schemas (entry/exit nodes are defined in nodes with `tool` field)
- `NodeDefinition` - Base node interface
- `EntryNode` - Entry point node that receives tool arguments
- `ExitNode` - Exit point node that returns final result
- `McpNode` - MCP tool call node
- `TransformNode` - JSONata transformation node
- `SwitchNode` - JSON Logic routing node

### 1.3 YAML Schema & Validation

**File: `src/config/schema.ts`**

Zod schemas implemented to validate YAML structure on load with clear error messages for invalid configurations.

### 1.4 YAML Parser

**File: `src/config/parser.ts`**

YAML file parsing into structured configuration with validation against schema. Handles file I/O errors gracefully.

### 1.5 Configuration Loader

**File: `src/config/loader.ts`**

Loads configuration from file path and returns parsed and validated configuration object.

## Phase 2: Graph Structure & Representation

### 2.1 Graph Data Structure

**File: `src/graph/graph.ts`**

Directed graph implementation from node definitions:
- Node adjacency (edges) storage
- Graph traversal utilities
- Support for cycles

### 2.2 Node Registry

**Note:** Not implemented as separate file - functionality integrated into `Graph` class and `validator.ts`:
- Node ID to node definition mapping
- Node reference validation (tool references in entry/exit nodes, next, switch targets)
- Orphaned node detection
- Graph connectivity validation

### 2.3 Graph Validator

**File: `src/graph/validator.ts`**

Graph structure validation:
- All referenced nodes exist
- All tools have exactly one entry and one exit node
- Entry nodes are only referenced as tool entry points
- Exit nodes are only referenced as tool exit points
- Exit nodes are reachable from entry nodes
- Detailed validation error messages

## Phase 3: MCP Server Foundation

### 3.1 MCP Server Setup

**Note:** Not implemented as separate file - functionality integrated into `src/main.ts`:
- MCP server initialization using `@modelcontextprotocol/sdk`
- Stdio transport setup
- Server lifecycle management

### 3.2 Tool Registration

**Note:** Not implemented as separate file - functionality integrated into `src/main.ts`:
- Tool definitions converted to MCP tool schemas
- Tools registered with MCP server
- Tool names mapped to execution handlers

### 3.3 Tool Execution Handler

**Note:** Not implemented as separate file - functionality integrated into `src/main.ts`:
- Tool invocation request handling
- Tool argument extraction
- Graph execution initiation at tool's entry node
- Result return to MCP client

## Phase 4: Expression Engines Integration

### 4.1 JSONata Integration

**File: `src/expressions/jsonata.ts`**

JSONata library wrapper:
- Expression evaluation with context data
- Error handling
- Support for JSONata references (e.g., `$.entry_count_files.directory` for tool input, `$.list_directory_node` for node outputs)

### 4.2 JSON Logic Integration

**File: `src/expressions/json-logic.ts`**

JSON Logic library wrapper:
- Rule evaluation with context data
- Boolean results for routing decisions
- Error handling

### 4.3 Expression Context

**File: `src/execution/context.ts`**

Expression evaluation context building:
- Tool input arguments
- Previous node outputs
- Execution state
- Data access for expressions

**Note:** `src/expressions/context.ts` exists but functionality is primarily in `src/execution/context.ts`.

## Phase 5: Node Execution

### 5.1 Node Executor Base

**Note:** Not implemented as separate base class - each executor is standalone with consistent execution pattern:
- Pre-execution validation
- Execute node logic
- Post-execution processing
- Determine next node(s)

### 5.2 MCP Tool Node Executor

**File: `src/execution/nodes/mcp-tool-executor.ts`**

MCP tool node execution:
- Pre-transform: Apply JSONata to format tool arguments
- Call MCP tool using MCP client
- Handle MCP call errors
- Return output and next node

### 5.3 Transform Node Executor

**File: `src/execution/nodes/transform-executor.ts`**

Transform node execution:
- Apply JSONata transformation expression
- Pass through data with transformation
- Return transformed output and next node

### 5.4 Switch Node Executor

**File: `src/execution/nodes/switch-executor.ts`**

Switch node execution:
- Evaluate JSON Logic conditions in order
- Select target node based on first matching condition
- Handle default/fallback case (conditions without rules)
- Return next node based on condition result

### 5.5 Entry Node Executor

**File: `src/execution/nodes/entry-executor.ts`**

Entry node execution:
- Receive tool arguments from MCP client
- Initialize execution context with tool arguments
- Make tool arguments available to subsequent nodes via entry node output (e.g., `$.entry_count_files.directory`)
- Pass execution to next node

### 5.6 Exit Node Executor

**File: `src/execution/nodes/exit-executor.ts`**

Exit node execution:
- Extract final result from execution context
- Signal execution completion
- Return final result to MCP tool caller

## Phase 6: Graph Execution Engine

### 6.1 Execution Context

**File: `src/execution/context.ts`**

Execution state management:
- Current node tracking
- Data context (node outputs stored by node ID, e.g., `$.entry_node_id.*`, `$.mcp_node_id.*`)
- Execution history
- Error state
- Data access for expressions (all data referenced by node ID)

### 6.2 Graph Executor

**File: `src/execution/executor.ts`**

Main graph execution orchestrator:
- Custom sequential execution loop
- Start at tool's entry node
- Execute current node based on type (entry, mcp, transform, switch, exit)
- Move to next node based on node's `next` field or switch routing
- Continue until exit node is reached
- Track execution history (node inputs/outputs)
- Handle errors with context

**Note:** The execution loop supports cycles (directed graphs with cycles), but infinite loops are prevented by the exit node check. Future loop node types can leverage this cycle support.

### 6.3 Execution Flow

**Note:** Not implemented as separate file - functionality integrated into `executor.ts`:
- Node execution sequence coordination
- Data flow between nodes
- Branching (switch nodes)
- Parallel execution support deferred

## Phase 7: MCP Client for External Servers

### 7.1 MCP Client Manager

**File: `src/mcp/client-manager.ts`**

MCP client connection management:
- Connections to external MCP servers
- Client connection caching
- Connection lifecycle handling
- Support for multiple concurrent servers

### 7.2 MCP Client Factory

**Note:** Not implemented as separate file - client creation functionality is in `client-manager.ts`:
- MCP client creation for different server types
- Stdio transport support
- Client configuration

### 7.3 Tool Call Handler

**Note:** Not implemented as separate file - tool calling functionality is in `mcp-tool-executor.ts`:
- `callTool` request execution to external MCP servers
- Tool argument handling
- Tool response processing
- Error and timeout handling

## Phase 8: Error Handling & Observability

### 8.1 Error Types

**Note:** Not implemented - using standard Error types:
- Basic error handling works with standard Error
- Custom error types (ConfigError, GraphError, ExecutionError, NodeError, McpError) would improve developer experience but are not required

### 8.2 Error Handling

**Note:** Basic error handling implemented throughout - centralized handler not implemented:
- Error logging with context (via logger)
- Error propagation through execution
- Basic user-friendly error messages
- Centralized error handler would be a nice-to-have enhancement

### 8.3 Execution Logging

**Note:** Basic logging implemented - structured execution logger not implemented:
- Node execution events logged via basic logger
- Structured logging would be valuable for debugging but basic logger works

## Phase 9: Integration & Testing

### 9.1 Main Entry Point

**File: `src/main.ts`**

Main entry point implementation:
- Command-line argument parsing (config file path)
- Configuration loading
- Graph validation
- MCP server startup
- Tool registration
- Tool execution handling
- Graceful shutdown handling

### 9.2 Integration Tests

**Files: `tests/files.test.ts`, `tests/mcp-server.test.ts`, `tests/switch.test.ts`**

Integration tests implemented:
- Full execution flow with sample configs
- Different node types tested
- MCP client integration tested
- Switch node conditional routing tested

### 9.3 Sample Configurations

**File: `examples/count_files.yaml`**

Sample configuration implemented demonstrating:
- Tool definition
- Entry/exit nodes
- MCP tool node
- Transform node with JSONata

## Phase 10: Polish & Documentation

### 10.1 Code Documentation

Basic JSDoc comments present on key functions. Comprehensive documentation would be a nice-to-have enhancement.

### 10.2 Error Messages

Basic error messages implemented. More helpful suggestions and context would improve developer experience.

### 10.3 README Updates

**File: `README.md`**

README updated with:
- Usage instructions
- Installation from npm
- MCP server configuration examples
- Examples and configuration format documentation

## Implementation Decisions

1. **Custom Execution Engine**: A custom execution loop was implemented to provide full control over execution flow, enable observability (execution history), and support future debugging/introspection features.

2. **Expression Evaluation**: All expressions (JSONata, JSON Logic) are evaluated with a consistent context where all data is referenced by node ID. Tool input is stored as the entry node's output (e.g., `$.entry_count_files.directory`), and each node's output is stored by its node ID (e.g., `$.list_directory_node`).

3. **Data Flow**: Data flows through nodes as a JSON object where each node's output is stored by its node ID. Each node can read from previous nodes (by their node IDs) and write its own output (stored by its node ID).

4. **Error Handling**: Errors at any node are caught, logged, and propagated. Basic error handling works; custom error types would be an enhancement.

5. **MCP Client Management**: External MCP servers are managed as separate clients. The system maintains a registry of available MCP servers and their tools.

6. **Code Organization**: Some planned separate files were integrated into existing files (e.g., server setup in main.ts, tool registration in main.ts). This works well and keeps the codebase simpler.

## Future Considerations

See `docs/future-introspection-debugging.md` for planned introspection and debugging features.

Other future enhancements:
- Visual editor/UX
- Hot-reload of configuration
- Loop node types (for, while, foreach)
- Parallel node execution
- Retry logic for failed nodes
- Execution history persistence
- Performance monitoring/metrics
- OpenTelemetry integration
- Custom error types
- Structured execution logging
- Centralized error handler

