# Contributing to mcpGraph

This document provides information for developers who want to contribute to mcpGraph or work with the source code.

## Setup

1. Clone the repository:
```bash
git clone https://github.com/TeamSparkAI/mcpGraph.git
cd mcpGraph
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Run the project:
```bash
npm start
```

Or run in development mode (with hot reload):
```bash
npm run dev
```

## Running Tests

```bash
npm test
```

### Test Setup

The tests use the filesystem MCP server for integration testing. The filesystem MCP server is installable via npm and can be run with `npx`.

The test directory is located at `tests/files/` and contains various test files used by the `count_files` example.

The filesystem MCP server configuration used in tests is hardcoded in the test files to use:
- Command: `npx`
- Args: `["-y", "@modelcontextprotocol/server-filesystem", "/path/to/tests/files"]`

For more information about the filesystem MCP server, see the [official repository](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem).

## Development

- Source code is in `src/`
- Build output goes to `dist/`
- TypeScript configuration is in `tsconfig.json`
- Example configurations are in `examples/`
- Tests are in `tests/`

## Project Structure

- `src/main.ts` - Main MCP server entry point
- `src/config/` - Configuration loading and validation
- `src/execution/` - Graph execution engine
- `src/graph/` - Graph validation and node registry
- `src/mcp/` - MCP client management
- `src/expressions/` - JSONata and JSON Logic expression evaluation

## Building

The project uses TypeScript and compiles to JavaScript in the `dist/` directory:

```bash
npm run build
```

Watch mode for development:

```bash
npm run watch
```

## Testing

Tests are located in the `tests/` directory and use Node.js's built-in test runner:

```bash
npm test
```

## Documentation

- [Design Document](docs/design.md) - Complete design and architecture
- [Implementation](docs/implementation.md) - Implementation details and architecture

