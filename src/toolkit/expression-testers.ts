/**
 * Expression testers for JSONata and JSON Logic
 * 
 * Provides functionality to test expressions with context
 */

import { evaluateJsonata, validateJsonataSyntax } from '../expressions/jsonata.js';
import { evaluateJsonLogic } from '../expressions/json-logic.js';
import { logger } from '../logger.js';

export interface ExpressionTestResult {
  result: unknown;
  error?: {
    message: string;
    details?: unknown;
  };
}

/**
 * Test a JSONata expression with context
 */
export async function testJSONata(
  expression: string,
  context: Record<string, unknown>
): Promise<ExpressionTestResult> {
  try {
    // Validate syntax first
    validateJsonataSyntax(expression);

    // Evaluate with context (no history needed for testing)
    const result = await evaluateJsonata(expression, context, [], 0);

    return { result };
  } catch (error) {
    return {
      result: null,
      error: {
        message: error instanceof Error ? error.message : String(error),
        details: error,
      },
    };
  }
}

/**
 * Test a JSON Logic expression with context
 */
export async function testJSONLogic(
  expression: unknown,
  context: Record<string, unknown>
): Promise<ExpressionTestResult> {
  try {
    // Evaluate JSON Logic with context (no history needed for testing)
    const result = await evaluateJsonLogic(expression, context, [], 0);

    return { result };
  } catch (error) {
    return {
      result: null,
      error: {
        message: error instanceof Error ? error.message : String(error),
        details: error,
      },
    };
  }
}

