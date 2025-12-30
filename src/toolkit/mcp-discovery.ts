/**
 * MCP Server Discovery for toolkit
 * 
 * Provides functionality to discover and introspect MCP servers and their tools
 */

import { loadMcpServers } from '../config/mcp-loader.js';
import { McpClientManager } from '../mcp/client-manager.js';
import type { ServerConfig } from '../types/config.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { logger } from '../logger.js';

export interface McpServerInfo {
  name: string;
  title?: string;
  instructions?: string;
  version?: string;
}

export interface McpToolInfo {
  name: string;
  description: string;
  server: string;
}

export interface McpToolDetails {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export class McpDiscovery {
  private mcpFilePath: string | null;
  private clientManager: McpClientManager;
  private serverConfigs: Record<string, ServerConfig> = {};
  private clients: Map<string, Client> = new Map();

  constructor(mcpFilePath: string | null) {
    this.mcpFilePath = mcpFilePath;
    this.clientManager = new McpClientManager();
  }

  /**
   * Load MCP servers from mcp.json file
   */
  async loadServers(): Promise<void> {
    if (!this.mcpFilePath) {
      return;
    }

    try {
      this.serverConfigs = loadMcpServers(this.mcpFilePath) || {};
    } catch (error) {
      logger.error(`Failed to load MCP servers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * List all available MCP servers
   */
  async listServers(): Promise<McpServerInfo[]> {
    await this.loadServers();
    
    const servers: McpServerInfo[] = [];
    
    for (const [serverName, serverConfig] of Object.entries(this.serverConfigs)) {
      try {
        const client = await this.getClient(serverName, serverConfig);
        const serverVersion = client.getServerVersion();
        
        servers.push({
          name: serverName,
          title: serverVersion?.title,
          instructions: client.getInstructions(),
          version: serverVersion?.version,
        });
      } catch (error) {
        logger.warn(`Failed to get info for server "${serverName}": ${error instanceof Error ? error.message : String(error)}`);
        // Still include server even if we can't get full info
        servers.push({
          name: serverName,
        });
      }
    }
    
    return servers;
  }

  /**
   * List tools from MCP servers
   */
  async listTools(serverName?: string): Promise<McpToolInfo[]> {
    await this.loadServers();
    
    const tools: McpToolInfo[] = [];
    const serversToQuery = serverName 
      ? (this.serverConfigs[serverName] ? [serverName] : [])
      : Object.keys(this.serverConfigs);
    
    for (const name of serversToQuery) {
      const serverConfig = this.serverConfigs[name];
      try {
        const client = await this.getClient(name, serverConfig);
        const toolsResult = await client.listTools();
        
        if (toolsResult.tools) {
          for (const tool of toolsResult.tools) {
            tools.push({
              name: tool.name,
              description: tool.description || '',
              server: name,
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to list tools for server "${name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return tools;
  }

  /**
   * Get full details of an MCP server tool
   */
  async getTool(serverName: string, toolName: string): Promise<McpToolDetails> {
    await this.loadServers();
    
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server "${serverName}" not found`);
    }
    
    const client = await this.getClient(serverName, serverConfig);
    const toolsResult = await client.listTools();
    
    const tool = toolsResult.tools?.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found in server "${serverName}"`);
    }
    
    return {
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema as Record<string, unknown>,
      outputSchema: tool.outputSchema as Record<string, unknown>,
    };
  }

  /**
   * Get or create MCP client for a server
   */
  private async getClient(serverName: string, serverConfig: ServerConfig): Promise<Client> {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName)!;
    }

    // Use clientManager to get or create client
    const client = await this.clientManager.getClient(serverName, serverConfig);
    this.clients.set(serverName, client);
    
    return client;
  }

  /**
   * Clean up all clients
   */
  async close(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.close();
      } catch (error) {
        logger.warn(`Error closing client: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this.clients.clear();
    await this.clientManager.closeAll();
  }
}

