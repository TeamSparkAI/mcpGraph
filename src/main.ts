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
    
    // Create API instance (loads and validates config)
    const api = new McpGraphApi(configPath);
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
