/**
 * Switch node executor
 */

import type { SwitchNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { evaluateJsonLogic } from "../../expressions/json-logic.js";
import { logger } from "../../logger.js";

export async function executeSwitchNode(
  node: SwitchNode,
  context: ExecutionContext,
  startTime: number
): Promise<{ output: unknown; nextNode: string }> {
  logger.debug(`Executing switch node: ${node.id}`);

  const exprContext = context.getData();
  const history = context.getHistory();
  const currentIndex = history.length; // This will be the index after we add this execution
  const endTime = Date.now();

  // Evaluate conditions in order
  for (let i = 0; i < node.conditions.length; i++) {
    const condition = node.conditions[i];
    
    // Evaluate the JSON Logic rule (now uses JSONata for var operations)
    const ruleResult = await evaluateJsonLogic(condition.rule, exprContext, history, currentIndex);

    if (ruleResult) {
      logger.debug(`Switch node ${node.id}: Condition matched, routing to: ${condition.next}`);
      const output = condition.next; // Output the next node ID
      context.addHistory(node.id, "switch", output, startTime, endTime);
      return {
        output,
        nextNode: condition.next,
      };
    }
  }

  // No conditions matched - use default next node
  logger.debug(`Switch node ${node.id}: No conditions matched, using default next: ${node.next}`);
  const output = node.next; // Output the default next node ID
  context.addHistory(node.id, "switch", output, startTime, endTime);
  return {
    output,
    nextNode: node.next,
  };
}

