/**
 * Types for execution introspection and debugging
 */

import type { NodeDefinition } from "./config.js";
import type { ExecutionContext } from "../execution/context.js";

export type ExecutionStatus = "not_started" | "running" | "paused" | "finished" | "error" | "stopped";

export interface NodeExecutionRecord {
  executionIndex: number;  // Position in overall execution history (0, 1, 2, ...) - unique identifier
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime: number;
  duration: number;
  output: unknown;
  error?: Error;
}

export interface ExecutionState {
  status: ExecutionStatus;
  currentNodeId: string | null;
  executionHistory: NodeExecutionRecord[];
  context: ExecutionContext;
  error?: Error;
}

export interface ExecutionHooks {
  /**
   * Called before a node executes
   * @param executionIndex - The unique execution index for this node execution (0, 1, 2, ...)
   * @param nodeId - The ID of the node being executed
   * @param node - The node definition
   * @param context - The execution context
   * @returns Return false to pause execution (breakpoint)
   */
  onNodeStart?: (
    executionIndex: number,
    nodeId: string,
    node: NodeDefinition,
    context: ExecutionContext
  ) => Promise<boolean>;

  /**
   * Called after a node completes successfully
   * @param executionIndex - The unique execution index for this node execution (0, 1, 2, ...)
   * @param nodeId - The ID of the node that completed
   * @param node - The node definition
   * @param input - The input context available to the node when it started
   * @param output - The output from the node
   * @param duration - The duration of the node execution in milliseconds
   */
  onNodeComplete?: (
    executionIndex: number,
    nodeId: string,
    node: NodeDefinition,
    input: unknown,
    output: unknown,
    duration: number
  ) => Promise<void>;

  /**
   * Called when a node encounters an error
   * @param executionIndex - The unique execution index for this node execution (0, 1, 2, ...)
   * @param nodeId - The ID of the node that encountered the error
   * @param node - The node definition
   * @param error - The error that occurred
   * @param context - The execution context
   */
  onNodeError?: (
    executionIndex: number,
    nodeId: string,
    node: NodeDefinition,
    error: Error,
    context: ExecutionContext
  ) => Promise<void>;

  /**
   * Called when execution pauses (breakpoint hit or manual pause)
   * @param executionIndex - The unique execution index for the current node execution (0, 1, 2, ...)
   * @param nodeId - The ID of the node where execution paused
   * @param context - The execution context
   */
  onPause?: (executionIndex: number, nodeId: string, context: ExecutionContext) => Promise<void>;

  /**
   * Called when execution resumes
   */
  onResume?: () => Promise<void>;
}

export interface ExecutionController {
  /**
   * Pause execution at the next node boundary
   * Only valid when status is "running"
   */
  pause(): void;

  /**
   * Resume execution
   * Only valid when status is "paused"
   */
  resume(): void;

  /**
   * Step to the next node (step over)
   * Only valid when status is "paused"
   */
  step(): Promise<void>;
  
  /**
   * Get current execution state
   */
  getState(): ExecutionState;

  /**
   * Set breakpoints
   */
  setBreakpoints(nodeIds: string[]): void;

  /**
   * Clear breakpoints
   */
  clearBreakpoints(): void;

  /**
   * Get all current breakpoints
   */
  getBreakpoints(): string[];

  /**
   * Stop/cancel the ongoing execution.
   * This immediately halts execution at the current node boundary.
   */
  stop(): void;
}

export interface ExecutionOptions {
  hooks?: ExecutionHooks;
  breakpoints?: string[];
  enableTelemetry?: boolean;
  /**
   * Start execution in a paused state.
   * When true, execution will pause at the entry node, allowing step-through debugging from the start.
   */
  startPaused?: boolean;
}

export interface ExecutionTelemetry {
  totalDuration: number;
  nodeDurations: Map<string, number>;
  nodeCounts: Map<string, number>;
  errorCount: number;
}

export interface ExecutionResult {
  result: unknown;
  executionHistory: NodeExecutionRecord[];
  telemetry?: ExecutionTelemetry;
}

