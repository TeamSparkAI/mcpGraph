/**
 * Exit node executor
 */

import type { ExitNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { logger } from "../../logger.js";

export function executeExitNode(
  node: ExitNode,
  context: ExecutionContext,
  previousNodeId: string | null,
  startTime: number
): { output: unknown } {
  logger.debug(`Executing exit node: ${node.id}`);

  const data = context.getData();
  let output: unknown;

  if (previousNodeId) {
    // Look up the previous node's output from context
    output = data[previousNodeId] || {};
    logger.debug(`Exit node using output from previous node: ${previousNodeId}`);
  } else {
    // No previous node (shouldn't happen in normal execution, but handle gracefully)
    logger.warn(`Exit node ${node.id} has no previous node, returning empty object`);
    output = {};
  }

  const endTime = Date.now();

  context.addHistory(node.id, "exit", data, output, startTime, endTime);

  return {
    output,
  };
}

