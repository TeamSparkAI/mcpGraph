# mcpGraph Design Document

## Overview

This document memorializes the high-level design and tooling recommendations for mcpGraph, a product similar to n8n that surfaces an MCP interface and internally implements a directed graph of MCP server calls. The system enables filtering and reformatting data between nodes, makes routing decisions based on node output, and maintains a declarative, observable configuration without embedding a full programming language.

## Core Architecture: The Orchestrator

### Recommended Platform: TypeScript (Node.js)

**Rationale:**
- The MCP SDK is most mature in TypeScript
- Frontend tools for visual graph editing (like React Flow) are industry standard
- Strong ecosystem for both backend orchestration and frontend visualization

### Graph Execution Engine: Flowcraft

**Flowcraft** is the recommended graph execution engine for orchestrating the directed graph of MCP server calls.

**Why Flowcraft:**
- **Workflow-Focused**: Designed specifically for workflow orchestration (similar to n8n/Zapier), making it a natural fit for tool-call-based nodes
- **Control Flow**: Built-in support for conditionals (if/switch), loops, and parallelism
- **Data Flow**: Designed to handle data transformation and flow between nodes, with built-in support for modifying node inputs/outputs
- **Lightweight**: Dependency-free and focused on workflow execution
- **Static Analysis**: Provides tools to analyze workflows, detect cycles, and catch errors before execution
- **Programmatic API**: Can be used programmatically to build workflows from custom YAML configurations

**Implementation Approach:**
The system will define its own custom YAML format for graph definitions. The YAML will be parsed into a graph structure, which will then be used to programmatically construct Flowcraft workflows. This allows full control over the YAML schema while leveraging Flowcraft's execution engine for running the graph.

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

**Resources:** [JSON Logic Documentation](https://jsonlogic.com/)

**YAML Example:**
```yaml
condition:
  and:
    - ">": [{ var: "price" }, 100]
    - "==": [{ var: "status" }, "active"]
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
   - **Post-transform**: Reformat the tool's output for the next step (if node is an MCP tool call)
   - **Route**: Evaluate json-logic against the current data state to decide which edge to follow next (if node is a switch/conditional)
   - **Observe**: Emit an event to the UI with the node_id, input_data, and output_data
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
   - **`mcp`**: Calls an MCP tool on an internal or external MCP server using `callTool`
   - **`transform`**: Applies JSONata expressions to transform data between nodes
   - **`switch`**: Uses JSON Logic to conditionally route to different nodes based on data
   - **`exit`**: Exit point for a tool's graph execution. Extracts and returns the final result to the MCP tool caller

### Example YAML Structure: count_files Tool

This example defines a `count_files` tool that takes a directory, lists its contents using the filesystem MCP server, counts the files, and returns the count:

```yaml
version: "1.0"

# MCP Server Metadata
server:
  name: "mcpGraph"
  version: "1.0.0"
  description: "MCP server that executes directed graphs of MCP tool calls"

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
      path: "$.input.directory"  # JSONata reference to tool input
    next: "count_files_node"
  
  # Transform and count files
  - id: "count_files_node"
    type: "transform"
    transform:
      expr: |
        { "count": $count($split(list_directory_node, "\n")) }
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

1. **Executable**: Exposes an MCP server to run the graph
2. **Visual Editor**: Tools to visually view and edit the graph
3. **Execution Observer**: Ability to observe the graph as it executes
4. **Graph Runner**: Core orchestration engine that executes the directed graph (supports cycles for loops and retries)
