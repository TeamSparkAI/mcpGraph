/**
 * Exit node executor
 */

import type { ExitNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { logger } from "../../logger.js";

export function executeExitNode(
  node: ExitNode,
  context: ExecutionContext,
  startTime: number
): { output: unknown } {
  logger.debug(`Executing exit node: ${node.id}`);

  const history = context.getHistory();
  const currentIndex = history.length; // This will be the index after we add this execution
  
  let output: unknown;
  
  if (currentIndex > 0) {
    // Get the previous node's output from history
    const previousRecord = history[currentIndex - 1];
    output = previousRecord.output || {};
    logger.debug(`Exit node using output from previous node: ${previousRecord.nodeId}`);
  } else {
    // No previous node (shouldn't happen in normal execution, but handle gracefully)
    logger.warn(`Exit node ${node.id} has no previous node, returning empty object`);
    output = {};
  }

  const endTime = Date.now();

  context.addHistory(node.id, "exit", output, startTime, endTime);

  return {
    output,
  };
}

