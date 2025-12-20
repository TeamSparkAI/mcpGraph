/**
 * Entry node executor
 */

import type { EntryNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { logger } from "../../logger.js";

export function executeEntryNode(
  node: EntryNode,
  toolInput: Record<string, unknown>,
  context: ExecutionContext,
  startTime: number
): { output: unknown; nextNode: string } {
  logger.debug(`Executing entry node: ${node.id}`);

  // Entry node receives tool input and initializes context
  // The input is already in the context, so we just pass it through
  const output = toolInput;
  const endTime = Date.now();

  context.addHistory(node.id, "entry", output, startTime, endTime);

  return {
    output,
    nextNode: node.next,
  };
}

