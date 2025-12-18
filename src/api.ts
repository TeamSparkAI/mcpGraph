/**
 * Programmatic API for mcpGraph
 * 
 * This API can be used by:
 * - MCP server (main.ts) - for stdio transport
 * - UX applications - for HTTP/WebSocket servers
 * - Other applications - for programmatic graph execution
 */

import { logger } from './logger.js';
import { loadConfig } from './config/loader.js';
import type { McpGraphConfig } from './types/config.js';
import { validateGraph, type ValidationError } from './graph/validator.js';
import { GraphExecutor } from './execution/executor.js';
import { McpClientManager } from './mcp/client-manager.js';

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ExecutionResult {
  result: unknown;
  structuredContent?: Record<string, unknown>;
}

export class McpGraphApi {
  private config: McpGraphConfig;
  private executor: GraphExecutor;
  private clientManager: McpClientManager;

  /**
   * Create a new McpGraphApi instance
   * @param configPath - Path to the YAML configuration file
   * @throws Error if config cannot be loaded or validated
   */
  constructor(configPath: string) {
    logger.info(`Loading configuration from: ${configPath}`);
    
    const config = loadConfig(configPath);
    
    const errors = validateGraph(config);
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join(', ');
      throw new Error(`Graph validation failed: ${errorMessages}`);
    }

    this.config = config;
    this.clientManager = new McpClientManager();
    this.executor = new GraphExecutor(config, this.clientManager);

    logger.info(`Loaded configuration: ${config.server.name} v${config.server.version}`);
    logger.info(`Tools defined: ${config.tools.map(t => t.name).join(', ')}`);
  }

  /**
   * Get the server metadata
   */
  getServerInfo(): { name: string; version: string; description: string } {
    return {
      name: this.config.server.name,
      version: this.config.server.version,
      description: this.config.server.description,
    };
  }

  /**
   * List all available tools
   */
  listTools(): ToolInfo[] {
    return this.config.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
      outputSchema: tool.outputSchema as unknown as Record<string, unknown>,
    }));
  }

  /**
   * Get information about a specific tool
   */
  getTool(toolName: string): ToolInfo | undefined {
    const tool = this.config.tools.find(t => t.name === toolName);
    if (!tool) {
      return undefined;
    }

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
      outputSchema: tool.outputSchema as unknown as Record<string, unknown>,
    };
  }

  /**
   * Execute a tool with the given arguments
   */
  async executeTool(
    toolName: string,
    toolArguments: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const result = await this.executor.executeTool(toolName, toolArguments);
    
    return {
      result,
      structuredContent: result as Record<string, unknown>,
    };
  }

  /**
   * Get the full configuration
   */
  getConfig(): McpGraphConfig {
    return this.config;
  }

  /**
   * Validate a configuration without creating an API instance
   */
  static validateConfig(configPath: string): ValidationError[] {
    const config = loadConfig(configPath);
    return validateGraph(config);
  }

  /**
   * Load and validate a configuration without creating an API instance
   */
  static loadAndValidateConfig(configPath: string): {
    config: McpGraphConfig;
    errors: ValidationError[];
  } {
    const config = loadConfig(configPath);
    const errors = validateGraph(config);
    return { config, errors };
  }

  /**
   * Clean up resources (close MCP clients, etc.)
   */
  async close(): Promise<void> {
    await this.clientManager.closeAll();
  }
}

