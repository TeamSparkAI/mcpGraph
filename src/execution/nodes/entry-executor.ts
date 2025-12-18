/**
 * Entry node executor
 */

import type { EntryNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { logger } from "../../logger.js";

export function executeEntryNode(
  node: EntryNode,
  toolInput: Record<string, unknown>,
  context: ExecutionContext
): { output: unknown; nextNode: string } {
  logger.debug(`Executing entry node: ${node.id}`);

  // Entry node receives tool input and initializes context
  // The input is already in the context, so we just pass it through
  const output = toolInput;

  context.setNodeOutput(node.id, output);
  context.addHistory(node.id, toolInput, output);

  return {
    output,
    nextNode: node.next,
  };
}

