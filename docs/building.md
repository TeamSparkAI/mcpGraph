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
- It can reference detailed documentation of JSONata and JSON Logic in separate files in the skill

If we provide tooling (mcpGraphBuilder), we can describe that in the skill as well (what it is and how to use it)
- This information will also be in the mcpGraphBuidler tooling server instructions and tool descriptions

## Tooling

Run, manage, and build mcpGraphs - Is this one program with multiple modes, or multiple programs?

### mcpGraph

Graph runner - exposes mcpGraph server as MCP server where each tool runs a graph

- -g / --graph specifies the graph configuration file to use
- -m / --mcp if provided, parse mcpServers from referenced mcp.json file (jsonc support?), add to graph
  - If mcpServers provided in graph, add them (overiding any passed-in MCP server with the same name)

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

### mcpGraphBuilder

Tools to construct an mcpGraph

- m / --mcp is path to mcp.json with all tools
- d / --dir is directory where graphs live?

Provide access to MCP servers and their tools
- list MCP servers, list tools, list tools for server (summary)
- find server/tool (summary)
- get server, get tool (full details)
- call tool (for testing)

Validation
- Run mcpGraph tool (implies loading from file)
  - Provide detailed error reporting (loading/runtime), logging, and final result
    - Would structured logging be enough to validate/debug (show each node, with context, output)
  - We have a full runtime harness with debugging, etc, that we could expose if needed
    - Step through nodes might be useful?
- Test JSONata - the ability to quickly test a JSONata expression with high quality feedback (specific errors, suggestions?)
  - Maybe a validate and a test mode?
  - This seems to be where agents struggle in creating graphs, though good SKILL.md might help significantly there
- Test JSON Logic (provide input context, JSON Logic) with high quality feedback (and results)
  - Validate and test mode (same as JSONata)?

## Issues

What about MCP servers that require a secret or OAuth (where the agent can talk to the MCP server)
- How can we talk to that MCP server securely without doing an agent tool call (which would defeat our purpose)
- This is where being an agent gateway (especially a "smart" on that is managing tool disclosure/aggregation/etc) would be handy
