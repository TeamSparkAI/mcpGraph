/**
 * MCP client manager for external MCP servers
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport, type SSEClientTransportOptions } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { logger } from "../logger.js";
import type {
  ServerConfig,
  StdioServerConfig,
  SseServerConfig,
  StreamableHttpServerConfig,
} from "../types/config.js";

export class McpClientManager {
  private clients: Map<string, Client>;

  constructor() {
    this.clients = new Map();
  }

  async getClient(serverName: string, serverConfig: ServerConfig): Promise<Client> {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName)!;
    }

    logger.info(`Creating MCP client for server: ${serverName} (type: ${getServerType(serverConfig)})`);

    const transport = await this.createTransport(serverConfig);

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

  private async createTransport(serverConfig: ServerConfig): Promise<
    StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport
  > {
    // Default to stdio if type is not specified
    const configType = getServerType(serverConfig);

    if (configType === "stdio" || !("type" in serverConfig)) {
      const stdioConfig = serverConfig as StdioServerConfig;
      const transportOptions: {
        command: string;
        args: string[];
        env?: Record<string, string>;
        cwd?: string;
      } = {
        command: stdioConfig.command,
        args: stdioConfig.args,
        env: process.env as Record<string, string>,
      };

      if (stdioConfig.cwd) {
        transportOptions.cwd = stdioConfig.cwd;
      }

      return new StdioClientTransport(transportOptions);
    } else if (configType === "sse") {
      const sseConfig = serverConfig as SseServerConfig;
      const options: SSEClientTransportOptions = {};

      // Merge headers into requestInit if provided
      if (sseConfig.headers || sseConfig.requestInit) {
        const existingRequestInit = (sseConfig.requestInit as RequestInit) || {};
        const existingHeaders = existingRequestInit.headers
          ? new Headers(existingRequestInit.headers)
          : new Headers();
        
        // Add config headers to existing headers
        if (sseConfig.headers) {
          for (const [key, value] of Object.entries(sseConfig.headers)) {
            existingHeaders.set(key, value);
          }
        }

        options.requestInit = {
          ...existingRequestInit,
          headers: existingHeaders,
        } as RequestInit;
      }

      if (sseConfig.eventSourceInit) {
        options.eventSourceInit = sseConfig.eventSourceInit as SSEClientTransportOptions["eventSourceInit"];
      }

      return new SSEClientTransport(new URL(sseConfig.url), options);
    } else if (configType === "streamableHttp") {
      const httpConfig = serverConfig as StreamableHttpServerConfig;
      const options: StreamableHTTPClientTransportOptions = {};

      // Merge headers into requestInit if provided
      if (httpConfig.headers || httpConfig.requestInit) {
        const existingRequestInit = (httpConfig.requestInit as RequestInit) || {};
        const existingHeaders = existingRequestInit.headers
          ? new Headers(existingRequestInit.headers)
          : new Headers();
        
        // Add config headers to existing headers
        if (httpConfig.headers) {
          for (const [key, value] of Object.entries(httpConfig.headers)) {
            existingHeaders.set(key, value);
          }
        }

        options.requestInit = {
          ...existingRequestInit,
          headers: existingHeaders,
        } as RequestInit;
      }

      return new StreamableHTTPClientTransport(new URL(httpConfig.url), options);
    } else {
      throw new Error(`Unsupported server transport type: ${configType}`);
    }
  }
}

function getServerType(serverConfig: ServerConfig): "stdio" | "sse" | "streamableHttp" {
  if (!("type" in serverConfig) || serverConfig.type === undefined || serverConfig.type === "stdio") {
    return "stdio";
  }
  return serverConfig.type;
}

