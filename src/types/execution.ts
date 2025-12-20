/**
 * Types for execution introspection and debugging
 */

import type { NodeDefinition } from "./config.js";
import type { ExecutionContext } from "../execution/context.js";

export type ExecutionStatus = "not_started" | "running" | "paused" | "finished" | "error" | "stopped";

export interface NodeExecutionRecord {
  nodeId: string;
  nodeType: string;
  startTime: number;
  endTime: number;
  duration: number;
  input: unknown;
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
   * Return false to pause execution (breakpoint)
   */
  onNodeStart?: (
    nodeId: string,
    node: NodeDefinition,
    context: ExecutionContext
  ) => Promise<boolean>;

  /**
   * Called after a node completes successfully
   */
  onNodeComplete?: (
    nodeId: string,
    node: NodeDefinition,
    input: unknown,
    output: unknown,
    duration: number
  ) => Promise<void>;

  /**
   * Called when a node encounters an error
   */
  onNodeError?: (
    nodeId: string,
    node: NodeDefinition,
    error: Error,
    context: ExecutionContext
  ) => Promise<void>;

  /**
   * Called when execution pauses (breakpoint hit or manual pause)
   */
  onPause?: (nodeId: string, context: ExecutionContext) => Promise<void>;

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

