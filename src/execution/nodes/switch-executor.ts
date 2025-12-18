/**
 * Switch node executor
 */

import type { SwitchNode } from "../../types/config.js";
import type { ExecutionContext } from "../context.js";
import { evaluateJsonLogic } from "../../expressions/json-logic.js";
import { logger } from "../../logger.js";

export async function executeSwitchNode(
  node: SwitchNode,
  context: ExecutionContext
): Promise<{ output: unknown; nextNode: string }> {
  logger.debug(`Executing switch node: ${node.id}`);

  const exprContext = context.getData();

  // Evaluate conditions in order
  for (const condition of node.conditions) {
    // If no rule is specified, this is a default/fallback case
    if (condition.rule === undefined || condition.rule === null) {
      logger.debug(`Switch node ${node.id}: Using default/fallback target: ${condition.target}`);
      return {
        output: exprContext,
        nextNode: condition.target,
      };
    }

    // Evaluate the JSON Logic rule
    const ruleResult = evaluateJsonLogic(condition.rule, exprContext);

    if (ruleResult) {
      logger.debug(`Switch node ${node.id}: Condition matched, routing to: ${condition.target}`);
      return {
        output: exprContext,
        nextNode: condition.target,
      };
    }
  }

  // No conditions matched and no default case
  throw new Error(
    `Switch node ${node.id}: No conditions matched and no default case provided`
  );
}

