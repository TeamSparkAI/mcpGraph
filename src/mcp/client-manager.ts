/**
 * MCP client manager for external MCP servers
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";
import { logger } from "../logger.js";

export class McpClientManager {
  private clients: Map<string, Client>;

  constructor() {
    this.clients = new Map();
  }

  async getClient(serverName: string, command: string, args: string[]): Promise<Client> {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName)!;
    }

    logger.info(`Creating MCP client for server: ${serverName}`);

    const transport = new StdioClientTransport({
      command,
      args,
    });

    const client = new Client(
      {
        name: `mcpgraph-${serverName}`,
        version: "0.1.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);

    this.clients.set(serverName, client);

    return client;
  }

  async closeAll(): Promise<void> {
    for (const [name, client] of this.clients.entries()) {
      logger.info(`Closing MCP client: ${name}`);
      await client.close();
    }
    this.clients.clear();
  }
}

