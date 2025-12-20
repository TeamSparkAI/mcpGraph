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
    const startPaused = options?.startPaused ?? false;

    // Initialize controller if hooks, breakpoints, or startPaused are provided
    if (hooks || breakpoints.length > 0 || startPaused) {
      this.controller = new ExecutionController();
      this.controller.setBreakpoints(breakpoints);
      this.controller.setStatus("not_started");
      
      // If startPaused is true, set pauseRequested so execution pauses at entry node
      if (startPaused && this.controller) {
        // Set pauseRequested directly - it will be checked after status is set to "running"
        // and the first node is processed
        (this.controller as any).pauseRequested = true;
      }
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

    // Get execution limits with defaults
    const limits = this.config.executionLimits || {};
    const maxNodeExecutions = limits.maxNodeExecutions ?? 1000;
    const maxExecutionTimeMs = limits.maxExecutionTimeMs ?? 300000; // 5 minutes

    try {
      if (this.controller) {
        this.controller.setStatus("running");
      }

      // Execute nodes until we reach the exit node
      while (true) {
        // Check execution limits before processing next node
        const currentHistoryLength = context.getHistory().length;
        if (currentHistoryLength >= maxNodeExecutions) {
          const error = new Error(
            `Execution limit exceeded: maximum node executions (${maxNodeExecutions}) reached. Current execution count: ${currentHistoryLength}`
          );
          if (this.controller) {
            this.controller.setStatus("error");
            this.controller.setCurrentNode(null);
          }
          throw error;
        }

        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= maxExecutionTimeMs) {
          const error = new Error(
            `Execution limit exceeded: maximum execution time (${maxExecutionTimeMs}ms) reached. Elapsed time: ${elapsedTime}ms`
          );
          if (this.controller) {
            this.controller.setStatus("error");
            this.controller.setCurrentNode(null);
          }
          throw error;
        }

        // Check for stop request before processing next node
        if (this.controller && this.controller.shouldStop()) {
          if (this.controller) {
            this.controller.setStatus("stopped");
            this.controller.setCurrentNode(null);
          }
          throw new Error("Execution was stopped");
        }

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
          // If breakpoint hit, set pauseRequested
          this.controller.checkAndSetBreakpointPause(currentNodeId);
          
          // Set status to paused
          this.controller.setStatus("paused");
          
          // Wait for resume - this creates the promise and blocks until resume() is called
          const pausePromise = this.controller.waitIfPaused();
          
          // Call onPause hook to notify that we've paused (status is "paused", waiting for resume)
          if (hooks?.onPause) {
            await hooks.onPause(currentNodeId, context);
          }
          
          // Wait for resume to be called
          await pausePromise;
          
          // Call onResume hook after resuming
          if (hooks?.onResume) {
            await hooks.onResume();
          }
          
          // Check again for stop after resuming from pause
          if (this.controller && this.controller.shouldStop()) {
            if (this.controller) {
              this.controller.setStatus("stopped");
              this.controller.setCurrentNode(null);
            }
            throw new Error("Execution was stopped");
          }
        }

        // Call onNodeStart hook
        if (hooks?.onNodeStart) {
          const shouldContinue = await hooks.onNodeStart(currentNodeId, node, context);
          // Check for stop after hook (hook may have called stop())
          if (this.controller && this.controller.shouldStop()) {
            if (this.controller) {
              this.controller.setStatus("stopped");
              this.controller.setCurrentNode(null);
            }
            throw new Error("Execution was stopped");
          }
          if (shouldContinue === false) {
            // Hook requested pause
            if (this.controller) {
              // Call onPause hook before waiting
              if (hooks?.onPause) {
                await hooks.onPause(currentNodeId, context);
              }
              await this.controller.waitIfPaused();
              // Call onResume hook after resuming
              if (hooks?.onResume) {
                await hooks.onResume();
              }
              // Check for stop after resuming from pause
              if (this.controller && this.controller.shouldStop()) {
                if (this.controller) {
                  this.controller.setStatus("stopped");
                  this.controller.setCurrentNode(null);
                }
                throw new Error("Execution was stopped");
              }
            }
          }
        }

        logger.debug(`Executing node: ${currentNodeId} (type: ${node.type})`);

        const nodeStartTime = Date.now();
        // Capture input context before node executes (only if hooks are provided)
        const inputContext = hooks?.onNodeComplete ? context.getData() : undefined;
        
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
              if (hooks?.onNodeComplete && inputContext !== undefined) {
                await hooks.onNodeComplete(
                  currentNodeId,
                  node,
                  inputContext,
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
              // Check for stop before starting MCP call (which may take time)
              if (this.controller && this.controller.shouldStop()) {
                if (this.controller) {
                  this.controller.setStatus("stopped");
                  this.controller.setCurrentNode(null);
                }
                throw new Error("Execution was stopped");
              }
              const serverConfig = this.getServerConfig(node.server);
              result = await executeMcpToolNode(
                node,
                context,
                this.clientManager,
                serverConfig,
                nodeStartTime
              );
              // Check for stop after MCP call completes
              if (this.controller && this.controller.shouldStop()) {
                if (this.controller) {
                  this.controller.setStatus("stopped");
                  this.controller.setCurrentNode(null);
                }
                throw new Error("Execution was stopped");
              }
              break;
            case "switch":
              result = await executeSwitchNode(node, context, nodeStartTime);
              break;
            default:
              throw new Error(`Unknown node type: ${(node as { type: string }).type}`);
          }

          // Call onNodeComplete hook
          if (hooks?.onNodeComplete && inputContext !== undefined) {
            await hooks.onNodeComplete(
              currentNodeId,
              node,
              inputContext,
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
          // If next node is the exit node, continue to process it in next iteration
          if (currentNodeId === exitNode.id) {
            continue;
          }
        } else {
          throw new Error(`Node ${currentNodeId} has no next node and is not the exit node`);
        }
      }

      // Should not reach here - exit node should have been processed and returned
      throw new Error(`Exit node was not reached`);
    } catch (error) {
      if (this.controller) {
        // Don't override "stopped" status with "error" if execution was stopped
        const state = this.controller.getState();
        if (this.controller.shouldStop() && state.status === "stopped") {
          // Status already set to stopped, just clean up
          this.controller.setCurrentNode(null);
        } else if (!(error instanceof Error && error.message === "Execution was stopped")) {
          // Only set error status if it wasn't a stop request
          this.controller.setStatus("error");
          this.controller.setCurrentNode(null);
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

