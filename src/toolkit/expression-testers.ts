/**
 * Expression testers for JSONata and JSON Logic
 * 
 * Provides functionality to test expressions with context
 */

import { evaluateJsonata, validateJsonataSyntax } from '../expressions/jsonata.js';
import { evaluateJsonLogic } from '../expressions/json-logic.js';
import type { McpGraphApi } from '../api.js';
import type { NodeExecutionRecord } from '../types/execution.js';
import type { ServerConfig } from '../types/config.js';
import { McpClientManager } from '../mcp/client-manager.js';
import { ToolCallError } from '../errors/mcp-tool-error.js';
import { extractMcpToolOutput } from '../mcp/tool-output-extractor.js';
import { evaluateArgValue } from '../execution/arg-evaluator.js';

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
    const exprContext = context || {};
    const history: NodeExecutionRecord[] = [];
    const currentIndex = 0;
    
    let evaluatedArgs: Record<string, unknown>;
    try {
      evaluatedArgs = await evaluateArgValue(
        args,
        exprContext,
        history,
        currentIndex
      ) as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `Failed to evaluate JSONata expressions in args: ${error instanceof Error ? error.message : String(error)}`
      );
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
      // Check if any args contain expression objects
      function hasExpressionObjects(value: unknown): boolean {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          "expr" in value &&
          Object.keys(value).length === 1
        ) {
          return true;
        }
        if (Array.isArray(value)) {
          return value.some(item => hasExpressionObjects(item));
        }
        if (typeof value === "object" && value !== null) {
          return Object.values(value).some(val => hasExpressionObjects(val));
        }
        return false;
      }
      
      if (context && hasExpressionObjects(args)) {
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