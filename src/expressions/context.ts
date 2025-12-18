/**
 * Expression evaluation context builder
 */

export interface ExecutionContext {
  input: Record<string, unknown>; // Tool input arguments
  [key: string]: unknown; // Node outputs and other context data
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

