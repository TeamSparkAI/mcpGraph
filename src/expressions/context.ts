/**
 * Expression evaluation context builder
 */

export interface ExecutionContext {
  // Node outputs and other context data (indexed by node ID)
  // Tool input is stored as the entry node's output
  [key: string]: unknown;
}

export function buildContext(
  toolInput: Record<string, unknown>,
  nodeOutputs: Record<string, unknown> = {}
): ExecutionContext {
  return {
    input: toolInput,
    ...nodeOutputs,
  };
}

