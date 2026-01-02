# Testing mcpGraphToolkit with Claude Code

This directory is a full working preconfigured project for Claude Code with the mcpGraphToolkit skill and MCP server pre-installed and pre-approved. You can run Claude Code in this directory and use mcpGraphToolkit directly.

## Configuration Elements

`.claude/skills/mcpgraph-toolkit/SKILL.md` - The mcpGraphToolkit skill, pre-installed into this Claude Code project

`.claude/settings.local.json` - Claude code settings with the mcpGraphToolkit skill and MCP server and tools installed and pre-approved

`.mpc.json` - This is the configuration of MCP tools available to Claude Code (including only mcpgraphtoolkit)

`graph.yaml` - This is the initially empty mcpGraph that the installed toolkit will use

`tools.json` - These are the tools that mcpGraphToolkit will make available to the agent to use for building new graph tools

## Usage

For example, run Claude Code

```bash
claude
```

And then try a prompt like this: 

> Create an mcpGraph tool to download a URL to a local file in the downloads directory of this project and return the filename and size

