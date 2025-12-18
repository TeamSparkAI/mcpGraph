/**
 * Graph execution engine
 */

import type { McpGraphConfig, ToolDefinition } from "../types/config.js";
import { Graph } from "../graph/graph.js";
import { ExecutionContext } from "./context.js";
import { executeEntryNode } from "./nodes/entry-executor.js";
import { executeExitNode } from "./nodes/exit-executor.js";
import { executeTransformNode } from "./nodes/transform-executor.js";
import { executeMcpToolNode } from "./nodes/mcp-tool-executor.js";
import { executeSwitchNode } from "./nodes/switch-executor.js";
import type { McpClientManager } from "../mcp/client-manager.js";
import { logger } from "../logger.js";

export class GraphExecutor {
  private config: McpGraphConfig;
  private graph: Graph;
  private clientManager: McpClientManager;

  constructor(config: McpGraphConfig, clientManager: McpClientManager) {
    this.config = config;
    this.graph = new Graph(config.nodes);
    this.clientManager = clientManager;
  }

  async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.config.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    logger.info(`Executing tool: ${toolName}`);

    const context = new ExecutionContext(toolInput);
    let currentNodeId = tool.entryNode;

    // Execute nodes until we reach the exit node
    while (currentNodeId !== tool.exitNode) {
      const node = this.graph.getNode(currentNodeId);
      if (!node) {
        throw new Error(`Node not found: ${currentNodeId}`);
      }

      logger.debug(`Executing node: ${currentNodeId} (type: ${node.type})`);

      let result: { output: unknown; nextNode?: string };

      switch (node.type) {
        case "entry":
          result = executeEntryNode(node, toolInput, context);
          break;
        case "exit":
          result = executeExitNode(node, context);
          return result.output;
        case "transform":
          result = await executeTransformNode(node, context);
          break;
        case "mcp_tool":
          result = await executeMcpToolNode(node, context, this.clientManager);
          break;
        case "switch":
          result = await executeSwitchNode(node, context);
          break;
        default:
          throw new Error(`Unknown node type: ${(node as { type: string }).type}`);
      }

      if (result.nextNode) {
        currentNodeId = result.nextNode;
      } else {
        throw new Error(`Node ${currentNodeId} has no next node and is not the exit node`);
      }
    }

    // Should not reach here, but handle exit node
    const exitNode = this.graph.getNode(tool.exitNode);
    if (exitNode && exitNode.type === "exit") {
      const result = executeExitNode(exitNode, context);
      return result.output;
    }

    throw new Error(`Exit node ${tool.exitNode} not found or invalid`);
  }
}

