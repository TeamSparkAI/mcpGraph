/**
 * JSON Logic expression evaluation
 */

// @ts-ignore - json-logic-js doesn't have type definitions
import jsonLogic from "json-logic-js";
import jsonata from "jsonata";
import { logger } from "../logger.js";
import type { NodeExecutionRecord } from "../types/execution.js";
import { registerHistoryFunctions } from "./jsonata-extensions.js";
import { validateJsonataSyntax } from "./jsonata.js";

/**
 * Evaluate a JSON Logic rule with the given context data
 * @param rule - JSON Logic rule (can be any valid JSON Logic structure)
 * @param context - Context data object to evaluate the rule against
 * @param history - Execution history for history functions
 * @param currentIndex - Current execution index for history functions
 * @returns Boolean result of the rule evaluation
 */
export async function evaluateJsonLogic(
  rule: unknown,
  context: Record<string, unknown>,
  history: NodeExecutionRecord[],
  currentIndex: number
): Promise<boolean> {
  try {
    logger.debug(`Evaluating JSON Logic rule: ${JSON.stringify(rule)}`);
    logger.debug(`Context keys: ${Object.keys(context).join(", ")}`);

    // Pre-process the rule: replace all var operations with their JSONata-evaluated values
    const processedRule = await preprocessJsonLogicRule(rule, context, history, currentIndex);

    // Now apply the processed rule (all var operations have been replaced with values)
    const result = jsonLogic.apply(processedRule, context);

    logger.debug(`JSON Logic result: ${result}`);

    // JSON Logic returns a boolean, but we'll ensure it's a boolean
    return Boolean(result);
  } catch (error) {
    // Extract detailed error message
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message || error.toString();
      if (errorMessage === '[object Object]' || !errorMessage) {
        errorMessage = error.toString();
        if (error.stack) {
          errorMessage = error.stack.split('\n')[0] || errorMessage;
        }
      }
    } else if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message && typeof errorObj.message === 'string') {
        errorMessage = errorObj.message;
      } else {
        errorMessage = JSON.stringify(error, null, 2);
      }
    } else {
      errorMessage = String(error);
    }
    
    logger.error(`JSON Logic evaluation error: ${errorMessage}`);
    logger.error(`Rule: ${JSON.stringify(rule, null, 2)}`);
    logger.error(`Context keys: ${Object.keys(context).join(', ')}`);
    
    throw new Error(`JSON Logic evaluation failed: ${errorMessage}\nRule: ${JSON.stringify(rule, null, 2)}`);
  }
}

/**
 * Recursively pre-process JSON Logic rule, replacing var operations with JSONata-evaluated values
 */
async function preprocessJsonLogicRule(
  rule: unknown,
  context: Record<string, unknown>,
  history: NodeExecutionRecord[],
  currentIndex: number
): Promise<unknown> {
  // If rule is a var operation, evaluate it with JSONata and return the value
  if (typeof rule === "object" && rule !== null && "var" in rule && Object.keys(rule).length === 1) {
    const path = (rule as { var: string }).var;
    
    logger.debug(`Evaluating var operation: "${path}" as JSONata expression`);
    
    try {
      const expr = jsonata(path);
      
      // Register history access functions
      registerHistoryFunctions(expr, history, currentIndex);
      
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
    return Promise.all(rule.map(item => preprocessJsonLogicRule(item, context, history, currentIndex)));
  }
  
  // If rule is an object, recursively process each property
  if (typeof rule === "object" && rule !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rule)) {
      result[key] = await preprocessJsonLogicRule(value, context, history, currentIndex);
    }
    return result;
  }
  
  // Primitive value, return as-is
  return rule;
}

/**
 * Validate JSON Logic rule syntax without evaluating it
 * Validates rule structure and any JSONata expressions in var operations
 * @param rule - JSON Logic rule to validate
 * @throws Error if syntax is invalid
 */
export function validateJsonLogicSyntax(rule: unknown): void {
  try {
    validateJsonLogicRuleRecursive(rule);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Invalid JSON Logic syntax: ${String(error)}`);
  }
}

/**
 * Recursively validate JSON Logic rule structure and JSONata in var operations
 */
function validateJsonLogicRuleRecursive(rule: unknown): void {
  // If rule is a var operation, validate the JSONata expression
  if (typeof rule === "object" && rule !== null && "var" in rule && Object.keys(rule).length === 1) {
    const path = (rule as { var: string }).var;
    
    if (typeof path !== "string") {
      throw new Error(`JSON Logic var operation must have a string value, got ${typeof path}`);
    }
    
    // If the var value looks like a JSONata expression (starts with $), validate it
    if (path.startsWith("$")) {
      try {
        validateJsonataSyntax(path);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Invalid JSONata in JSON Logic var operation "${path}": ${error.message}`);
        }
        throw error;
      }
    }
    // If it's not a JSONata expression, it's just a path reference (valid)
    return;
  }
  
  // If rule is an array, recursively validate each element
  if (Array.isArray(rule)) {
    for (const item of rule) {
      validateJsonLogicRuleRecursive(item);
    }
    return;
  }
  
  // If rule is an object, recursively validate each property
  if (typeof rule === "object" && rule !== null) {
    for (const value of Object.values(rule)) {
      validateJsonLogicRuleRecursive(value);
    }
    return;
  }
  
  // Primitive values are valid
  // Note: We can't fully validate JSON Logic operators without context,
  // but we've validated the structure and any JSONata expressions
}


