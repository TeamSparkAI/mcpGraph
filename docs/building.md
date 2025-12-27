NOTE: This file is design notes only - do not implement anything here unless specifically asked

# Building mcpGraphs

To build an agent graph you need:

Basic knowledge of the mcpGraph file structure
- Assumes understanding of standard MCP data structures: MCP server metadata, tool description, mcpServers config

Understanding of graph structure, flow, nodes, and node types/details
- Including JSONata and JSON logic (both genrally, and as used in various nodes)

All relevant MCP servers and their configurations
- Including all tools provided with tool definitions

Testing tools
- In agent dev of our own examples, used primarily log output (which included error details)
- We have a full runtime harness with debugging, etc, that we could expose if needed

## SKILL.md

We can provide file / data structure defintion and context in a skill

If we provide tooling (add, run, etc), we can describe that in the skill as well (what it is and how to use it)
- It will also be in the tooling tool descriptions

## mcpGraphBuilder

Get all mcp servers and their configurations, and all tools they provide (search, progressive disclosure?)
- To support agents building graphs so they understand what tools they have and can access server config (which they usually couldn't)

Run a graph
- Would structured logging be enough to validate/debug (show each node, with context, output)

Do we want to use this to manage a set of graphs?
- Get tools (find tool)
- Run tool (debugging?  log output, step, etc?)
- Add tool (fully implemented and tested tool, add by yaml file)
- Edit/remove tool?

For add/edit, this implies we can serialize them somehow
- Do we manage a directory of graph files with a shared mcp.json?
  - Assumes we have write access to a directory
- Do we just use a single graph file with mcpServers defined inline and manage all of our tools/graphs in that file?
  - Assumes we have write access to our graph file

If we're managing the tools as a set of graphs under this mcpGraph builder/manager, we're not really using the "server" part of the graph
- Are the name/title/instructions relevant, can we just ignore them and assume the tool description (and contents) will suffice?
- Would we want customizable metadata (esp instructions) for the builder/manager
  - Maybe to distinguish them from each other, focus on set domain/tools available

## Issues

Do we want to expose the mcpServers config to the graphs themselves?

What if we had a master mcpServers (mcp.json) that had all mcpServer configs used by any graph (basically everything the agent has access to)
- Graph builder has access to all servers (without access to their config details)
- Graphs have access to the servers they need (without access to their config details)
  - Pass path to mcp.json as arg
- For config details that are secret, this makes sense, but for others, maybe less so (like a directory path or other kind of scope)

What about MCP servers that require a secret or OAuth (where the agent can talk to the MCP server)
- How can we talk to that MCP server securely without doing an agent tool call (which would defeat our purpose)
- This is where being an agent gateway (especially a "smart" on that is managing tool disclosure/aggregation/etc) would be handy

mcpGraphBuilder
- m / --mcp is path to mcp.json with all tools
- d / --dir is directory where graphs live?

mcpGraph
- -g / --graph specifies the graph configuration file to use
- If -m / --mcp then parse mcpServers from referenced mcp.json file (jsonc support?), add to graph
- If mcpServers provided in graph, add them (overiding any passed-in MCP server with the same name)

Maybe it's one MCP server that requires either --dir ("builder" mode) or --graph ("runner" mode)

