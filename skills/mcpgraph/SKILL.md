---
name: mcpgraph
description: Build no-code MCP servers with tools that compose and orchestrate other MCP tools, with data transformation and conditional logic.
version: 1.0.0
---

# Building mcpGraphs

This skill teaches you how to build mcpGraph configurations - declarative YAML files that define MCP tools as directed graphs of nodes.

## What is an mcpGraph?

An **mcpGraph** is a declarative YAML configuration file that defines MCP (Model Context Protocol) tools as directed graphs. Each tool executes a sequence of nodes that can:
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
- **Declarative**: All logic expressed in YAML using standard expression languages
- **Observable**: Every transformation and decision is traceable
- **No Embedded Code**: Uses JSONata and JSON Logic instead of full programming languages
- **Standard-Based**: Built on MCP, JSONata, and JSON Logic standards
- **Composable**: Build complex tools from simpler MCP tools

## How to Use mcpGraph

This skill assumes mcpGraph is installed in your local environment and available as the `mcpgraph` command.

To use mcpGraph as an MCP server (e.g., in Claude Desktop), add it to your MCP client configuration:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "mcpgraph": {
      "command": "mcpgraph",
      "args": ["-g", "/path/to/your/config.yaml"]
    }
  }
}
```

The `-g` (or `--graph`) flag specifies the path to your YAML configuration file.

## File Structure

An mcpGraph configuration file is a YAML file with the following structure:

```yaml
version: "1.0"

# MCP Server Metadata
server:
  name: "serverName"          # Required: unique identifier
  version: "1.0.0"            # Required: server version
  title: "Display Name"       # Optional: display name (defaults to name)
  instructions: "..."         # Optional: server usage instructions

# MCP Servers used by the graph
mcpServers:
  serverName:
    command: "command"         # For stdio servers
    args: ["arg1", "arg2"]    # Command arguments
  # OR for HTTP servers:
  # httpServer:
  #   type: "streamableHttp"
  #   url: "https://api.example.com/mcp"
  #   headers:
  #     Authorization: "Bearer token"

# Tool Definitions for tools implemented by this graph and available as part of this MCP server
tools:
  - name: "toolName"
    description: "Tool description"
    inputSchema:
      type: "object"
      properties:
        paramName:
          type: "string"
          description: "Parameter description"
      required:
        - paramName
    outputSchema:
      type: "object"
      properties:
        result:
          type: "string"
          description: "Result description"
    nodes:
      # Node definitions here
```

### MCP Server Metadata

The `server` section defines metadata for the MCP server that will expose these tools:
- **`name`** (required): Unique identifier for the server
- **`version`** (required): Server version (semantic versioning)
- **`title`** (optional): Display name (defaults to `name` if not provided)
- **`instructions`** (optional): Instructions for using this server

### MCP Servers

The `mcpServers` section defines the MCP servers that the graph will call. Each server can be:
- **stdio server**: Uses `command` and `args` to run a command-line program
- **streamableHttp server**: Uses `type: "streamableHttp"`, `url`, and optional `headers`

### Tools

The `tools` array defines the MCP tools exposed by this server. Each tool has:
- **`name`**: Tool identifier
- **`description`**: Tool description
- **`inputSchema`**: JSON Schema defining input parameters (standard MCP tool schema)
- **`outputSchema`**: JSON Schema defining output structure
- **`nodes`**: Array of node definitions that form the execution graph

## Graph Structure and Flow

A graph is a directed sequence of nodes that execute in order. Execution flow:
1. Starts at the **entry** node (receives tool arguments)
2. Executes nodes sequentially based on `next` fields
3. **switch** nodes can conditionally route to different nodes
4. Continues until the **exit** node is reached
5. Exit node returns the final result

### Node Connections

Nodes are connected using the `next` field, which specifies the ID of the next node to execute:
```yaml
- id: "node1"
  type: "transform"
  next: "node2"  # Executes node2 after node1
```

**Switch nodes** use `conditions` with `next` fields (each condition specifies its own `next` node), plus a top-level `next` field as the default:
```yaml
- id: "switch_node"
  type: "switch"
  conditions:
    - rule: { ">": [{ var: "entry.value" }, 10] }
      next: "high_path"
  next: "default_path"  # Default case if no conditions match
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
```yaml
- id: "entry"
  type: "entry"
  next: "process_node"
```

