/**
 * MCP tool node executor
 */

import type { McpNode, ServerConfig } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { evaluateJsonata } from "../../expressions/jsonata.js";
import type { McpClientManager } from "../../mcp/client-manager.js";
import { logger } from "../../logger.js";
import { ToolCallMcpError, ToolCallError } from "../../errors/mcp-tool-error.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

export async function executeMcpToolNode(
  node: McpNode,
  context: ExecutionContext,
  clientManager: McpClientManager,
  serverConfig: ServerConfig,
  startTime: number
): Promise<{ output: unknown; nextNode: string }> {
  logger.debug(`Executing MCP tool node: ${node.id} (${node.server}.${node.tool})`);

  const exprContext = context.getData();
  const history = context.getHistory();
  const currentIndex = history.length; // This will be the index after we add this execution

  // Pre-transform: Apply JSONata to format tool arguments
  const transformedArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.args)) {
    if (typeof value === "string" && value.startsWith("$")) {
      // JSONata expression
      const evaluated = await evaluateJsonata(value, exprContext, history, currentIndex);
      transformedArgs[key] = evaluated;
      logger.debug(`JSONata "${value}" evaluated to: ${JSON.stringify(evaluated)}`);
    } else {
      transformedArgs[key] = value;
    }
  }

  logger.debug(`MCP tool args: ${JSON.stringify(transformedArgs, null, 2)}`);
  logger.debug(`Expression context: ${JSON.stringify(exprContext, null, 2)}`);

  // Clear previous stderr for this server at the start of execution
  // This ensures we capture fresh stderr for this node execution
  clientManager.clearStderr(node.server);

  // Get or create MCP client using server configuration
  let client;
  try {
    client = await clientManager.getClient(node.server, serverConfig);
  } catch (error) {
    // Handle errors during client initialization/connection
    // Retrieve stderr by server name (available even if client creation failed)
    const stderr = clientManager.getStderr(node.server);
    
    // If it's already an McpError, extend it with stderr
    if (error instanceof McpError) {
      throw new ToolCallMcpError(error, stderr);
    }
    
    // For non-McpError exceptions (transport errors, etc.), create a generic McpError
    const errorMessage = error instanceof Error ? error.message : String(error);
    const mcpError = new McpError(-32000, `MCP client initialization failed: ${errorMessage}`, error);
    throw new ToolCallMcpError(mcpError, stderr);
  }

  // Call the tool
  let result;
  try {
    result = await client.callTool({
      name: node.tool,
      arguments: transformedArgs as Record<string, unknown>,
    });
  } catch (error) {
    const stderr = clientManager.getStderr(node.server);
    
    // If it's already an McpError, extend it with stderr
    if (error instanceof McpError) {
      throw new ToolCallMcpError(error, stderr);
    }
    
    // For non-McpError exceptions (transport errors, etc.), create a generic McpError
    const errorMessage = error instanceof Error ? error.message : String(error);
    const mcpError = new McpError(-32000, `MCP tool call failed: ${errorMessage}`, error);
    throw new ToolCallMcpError(mcpError, stderr);
  }

  if (result.isError) {
    // MCP protocol succeeded, but tool returned an error response
    // Throw ToolCallError with the full result for inspection
    throw new ToolCallError({
      ...result,
      content: Array.isArray(result.content) ? result.content : [],
    });
  }

  // Extract result content
  // Check for structuredContent first (if present, use it as output)
  let toolOutput: unknown;
  
  if ('structuredContent' in result && result.structuredContent !== undefined) {
    // Use structuredContent if available (regardless of content presence)
    toolOutput = result.structuredContent;
  } else if ('content' in result) {
    // Fall back to processing text content
    const content = (result.content ?? []) as Array<{ text?: string } | unknown>;
    
    if (content[0] && typeof content[0] === "object" && "text" in content[0]) {
      const textContent = (content[0] as { text?: string }).text;
      if (textContent) {
        try {
          toolOutput = JSON.parse(textContent);
        } catch {
          toolOutput = textContent;
        }
      } else {
        toolOutput = content[0];
      }
    } else {
      toolOutput = content[0];
    }
  } else {
    // toolResult variant - not expected in normal flow, but handle it
    throw new Error('Expected content-based result, got toolResult variant');
  }

  logger.debug(`MCP tool output: ${JSON.stringify(toolOutput, null, 2)}`);

  const output = toolOutput;
  const endTime = Date.now();

  context.addHistory(node.id, "mcp", output, startTime, endTime);

  return {
    output,
    nextNode: node.next,
  };
}

