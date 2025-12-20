/**
 * JSON Logic expression evaluation
 */

// @ts-ignore - json-logic-js doesn't have type definitions
import jsonLogic from "json-logic-js";
import jsonata from "jsonata";
import { logger } from "../logger.js";

/**
 * Evaluate a JSON Logic rule with the given context data
 * @param rule - JSON Logic rule (can be any valid JSON Logic structure)
 * @param context - Context data object to evaluate the rule against
 * @param previousNodeId - Optional previous node ID for $previousNode() support
 * @returns Boolean result of the rule evaluation
 */
export async function evaluateJsonLogic(
  rule: unknown,
  context: Record<string, unknown>,
  previousNodeId?: string | null
): Promise<boolean> {
  try {
    logger.debug(`Evaluating JSON Logic rule: ${JSON.stringify(rule)}`);
    logger.debug(`Context keys: ${Object.keys(context).join(", ")}`);

    // Pre-process the rule: replace all var operations with their JSONata-evaluated values
    const processedRule = await preprocessJsonLogicRule(rule, context, previousNodeId);

    // Now apply the processed rule (all var operations have been replaced with values)
    const result = jsonLogic.apply(processedRule, context);

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

/**
 * Recursively pre-process JSON Logic rule, replacing var operations with JSONata-evaluated values
 */
async function preprocessJsonLogicRule(
  rule: unknown,
  context: Record<string, unknown>,
  previousNodeId?: string | null
): Promise<unknown> {
  // If rule is a var operation, evaluate it with JSONata and return the value
  if (typeof rule === "object" && rule !== null && "var" in rule && Object.keys(rule).length === 1) {
    const path = (rule as { var: string }).var;
    
    logger.debug(`Evaluating var operation: "${path}" as JSONata expression`);
    
    try {
      const expr = jsonata(path);
      
      // Register $previousNode() function if previousNodeId is provided
      if (previousNodeId) {
        expr.registerFunction(
          "previousNode",
          () => {
            const previousOutput = context[previousNodeId];
            logger.debug(`$previousNode() returning output from node: ${previousNodeId}`);
            return previousOutput !== undefined ? previousOutput : null;
          },
          "<:o>"
        );
      }
      
      const result = await expr.evaluate(context);
      logger.debug(`JSONata evaluation result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      logger.error(`JSONata evaluation error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  // If rule is an array, recursively process each element
  if (Array.isArray(rule)) {
    return Promise.all(rule.map(item => preprocessJsonLogicRule(item, context, previousNodeId)));
  }
  
  // If rule is an object, recursively process each property
  if (typeof rule === "object" && rule !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rule)) {
      result[key] = await preprocessJsonLogicRule(value, context, previousNodeId);
    }
    return result;
  }
  
  // Primitive value, return as-is
  return rule;
}