### MCP Node

Calls an MCP tool on an internal or external MCP server.

**Properties:**
- `id`: Node identifier
- `type`: `"mcp"`
- `server`: Name of the MCP server (from `mcpServers` section)
- `tool`: Name of the tool to call on that server
- `args`: Arguments to pass to the tool (can use JSONata expressions)
- `next`: ID of the next node to execute

**Output:** The MCP tool's response (parsed from the tool's content)

**Example:**
```yaml
- id: "list_directory_node"
  type: "mcp"
  server: "filesystem"
  tool: "list_directory"
  args:
    path:
      expr: "$.entry.directory"  # JSONata expression accessing entry node output
  next: "count_files_node"
```

### Transform Node

Applies JSONata expressions to transform data between nodes.

**Properties:**
- `id`: Node identifier
- `type`: `"transform"`
- `transform.expr`: JSONata expression (string)
- `next`: ID of the next node to execute

**Output:** The result of evaluating the JSONata expression

**Expression Format:**
- Use **single-quoted strings** for simple expressions: `expr: '{ "result": "value" }'`
- Use **block scalars** (`|`) for complex multi-line expressions to improve readability

**Example (simple):**
```yaml
- id: "count_files_node"
  type: "transform"
  transform:
    expr: '{ "count": $count($split($.list_directory_node.content, "\n")) }'
  next: "exit"
```

**Example (complex):**
```yaml
- id: "increment_node"
  type: "transform"
  transform:
    expr: |
      $executionCount("increment_node") = 0
        ? { "counter": 1, "sum": 1, "target": $.entry_sum.n }
        : { "counter": $nodeExecution("increment_node", -1).counter + 1, ... }
  next: "check_condition"
```

### Switch Node

Uses JSON Logic to conditionally route to different nodes based on data.

**Properties:**
- `id`: Node identifier
- `type`: `"switch"`
- `conditions`: Array of condition rules
  - `rule`: JSON Logic expression (required - all conditions must have rules)
  - `next`: ID of the node to route to if this condition matches
- `next`: ID of the default next node (used if no conditions match)

**Output:** The node ID of the next node that was routed to (string)

**Important:** `var` operations in JSON Logic rules are evaluated using JSONata, allowing full JSONata expression support (including history functions).

**Example:**
```yaml
- id: "switch_node"
  type: "switch"
  conditions:
    - rule:
        ">": [{ var: "entry.value" }, 10]
      next: "high_path"
    - rule:
        ">": [{ var: "entry.value" }, 0]
      next: "low_path"
  next: "zero_path"  # Default case if no conditions match
```

**Advanced Example with JSONata:**
```yaml
- id: "check_condition"
  type: "switch"
  conditions:
    - rule:
        "<": [
          { var: "$.increment_node.counter" },
          { var: "$.increment_node.target" }
        ]
      next: "increment_node"  # Loop back
  next: "exit_sum"  # Default: exit loop when counter >= target
```

### Exit Node

Exit point that returns the final result to the MCP tool caller.

**Properties:**
- `id`: Node identifier (typically "exit")
- `type`: `"exit"`
- **Note:** No `next` field - execution ends here

**Output:** The output from the previous node in the execution history

**Example:**
```yaml
- id: "exit"
  type: "exit"
```

## JSONata Expressions

JSONata is used in three places in mcpGraph for data transformation and access:
1. **Transform node expressions** - Transform data between nodes
2. **JSON Logic `var` operations** - Access context data in switch node conditions
3. **MCP tool node arguments** - Objects with `{ "expr": "..." }` are evaluated as JSONata expressions (recursively)

### Basic Syntax

- **Object construction**: `{ "key": value }`
- **Property access**: `$.node_id.property`
- **Functions**: `$count(array)`, `$split(string, delimiter)`, etc.
- **Conditional**: `condition ? trueValue : falseValue`

### Where JSONata is Used

