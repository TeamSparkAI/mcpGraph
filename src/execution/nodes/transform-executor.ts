/**
 * Transform node executor
 */

import type { TransformNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { evaluateJsonata } from "../../expressions/jsonata.js";
import { logger } from "../../logger.js";

export async function executeTransformNode(
  node: TransformNode,
  context: ExecutionContext,
  startTime: number
): Promise<{ output: unknown; nextNode: string }> {
  logger.debug(`Executing transform node: ${node.id}`);
  logger.debug(`Transform expression: ${node.transform.expr}`);

  const exprContext = context.getData();
  logger.debug(`Transform context: ${JSON.stringify(exprContext, null, 2)}`);
  
  const output = await evaluateJsonata(node.transform.expr, exprContext);
  const endTime = Date.now();
  
  logger.debug(`Transform output: ${JSON.stringify(output, null, 2)}`);

  context.setNodeOutput(node.id, output);
  context.addHistory(node.id, "transform", exprContext, output, startTime, endTime);

  return {
    output,
    nextNode: node.next,
  };
}

