/**
 * Execution context for graph execution
 */

import type { ExecutionContext as ExprContext } from "../expressions/context.js";

export class ExecutionContext {
  private data: ExprContext;
  private history: Array<{ nodeId: string; input: unknown; output: unknown }>;

  constructor(toolInput: Record<string, unknown>) {
    // Initialize context with tool input available as $.input
    this.data = {
      input: toolInput,
      // Also make input properties directly accessible for convenience
      ...toolInput,
    };
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

  addHistory(nodeId: string, input: unknown, output: unknown): void {
    this.history.push({ nodeId, input, output });
  }

  getHistory(): Array<{ nodeId: string; input: unknown; output: unknown }> {
    return this.history;
  }
}

