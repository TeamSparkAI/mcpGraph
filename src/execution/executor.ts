/**
 * Graph execution engine
 */

import type { McpGraphConfig, ToolDefinition, ServerConfig, NodeDefinition } from "../types/config.js";
import type {
  ExecutionOptions,
  ExecutionResult,
  ExecutionHooks,
  ExecutionTelemetry,
  ExecutionController as IExecutionController,
} from "../types/execution.js";
import { Graph } from "../graph/graph.js";
import { ExecutionContext } from "./context.js";
import { ExecutionController } from "./controller.js";
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
  private controller: ExecutionController | null = null;

  constructor(config: McpGraphConfig, clientManager: McpClientManager) {
    this.config = config;
    this.graph = new Graph(config.nodes);
    this.clientManager = clientManager;
  }

  getController(): IExecutionController | null {
    return this.controller;
  }

  getGraph(): Graph {
    return this.graph;
  }

  getConfig(): McpGraphConfig {
    return this.config;
  }

  private getServerConfig(serverName: string): ServerConfig {
    if (!this.config.servers || !this.config.servers[serverName]) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }
    return this.config.servers[serverName];
  }

  async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    const tool = this.config.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    logger.info(`Executing tool: ${toolName}`);

    // Initialize execution options
    const hooks = options?.hooks;
    const breakpoints = options?.breakpoints || [];
    const enableTelemetry = options?.enableTelemetry ?? false;

    // Initialize controller if hooks or breakpoints are provided
    if (hooks || breakpoints.length > 0) {
      this.controller = new ExecutionController();
      this.controller.setBreakpoints(breakpoints);
      this.controller.setStatus("not_started");
    }

    // Find entry node for this tool
    const entryNode = this.config.nodes.find(
      (n) => n.type === "entry" && (n as { tool: string }).tool === toolName
    );
    if (!entryNode) {
      throw new Error(`Entry node not found for tool: ${toolName}`);
    }

    // Find exit node for this tool
    const exitNode = this.config.nodes.find(
      (n) => n.type === "exit" && (n as { tool: string }).tool === toolName
    );
    if (!exitNode) {
      throw new Error(`Exit node not found for tool: ${toolName}`);
    }

    const context = new ExecutionContext(toolInput);
    if (this.controller) {
      this.controller.setContext(context);
    }

    const startTime = Date.now();
    let currentNodeId = entryNode.id;

    try {
      if (this.controller) {
        this.controller.setStatus("running");
      }

      // Execute nodes until we reach the exit node
      while (currentNodeId !== exitNode.id) {
        const node = this.graph.getNode(currentNodeId);
        if (!node) {
          throw new Error(`Node not found: ${currentNodeId}`);
        }

        // Update controller with current node
        if (this.controller) {
          this.controller.setCurrentNode(currentNodeId);
        }

        // Check for breakpoint or pause request
        if (this.controller && this.controller.shouldPause(currentNodeId)) {
          await this.controller.waitIfPaused();
        }

        // Call onNodeStart hook
        if (hooks?.onNodeStart) {
          const shouldContinue = await hooks.onNodeStart(currentNodeId, node, context);
          if (shouldContinue === false) {
            // Hook requested pause
            if (this.controller) {
              await this.controller.waitIfPaused();
            }
          }
        }

        logger.debug(`Executing node: ${currentNodeId} (type: ${node.type})`);

        const nodeStartTime = Date.now();
        let result: { output: unknown; nextNode?: string };
        let nodeError: Error | undefined;

        try {
          switch (node.type) {
            case "entry":
              result = executeEntryNode(node, toolInput, context, nodeStartTime);
              break;
            case "exit":
              result = executeExitNode(node, context, nodeStartTime);
              // Call onNodeComplete hook for exit node
              if (hooks?.onNodeComplete) {
                await hooks.onNodeComplete(
                  currentNodeId,
                  node,
                  context.getData(),
                  result.output,
                  Date.now() - nodeStartTime
                );
              }
              if (this.controller) {
                this.controller.setStatus("finished");
                this.controller.setCurrentNode(null);
              }
              const endTime = Date.now();
              const telemetry = enableTelemetry
                ? this.buildTelemetry(context, startTime, endTime)
                : undefined;
              return {
                result: result.output,
                executionHistory: context.getHistory(),
                telemetry,
              };
            case "transform":
              result = await executeTransformNode(node, context, nodeStartTime);
              break;
            case "mcp":
              const serverConfig = this.getServerConfig(node.server);
              result = await executeMcpToolNode(
                node,
                context,
                this.clientManager,
                serverConfig,
                nodeStartTime
              );
              break;
            case "switch":
              result = await executeSwitchNode(node, context, nodeStartTime);
              break;
            default:
              throw new Error(`Unknown node type: ${(node as { type: string }).type}`);
          }

          // Call onNodeComplete hook
          if (hooks?.onNodeComplete) {
            await hooks.onNodeComplete(
              currentNodeId,
              node,
              context.getData(),
              result.output,
              Date.now() - nodeStartTime
            );
          }

          // Mark step complete if stepping
          if (this.controller) {
            this.controller.markStepComplete();
          }
        } catch (error) {
          nodeError = error instanceof Error ? error : new Error(String(error));
          const nodeEndTime = Date.now();
          
          // Record error in history (if not already recorded by node executor)
          const history = context.getHistory();
          const lastRecord = history[history.length - 1];
          if (!lastRecord || lastRecord.nodeId !== currentNodeId) {
            context.addHistory(
              currentNodeId,
              node.type,
              context.getData(),
              null,
              nodeStartTime,
              nodeEndTime,
              nodeError
            );
          }

          // Call onNodeError hook
          if (hooks?.onNodeError) {
            await hooks.onNodeError(currentNodeId, node, nodeError, context);
          }

          if (this.controller) {
            this.controller.setStatus("error");
            this.controller.setCurrentNode(null);
          }

          throw nodeError;
        }

        if (result.nextNode) {
          currentNodeId = result.nextNode;
        } else {
          throw new Error(`Node ${currentNodeId} has no next node and is not the exit node`);
        }
      }

      // Should not reach here, but handle exit node
      const finalExitNode = this.graph.getNode(exitNode.id);
      if (finalExitNode && finalExitNode.type === "exit") {
        const result = executeExitNode(finalExitNode, context, Date.now());
        if (this.controller) {
          this.controller.setStatus("finished");
          this.controller.setCurrentNode(null);
        }
        const endTime = Date.now();
        const telemetry = enableTelemetry
          ? this.buildTelemetry(context, startTime, endTime)
          : undefined;
        return {
          result: result.output,
          executionHistory: context.getHistory(),
          telemetry,
        };
      }

      throw new Error(`Exit node ${exitNode.id} not found or invalid`);
    } catch (error) {
      if (this.controller) {
        this.controller.setStatus("error");
        this.controller.setCurrentNode(null);
        if (error instanceof Error) {
          // Store error in controller state would require extending ExecutionState
        }
      }
      throw error;
    } finally {
      // Clean up controller after execution
      if (this.controller) {
        this.controller = null;
      }
    }
  }

  private buildTelemetry(
    context: ExecutionContext,
    startTime: number,
    endTime: number
  ): ExecutionTelemetry {
    const history = context.getHistory();
    const nodeDurations = new Map<string, number>();
    const nodeCounts = new Map<string, number>();
    let errorCount = 0;

    for (const record of history) {
      // Aggregate durations by node type
      const currentDuration = nodeDurations.get(record.nodeType) || 0;
      nodeDurations.set(record.nodeType, currentDuration + record.duration);

      // Count nodes by type
      const currentCount = nodeCounts.get(record.nodeType) || 0;
      nodeCounts.set(record.nodeType, currentCount + 1);

      // Count errors
      if (record.error) {
        errorCount++;
      }
    }

    return {
      totalDuration: endTime - startTime,
      nodeDurations,
      nodeCounts,
      errorCount,
    };
  }
}

