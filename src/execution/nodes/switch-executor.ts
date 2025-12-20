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
    // If no rule is specified, this is a default/fallback case
    if (condition.rule === undefined || condition.rule === null) {
      logger.debug(`Switch node ${node.id}: Using default/fallback target: ${condition.target}`);
      const output = condition.target; // Output the target node ID
      context.addHistory(node.id, "switch", output, startTime, endTime);
      return {
        output,
        nextNode: condition.target,
      };
    }

    // Evaluate the JSON Logic rule (now uses JSONata for var operations)
    const ruleResult = await evaluateJsonLogic(condition.rule, exprContext, history, currentIndex);

    if (ruleResult) {
      logger.debug(`Switch node ${node.id}: Condition matched, routing to: ${condition.target}`);
      const output = condition.target; // Output the target node ID
      context.addHistory(node.id, "switch", output, startTime, endTime);
      return {
        output,
        nextNode: condition.target,
      };
    }
  }

  // No conditions matched and no default case
  const error = new Error(
    `Switch node ${node.id}: No conditions matched and no default case provided`
  );
  context.addHistory(node.id, "switch", null, startTime, endTime, error);
  throw error;
}

