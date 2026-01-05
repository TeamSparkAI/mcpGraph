NOTE: This file is design notes only - do not implement anything here unless specifically asked

# Building mcpGraphs

## Oveeview

To build an agent graph you need:

What an mpcGraph is, what it does, when and why you should use one

Basic knowledge of the mcpGraph file structure
- Assumes understanding of standard MCP data structures: MCP server metadata, tool description, mcpServers config

Understanding of graph structure, flow, nodes, and node types/details
- Including JSONata and JSON logic (both genrally, and as used in various nodes)

## SKILL.md

Both skill files cover mcpGraph overview material (above)

SKILL.md for
- mcpgraph: focus on mcpGraph MCP server installation/configuration, file / data structure defintion
- mcpgraphtoolkit: focus on how to use mcpgraphtoolkit tools


## Issues

What about MCP servers that require a secret or OAuth (where the agent can talk to the MCP server)
- How can we talk to that MCP server securely without doing an agent tool call (which would defeat our purpose)
- This is where being an agent gateway (especially a "smart" on that is managing tool disclosure/aggregation/etc) would be handy

## Demo

/testClaude is a pre-configured project for Claude Code with mcpgraphtoolkit SKILL and MCP server pre-installed and pre-approvied

### Prompt (two steps):

Create an mcpGraph tool to download a URL to a local file in the downloads directory of this project and return the filename and size

Use that tool to download https://world.hey.com/dhh/pay-yourself-first-e86f8147

### Prompt (one-shot, create and use tool):

Download the text contents of the web page https://world.hey.com/dhh/pay-yourself-first-e86f8147 to a local file, return the filename and size

### DevRel prompt:

What did you struggle with in building that tool and how could the skill.md documentation or the mcpgraphtoolkit tooling be improved to help 

### Demo Video

https://medium.com/@scalablecto/mcpgraph-a-no-code-alternative-to-code-mode-13f2e48cb8f9?source=friends_link&sk=f9350071d295391afba09d7b1003075a