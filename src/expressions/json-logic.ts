/**
 * JSON Logic expression evaluation
 */

// @ts-ignore - json-logic-js doesn't have type definitions
import jsonLogic from "json-logic-js";
import { logger } from "../logger.js";

/**
 * Evaluate a JSON Logic rule with the given context data
 * @param rule - JSON Logic rule (can be any valid JSON Logic structure)
 * @param context - Context data object to evaluate the rule against
 * @returns Boolean result of the rule evaluation
 */
export function evaluateJsonLogic(
  rule: unknown,
  context: Record<string, unknown>
): boolean {
  try {
    logger.debug(`Evaluating JSON Logic rule: ${JSON.stringify(rule)}`);
    logger.debug(`Context keys: ${Object.keys(context).join(", ")}`);

    const result = jsonLogic.apply(rule, context);

    logger.debug(`JSON Logic result: ${result}`);

    // JSON Logic returns a boolean, but we'll ensure it's a boolean
    return Boolean(result);
  } catch (error) {
    logger.error(`JSON Logic evaluation error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(
      `Failed to evaluate JSON Logic rule: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

