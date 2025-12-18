# mcpGraph Implementation Plan

This document outlines the implementation plan for the mcpGraph MCP server with graph execution capabilities. The visual editor/UX is deferred to a later phase.

## Overview

The implementation is divided into phases, with each phase building on the previous one. The goal is to create a working MCP server that can:
1. Parse YAML configuration files
2. Expose MCP tools defined in the configuration
3. Execute directed graphs of nodes when tools are called
4. Handle data transformation and routing between nodes

## Phase 1: Foundation & Configuration Parsing

### 1.1 Project Setup & Dependencies
- [x] Initialize TypeScript project
- [x] Set up logger (stderr only)
- [ ] Add dependencies:
  - `@modelcontextprotocol/sdk` - MCP SDK
  - `flowcraft` - Graph execution engine
  - `jsonata` - Data transformation
  - `json-logic-js` - Conditional routing
  - `js-yaml` - YAML parsing
  - `zod` - Schema validation

### 1.2 Type Definitions
**File: `src/types/config.ts`**
- Define TypeScript interfaces for:
  - `McpGraphConfig` - Root configuration structure
  - `ServerMetadata` - MCP server metadata
  - `ToolDefinition` - Tool definition with input/output schemas, entryNode, and exitNode
  - `NodeDefinition` - Base node interface
  - `EntryNode` - Entry point node that receives tool arguments
  - `ExitNode` - Exit point node that returns final result
  - `McpToolNode` - MCP tool call node
  - `TransformNode` - JSONata transformation node
  - `SwitchNode` - JSON Logic routing node

### 1.3 YAML Schema & Validation
**File: `src/config/schema.ts`**
- Use Zod to define validation schemas matching the type definitions
- Validate YAML structure on load
- Provide clear error messages for invalid configurations

### 1.4 YAML Parser
**File: `src/config/parser.ts`**
- Parse YAML file into structured configuration
- Validate against schema
- Return typed configuration object
- Handle file I/O errors gracefully

### 1.5 Configuration Loader
**File: `src/config/loader.ts`**
- Load configuration from file path
- Return parsed and validated configuration object

## Phase 2: Graph Structure & Representation

### 2.1 Graph Data Structure
**File: `src/graph/graph.ts`**
- Build directed graph from node definitions
- Store node adjacency (edges)
- Support cycle detection
- Provide graph traversal utilities

### 2.2 Node Registry
**File: `src/graph/node-registry.ts`**
- Map node IDs to node definitions
- Validate node references (entryNode, exitNode, next, switch targets)
- Detect orphaned nodes
- Validate graph connectivity

### 2.3 Graph Validator
**File: `src/graph/validator.ts`**
- Validate graph structure:
  - All referenced nodes exist
  - All tools have valid entryNode and exitNode
  - Entry nodes are only referenced as tool entry points
  - Exit nodes are only referenced as tool exit points
  - Exit nodes are reachable from entry nodes
  - No unreachable nodes (optional warning)
- Provide detailed validation errors

## Phase 3: MCP Server Foundation

### 3.1 MCP Server Setup
**File: `src/server/server.ts`**
- Initialize MCP server using `@modelcontextprotocol/sdk`
- Set up stdio transport
- Register tools from configuration
- Handle server lifecycle

### 3.2 Tool Registration
**File: `src/server/tool-registry.ts`**
- Convert tool definitions to MCP tool schemas
- Register tools with MCP server
- Map tool names to execution handlers

### 3.3 Tool Execution Handler
**File: `src/server/tool-handler.ts`**
- Handle tool invocation requests
- Extract tool arguments
- Start graph execution at tool's entry node
- Entry node receives tool arguments and initializes execution context
- Execution continues until exit node is reached
- Exit node extracts final result and returns to MCP client

## Phase 4: Expression Engines Integration

### 4.1 JSONata Integration
**File: `src/expressions/jsonata.ts`**
- Wrap JSONata library
- Evaluate JSONata expressions with context data
- Handle expression errors gracefully
- Support JSONata references (e.g., `$.input.directory`)

### 4.2 JSON Logic Integration
**File: `src/expressions/json-logic.ts`**
- Wrap json-logic-js library
- Evaluate JSON Logic rules with context data
- Return boolean results for routing decisions
- Handle rule errors gracefully

### 4.3 Expression Context
**File: `src/expressions/context.ts`**
- Build expression evaluation context from:
  - Tool input arguments
  - Previous node outputs
  - Execution state
- Provide helper functions for common patterns

## Phase 5: Node Execution

### 5.1 Node Executor Base
**File: `src/execution/node-executor.ts`**
- Base interface for node execution
- Common execution flow:
  - Pre-execution validation
  - Execute node logic
  - Post-execution processing
  - Determine next node(s)

### 5.2 MCP Tool Node Executor
**File: `src/execution/nodes/mcp-tool-executor.ts`**
- Pre-transform: Apply JSONata to format tool arguments
- Call MCP tool using MCP client
- Post-transform: Apply JSONata to format output
- Handle MCP call errors
- Return output and next node

### 5.3 Transform Node Executor
**File: `src/execution/nodes/transform-executor.ts`**
- Apply JSONata transformation expression
- Pass through data with transformation
- Return transformed output and next node

