---
name: mcpGraphToolkit
description: Build, test, and manage mcpGraph tools using the mcpGraphToolkit MCP server. Discover MCP servers and tools, construct graph nodes with JSONata and JSON Logic, and interact with mcpGraph configurations.
version: 1.0.1
---

# Building mcpGraph Tools with mcpGraphToolkit

This skill teaches you how to use mcpGraphToolkit to build, debug, test, call, and manage graph tools in an mcpGraph. mcpGraphToolkit is an MCP server that provides tools for discovering MCP servers, constructing graph nodes, testing expressions, and managing tool definitions.

An mcpGraph is a collection of MCP servers (and their tools), which we will refer to as "MCP servers", and a set of graph tools that are callable by you through the mcpGraphToolkit (similar to how you would call an MCP server tool).  Each graph tool is defined similarly to an MCP tool and has its logic implemented in a directed graph of nodes that can call MCP servers, transform data, and perform conditional logic.

You should understand the current graph tools available and prioritize using those tools when they exist and are fit for the purpose.

When creating a new graph tool, you should always check to see if there is an existing graph tool that is fit for the purpose.

## ⚠️ CRITICAL: Use Only the Provided Tools

**DO NOT create, edit, or read configuration files directly.** mcpGraphToolkit uses configuration files internally (such as graph configuration files and MCP server configuration files), but you should never attempt to create, edit, or read directly from these files. The toolkit tools provide all the functionality you need to understand the state of the mcpGraph.

**How it works:**
- mcpGraphToolkit manages configuration files internally
- All file operations (reading, writing, updating) are handled by the toolkit tools
- You interact with the toolkit one through calling its tools
- The toolkit tools automatically handle all file operations behind the scenes

**What you should do:**
- **✅ DO** use `listMcpServers` and `listMcpServerTools` to discover available MCP servers and tools
- **✅ DO** use `getMcpServerTool` to get MCP server tool details and schemas
- **✅ DO** use `addGraphTool` to add graph tools to the mcpGraph (it handles file operations automatically)
- **✅ DO** use `updateGraphTool` and `deleteGraphTool` to manage graph tools
- **✅ DO** use `runGraphTool` to test graph tools before adding them
- **✅ DO** use `listGraphTools` and `getGraphTool` to discover and examine existing graph tools

**What you should never do:**
- **❌ DO NOT** create, edit, or read configuration files directly
- **❌ DO NOT** use file system tools to create or modify configuration files
- **❌ DO NOT** manually write YAML or JSON configuration files
- **❌ DO NOT** attempt to read or parse configuration files to understand the current state

**Remember:** The toolkit is an MCP server that manages all file operations. You interact with it through MCP tool calls, not by manipulating files directly. All information about the current state (MCP servers, tools, graph tools) is available through the discovery tools.


## Terminology: MCP Servers/Tools vs Graph Tools

**Important:** Understanding the distinction between MCP servers/tools and graph tools is critical.

