#!/usr/bin/env node
/**
 * mcpGraph - MCP server that runs a directed graph of MCP server calls
 */

import { logger } from './logger.js';
import { McpGraphApi } from './api.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { parseArgs } from 'node:util';
import { loadMcpServers } from './config/mcp-loader.js';
import type { ServerConfig } from './types/config.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Get version from package.json
let version = 'unknown';
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  version = packageJson.version;
} catch (error) {
  // Fallback: try reading from project root
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version;
  } catch {
    // If both fail, version remains 'unknown'
  }
}

const { values } = parseArgs({
  options: {
    graph: {
      type: 'string',
      short: 'g',
      default: 'config.yaml',
    },
    mcp: {
      type: 'string',
      short: 'm',
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
    version: {
      type: 'boolean',
      short: 'v',
    },
  },
});

// Handle help and version flags
if (values.version) {
  console.log(version);
  process.exit(0);
}

if (values.help) {
  console.log(`mcpGraph v${version}
  
MCP server that executes directed graphs of MCP server calls.

Usage: mcpgraph [options]

Options:
  -g, --graph <path>    Path to graph configuration file (default: config.yaml)
  -m, --mcp <path>      Path to MCP servers configuration file
  -h, --help            Show this help message
  -v, --version         Show version number

Examples:
  mcpgraph -g ./my-graph.yaml
  mcpgraph -g ./my-graph.yaml -m ./mcp.json
`);
  process.exit(0);
}

async function main() {
  try {
    const configPath = values.graph || 'config.yaml';
    
    // Load mcpServers from MCP JSON file if provided
    let mcpServersFromFile: Record<string, ServerConfig> | undefined;
    if (values.mcp) {
      try {
        mcpServersFromFile = loadMcpServers(values.mcp);
      } catch (error) {
        logger.error(`Failed to load MCP file: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
    
    // Create API instance (loads and validates config, merging mcpServers)
    const api = new McpGraphApi(configPath, mcpServersFromFile);
    const serverInfo = api.getServerInfo();

    // Initialize MCP server
    const server = new Server(
      {
        name: serverInfo.name,
        version: serverInfo.version,
        title: serverInfo.title, // Optional title (defaults to name if not provided)
      },
      {
        capabilities: {
          tools: {},
        },
        instructions: serverInfo.instructions, // Set instructions if provided
      }
    );

    // Register tools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: api.listTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      
      logger.info(`Tool called: ${toolName}`);
      const { promise } = api.executeTool(toolName, request.params.arguments || {});
      const executionResult = await promise;
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(executionResult.result),
          },
        ],
        structuredContent: executionResult.structuredContent,
      };
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('mcpGraph MCP server running on stdio');
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    logger.error(error.stack);
  }
  process.exit(1);
});