### 5.4 Switch Node Executor
**File: `src/execution/nodes/switch-executor.ts`**
- Evaluate JSON Logic conditions
- Select target node based on first matching condition
- Handle default/fallback case
- Return next node based on condition result

### 5.5 Entry Node Executor
**File: `src/execution/nodes/entry-executor.ts`**
- Receive tool arguments from MCP client
- Initialize execution context with tool arguments
- Make tool arguments available to subsequent nodes (e.g., `$.input.*`)
- Pass execution to next node

### 5.6 Exit Node Executor
**File: `src/execution/nodes/exit-executor.ts`**
- Extract final result from execution context
- Apply optional transformation (if needed)
- Signal execution completion
- Return final result to MCP tool caller

## Phase 6: Graph Execution Engine

### 6.1 Execution Context
**File: `src/execution/context.ts`**
- Maintain execution state:
  - Current node
  - Data context (tool inputs, node outputs)
  - Execution history
  - Error state
- Provide data access for expressions

### 6.2 Graph Executor
**File: `src/execution/executor.ts`**
- Main graph execution orchestrator
- Use Flowcraft programmatically to execute graph
- Or implement custom execution loop:
  - Start at tool's entry node
  - Execute current node
  - Move to next node(s)
  - Continue until exit node is reached
  - Handle cycles (with limits)
- Track execution path
- Handle errors and timeouts

### 6.3 Execution Flow
**File: `src/execution/flow.ts`**
- Coordinate node execution sequence
- Manage data flow between nodes
- Handle branching (switch nodes)
- Support parallel execution (future)

## Phase 7: MCP Client for External Servers

### 7.1 MCP Client Manager
**File: `src/mcp/client-manager.ts`**
- Manage connections to external MCP servers
- Cache client connections
- Handle connection lifecycle
- Support multiple concurrent servers

### 7.2 MCP Client Factory
**File: `src/mcp/client-factory.ts`**
- Create MCP clients for different server types
- Support stdio, SSE, and other transports
- Configure client settings

### 7.3 Tool Call Handler
**File: `src/mcp/tool-caller.ts`**
- Execute `callTool` requests to external MCP servers
- Handle tool arguments
- Process tool responses
- Handle errors and timeouts

## Phase 8: Error Handling & Observability

### 8.1 Error Types
**File: `src/errors/types.ts`**
- Define custom error types:
  - `ConfigError` - Configuration parsing/validation errors
  - `GraphError` - Graph structure errors
  - `ExecutionError` - Runtime execution errors
  - `NodeError` - Node-specific errors
  - `McpError` - MCP communication errors

### 8.2 Error Handling
**File: `src/errors/handler.ts`**
- Centralized error handling
- Error logging with context
- Error propagation through execution
- User-friendly error messages

### 8.3 Execution Logging
**File: `src/observability/execution-logger.ts`**
- Log node execution events:
  - Node start
  - Node input data
  - Node output data
  - Node errors
  - Execution path
- Use structured logging

## Phase 9: Integration & Testing

### 9.1 Main Entry Point
**File: `src/main.ts`**
- Parse command-line arguments (config file path)
- Load configuration
- Validate graph
- Start MCP server
- Handle graceful shutdown

### 9.2 Integration Tests
**File: `tests/integration/`**
- Test full execution flow with sample configs
- Test error scenarios
- Test different node types
- Test graph with cycles

### 9.3 Sample Configurations
**File: `examples/`**
- `count_files.yaml` - Example from design doc
- Additional examples for different patterns

## Phase 10: Polish & Documentation

### 10.1 Code Documentation
- Add JSDoc comments to all public APIs
- Document configuration format
- Document node types and their behavior

### 10.2 Error Messages
- Improve error messages for common issues
- Provide helpful suggestions

### 10.3 README Updates
- Update README with usage instructions
- Add examples
- Document configuration format

## Implementation Order Summary

1. **Phase 1**: Foundation - types, parsing, validation
2. **Phase 2**: Graph structure - build and validate graph
3. **Phase 4**: Expression engines - JSONata and JSON Logic
4. **Phase 5**: Node execution - implement each node type
5. **Phase 7**: MCP client - connect to external servers
6. **Phase 6**: Graph execution - orchestrate execution
7. **Phase 3**: MCP server - expose tools
8. **Phase 8**: Error handling - robust error management
9. **Phase 9**: Integration - bring it all together
10. **Phase 10**: Polish - documentation and refinement

## Key Design Decisions

1. **Flowcraft Usage**: Use Flowcraft programmatically rather than its YAML format. This gives us full control over our YAML schema while leveraging its execution capabilities.

2. **Expression Evaluation**: All expressions (JSONata, JSON Logic) are evaluated with a consistent context that includes tool inputs and previous node outputs.

3. **Data Flow**: Data flows through nodes as a JSON object that accumulates results. Each node can read from and write to this context.

4. **Error Handling**: Errors at any node should be caught, logged, and either propagated (for critical errors) or handled gracefully (for recoverable errors).

5. **MCP Client Management**: External MCP servers are managed as separate clients. The system maintains a registry of available MCP servers and their tools.

## Future Considerations (Out of Scope for Initial Implementation)

- Visual editor/UX
- Hot-reload of configuration
- Parallel node execution
- Retry logic for failed nodes
- Execution history persistence
- Performance monitoring/metrics
- OpenTelemetry integration