### MCP Servers and Tools (Available to the Graph)
- **MCP Servers**: External MCP servers that are available to the graph (discovered via `listMcpServers`)
- **MCP Tools**: Tools provided by those MCP servers (discovered via `listMcpServerTools` and `getMcpServerTool`)
- These are the **building blocks** that graph tools can use
- Graph tools can **only** use MCP servers and tools that are available to the graph (as determined by the toolkit's discovery APIs)
- Use `listMcpServers` and `listMcpServerTools` to see what's available before building graph tools

### Graph Tools (What You Create and Manage)
- **Graph Tools**: Tools you create, manage, and run using mcpGraphToolkit
- These are **composed** from MCP tools, transform nodes, and switch nodes
- Once created, graph tools can be called **like MCP tools** - they appear as tools that can be invoked
- Graph tools are stored in the graph configuration and can be discovered via `listGraphTools`

**Key Points:**
- Graph tools **orchestrate** MCP tools - they call MCP tools in sequence, transform data, and make routing decisions
- Graph tools can **only** use MCP servers/tools that are available to the graph (check with `listMcpServers` first)
- **Always check** if an existing graph tool already serves your purpose before creating a new one (use `listGraphTools` and `getGraphTool`)
- Graph tools you create become available as callable tools, just like MCP tools

## What is an mcpGraph?

An **mcpGraph** is a declarative configuration that defines MCP tools as directed graphs of nodes. Each tool executes a sequence of nodes that can:
- Call other MCP tools (on internal or external MCP servers)
- Transform data using JSONata expressions
- Make routing decisions using JSON Logic

**When to use mcpGraph:**
- You need to orchestrate multiple MCP tool calls in sequence
- You want to transform data between tool calls
- You need conditional routing based on data
- You want declarative, observable configurations (no embedded code)
- You need to compose complex workflows from simpler MCP tools

**Why use mcpGraph:**
- **Declarative**: All logic expressed using standard expression languages (JSONata, JSON Logic)
- **Observable**: Every transformation and decision is traceable
- **No Embedded Code**: Uses JSONata and JSON Logic instead of full programming languages
- **Standard-Based**: Built on MCP, JSONata, and JSON Logic standards
- **Composable**: Build complex tools from simpler MCP tools

## mcpGraphToolkit Tools

mcpGraphToolkit provides 11 tools organized into categories:

### Graph Discovery Tools
- **`getGraphServer`**: Get full details of the mcpGraph server metadata (name, version, title, instructions)
- **`listGraphTools`**: List all graph tools in the mcpGraph (name and description)
  - **Always check this first** before creating a new graph tool - an existing graph tool may already serve your purpose
- **`getGraphTool`**: Get full detail of a graph tool from the mcpGraph (including complete node definitions)
  - Use this to understand existing graph tools before creating new ones

### MCP Server Discovery Tools
- **`listMcpServers`**: List all MCP servers available to the graph (name, title, instructions, version)
  - These are the MCP servers that graph tools can use
  - Graph tools can **only** use MCP servers listed here
- **`listMcpServerTools`**: List tools from MCP servers available to the graph (name/description only), optionally filtered by MCP server name
  - These are the MCP tools that graph tools can call
- **`getMcpServerTool`**: Get full MCP server tool details (including input and output schemas)
  - Use this to understand how to call MCP tools from your graph tools

### Graph Tool Management Tools
- **`addGraphTool`**: Add a new tool to the mcpGraph
- **`updateGraphTool`**: Update an existing tool in the mcpGraph
- **`deleteGraphTool`**: Delete a tool from the mcpGraph

### Tool Execution Tools
- **`runGraphTool`**: Run an exported tool from the mcpGraph. Can specify existing tool name or run a tool definition supplied in payload. Supports optional logging collection.

### Expression Testing Tools
- **`testJSONata`**: Test a JSONata expression with context
- **`testJSONLogic`**: Test a JSON Logic expression with context

## Graph Structure and Flow

A graph is a directed sequence of nodes that execute in order. Execution flow:
1. Starts at the **entry** node (receives tool arguments)
2. Executes nodes sequentially based on `next` fields
3. **switch** nodes can conditionally route to different nodes
4. Continues until the **exit** node is reached
5. Exit node returns the final result

### Node Connections

Nodes are connected using the `next` field, which specifies the ID of the next node to execute:

```json
{
  "id": "node1",
  "type": "transform",
  "next": "node2"
}
```

**Switch nodes** use `conditions` with `target` fields instead of `next`:

```json
{
  "id": "switch_node",
  "type": "switch",
  "conditions": [
    {
      "rule": { ">": [{ "var": "entry.value" }, 10] },
      "target": "high_path"
    },
    {
      "target": "default_path"
    }
  ]
}
```

### Execution Context

During execution, each node's output is stored in the execution context. You can access node outputs using JSONata expressions:
- `$.node_id` - Accesses the latest output of a node with ID `node_id`
- `$.entry.paramName` - Accesses a parameter from the entry node

The context is a flat structure: `{ "node_id": output, ... }`

## Node Types

### Entry Node

The entry point for a tool's graph execution. Receives tool arguments.

**Properties:**
- `id`: Node identifier (typically "entry")
- `type`: `"entry"`
- `next`: ID of the next node to execute

**Output:** The tool input arguments (passed through as-is)

**Example:**
```json
{
  "id": "entry",
  "type": "entry",
  "next": "process_node"
}
```

### MCP Node

Calls an MCP tool on an MCP server that is available to the graph.

**Properties:**
- `id`: Node identifier
- `type`: `"mcp"`
- `server`: Name of the MCP server (must be one of the servers available to the graph, as discovered via `listMcpServers`)
- `tool`: Name of the tool to call on that server (must be one of the tools available on that server, as discovered via `listMcpServerTools`)
- `args`: Arguments to pass to the tool (can use JSONata expressions)
- `next`: ID of the next node to execute

**Output:** The MCP tool's response (parsed from the tool's content)

