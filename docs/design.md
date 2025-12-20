# mcpGraph Design Document

## Overview

This document memorializes the high-level design and tooling recommendations for mcpGraph, a product similar to n8n that surfaces an MCP interface and internally implements a directed graph of MCP server calls. The system enables filtering and reformatting data between nodes, makes routing decisions based on node output, and maintains a declarative, observable configuration without embedding a full programming language.

## Core Architecture: The Orchestrator

### Recommended Platform: TypeScript (Node.js)

**Rationale:**
- The MCP SDK is most mature in TypeScript
- Frontend tools for visual graph editing (like React Flow) are industry standard
- Strong ecosystem for both backend orchestration and frontend visualization

### Graph Execution Engine

The system implements a custom graph execution engine that orchestrates the directed graph of MCP server calls.

**Design Approach:**
- **Custom Execution Loop**: A lightweight, sequential execution loop that provides full control over execution flow
- **Simple Architecture**: Direct mapping from YAML node definitions to execution, avoiding abstraction layers
- **Data Flow**: Execution context maintains state and data flow between nodes
- **Control Flow**: Supports conditional routing via switch nodes; cycles are supported for future loop constructs
- **Observability**: Built-in execution history tracking for debugging and introspection

**Implementation:**
The YAML configuration is parsed into a graph structure (`Graph` class) and executed by a custom `GraphExecutor` that:
- Starts at the tool's entry node
- Executes nodes sequentially based on the graph structure
- Tracks execution state and history
- Routes conditionally via switch nodes
- Continues until the exit node is reached

### MCP Integration

- Use `@modelcontextprotocol/sdk`
- The system exposes an MCP server interface
- The YAML configuration defines the MCP server metadata and the tools it exposes
- Each tool definition includes standard MCP tool metadata (name, description, input/output parameters)
- Each tool's graph has an explicit entry node that receives tool arguments and initializes execution
- Each tool's graph has an explicit exit node that returns the final result to the MCP tool caller
- Execution flows through the graph from entry node to exit node

## Declarative Logic & Data Transformation

To avoid embedding a full programming language while maintaining declarative, observable configurations, the system uses standardized expression engines.

### Data Reformatting: JSONata

**Why JSONata:**
- Declarative query and transformation language for JSON
- Single string expression enables clear observability
- Can log input, expression, and output to debug transformations

**Resources:** [JSONata Documentation](https://jsonata.org/)

**YAML Example:**
```yaml
transform:
  expr: "$merge([payload, {'timestamp': $now()}])"
```

### Routing Decisions: JSON Logic

**Why JSON Logic:**
- Allows complex rules (e.g., "if price > 100 and status == 'active'") as pure JSON objects
- Declarative and observable
- No embedded code execution
- **Note:** `var` operations in JSON Logic rules are evaluated using JSONata, allowing full JSONata expression support (including `$previousNode()` function)

**Resources:** [JSON Logic Documentation](https://jsonlogic.com/)

**YAML Example:**
```yaml
condition:
  and:
    - ">": [{ var: "entry.price" }, 100]
    - "==": [{ var: "entry.status" }, "active"]
```

**Advanced Example with JSONata:**
```yaml
condition:
  ">": [{ var: "$previousNode().count" }, 10]
```

## High-Level Design: The Graph Runner

The system exposes an MCP server that reads a YAML configuration file. When a tool is called on this MCP server, it executes the corresponding graph starting at the tool's entry node and continuing until the exit node is reached.

### The Workflow Lifecycle

1. **Parse**: Read the YAML configuration into a structure containing MCP server metadata, tool definitions, and the directed graph of nodes
2. **Initialize MCP Server**: Expose the MCP server with the tools defined in the configuration
3. **Tool Invocation**: When a tool is called:
   - Receive tool arguments from the MCP client
   - Start graph execution at the tool's entry node
   - Entry node receives tool arguments and initializes the execution context
4. **Execute Node**:
   - **Entry Node**: Receives tool arguments, initializes execution context, passes to next node
   - **Pre-transform**: Apply JSONata to the incoming data to format the tool arguments (if node is an MCP tool call)
   - **Call Tool**: Use the MCP SDK to `callTool` on the target server (if node is an MCP tool call)
   - **Transform**: Apply JSONata expressions to transform data (if node is a transform node)
   - **Route**: Evaluate JSON Logic against the current data state to decide which edge to follow next (if node is a switch/conditional)
   - **Track History**: Record node execution with inputs and outputs for observability
5. **Exit Node**: When execution reaches the exit node, extract the final result and return it to the MCP tool caller

## Visual Tooling & Observability

### Component Recommendations

| Component | Tooling Recommendation |
|-----------|----------------------|
| **Visual Editor** | **React Flow** - Industry standard for node-based UIs, used by companies like Stripe and Typeform. Provides customizable nodes, edges, zooming, panning, and built-in components like MiniMap and Controls. [React Flow Documentation](https://reactflow.dev/) |
| **Observability** | OpenTelemetry - wrap each node execution in a "Span" to see the "Trace" of data through the graph in tools like Jaeger |

## Implementation Strategy: The YAML Standard

Graph definitions should feel like Kubernetes manifests or GitHub Actions - declarative and version-controlled.

### Configuration Structure

The YAML configuration centers around MCP server and tool definitions:

1. **MCP Server Metadata**: Defines the MCP server information (name, version, description)
2. **Tools**: Array of tool definitions, each containing:
   - Standard MCP tool metadata (name, description)
   - Input parameters schema (MCP tool parameter definitions)
   - Output schema (what the tool returns)
   - Note: Entry and exit nodes are defined in the nodes section with a `tool` field indicating which tool they belong to
3. **Nodes**: The directed graph of nodes that execute when tools are called. Node types include:
   - **`entry`**: Entry point for a tool's graph execution. Receives tool arguments and initializes execution context.
     - **Output**: The tool input arguments (passed through as-is)
   - **`mcp`**: Calls an MCP tool on an internal or external MCP server using `callTool`
     - **Output**: The MCP tool's response (parsed from the tool's content)
   - **`transform`**: Applies JSONata expressions to transform data between nodes
     - **Output**: The result of evaluating the JSONata expression
   - **`switch`**: Uses JSON Logic to conditionally route to different nodes based on data
     - **Output**: The node ID of the target node that was routed to (string)
   - **`exit`**: Exit point for a tool's graph execution. Extracts and returns the final result to the MCP tool caller
     - **Output**: The output from the previous node in the execution history

### Example YAML Structure: count_files Tool

This example defines a `count_files` tool that takes a directory, lists its contents using the filesystem MCP server, counts the files, and returns the count:

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

## Key Design Principles

1. **Declarative Configuration**: All logic expressed in YAML using standard expression languages (JSONata, JSON Logic)
2. **Observability**: Every transformation and decision is traceable and loggable
3. **No Embedded Code**: Avoid full programming languages to maintain clarity and safety
4. **Standard-Based**: Favor existing standards (JSONata, JSON Logic) over custom solutions
5. **Visual First**: Graph should be viewable and editable through a visual interface
6. **Execution Transparency**: Ability to observe graph execution in real-time

## System Components

1. **Executable**: Exposes an MCP server to run the graph (`mcpgraph` CLI)
2. **Programmatic API**: Exports `McpGraphApi` class for programmatic use (e.g., by visualizer applications)
3. **Graph Executor**: Core orchestration engine that executes the directed graph sequentially
4. **Execution Context**: Tracks execution state, data flow, and history
5. **Visual Editor**: Tools to visually view and edit the graph (future)
6. **Execution Observer**: Ability to observe and debug graph execution (future - see `docs/future-introspection-debugging.md`)
