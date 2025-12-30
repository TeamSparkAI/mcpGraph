---
name: mcpGraphToolkit
description: Build, test, and manage mcpGraph tools using the mcpGraphToolkit MCP server. Discover MCP servers and tools, construct graph nodes with JSONata and JSON Logic, and interact with mcpGraph configurations.
version: 1.0.0
---

# Building mcpGraph Tools with mcpGraphToolkit

This skill teaches you how to use mcpGraphToolkit to build, test, and manage mcpGraph tools. mcpGraphToolkit is an MCP server that provides tools for discovering MCP servers, constructing graph nodes, testing expressions, and managing tool definitions.

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

## How to Use mcpGraphToolkit

mcpGraphToolkit is an MCP server that provides tools for building and managing mcpGraph configurations. To use it, add it to your MCP client configuration:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

The `-g` (or `--graph`) flag specifies the path to your graph YAML configuration file. The `-m` (or `--mcp`) flag specifies the path to an MCP JSON file containing MCP server definitions for discovery.

## mcpGraphToolkit Tools

mcpGraphToolkit provides 11 tools organized into categories:

### Graph Discovery Tools
- **`getGraphServer`**: Get full details of the mcpGraph server metadata (name, version, title, instructions)
- **`listGraphTools`**: List all exported tools from the mcpGraph (name and description)
- **`getGraphTool`**: Get full detail of an exported tool from the mcpGraph (including complete node definitions)

### MCP Server Discovery Tools
- **`listMcpServers`**: List all available MCP servers (name, title, instructions, version)
- **`listMcpServerTools`**: List tools from MCP servers (name/description only), optionally filtered by MCP server name
- **`getMcpServerTool`**: Get full MCP server tool details (including input and output schemas)

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

Calls an MCP tool on an internal or external MCP server.

**Properties:**
- `id`: Node identifier
- `type`: `"mcp"`
- `server`: Name of the MCP server (must be available in the graph's MCP server configuration)
- `tool`: Name of the tool to call on that server
- `args`: Arguments to pass to the tool (can use JSONata expressions)
- `next`: ID of the next node to execute

**Output:** The MCP tool's response (parsed from the tool's content)

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
1. Use `listMcpServers` to discover available MCP servers
2. Use `listMcpServerTools` to see tools available on a server
3. Use `getMcpServerTool` to get full tool details including input/output schemas
4. Use the server name and tool name in your MCP node

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

1. **Discover Available MCP Servers and Tools**
   - Use `listMcpServers` to see available MCP servers
   - Use `listMcpServerTools` to see tools on a server
   - Use `getMcpServerTool` to get full tool details (input/output schemas)

2. **Test Expressions**
   - Use `testJSONata` to test transform expressions
   - Use `testJSONLogic` to test switch conditions
   - Iterate until expressions work correctly

3. **Build Tool Definition**
   - Construct nodes using discovered MCP servers and tools
   - Use tested expressions in transform and switch nodes
   - Define entry and exit nodes
   - Specify input and output schemas

4. **Test Tool Before Adding**
   - Use `runGraphTool` with `toolDefinition` to test the tool inline
   - Optionally enable `logging: true` to see execution details
   - Verify the tool works correctly

5. **Add Tool to Graph**
   - Use `addGraphTool` to add the tested tool to the graph
   - The tool is saved to the graph file automatically

6. **Update or Delete Tools**
   - Use `updateGraphTool` to modify existing tools
   - Use `deleteGraphTool` to remove tools
   - Changes are saved automatically

### Example: Building a File Counter Tool

**Step 1: Discover MCP Servers**
```json
{
  "tool": "listMcpServers",
  "arguments": {}
}
```

**Step 2: Discover Tools on Filesystem Server**
```json
{
  "tool": "listMcpServerTools",
  "arguments": {
    "serverName": "filesystem"
  }
}
```

**Step 3: Get Tool Details**
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

1. **Discover Before Building**: Always use `listMcpServers` and `getMcpServerTool` to understand available MCP servers and tools before constructing nodes

2. **Test Expressions First**: Use `testJSONata` and `testJSONLogic` to validate expressions before adding them to nodes

3. **Test Tools Inline**: Use `runGraphTool` with `toolDefinition` to test tools before adding them to the graph

4. **Use Descriptive Node IDs**: Make node IDs clear and meaningful (e.g., `list_directory_node` not `node1`)

5. **Enable Logging for Debugging**: Use `logging: true` in `runGraphTool` to see execution details when debugging

6. **Iterate Incrementally**: Build and test graphs node by node, adding complexity gradually

7. **Validate Schemas**: Ensure `inputSchema` and `outputSchema` match actual data flow

8. **Use History Functions Carefully**: Understand execution context when nodes execute multiple times in loops

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

