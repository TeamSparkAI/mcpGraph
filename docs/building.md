NOTE: This file is design notes only - do not implement anything here unless specifically asked

# Building mcpGraphs

To build an agent graph you need:

What an mpcGraph is, what it does, when and why you should use one

Basic knowledge of the mcpGraph file structure
- Assumes understanding of standard MCP data structures: MCP server metadata, tool description, mcpServers config

Understanding of graph structure, flow, nodes, and node types/details
- Including JSONata and JSON logic (both genrally, and as used in various nodes)

## SKILL.md

We can provide file / data structure defintion and context in a skill

Probably the main skill will have all of the overview and format stuff
- It can reference detailed documentation of JSONata and JSON Logic in separate files in the skill that we reference from the main skill

Later: If we provide tooling (mcpGraphBuilder), we can describe that in the skill as well (what it is and how to use it)
- This information will also be in the mcpGraphBuidler tooling server instructions and tool descriptions

## Tooling

Run, manage, and build mcpGraphs - Is this one program with multiple modes, or multiple programs?

### mcpGraph

Graph runner - exposes mcpGraph server as MCP server where each tool runs a graph

- -g / --graph specifies the graph configuration file to use
- -m / --mcp if provided, parse mcpServers from referenced mcp.json file (jsonc support?), add to graph
  - If mcpServers provided in graph, add them (overiding any passed-in MCP server with the same name)

### mcpGraphToolkit

mcpGraphToolkit is a set of tools for building, testing, and running mcpGraph tools specified in a single mcpGraph server (file)

Will have it's own corresponding skill (separate from mcpGraph)

Same params as mcpGraph (-m/--mcp, -g/-graph)
- Future: If graph file doesn't exist, create it from template?

Setup:
- Create (or reference existing) mcp.json
- Create mcpgraph.yaml file (can use generic template, doesn't need any mcpServers or tools, just "server" block)
- Install mcpGraphToolkit as MCP server in agent pointing to mcp and graph files

Use case:
- Agent can discover existing tools and call them
- Agent can create new tools (with support for testing)
- Agent can manage tools in the mcpGraph (add/update/delete)

Tools:
- getGraphServer - return full details of mcpGraph server
- listMcpServers - return list of available mcpServer servers (name, title, instructions, version)
- listMcpServerTools - return list of tools (name/description only), optionally filtered by MCP server name
- getMcpServerTool - return full MCP server tool details (including input and output)
- listGraphTools - return a list of exported tools from the mcpGraph (name, description)
- getGraphTool - return full detail of an exported tool from the mcpGraph
- addGraphTool, updateGraphTool, deleteGraphTool - crud for exported mcpGraph tools
- runGraphTool - run an exported tool from the mcpGraph
  - can specify existing tool name, or run a tool definition supplied in payload
  - input includes tool input (arbitrary JSON)
  - output inclides tool result payload (or error)
  - can specify logging, in which case logging will also be returned with payload
  - Future: optionally return detailed results (execution history, node-level)
  - Future: runtime debugging - step through graph, etc?
- testJSONata - test a JSONata expression
  - provide context object, JSONata string, returns result object or error)
  - Future: validate-only mode?
- testJSONLogic - test a JSON Logic expression
  - provide context object, JSON Logic object, return result or error)
  - Future: validate-only mode?


### mcpGraphManager

Manage a collection of graphs / graph tools

- m / --mcp is path to mcp.json with all tools
- d / --dir is directory where graphs live (assumes we have read or read/write access - write tools only available if write access?)
  - Would we want a mode where we pass a single -g / --graph and only expose tools relevant a single graph server, and also whether we have write access to it?

Manage a set of graphs and their tools
- list graph servers, list tools, list tools by graph server
- find graph server/tool
- list by graph server/tool name/description, get graph server / tool for details?
- add/edit/delete graph server
- add/edit/delete graph server tool?
- run graph server tool (basic running, no debugging, just results as when running as MCP server)
- tool names will be graph server.name + "__" + tool.name (so we can dereference on run tool)

## Issues

What about MCP servers that require a secret or OAuth (where the agent can talk to the MCP server)
- How can we talk to that MCP server securely without doing an agent tool call (which would defeat our purpose)
- This is where being an agent gateway (especially a "smart" on that is managing tool disclosure/aggregation/etc) would be handy

## Demo

New project for Claude Code - toolkitTest

graph.yaml - empty graph

```yaml
version: "1.0"

# MCP Server Metadata
server:
  name: "utils"
  version: "1.0.0"
  title: "Utility tools implemented as mcpGraphs"
  instructions: "This server provides file utility tools created by this agent - always use these tools first when applicable."
```

tools.json - mcpServers for mcpGrahToolkit to use

```json
{
  "mcpServers": {
    "fetch": {
      "type": "stdio",
      "command": "uvx",
      "args": [
        "-q",
        "mcp-server-fetch"
      ]
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/bob/Documents/GitHub/teamspark-workbench/test_files"
      ]
    }
  }
}
```

.mcp.json - Claude Code project level MCP config

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


Install mcpgraph globally, verify it's installed
Install mcpGraphToolkit SKILL.md in agent
- /.claude/
Verify: No fetch or filesystem tool installed in agent
Install mcpGraphToolkit in agent
- place agent.yaml and mcp.json where installed mcpGraphToolkit can see them
- install
Prompt to create new tool

Prompt (two steps):

Create an mcpGraph tool to download a URL to a local file in the downloads directory of this project and return the filename and size

Use that tool to download https://world.hey.com/dhh/pay-yourself-first-e86f8147

Prompt (one-shot, create and use tool):

Download the text contents of the web page https://world.hey.com/dhh/pay-yourself-first-e86f8147 to a local file, return the filename and size

DevRel prompt:

What did you struggle with in building that tool and how could the skill.md documentation or the mcpgraphtoolkit tooling be improved to help 

NOTES:

First pass had a "graph/node" structure, no input node, malformed graph/output node, dependsOn elements - basically crazytown, second pass was correct
- Agent detected error and rebuilt it correctly, so that's good

Check relative path support in .mcp.json mcpgraphtoolkit config

Test Claude-generated graph in UX (debug, validate)

Move entire test Claude project into mcpGraph repo?
- Might only make sense of relative paths worked
