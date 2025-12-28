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
  private stderrBuffers: Map<string, string[]>;

  constructor() {
    this.clients = new Map();
    this.stderrBuffers = new Map();
  }

  async getClient(serverName: string, serverConfig: ServerConfig): Promise<Client> {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName)!;
    }

    logger.info(`Creating MCP client for server: ${serverName} (type: ${getServerType(serverConfig)})`);

    // Create transport and set up stderr capture
    const { transport, stderrBuffer } = await this.createTransport(serverConfig);

    // Store stderr buffer by server name (available even if connection fails)
    this.stderrBuffers.set(serverName, stderrBuffer);

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
    this.stderrBuffers.clear();
  }

  /**
   * Get captured stderr output for a server
   * @param serverName - The server name
   * @returns Array of stderr lines, or empty array if none
   */
  getStderr(serverName: string): string[] {
    return this.stderrBuffers.get(serverName) || [];
  }

  /**
   * Clear stderr buffer for a server (typically before a call to prepare for fresh output)
   * 
   * Note: We mutate the existing array (buffer.length = 0) rather than replacing it
   * because the transport's stderr event handler has a closure reference to the original
   * array. If we replace the array in the Map, writes would continue going to the old array.
   * 
   * @param serverName - The server name
   */
  clearStderr(serverName: string): void {
    const buffer = this.stderrBuffers.get(serverName);
    if (buffer) {
      buffer.length = 0;
    }
  }

  private async createTransport(serverConfig: ServerConfig): Promise<{
    transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
    stderrBuffer: string[];
  }> {
    // Default to stdio if type is not specified
    const configType = getServerType(serverConfig);

    if (configType === "stdio" || !("type" in serverConfig)) {
      const stdioConfig = serverConfig as StdioServerConfig;
      const transportOptions: {
        command: string;
        args: string[];
        env?: Record<string, string>;
        cwd?: string;
        stderr?: 'pipe';
      } = {
        command: stdioConfig.command,
        args: stdioConfig.args,
        env: process.env as Record<string, string>,
        stderr: 'pipe',
      };

      if (stdioConfig.cwd) {
        transportOptions.cwd = stdioConfig.cwd;
      }

      const transport = new StdioClientTransport(transportOptions);
      
      // Create stderr buffer for this transport
      const stderrBuffer: string[] = [];
      
      // Capture stderr output
      if (transport.stderr) {
        transport.stderr.on('data', (data: Buffer) => {
          const logEntry = data.toString().trim();
          if (logEntry) {
            stderrBuffer.push(logEntry);
          }
        });
      }
      
      return { transport, stderrBuffer };
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

      return { transport: new SSEClientTransport(new URL(sseConfig.url), options), stderrBuffer: [] };
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

      return { transport: new StreamableHTTPClientTransport(new URL(httpConfig.url), options), stderrBuffer: [] };
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

