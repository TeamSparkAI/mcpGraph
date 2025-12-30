#!/usr/bin/env node
/**
 * mcpGraphToolkit - MCP server for building, testing, and running mcpGraph tools
 */

import { logger } from './logger.js';
import { McpGraphApi } from './api.js';
import { ToolkitApi } from './toolkit/api.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { parseArgs } from 'node:util';
import { loadMcpServers } from './config/mcp-loader.js';
import type { ServerConfig } from './types/config.js';

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
  },
});

let toolkitApi: ToolkitApi | null = null;

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
    toolkitApi = new ToolkitApi(api, values.mcp || null);

    // Initialize MCP server
    const server = new Server(
      {
        name: 'mcpgraphtoolkit',
        version: '1.0.0',
        title: 'mcpGraph Toolkit',
      },
      {
        capabilities: {
          tools: {},
        },
        instructions: 'Tools for building, testing, and running mcpGraph tools',
      }
    );

    // Register tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = toolkitApi!.listTools().map(tool => {
        const mapped = {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        };
        // Log if outputSchema is undefined or invalid
        if (tool.outputSchema === undefined) {
          logger.warn(`Tool ${tool.name} has undefined outputSchema`);
        }
        return mapped;
      });
      logger.debug(`Returning ${tools.length} tools from listTools`);
      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      
      logger.info(`Toolkit tool called: ${toolName}`);
      try {
        const result = await toolkitApi!.callTool(toolName, request.params.arguments || {});
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        // Convert errors to MCP error responses
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(-32603, errorMessage, error);
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('mcpGraphToolkit MCP server running on stdio');

    // Handle cleanup on process termination
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      if (toolkitApi) {
        await toolkitApi.close();
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      if (toolkitApi) {
        await toolkitApi.close();
      }
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(async (error) => {
  logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    logger.error(error.stack);
  }
  process.exit(1);
});

