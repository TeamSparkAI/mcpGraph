#!/usr/bin/env node
/**
 * mcpGraph - MCP server that runs a directed graph of MCP server calls
 */

import { logger } from './logger.js';
import { loadConfig } from './config/loader.js';
import { validateGraph } from './graph/validator.js';
import { GraphExecutor } from './execution/executor.js';
import { McpClientManager } from './mcp/client-manager.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    config: {
      type: 'string',
      short: 'c',
      default: 'config.yaml',
    },
  },
});

async function main() {
  try {
    const configPath = values.config || 'config.yaml';
    logger.info(`Loading configuration from: ${configPath}`);

    const config = loadConfig(configPath);

    const errors = validateGraph(config);
    if (errors.length > 0) {
      logger.error('Graph validation failed:');
      for (const error of errors) {
        logger.error(`  - ${error.message}`);
      }
      process.exit(1);
    }

    logger.info(`Loaded configuration: ${config.server.name} v${config.server.version}`);
    logger.info(`Tools defined: ${config.tools.map(t => t.name).join(', ')}`);

    const clientManager = new McpClientManager();
    const executor = new GraphExecutor(config, clientManager);

    // Initialize MCP server
    const server = new Server(
      {
        name: config.server.name,
        version: config.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register tools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: config.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const tool = config.tools.find(t => t.name === toolName);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      logger.info(`Tool called: ${toolName}`);
      const result = await executor.executeTool(toolName, request.params.arguments || {});
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
        structuredContent: result as Record<string, unknown>,
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
