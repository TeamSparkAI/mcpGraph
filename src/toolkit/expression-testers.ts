/**
 * Expression testers for JSONata and JSON Logic
 * 
 * Provides functionality to test expressions with context
 */

import { evaluateJsonata, validateJsonataSyntax } from '../expressions/jsonata.js';
import { evaluateJsonLogic } from '../expressions/json-logic.js';
import { logger } from '../logger.js';
import type { McpGraphApi } from '../api.js';
import type { NodeExecutionRecord } from '../types/execution.js';
import type { ServerConfig } from '../types/config.js';
import { McpClientManager } from '../mcp/client-manager.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolCallMcpError, ToolCallError } from '../errors/mcp-tool-error.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { extractMcpToolOutput } from '../mcp/tool-output-extractor.js';

export interface ExpressionTestResult {
  result: unknown;
  error?: {
    message: string;
    details?: unknown;
  };
}

export interface McpToolTestResult {
  output: unknown;
  evaluatedArgs?: Record<string, unknown>;
  executionTime: number;
  error?: {
    message: string;
    details?: unknown;
  };
}

/**
 * Test a JSONata expression with context
 */
export async function testJSONata(
  expression: string,
  context: Record<string, unknown>
): Promise<ExpressionTestResult> {
  try {
    // Validate syntax first
    validateJsonataSyntax(expression);

    // Evaluate with context (no history needed for testing)
    const result = await evaluateJsonata(expression, context, [], 0);

    return { result };
  } catch (error) {
    return {
      result: null,
      error: {
        message: error instanceof Error ? error.message : String(error),
        details: error,
      },
    };
  }
}

/**
 * Test a JSON Logic expression with context
 */
export async function testJSONLogic(
  expression: unknown,
  context: Record<string, unknown>
): Promise<ExpressionTestResult> {
  try {
    // Evaluate JSON Logic with context (no history needed for testing)
    const result = await evaluateJsonLogic(expression, context, [], 0);

    return { result };
  } catch (error) {
    return {
      result: null,
      error: {
        message: error instanceof Error ? error.message : String(error),
        details: error,
      },
    };
  }
}

/**
 * Test an MCP tool call directly. Evaluates JSONata expressions in args if context is provided.
 */
export async function testMcpTool(
  api: McpGraphApi,
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<McpToolTestResult> {
  const startTime = Date.now();
  
  try {
    // Get server config from the graph config
    const config = api.getConfig();
    if (!config.mcpServers || !config.mcpServers[serverName]) {
      throw new Error(`Server "${serverName}" not found in graph configuration`);
    }
    const serverConfig = config.mcpServers[serverName] as ServerConfig;
    
    // Evaluate JSONata expressions in args if context is provided
    const evaluatedArgs: Record<string, unknown> = {};
    const exprContext = context || {};
    const history: NodeExecutionRecord[] = [];
    const currentIndex = 0;
    
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === "string" && value.startsWith("$")) {
        // JSONata expression - evaluate it
        try {
          const evaluated = await evaluateJsonata(value, exprContext, history, currentIndex);
          evaluatedArgs[key] = evaluated;
          logger.debug(`JSONata "${value}" evaluated to: ${JSON.stringify(evaluated)}`);
        } catch (error) {
          throw new Error(`Failed to evaluate JSONata expression "${value}" in arg "${key}": ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        evaluatedArgs[key] = value;
      }
    }
    
    // Get client manager from API (we need to access it, but it's private)
    // Instead, we'll create a temporary client manager for this test
    const clientManager = new McpClientManager();
    
    try {
      // Get or create MCP client
      const client = await clientManager.getClient(serverName, serverConfig);
      
      // Call the tool
      const result = await client.callTool({
        name: toolName,
        arguments: evaluatedArgs as Record<string, unknown>,
      });
      
      // Clean up client
      await clientManager.closeAll();
      
      if (result.isError) {
        throw new ToolCallError({
          ...result,
          content: Array.isArray(result.content) ? result.content : [],
        });
      }
      
      // Extract result content using the exact same logic as mcp-tool-executor.ts
      // This ensures testMcpTool returns the same output that would be available
      // in a graph node's execution context
      const toolOutput = extractMcpToolOutput(result);
      
      const executionTime = Date.now() - startTime;
      
      const response: McpToolTestResult = {
        output: toolOutput,
        executionTime,
      };
      
      // Include evaluated args if any JSONata expressions were used
      if (context && Object.keys(evaluatedArgs).some(key => typeof args[key] === "string" && (args[key] as string).startsWith("$"))) {
        response.evaluatedArgs = evaluatedArgs;
      }
      
      return response;
    } catch (error) {
      await clientManager.closeAll();
      throw error;
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    return {
      output: null,
      executionTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        details: error,
      },
    };
  }
}