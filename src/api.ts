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
import type {
  ExecutionOptions,
  ExecutionResult as CoreExecutionResult,
  ExecutionController,
  ExecutionState,
  NodeExecutionRecord,
} from './types/execution.js';

// Re-export types for consumers
export type { NodeDefinition, McpGraphConfig } from './types/config.js';
export type {
  ExecutionOptions,
  ExecutionHooks,
  ExecutionController,
  ExecutionState,
  ExecutionStatus,
  NodeExecutionRecord,
  ExecutionTelemetry,
} from './types/execution.js';

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ExecutionResult {
  result: unknown;
  structuredContent?: Record<string, unknown>;
  executionHistory?: CoreExecutionResult['executionHistory'];
  telemetry?: CoreExecutionResult['telemetry'];
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

    const title = config.server.title || config.server.name;
    logger.info(`Loaded configuration: ${config.server.name} v${config.server.version} - ${title}`);
    if (config.server.instructions) {
      logger.debug(`Server instructions: ${config.server.instructions}`);
    }
    logger.info(`Tools defined: ${config.tools.map(t => t.name).join(', ')}`);
  }

  /**
   * Get the server metadata
   * Title defaults to name if not provided (matching MCP SDK behavior)
   */
  getServerInfo(): { name: string; version: string; title: string; instructions?: string } {
    return {
      name: this.config.server.name,
      version: this.config.server.version,
      title: this.config.server.title || this.config.server.name, // Default to name if title not provided
      instructions: this.config.server.instructions,
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
   * Returns both the execution promise and the controller (if hooks/breakpoints are provided)
   */
  executeTool(
    toolName: string,
    toolArguments: Record<string, unknown> = {},
    options?: ExecutionOptions
  ): { promise: Promise<ExecutionResult>; controller: ExecutionController | null } {
    // Start execution and get controller immediately
    const executionPromise = this.executor.executeTool(toolName, toolArguments, options);
    const controller = this.executor.getController();
    
    // Wrap the execution result
    const wrappedPromise = executionPromise.then(executionResult => ({
      result: executionResult.result,
      structuredContent: executionResult.result as Record<string, unknown>,
      executionHistory: executionResult.executionHistory,
      telemetry: executionResult.telemetry,
    }));
    
    return {
      promise: wrappedPromise,
      controller,
    };
  }

  /**
   * Get the execution controller (available during execution with hooks/breakpoints)
   * @deprecated Use the controller returned from executeTool() instead
   */
  getController(): ExecutionController | null {
    return this.executor.getController();
  }

  /**
   * Get the graph structure
   */
  getGraph() {
    return this.executor.getGraph();
  }

  /**
   * Get the current execution state (if execution is in progress)
   */
  getExecutionState(): ExecutionState | null {
    const controller = this.executor.getController();
    if (!controller) {
      return null;
    }
    try {
      return controller.getState();
    } catch {
      return null;
    }
  }

  /**
   * Get the context that was available to a specific execution (for debugging)
   * @param executionIndex - The execution index to get context for
   * @returns Context object that was available to that execution, or null if execution not found
   */
  getContextForExecution(executionIndex: number): Record<string, unknown> | null {
    const controller = this.executor.getController();
    if (!controller) {
      return null;
    }
    try {
      const state = controller.getState();
      const context = state.context;
      return context.getContextForExecution(executionIndex);
    } catch (error) {
      logger.error(`Error getting context for execution ${executionIndex}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get a specific execution record by index
   * @param executionIndex - The execution index
   * @returns Execution record or null if not found
   */
  getExecutionByIndex(executionIndex: number): NodeExecutionRecord | null {
    const controller = this.executor.getController();
    if (!controller) {
      return null;
    }
    try {
      const state = controller.getState();
      const context = state.context;
      return context.getExecutionByIndex(executionIndex) || null;
    } catch (error) {
      logger.error(`Error getting execution ${executionIndex}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
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

