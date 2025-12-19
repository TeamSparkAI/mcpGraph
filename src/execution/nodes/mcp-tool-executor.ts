/**
 * MCP tool node executor
 */

import type { McpNode, ServerConfig } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { evaluateJsonata } from "../../expressions/jsonata.js";
import type { McpClientManager } from "../../mcp/client-manager.js";
import { logger } from "../../logger.js";

export async function executeMcpToolNode(
  node: McpNode,
  context: ExecutionContext,
  clientManager: McpClientManager,
  serverConfig: ServerConfig,
  startTime: number
): Promise<{ output: unknown; nextNode: string }> {
  logger.debug(`Executing MCP tool node: ${node.id} (${node.server}.${node.tool})`);

  const exprContext = context.getData();

  // Pre-transform: Apply JSONata to format tool arguments
  const transformedArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.args)) {
    if (typeof value === "string" && value.startsWith("$")) {
      // JSONata expression
      const evaluated = await evaluateJsonata(value, exprContext);
      transformedArgs[key] = evaluated;
      logger.debug(`JSONata "${value}" evaluated to: ${JSON.stringify(evaluated)}`);
    } else {
      transformedArgs[key] = value;
    }
  }

  logger.debug(`MCP tool args: ${JSON.stringify(transformedArgs, null, 2)}`);
  logger.debug(`Expression context: ${JSON.stringify(exprContext, null, 2)}`);

  // Get or create MCP client using server configuration
  const client = await clientManager.getClient(node.server, serverConfig);

  // Call the tool
  const result = await client.callTool({
    name: node.tool,
    arguments: transformedArgs as Record<string, unknown>,
  });

  if (result.isError) {
    const content = result.content as Array<{ text?: string }>;
    throw new Error(`MCP tool error: ${content[0]?.text || "Unknown error"}`);
  }

  // Extract result content
  const content = result.content as Array<{ text?: string } | unknown>;
  let toolOutput: unknown;
  
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

  logger.debug(`MCP tool output: ${JSON.stringify(toolOutput, null, 2)}`);

  const output = toolOutput;
  const endTime = Date.now();

  context.setNodeOutput(node.id, output);
  context.addHistory(node.id, "mcp", transformedArgs, output, startTime, endTime);

  return {
    output,
    nextNode: node.next,
  };
}