**1. Transform Nodes:**
Transform nodes use JSONata expressions in the `transform.expr` field to transform data:
```yaml
transform:
  expr: '{ "count": $count($split($.list_directory_node.content, "\n")) }'
```

**2. MCP Tool Node Arguments:**
To use a JSONata expression in an MCP node argument, wrap it in an object with an `expr` property:
```yaml
args:
  path:
    expr: "$.entry.directory"  # JSONata expression accessing entry node output
  static: "literal/path"  # Literal value (not evaluated)
  count:
    expr: "$count($.previous_node.items)"  # JSONata expression with function
```

**Complex nested args:**
```yaml
args:
  path:
    expr: "'downloads/' & $.entry.filename"  # String concatenation
  options:
    recursive: true  # Literal value
    filter:
      expr: "$.entry.filterPattern"  # Nested expression
```

**Important:**
- Objects with only an `expr` property are evaluated as JSONata
- Objects with `expr` and other properties are invalid (error)
- All other values (strings, numbers, arrays, objects without `expr`) are passed as literals
- Arrays and objects are recursively evaluated

**3. JSON Logic `var` Operations:**
In switch node conditions, `var` operations are evaluated using JSONata:
```yaml
rule:
  ">": [{ var: "$.increment_node.counter" }, 10]
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
```yaml
transform:
  expr: |
    $executionCount("increment_node") = 0
      ? { "counter": 1, "sum": 1, "target": $.entry_sum.n }
      : {
          "counter": $nodeExecution("increment_node", -1).counter + 1,
          "sum": $nodeExecution("increment_node", -1).sum + $nodeExecution("increment_node", -1).counter + 1,
          "target": $.entry_sum.n
        }
```

### Expression Format in YAML

- **Simple expressions**: Use single-quoted strings
  ```yaml
  expr: '{ "count": $count($split($.list_directory_node.content, "\n")) }'
  ```

- **Complex expressions**: Use block scalars (`|`) for readability
  ```yaml
  expr: |
    $executionCount("increment_node") = 0
      ? { "counter": 1 }
      : { "counter": $nodeExecution("increment_node", -1).counter + 1 }
  ```

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
```yaml
rule:
  ">": [{ var: "entry.value" }, 10]
```

**Complex condition:**
```yaml
rule:
  and:
    - ">": [{ var: "entry.price" }, 100]
    - "==": [{ var: "entry.status" }, "active"]
```

**With JSONata:**
```yaml
rule:
  "<": [
    { var: "$.increment_node.counter" },
    { var: "$.increment_node.target" }
  ]
```

## Complete Example

Here's a complete example that counts files in a directory:

```yaml
version: "1.0"

server:
  name: "fileUtils"
  version: "1.0.0"
  title: "File utilities"
  instructions: "This server provides file utility tools for counting files and calculating total file sizes in directories."

mcpServers:
  filesystem:
    command: "npx"
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "./tests/counting"

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
          path:
            expr: "$.entry.directory"
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

## Best Practices

1. **Use descriptive node IDs**: Make node IDs clear and meaningful (e.g., `list_directory_node` not `node1`)
2. **Format complex expressions**: Use block scalars (`|`) for multi-line JSONata expressions
3. **Document with comments**: Add YAML comments to explain complex logic
4. **Validate schemas**: Ensure `inputSchema` and `outputSchema` match actual data flow
5. **Test incrementally**: Build and test graphs node by node
6. **Use history functions carefully**: Understand execution context when nodes execute multiple times

## Common Patterns

### Sequential Tool Calls
Chain multiple MCP tool calls in sequence:
```yaml
entry -> mcp_node_1 -> mcp_node_2 -> transform -> exit
```

### Conditional Routing
Use switch nodes to route based on data:
```yaml
entry -> switch_node -> [path_a | path_b] -> exit
```

### Loops
Use switch nodes to loop back to previous nodes:
```yaml
entry -> increment_node -> check_condition -> [increment_node | exit]
```

### Data Transformation
Transform data between nodes using JSONata:
```yaml
mcp_node -> transform -> next_node
```

## Resources

- **JSONata Documentation**: https://jsonata.org/
- **JSON Logic Documentation**: https://jsonlogic.com/