**Important:** Graph tools can **only** use MCP servers and tools that are available to the graph. Always use `listMcpServers` and `listMcpServerTools` to verify what's available before referencing servers and tools in your graph nodes.

**Example:**
```json
{
  "id": "list_directory_node",
  "type": "mcp",
  "server": "filesystem",
  "tool": "list_directory",
  "args": {
    "path": "$.entry.directory"
  },
  "next": "count_files_node"
}
```

**Using MCP Discovery:**
1. Use `listMcpServers` to discover MCP servers available to the graph (graph tools can only use these servers)
2. Use `listMcpServerTools` to see MCP tools available on a server (graph tools can only call these tools)
3. Use `getMcpServerTool` to get full tool details including input/output schemas
4. Use the server name and tool name in your MCP node (must match what's available to the graph)

### Transform Node

Applies JSONata expressions to transform data between nodes.

**Properties:**
- `id`: Node identifier
- `type`: `"transform"`
- `transform.expr`: JSONata expression (string)
- `next`: ID of the next node to execute

**Output:** The result of evaluating the JSONata expression

**Example (simple):**
```json
{
  "id": "count_files_node",
  "type": "transform",
  "transform": {
    "expr": "{ \"count\": $count($split($.list_directory_node.content, \"\\n\")) }"
  },
  "next": "exit"
}
```

**Example (complex):**
```json
{
  "id": "increment_node",
  "type": "transform",
  "transform": {
    "expr": "$executionCount(\"increment_node\") = 0 ? { \"counter\": 1, \"sum\": 1, \"target\": $.entry_sum.n } : { \"counter\": $nodeExecution(\"increment_node\", -1).counter + 1, \"sum\": $nodeExecution(\"increment_node\", -1).sum + $nodeExecution(\"increment_node\", -1).counter + 1, \"target\": $.entry_sum.n }"
  },
  "next": "check_condition"
}
```

### Switch Node

Uses JSON Logic to conditionally route to different nodes based on data.

**Properties:**
- `id`: Node identifier
- `type`: `"switch"`
- `conditions`: Array of condition rules
  - `rule`: JSON Logic expression (optional - if omitted, acts as default case)
  - `target`: ID of the node to route to if this condition matches
- **Note:** No `next` field - routing is determined by conditions

**Output:** The node ID of the target node that was routed to (string)

**Important:** `var` operations in JSON Logic rules are evaluated using JSONata, allowing full JSONata expression support (including history functions).

**Example:**
```json
{
  "id": "switch_node",
  "type": "switch",
  "conditions": [
    {
      "rule": {
        ">": [{ "var": "entry.value" }, 10]
      },
      "target": "high_path"
    },
    {
      "rule": {
        ">": [{ "var": "entry.value" }, 0]
      },
      "target": "low_path"
    },
    {
      "target": "zero_path"
    }
  ]
}
```

**Advanced Example with JSONata:**
```json
{
  "id": "check_condition",
  "type": "switch",
  "conditions": [
    {
      "rule": {
        "<": [
          { "var": "$.increment_node.counter" },
          { "var": "$.increment_node.target" }
        ]
      },
      "target": "increment_node"
    },
    {
      "target": "exit_sum"
    }
  ]
}
```

### Exit Node

Exit point that returns the final result to the MCP tool caller.

**Properties:**
- `id`: Node identifier (typically "exit")
- `type`: `"exit"`
- **Note:** No `next` field - execution ends here

**Output:** The output from the previous node in the execution history

**Example:**
```json
{
  "id": "exit",
  "type": "exit"
}
```

## JSONata Expressions

JSONata is used in three places in mcpGraph for data transformation and access:
1. **Transform node expressions** - Transform data between nodes
2. **JSON Logic `var` operations** - Access context data in switch node conditions
3. **MCP tool node arguments** - Dynamically compute argument values (any argument value starting with `$` is evaluated as a JSONata expression)

### Basic Syntax

- **Object construction**: `{ "key": value }`
- **Property access**: `$.node_id.property`
- **Functions**: `$count(array)`, `$split(string, delimiter)`, etc.
- **Conditional**: `condition ? trueValue : falseValue`

### Where JSONata is Used

**1. Transform Nodes:**
Transform nodes use JSONata expressions in the `transform.expr` field to transform data:
```json
{
  "transform": {
    "expr": "{ \"count\": $count($split($.list_directory_node.content, \"\\n\")) }"
  }
}
```

**2. MCP Tool Node Arguments:**
Any argument value in an MCP tool node that starts with `$` is evaluated as a JSONata expression:
```json
{
  "args": {
    "path": "$.entry.directory",
    "count": "$count($.previous_node.items)"
  }
}
```

**3. JSON Logic `var` Operations:**
In switch node conditions, `var` operations are evaluated using JSONata:
```json
{
  "rule": {
    ">": [{ "var": "$.increment_node.counter" }, 10]
  }
}
```

### Accessing Node Outputs

- `$.node_id` - Latest output of a node
- `$.node_id.property` - Property from node output
- `$.entry.paramName` - Parameter from entry node

### History Functions

For loops and accessing execution history:
- `$previousNode()` - Get the previous node's output
- `$previousNode(index)` - Get the node that executed N steps before current
- `$executionCount(nodeName)` - Count how many times a node executed
- `$nodeExecution(nodeName, index)` - Get a specific execution (0 = first, -1 = last)
- `$nodeExecutions(nodeName)` - Get all executions as an array

**Example:**
```json
{
  "transform": {
    "expr": "$executionCount(\"increment_node\") = 0 ? { \"counter\": 1, \"sum\": 1, \"target\": $.entry_sum.n } : { \"counter\": $nodeExecution(\"increment_node\", -1).counter + 1, \"sum\": $nodeExecution(\"increment_node\", -1).sum + $nodeExecution(\"increment_node\", -1).counter + 1, \"target\": $.entry_sum.n }"
  }
}
```

### Testing JSONata Expressions

Use the `testJSONata` tool to test expressions before adding them to your graph:

```json
{
  "tool": "testJSONata",
  "arguments": {
    "expression": "{ \"count\": $count($split($.list_directory_node.content, \"\\n\")) }",
    "context": {
      "list_directory_node": {
        "content": "file1.txt\nfile2.txt\nfile3.txt"
      }
    }
  }
}
```

This allows you to:
- Validate expression syntax
- Test with sample data
- Debug transformation logic
- Iterate on expressions before adding to nodes

## JSON Logic

JSON Logic is used in switch nodes for conditional routing. It allows complex rules as pure JSON objects.

### Basic Syntax

- **Comparison**: `{ ">": [a, b] }`, `{ "<": [a, b] }`, `{ "==": [a, b] }`, etc.
- **Logical**: `{ "and": [rule1, rule2] }`, `{ "or": [rule1, rule2] }`, `{ "!": rule }`
- **Variable access**: `{ "var": "path" }` or `{ "var": "$.node_id.property" }`

**Important:** `var` operations are evaluated using JSONata, so you can use full JSONata expressions:
- `{ "var": "entry.value" }` - Simple property access
- `{ "var": "$.increment_node.counter" }` - JSONata expression
- `{ "var": "$previousNode().count" }` - JSONata with history function

### Examples

**Simple comparison:**
```json
{
  "rule": {
    ">": [{ "var": "entry.value" }, 10]
  }
}
```

**Complex condition:**
```json
{
  "rule": {
    "and": [
      { ">": [{ "var": "entry.price" }, 100] },
      { "==": [{ "var": "entry.status" }, "active"] }
    ]
  }
}
```

**With JSONata:**
```json
{
  "rule": {
    "<": [
      { "var": "$.increment_node.counter" },
      { "var": "$.increment_node.target" }
    ]
  }
}
```

### Testing JSON Logic Expressions

Use the `testJSONLogic` tool to test expressions before adding them to your graph:

```json
{
  "tool": "testJSONLogic",
  "arguments": {
    "expression": {
      ">": [{ "var": "entry.value" }, 10]
    },
    "context": {
      "entry": {
        "value": 15
      }
    }
  }
}
```

This allows you to:
- Validate expression syntax
- Test with sample data
- Debug routing logic
- Iterate on conditions before adding to switch nodes

## Building Tools with mcpGraphToolkit

### Workflow

**IMPORTANT:** Follow this workflow exactly. Do not skip steps or try to create files manually.

0. **Check for Existing Graph Tools**
   - **ALWAYS START HERE**: Use `listGraphTools` to see if a graph tool already exists for your purpose
   - Use `getGraphTool` to examine existing graph tools before creating new ones
   - Only create a new graph tool if no existing tool serves your purpose
   
1. **Discover Available MCP Servers and Tools**
   - **MUST USE** `listMcpServers` to see MCP servers available to the graph (graph tools can only use these servers)
   - **MUST USE** `listMcpServerTools` to see MCP tools available on a server (graph tools can only call these tools)
   - **MUST USE** `getMcpServerTool` to get full tool details (input/output schemas)
   - **Remember**: Graph tools can only use MCP servers and tools that are available to the graph (as shown by these discovery tools)
   - **DO NOT** attempt to read configuration files to discover MCP servers - use the toolkit discovery tools instead

2. **Test Expressions**
   - Use `testJSONata` to test transform expressions
   - Use `testJSONLogic` to test switch conditions
   - Iterate until expressions work correctly

3. **Build Tool Definition**
   - Construct nodes using MCP servers and tools that are available to the graph (from step 1)
   - **Only reference** MCP servers and tools that were discovered via `listMcpServers` and `listMcpServerTools`
   - Use tested expressions in transform and switch nodes
   - Define entry and exit nodes
   - Specify input and output schemas

4. **Test Tool Before Adding**
   - Use `runGraphTool` with `toolDefinition` to test the tool inline
   - Optionally enable `logging: true` to see execution details
   - Verify the tool works correctly

5. **Add Tool to Graph**
   - **MUST USE** `addGraphTool` to add the tested tool to the graph
   - **DO NOT** create or edit configuration files directly
   - The tool is saved automatically by the toolkit (all file operations are handled internally)

6. **Update or Delete Tools**
   - **MUST USE** `updateGraphTool` to modify existing tools (do NOT edit configuration files directly)
   - **MUST USE** `deleteGraphTool` to remove tools (do NOT edit configuration files directly)
   - Changes are saved automatically by the toolkit (all file operations are handled internally)

### Example: Building a File Counter Tool

**IMPORTANT:** This example shows the correct workflow using ONLY toolkit tools. Do not create any files manually.

**Step 0: Check for Existing Graph Tools**
First, check if a graph tool already exists for counting files. Do NOT create a new tool if one already exists.
```json
{
  "tool": "listGraphTools",
  "arguments": {}
}
```

If a tool like "count_files" already exists, use `getGraphTool` to examine it:
```json
{
  "tool": "getGraphTool",
  "arguments": {
    "toolName": "count_files"
  }
}
```

Only proceed to create a new tool if no existing graph tool serves your purpose.

**Step 1: Discover MCP Servers Available to the Graph**
Use the toolkit to discover MCP servers that are available to the graph. Graph tools can only use these servers. The toolkit manages MCP server configuration internally - use the discovery tools, never attempt to read or create configuration files.
```json
{
  "tool": "listMcpServers",
  "arguments": {}
}
```

**Step 2: Discover Tools on Filesystem Server**
Use the toolkit to discover tools available on a specific server.
```json
{
  "tool": "listMcpServerTools",
  "arguments": {
    "serverName": "filesystem"
  }
}
```

**Step 3: Get Tool Details**
Use the toolkit to get complete tool information including input/output schemas.
```json
{
  "tool": "getMcpServerTool",
  "arguments": {
    "serverName": "filesystem",
    "toolName": "list_directory"
  }
}
```

**Step 4: Test JSONata Expression**
```json
{
  "tool": "testJSONata",
  "arguments": {
    "expression": "{ \"count\": $count($split($.list_directory_node.content, \"\\n\")) }",
    "context": {
      "list_directory_node": {
        "content": "file1.txt\nfile2.txt\nfile3.txt"
      }
    }
  }
}
```

**Step 5: Test Tool Definition**
```json
{
  "tool": "runGraphTool",
  "arguments": {
    "toolDefinition": {
      "name": "count_files",
      "description": "Counts the number of files in a directory",
      "inputSchema": {
        "type": "object",
        "properties": {
          "directory": {
            "type": "string",
            "description": "The directory path to count files in"
          }
        },
        "required": ["directory"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "count": {
            "type": "number",
            "description": "The number of files in the directory"
          }
        }
      },
      "nodes": [
        {
          "id": "entry",
          "type": "entry",
          "next": "list_directory_node"
        },
        {
          "id": "list_directory_node",
          "type": "mcp",
          "server": "filesystem",
          "tool": "list_directory",
          "args": {
            "path": "$.entry.directory"
          },
          "next": "count_files_node"
        },
        {
          "id": "count_files_node",
          "type": "transform",
          "transform": {
            "expr": "{ \"count\": $count($split($.list_directory_node.content, \"\\n\")) }"
          },
          "next": "exit"
        },
        {
          "id": "exit",
          "type": "exit"
        }
      ]
    },
    "arguments": {
      "directory": "/path/to/directory"
    },
    "logging": true
  }
}
```

**Step 6: Add Tool to Graph**
Use `addGraphTool` to add the tested tool to the graph. This tool automatically handles all file operations internally - you do NOT need to create or edit any configuration files.
```json
{
  "tool": "addGraphTool",
  "arguments": {
    "tool": {
      "name": "count_files",
      "description": "Counts the number of files in a directory",
      "inputSchema": {
        "type": "object",
        "properties": {
          "directory": {
            "type": "string",
            "description": "The directory path to count files in"
          }
        },
        "required": ["directory"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "count": {
            "type": "number",
            "description": "The number of files in the directory"
          }
        }
      },
      "nodes": [
        {
          "id": "entry",
          "type": "entry",
          "next": "list_directory_node"
        },
        {
          "id": "list_directory_node",
          "type": "mcp",
          "server": "filesystem",
          "tool": "list_directory",
          "args": {
            "path": "$.entry.directory"
          },
          "next": "count_files_node"
        },
        {
          "id": "count_files_node",
          "type": "transform",
          "transform": {
            "expr": "{ \"count\": $count($split($.list_directory_node.content, \"\\n\")) }"
          },
          "next": "exit"
        },
        {
          "id": "exit",
          "type": "exit"
        }
      ]
    }
  }
}
```

## Best Practices

1. **Use Toolkit Tools Only**: Never create, edit, or modify configuration files directly. Always use the provided toolkit tools for all operations.

2. **Check for Existing Graph Tools First**: Always use `listGraphTools` to check if a graph tool already exists for your purpose before creating a new one. Use `getGraphTool` to examine existing tools.

3. **Discover MCP Servers/Tools Before Building**: Always use `listMcpServers` and `getMcpServerTool` to understand which MCP servers and tools are available to the graph before constructing nodes. Graph tools can only use MCP servers and tools that are available to the graph (as shown by these discovery tools). The toolkit manages MCP server configuration internally - use the discovery tools, never attempt to read or create configuration files.

3. **Test Expressions First**: Use `testJSONata` and `testJSONLogic` to validate expressions before adding them to nodes

4. **Test Tools Inline**: Use `runGraphTool` with `toolDefinition` to test tools before adding them to the graph

5. **Add Tools via Toolkit**: Always use `addGraphTool` to add tools to the graph. Never create or edit configuration files directly - the toolkit handles all file operations internally.

6. **Use Descriptive Node IDs**: Make node IDs clear and meaningful (e.g., `list_directory_node` not `node1`)

7. **Enable Logging for Debugging**: Use `logging: true` in `runGraphTool` to see execution details when debugging

8. **Iterate Incrementally**: Build and test graphs node by node, adding complexity gradually

9. **Validate Schemas**: Ensure `inputSchema` and `outputSchema` match actual data flow

10. **Use History Functions Carefully**: Understand execution context when nodes execute multiple times in loops

## Common Patterns

### Sequential Tool Calls
Chain multiple MCP tool calls in sequence:
```
entry -> mcp_node_1 -> mcp_node_2 -> transform -> exit
```

### Conditional Routing
Use switch nodes to route based on data:
```
entry -> switch_node -> [path_a | path_b] -> exit
```

### Loops
Use switch nodes to loop back to previous nodes:
```
entry -> increment_node -> check_condition -> [increment_node | exit]
```

### Data Transformation
Transform data between nodes using JSONata:
```
entry -> mcp_node -> transform -> mcp_node_2 -> exit
```

## Resources

- **JSONata Documentation**: https://jsonata.org/
- **JSON Logic Documentation**: https://jsonlogic.com/
- **MCP Specification**: https://modelcontextprotocol.io/

