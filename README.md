# mcpGraph

MCP server that runs a directed graph of MCP server calls.

## Overview

An MCP server that surfaces tools, where those tools implement a directed graph of MCP server calls. 

The system enables filtering and reformatting data between nodes, makes routing decisions based on node
output, and maintains a declarative, observable configuration without embedding a full programming language.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run the project:
```bash
npm start
```

Or run in development mode (with hot reload):
```bash
npm run dev
```

## Development

- Source code is in `src/`
- Build output goes to `dist/`
- TypeScript configuration is in `tsconfig.json`

## Design

See [docs/design.md](docs/design.md) for the project design document.
