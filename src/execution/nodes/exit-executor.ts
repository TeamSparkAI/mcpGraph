/**
 * Exit node executor
 */

import type { ExitNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { logger } from "../../logger.js";

export function executeExitNode(
  node: ExitNode,
  context: ExecutionContext
): { output: unknown } {
  logger.debug(`Executing exit node: ${node.id}`);

  // Exit node extracts the final result from context
  // Use the last output or the context's output
  const data = context.getData();
  const output = data.output || data.last || {};

  context.addHistory(node.id, data, output);

  return {
    output,
  };
}

