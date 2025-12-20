/**
 * Execution context for graph execution
 */

import type { ExecutionContext as ExprContext } from "../expressions/context.js";
import type { NodeExecutionRecord } from "../types/execution.js";

export class ExecutionContext {
  private data: ExprContext;
  private history: NodeExecutionRecord[];

  constructor(toolInput: Record<string, unknown>) {
    // Initialize empty context - tool input will be stored by entry node
    this.data = {};
    this.history = [];
  }

  getData(): ExprContext {
    return this.data;
  }

  setNodeOutput(nodeId: string, output: unknown): void {
    // Store output with node ID as key for reference
    this.data[nodeId] = output;
    // Also store in a generic way for JSONata access
    this.data.output = output;
    this.data.last = output;
  }

  addHistory(
    nodeId: string,
    nodeType: string,
    input: unknown,
    output: unknown,
    startTime: number,
    endTime: number,
    error?: Error
  ): void {
    this.history.push({
      nodeId,
      nodeType,
      input,
      output,
      startTime,
      endTime,
      duration: endTime - startTime,
      error,
    });
  }

  getHistory(): NodeExecutionRecord[] {
    return this.history;
  }
}

