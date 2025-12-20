/**
 * Execution context for graph execution
 */

import type { ExecutionContext as ExprContext } from "../expressions/context.js";
import type { NodeExecutionRecord } from "../types/execution.js";

export class ExecutionContext {
  private history: NodeExecutionRecord[];

  constructor(toolInput: Record<string, unknown>) {
    // Initialize empty history - tool input will be stored by entry node
    this.history = [];
  }

  /**
   * Build context from history up to a specific index (for debugging) or entire history (for current execution)
   * @param upToIndex - If provided, build context from history up to this index (exclusive). If not provided, use entire history.
   * @returns Context object with node outputs (latest execution wins for each node)
   */
  private buildContextFromHistory(upToIndex?: number): ExprContext {
    const context: ExprContext = {};
    const endIndex = upToIndex !== undefined ? upToIndex : this.history.length;
    
    // Walk backwards through history up to endIndex, most recent execution of each node wins
    for (let i = endIndex - 1; i >= 0; i--) {
      const record = this.history[i];
      if (!(record.nodeId in context)) {
        context[record.nodeId] = record.output;
      }
    }
    
    return context;
  }

  /**
   * Get the current execution context (built from entire history)
   * Called once per node execution when the node starts
   */
  getData(): ExprContext {
    return this.buildContextFromHistory();
  }

  /**
   * Get the context that was available to a specific execution (for debugging)
   * @param executionIndex - The execution index to build context for
   * @returns Context object that was available to that execution
   */
  getContextForExecution(executionIndex: number): ExprContext {
    if (executionIndex < 0 || executionIndex >= this.history.length) {
      throw new Error(`Invalid execution index: ${executionIndex}`);
    }
    // Build context from history up to (but not including) this execution
    // The context for execution N is built from executions 0 to N-1
    return this.buildContextFromHistory(executionIndex);
  }

  /**
   * Get a specific execution record by index
   */
  getExecutionByIndex(executionIndex: number): NodeExecutionRecord | undefined {
    return this.history[executionIndex];
  }

  /**
   * Get the previous node execution record
   * @param currentIndex - Current execution index
   * @returns Previous execution record or null if this is the first execution
   */
  getPreviousNode(currentIndex: number): NodeExecutionRecord | null {
    return currentIndex > 0 ? this.history[currentIndex - 1] : null;
  }

  addHistory(
    nodeId: string,
    nodeType: string,
    output: unknown,
    startTime: number,
    endTime: number,
    error?: Error
  ): void {
    const executionIndex = this.history.length;
    this.history.push({
      executionIndex,
      nodeId,
      nodeType,
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

