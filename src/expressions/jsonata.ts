/**
 * JSONata expression evaluation
 */

import jsonata from "jsonata";
import { logger } from "../logger.js";
import type { NodeExecutionRecord } from "../types/execution.js";
import { registerHistoryFunctions } from "./jsonata-extensions.js";

/**
 * Validate JSONata expression syntax without evaluating it
 * @param expression - JSONata expression string to validate
 * @throws Error if syntax is invalid
 */
export function validateJsonataSyntax(expression: string): void {
  try {
    jsonata(expression);
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
    
    throw new Error(`Invalid JSONata syntax: ${errorMessage}`);
  }
}

export async function evaluateJsonata(
  expression: string,
  context: Record<string, unknown>,
  history: NodeExecutionRecord[],
  currentIndex: number
): Promise<unknown> {
  try {
    const expr = jsonata(expression);
    
    // Register history access functions
    registerHistoryFunctions(expr, history, currentIndex);
    
    const result = await expr.evaluate(context);
    
    // Log for debugging
    logger.debug(`JSONata expression: ${expression}`);
    logger.debug(`JSONata context keys: ${Object.keys(context).join(", ")}`);
    if (typeof context.list_directory_node === "string") {
      logger.debug(`list_directory_node value (first 100 chars): ${(context.list_directory_node as string).substring(0, 100)}`);
      logger.debug(`list_directory_node has actual newlines: ${(context.list_directory_node as string).includes("\n")}`);
    }
    logger.debug(`JSONata result: ${JSON.stringify(result)}`);
    
    return result;
  } catch (error) {
    // Extract detailed error message
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message || error.toString();
      // If message is still unhelpful, try to get more details
      if (errorMessage === '[object Object]' || !errorMessage) {
        errorMessage = error.toString();
        // Try to get stack trace or other properties
        if (error.stack) {
          errorMessage = error.stack.split('\n')[0] || errorMessage;
        }
      }
    } else if (error && typeof error === 'object') {
      // Try to extract meaningful information from error object
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message && typeof errorObj.message === 'string') {
        errorMessage = errorObj.message;
      } else if (errorObj.code && typeof errorObj.code === 'string') {
        errorMessage = `Error code: ${errorObj.code}`;
      } else {
        errorMessage = JSON.stringify(error, null, 2);
      }
    } else {
      errorMessage = String(error);
    }
    
    logger.error(`JSONata evaluation error: ${errorMessage}`);
    logger.error(`Expression: ${expression}`);
    logger.error(`Context keys: ${Object.keys(context).join(', ')}`);
    logger.error(`Context: ${JSON.stringify(context, null, 2)}`);
    
    throw new Error(`JSONata evaluation failed: ${errorMessage}\nExpression: ${expression}`);
  }
}


